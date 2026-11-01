import { query, pool } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { estimateOneRepMax } from '../../utils/oneRepMax.js';

export const listWorkouts = async (userId, { from, to }) => {
  const conditions = ['user_id = $1'];
  const params = [userId];

  if (from) {
    params.push(from);
    conditions.push(`date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`date <= $${params.length}`);
  }

  const { rows } = await query(
    `SELECT * FROM workouts WHERE ${conditions.join(' AND ')} ORDER BY date ASC`,
    params
  );
  return rows;
};

export const getWorkoutWithSets = async (workoutId, userId, execute = query) => {
  const { rows: workoutRows } = await execute(
    `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
    [workoutId, userId]
  );
  const workout = workoutRows[0];
  if (!workout) throw new ApiError(404, 'Тренировка не найдена');

  const { rows: sets } = await execute(
    `SELECT ws.*, e.name AS exercise_name, e.muscle_group, e.tracking
     FROM workout_sets ws
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.workout_id = $1
     ORDER BY ws.order_index ASC, ws.exercise_id, ws.created_at, ws.id`,
    [workoutId]
  );

  return { ...workout, sets };
};

export const createWorkout = async ({ userId, title, date, notes, clientId }) => {
  const { rows } = await query(
    `INSERT INTO workouts (user_id, title, date, notes, id)
     VALUES ($1, $2, $3, $4, COALESCE($5::uuid, gen_random_uuid()))
     ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
       WHERE workouts.user_id = EXCLUDED.user_id
     RETURNING *`,
    [userId, title, date, notes ?? null, clientId ?? null]
  );
  if (!rows.length) throw new ApiError(409, 'Идентификатор тренировки уже используется');
  return rows[0];
};

const materializeSetsFromProgramDay = async (client, workoutId, programDayId) => {
  const { rows } = await client.query(
    `WITH pe AS (
       SELECT exercise_id, group_index, order_index, target_sets,
              row_number() OVER (PARTITION BY group_index ORDER BY order_index) - 1 AS slot
         FROM program_exercises
        WHERE program_day_id = $2
     ),
     grouped AS (
       SELECT group_index, min(order_index) AS group_order, max(target_sets) AS rounds
         FROM pe
        GROUP BY group_index
     ),
     ordered AS (
       SELECT group_index, rounds,
              dense_rank() OVER (ORDER BY group_order) - 1 AS group_ordinal
         FROM grouped
     ),
     slots AS (
       SELECT pe.exercise_id, pe.group_index, pe.slot,
              o.group_ordinal, r.round AS round_index
         FROM pe
         JOIN ordered o ON o.group_index = pe.group_index
         CROSS JOIN LATERAL generate_series(0, o.rounds - 1) AS r(round)
        WHERE r.round < pe.target_sets
     )
     INSERT INTO workout_sets (workout_id, exercise_id, order_index, group_index, round_index)
     SELECT $1, exercise_id,
            group_ordinal * 10000 + round_index * 100 + slot,
            group_index, round_index
       FROM slots
      ORDER BY group_ordinal, round_index, slot
     RETURNING id`,
    [workoutId, programDayId]
  );
  return rows.length;
};

const prefillSetsFromHistory = async (client, workoutId, userId) => {
  await client.query(
    `UPDATE workout_sets ws
        SET weight = lp.weight, reps = lp.reps, duration_sec = lp.duration_sec
       FROM (
         SELECT DISTINCT ON (s.exercise_id)
                s.exercise_id, s.weight, s.reps, s.duration_sec
           FROM workout_sets s
           JOIN workouts w ON w.id = s.workout_id
          WHERE w.user_id = $2
            AND w.id <> $1
            AND w.status = 'completed' AND s.is_completed = true
            AND (s.reps IS NOT NULL OR s.duration_sec IS NOT NULL)
          ORDER BY s.exercise_id, w.date DESC, s.order_index DESC
       ) lp
      WHERE ws.workout_id = $1
        AND ws.exercise_id = lp.exercise_id
        AND ws.weight IS NULL
        AND ws.reps IS NULL
        AND ws.duration_sec IS NULL`,
    [workoutId, userId]
  );
};

export const startWorkout = async (workoutId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

    const { rows: wRows } = await client.query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2 FOR UPDATE`,
      [workoutId, userId]
    );
    const workout = wRows[0];
    if (!workout) throw new ApiError(404, 'Тренировка не найдена');
    if (workout.status === 'completed') throw new ApiError(400, 'Тренировка уже завершена');
    const { rows: active } = await client.query(
      `SELECT id FROM workouts WHERE user_id = $1 AND status = 'in_progress' AND id <> $2`,
      [userId, workoutId]
    );
    if (active.length) throw new ApiError(409, 'Сначала завершите текущую тренировку');

    const { rows: existing } = await client.query(
      `SELECT 1 FROM workout_sets WHERE workout_id = $1 LIMIT 1`,
      [workoutId]
    );

    if (!existing.length && workout.program_day_id) {
      await materializeSetsFromProgramDay(client, workoutId, workout.program_day_id);
    }

    await prefillSetsFromHistory(client, workoutId, userId);

    await client.query(
      `UPDATE workouts SET status = 'in_progress', started_at = COALESCE(started_at, now()) WHERE id = $1`,
      [workoutId]
    );

    const result = await getWorkoutWithSets(workoutId, userId, client.query.bind(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const getActiveWorkout = async (userId) => {
  const { rows } = await query(
    `SELECT * FROM workouts WHERE user_id = $1 AND status = 'in_progress'
    ORDER BY date DESC LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
};

export const scheduleProgramToCalendar = async ({ userId, programId, startDate, weekdays, weeksCount }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

    const { rows: programRows } = await client.query(
      `SELECT * FROM programs WHERE id = $1 AND owner_id = $2`,
      [programId, userId]
    );
    if (!programRows.length) throw new ApiError(404, 'Программа не найдена');

    const { rows: days } = await client.query(
      `SELECT * FROM program_days WHERE program_id = $1 ORDER BY day_index ASC`,
      [programId]
    );
    if (!days.length) throw new ApiError(400, 'В программе нет дней для планирования');
    if (!weekdays?.length) throw new ApiError(400, 'Не выбраны тренировочные дни');

    await client.query(
      `DELETE FROM workouts
        WHERE user_id = $1
          AND program_day_id IN (SELECT id FROM program_days WHERE program_id = $2)
          AND status = 'planned'
          AND date >= $3`,
          [userId, programId, startDate]
    );

    const created = [];
    const totalDays = weeksCount * 7;
    const cursor = new Date(startDate);
    let dayPointer = 0;

    for (let i = 0; i < totalDays; i++) {
      if (weekdays.includes(cursor.getUTCDay())) {
        const programDay = days[dayPointer % days.length];
        const dateStr = cursor.toISOString().split('T')[0];

        const { rows } = await client.query(
          `INSERT INTO workouts (user_id, program_day_id, title, date, status)
           VALUES ($1, $2, $3, $4, 'planned')
           RETURNING *`,
          [userId, programDay.id, programDay.title, dateStr]
        );
        created.push(rows[0]);
        await materializeSetsFromProgramDay(client, rows[0].id, programDay.id);
        dayPointer++;
      }
      cursor.setUTCDate(cursor.getUTCDate() + 1);
    }

    await client.query('COMMIT');
    return created;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const syncWorkoutWithProgram = async (workoutId, userId) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

    const { rows: workoutRows } = await client.query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
      [workoutId, userId]
    );
    const workout = workoutRows[0];
    if (!workout) throw new ApiError(404, 'Тренировка не найдена');
    if (!workout.program_day_id) throw new ApiError(400, 'Тренировка не привязана к программе');

    if (workout.status !== 'planned') {
      throw new ApiError(400, 'Нельзя синхронизировать уже начатую или завершённую тренировку');
    }

    await client.query(`DELETE FROM workout_sets WHERE workout_id = $1`, [workoutId]);
    await materializeSetsFromProgramDay(client, workoutId, workout.program_day_id);
    const result = await getWorkoutWithSets(workoutId, userId, client.query.bind(client));
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

// Recompute from valid source sets, including decreases and removed achievements.
const recomputeRecords = async (client, userId) => {
  const { rows } = await client.query(
    `SELECT s.*, w.date FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
      WHERE w.user_id = $1 AND w.status IN ('completed', 'in_progress')
        AND s.is_completed = true AND s.weight > 0 AND s.reps > 0
      ORDER BY w.date ASC, s.created_at ASC, s.id ASC`, [userId]);
  const best = new Map();
  for (const set of rows) {
    const oneRm = Number(estimateOneRepMax(Number(set.weight), Number(set.reps)).toFixed(2));
    if (!best.has(set.exercise_id) || oneRm > best.get(set.exercise_id).oneRm) {
      best.set(set.exercise_id, { ...set, oneRm });
    }
  }
  await client.query(`DELETE FROM personal_records WHERE user_id = $1
    AND NOT (exercise_id = ANY($2::uuid[]))`, [userId, [...best.keys()]]);
  for (const [exerciseId, set] of best) {
    await client.query(
      `INSERT INTO personal_records (user_id, exercise_id, one_rm, weight, reps, workout_id, achieved_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, exercise_id) DO UPDATE SET
         one_rm = EXCLUDED.one_rm, weight = EXCLUDED.weight, reps = EXCLUDED.reps,
         workout_id = EXCLUDED.workout_id, achieved_at = EXCLUDED.achieved_at, updated_at = now()
       WHERE (personal_records.one_rm, personal_records.weight, personal_records.reps,
              personal_records.workout_id, personal_records.achieved_at)
         IS DISTINCT FROM (EXCLUDED.one_rm, EXCLUDED.weight, EXCLUDED.reps,
                           EXCLUDED.workout_id, EXCLUDED.achieved_at)`,
      [userId, exerciseId, set.oneRm, set.weight, set.reps, set.workout_id, set.date]);
  }
  return best;
};

export const updateWorkout = async (workoutId, userId, { title, date, notes }) => {
  const fields = [];
  const params = [];
  if (title !== undefined) { params.push(title); fields.push(`title = $${params.length}`); }
  if (date !== undefined)  { params.push(date);  fields.push(`date = $${params.length}`); }
  if (notes !== undefined) { params.push(notes); fields.push(`notes = $${params.length}`); }
  if (!fields.length) throw new ApiError(400, 'Нет полей для обновления');

  params.push(workoutId, userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
  const { rows } = await client.query(
    `UPDATE workouts SET ${fields.join(', ')}
     WHERE id = $${params.length - 1} AND user_id = $${params.length}
     RETURNING *`,
    params
  );
  if (!rows.length) throw new ApiError(404, 'Тренировка не найдена');
  await recomputeRecords(client, userId);
  await client.query('COMMIT');
  return rows[0];
  } catch (error) {
    await client.query('ROLLBACK'); throw error;
  } finally { client.release(); }
};

export const updateWorkoutStatus = async (workoutId, userId, status) => {
  if (status === 'in_progress') return startWorkout(workoutId, userId);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

    const { rows } = await client.query(
      `UPDATE workouts SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
      [status, workoutId, userId]
    );
    if (!rows.length) throw new ApiError(404, 'Тренировка не найдена');
    const workout = rows[0];

    await recomputeRecords(client, userId);

    await client.query('COMMIT');
    return workout;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const deleteWorkout = async (workoutId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const { rows } = await client.query(
      `DELETE FROM workouts WHERE id = $1 AND user_id = $2 RETURNING id`, [workoutId, userId]);
    if (!rows.length) throw new ApiError(404, 'Тренировка не найдена');
    await recomputeRecords(client, userId);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};

export const upsertWorkoutSet = async ({ workoutId, userId, setId, exerciseId, weight, reps, rpe, durationSec, isCompleted, orderIndex, setKind, parentSetId, clientId }) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

    const { rows: workoutRows } = await client.query(
      `SELECT id, date FROM workouts WHERE id = $1 AND user_id = $2`,
      [workoutId, userId]
    );
    const workout = workoutRows[0];
    if (!workout) throw new ApiError(404, 'Тренировка не найдена');

    const { rows: previousRecords } = await client.query(
      'SELECT exercise_id, one_rm FROM personal_records WHERE user_id = $1', [userId]);
    let set;

    if (setId) {
      const fields = [];
      const params = [];

      const put = (column, value) => {
        if (value === undefined) return;
        params.push(value);
        fields.push(`${column} = $${params.length}`);
      };

      put('weight', weight);
      put('reps', reps);
      put('rpe', rpe);
      put('duration_sec', durationSec);
      put('is_completed', isCompleted);

      if (!fields.length) throw new ApiError(400, 'Нет полей для обновления');

      params.push(setId, workoutId);

      const { rows } = await client.query(
        `UPDATE workout_sets SET ${fields.join(', ')}
          WHERE id = $${params.length - 1} AND workout_id = $${params.length}
          RETURNING *`,
        params
      );

      if (!rows.length) throw new ApiError(404, 'Сет не найден');
      set = rows[0];
    } else {
      let parent = null;

      if (parentSetId) {
        const { rows: parentRows } = await client.query(
          `SELECT id, exercise_id, order_index, group_index, round_index
             FROM workout_sets WHERE id = $1 AND workout_id = $2 AND set_kind = 'normal'`,
          [parentSetId, workoutId]
        );
        parent = parentRows[0];
        if (!parent) throw new ApiError(404, 'Основной подход не найден');
      }

      const { rows: positions } = await client.query(
        `SELECT COALESCE((SELECT group_index FROM workout_sets
              WHERE workout_id = $1 AND exercise_id = $2 AND set_kind = 'normal'
              ORDER BY order_index LIMIT 1),
             (SELECT COALESCE(max(group_index), -1) + 1 FROM workout_sets WHERE workout_id = $1)) AS group_index,
          (SELECT COALESCE(max(round_index), -1) + 1 FROM workout_sets
            WHERE workout_id = $1 AND exercise_id = $2 AND set_kind = 'normal') AS round_index`,
        [workoutId, parent ? parent.exercise_id : exerciseId]);
      const { rows } = await client.query(
        `INSERT INTO workout_sets
           (workout_id, exercise_id, order_index, weight, reps, rpe, duration_sec, is_completed,
            set_kind, parent_set_id, group_index, round_index, id)
         VALUES (
            $1, $2,
            COALESCE($3, (SELECT COALESCE(MAX(order_index), -1) + 1 FROM workout_sets WHERE workout_id = $1)),
            $4, $5, $6, $7, $8, $9, $10, $11, $12, COALESCE($13::uuid, gen_random_uuid()))
         ON CONFLICT (id) DO UPDATE SET id = EXCLUDED.id
           WHERE workout_sets.workout_id = EXCLUDED.workout_id
         RETURNING *`,
        [
          workoutId,
          parent ? parent.exercise_id : exerciseId,
          parent ? parent.order_index : orderIndex ?? null,
          weight ?? null,
          reps ?? null,
          rpe ?? null,
          durationSec ?? null,
          isCompleted ?? false,
          parent ? 'drop' : setKind ?? 'normal',
          parent ? parent.id : null,
          parent ? parent.group_index : positions[0].group_index,
          parent ? parent.round_index : positions[0].round_index,
          clientId ?? null,
        ]
      );
      if (!rows.length) throw new ApiError(409, 'Идентификатор подхода уже используется');
      set = rows[0];
    }

    const best = await recomputeRecords(client, userId);
    const previous = previousRecords.find((r) => r.exercise_id === set.exercise_id);
    const winner = best.get(set.exercise_id);
    const record = winner && winner.id === set.id && winner.oneRm > Number(previous?.one_rm ?? 0)
      ? { exerciseId: set.exercise_id, oneRm: winner.oneRm,
          previousOneRm: previous ? Number(previous.one_rm) : null,
          weight: Number(set.weight), reps: set.reps }
      : null;

    await client.query('COMMIT');
    return { set, record };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const deleteWorkoutSet = async (setId, workoutId, userId) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const { rows } = await client.query(
      'SELECT id FROM workouts WHERE id = $1 AND user_id = $2 FOR UPDATE', [workoutId, userId]);
    if (!rows.length) throw new ApiError(404, 'Тренировка не найдена');
    await client.query('DELETE FROM workout_sets WHERE id = $1 AND workout_id = $2', [setId, workoutId]);
    await recomputeRecords(client, userId);
    await client.query('COMMIT');
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
};
