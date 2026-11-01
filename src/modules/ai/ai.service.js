import axios from 'axios';
import { query, pool } from '../../config/db.js';
import { env } from '../../config/env.js';
import { ApiError } from '../../utils/apiError.js';

const openRouterClient = axios.create({
  baseURL: 'https://openrouter.ai/api/v1',
  timeout: 75_000,
  headers: {
    Authorization: `Bearer ${env.openRouterApiKey}`,
    'Content-Type': 'application/json',
  },
});

const buildSystemPrompt = async (contextType, contextId, userId, execute = query) => {
  const base = 'Ты — ассистент фитнес-приложения Sisyphus. Отвечай кратко, по делу, на русском языке, если пользователь не пишет на другом.';

  if (contextType === 'free') {
    return base;
  }

  if (['program', 'workout'].includes(contextType) && !contextId) {
    throw new ApiError(400, 'Выберите программу или тренировку для контекста');
  }

  if (contextType === 'program') {
    const { rows } = await execute(
      `SELECT p.title, p.description,
         json_agg(json_build_object('title', pd.title, 'day_index', pd.day_index,
           'exercises', (SELECT json_agg(json_build_object('name', e.name,
             'sets', pe.target_sets, 'reps', pe.target_reps, 'group', pe.group_index)
             ORDER BY pe.order_index)
             FROM program_exercises pe JOIN exercises e ON e.id = pe.exercise_id
             WHERE pe.program_day_id = pd.id)) ORDER BY pd.day_index)
           FILTER (WHERE pd.id IS NOT NULL) AS days
       FROM programs p
       LEFT JOIN program_days pd ON pd.program_id = p.id
       WHERE p.id = $1 AND p.owner_id = $2
       GROUP BY p.id`,
      [contextId, userId]
    );
    const program = rows[0];
    if (!program) throw new ApiError(404, 'Программа не найдена');

    return `${base}\n\nКонтекст — программа тренировок пользователя: "${program.title}". Описание: ${program.description || 'нет'}. Дни программы: ${JSON.stringify(program.days)}. Отвечай на вопросы именно про эту программу.`;
  }

  if (contextType === 'workout') {
    const { rows } = await execute(
      `SELECT w.title, w.date, w.status,
         json_agg(json_build_object('exercise', e.name, 'weight', ws.weight, 'reps', ws.reps)) AS sets
       FROM workouts w
       LEFT JOIN workout_sets ws ON ws.workout_id = w.id
       LEFT JOIN exercises e ON e.id = ws.exercise_id
       WHERE w.id = $1 AND w.user_id = $2
       GROUP BY w.id`,
      [contextId, userId]
    );
    const workout = rows[0];
    if (!workout) throw new ApiError(404, 'Тренировка не найдена');

    return `${base}\n\nКонтекст — тренировка "${workout.title}" от ${workout.date}, статус: ${workout.status}. Сеты: ${JSON.stringify(workout.sets)}. Помогай анализировать прогресс и технику.`;
  }

  if (contextType === 'nutrition') {
    const { rows } = await execute(
      `SELECT date, meal_type, name, calories, protein, fat, carbs
       FROM nutrition_entries
       WHERE user_id = $1 AND date >= CURRENT_DATE - INTERVAL '7 days'
       ORDER BY date DESC`,
      [userId]
    );

    return `${base}\n\nКонтекст — дневник питания пользователя за последние 7 дней: ${JSON.stringify(rows)}. Помогай анализировать рацион и давай рекомендации.`;
  }

  return base;
};

export const createConversation = async (userId, { contextType, contextId, title }) => {
  if (['program', 'workout'].includes(contextType)) await buildSystemPrompt(contextType, contextId, userId);
  const { rows } = await query(
    `INSERT INTO ai_conversations (user_id, context_type, context_id, title)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, contextType || 'free', contextId || null, title || null]
  );
  return rows[0];
};

export const listConversations = async (userId) => {
  const { rows } = await query(
    `SELECT * FROM ai_conversations WHERE user_id = $1 ORDER BY created_at DESC`,
    [userId]
  );
  return rows;
};

export const getConversationMessages = async (conversationId, userId) => {
  const { rows: convRows } = await query(
    `SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2`,
    [conversationId, userId]
  );
  if (!convRows.length) throw new ApiError(404, 'Диалог не найден');

  const { rows: messages } = await query(
    `SELECT * FROM ai_messages WHERE conversation_id = $1 ORDER BY created_at ASC`,
    [conversationId]
  );
  return { conversation: convRows[0], messages };
};

export const sendMessageToAI = async (conversationId, userId, userMessage) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      'SELECT * FROM ai_conversations WHERE id = $1 AND user_id = $2 FOR UPDATE', [conversationId, userId]);
    const conversation = rows[0];
    if (!conversation) throw new ApiError(404, 'Диалог не найден');
    const systemPrompt = await buildSystemPrompt(conversation.context_type, conversation.context_id,
      userId, client.query.bind(client));
    const { rows: history } = await client.query(
      `SELECT role, content FROM (
         SELECT role, content, created_at, id FROM ai_messages WHERE conversation_id = $1
         ORDER BY created_at DESC, id DESC LIMIT 20
       ) recent ORDER BY created_at ASC, id ASC`, [conversationId]);
    let aiResponseText;
    try {
      const { data } = await openRouterClient.post('/chat/completions', {
        model: env.openRouterModel,
        messages: [{ role: 'system', content: systemPrompt }, ...history,
          { role: 'user', content: userMessage }],
      });
      aiResponseText = data.choices?.[0]?.message?.content;
      if (typeof aiResponseText !== 'string' || !aiResponseText.trim()) throw new Error('Empty response');
    } catch (error) {
      console.error('OpenRouter error:', error.message);
      throw new ApiError(502, 'Ошибка при обращении к AI-сервису');
    }
    // Save the pair only after a successful response. Failed retries leave no orphan questions.
    await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content, created_at)
       VALUES ($1, 'user', $2, clock_timestamp())`, [conversationId, userMessage]);
    const { rows: saved } = await client.query(
      `INSERT INTO ai_messages (conversation_id, role, content, created_at)
       VALUES ($1, 'assistant', $2, clock_timestamp()) RETURNING *`, [conversationId, aiResponseText]);
    await client.query('COMMIT');
    return saved[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
};

export const deleteConversation = async (conversationId, userId) => {
  const { rows } = await query(
    `DELETE FROM ai_conversations WHERE id = $1 AND user_id = $2 RETURNING id`,
    [conversationId, userId]
  );
  if (!rows.length) throw new ApiError(404, 'Диалог не найден');
};