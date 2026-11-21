import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export const listExercises = async ({ muscleGroup, search, userId, sort }) => {
  const params = [userId];
  const conditions = ['(e.created_by IS NULL OR e.created_by = $1)'];
  if (muscleGroup) { params.push(muscleGroup); conditions.push(`e.muscle_group = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`e.name ILIKE $${params.length}`); }
  const ranked = sort === 'usage';
  const { rows } = await query(`SELECT e.*, n.technique AS personal_technique
    ${ranked ? ', COALESCE(u.usage_count, 0) AS usage_count' : ''}
    FROM exercises e LEFT JOIN exercise_technique_notes n ON n.exercise_id = e.id AND n.user_id = $1
    ${ranked ? `LEFT JOIN (
      SELECT exercise_id, count(*)::int AS usage_count FROM (
        SELECT DISTINCT pe.program_day_id, pe.exercise_id
        FROM programs p JOIN program_days d ON d.program_id = p.id
        JOIN program_exercises pe ON pe.program_day_id = d.id
        WHERE p.owner_id = $1
        UNION ALL
        SELECT DISTINCT w.id, s.exercise_id
        FROM workouts w JOIN workout_sets s ON s.workout_id = w.id
        WHERE w.user_id = $1 AND NOT s.is_skipped AND (s.is_completed OR NOT EXISTS (
          SELECT 1 FROM program_exercises template
          WHERE template.program_day_id = w.program_day_id AND template.exercise_id = s.exercise_id
        ))
      ) uses GROUP BY exercise_id
    ) u ON u.exercise_id = e.id` : ''}
    WHERE ${conditions.join(' AND ')} ORDER BY e.name ASC, e.id`, params);
  if (ranked) {
    const alphabet = new Intl.Collator('ru', { sensitivity: 'base' });
    rows.sort((a, b) => b.usage_count - a.usage_count ||
      alphabet.compare(a.name, b.name) || a.id.localeCompare(b.id));
  }
  return rows;
};

export const createExercise = async ({ name, muscleGroup, muscleDetail, equipment, tracking, userId }) => {
  const { rows } = await query(`INSERT INTO exercises (name, muscle_group, muscle_detail, equipment, tracking, created_by)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [name, muscleGroup, muscleDetail ?? null, equipment ?? null, tracking ?? 'weight_reps', userId]);
  return rows[0];
};

export const saveTechniqueNote = async (userId, exerciseId, technique) => {
  const { rows } = await query(`INSERT INTO exercise_technique_notes (user_id, exercise_id, technique)
    SELECT $1, e.id, $3 FROM exercises e WHERE e.id = $2 AND (e.created_by IS NULL OR e.created_by = $1)
    ON CONFLICT (user_id, exercise_id) DO UPDATE SET technique = EXCLUDED.technique, updated_at = now()
    RETURNING technique, updated_at`, [userId, exerciseId, technique]);
  if (!rows.length) throw new ApiError(404, 'Упражнение не найдено');
  return rows[0];
};
