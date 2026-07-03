import { query, pool } from '../../config/db.js';
import { apiError } from '../../utils/apiError.js';

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

export const getWorkoutWithSets = async (workoutId, userId) => {
  const { rows: workoutRows } = await query(
    `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
    [workoutId, userId]
  );
  const workout = workoutRows[0];
  if (!workout) throw new apiError(404, 'Тренировка не найдена');

  const { rows: sets } = await query(
    `SELECT ws.*, e.name AS exercise_name, e.muscle_group
     FROM workout_sets ws
     JOIN exercises e ON e.id = ws.exercise_id
     WHERE ws.workout_id = $1
     ORDER BY ws.order_index ASC`,
    [workoutId]
  );

  return { ...workout, sets };
};

export const createWorkout = async ({ userId, title, date, notes }) => {
  const { rows } = await query(
    `INSERT INTO workouts (user_id, title, date, notes)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [userId, title, date, notes ?? null]
  );
  return rows[0];
};

export const scheduleProgramToCalendar = async ({ userId, programId, startDate, cyclesCount }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: programRows } = await client.query(
      `SELECT * FROM programs WHERE id = $1 AND owner_id = $2`,
      [programId, userId]
    );
    if (!programRows.length) throw new apiError(404, 'Программа не найдена');

    const { rows: days } = await client.query(
      `SELECT * FROM program_days WHERE program_id = $1 ORDER BY day_index ASC`,
      [programId]
    );
    if (!days.length) throw new apiError(400, 'В программе нет дней для планирования');

    const createdWorkouts = [];
    let currentDate = new Date(startDate);

    for (let cycle = 0; cycle < cyclesCount; cycle++) {
      for (const day of days) {
        const dateStr = currentDate.toISOString().split('T')[0];

        const { rows: workoutRows } = await client.query(
          `INSERT INTO workouts (user_id, program_day_id, title, date, status)
           VALUES ($1, $2, $3, $4, 'planned')
           RETURNING *`,
          [userId, day.id, day.title, dateStr]
        );
        createdWorkouts.push(workoutRows[0]);

        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    await client.query('COMMIT');
    return createdWorkouts;
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

    const { rows: workoutRows } = await client.query(
      `SELECT * FROM workouts WHERE id = $1 AND user_id = $2`,
      [workoutId, userId]
    );
    const workout = workoutRows[0];
    if (!workout) throw new apiError(404, 'Тренировка не найдена');
    if (!workout.program_day_id) throw new apiError(400, 'Тренировка не привязана к программе');

    if (workout.status !== 'planned') {
      throw new apiError(400, 'Нельзя синхронизировать уже начатую или завершённую тренировку');
    }

    await client.query(`DELETE FROM workout_sets WHERE workout_id = $1`, [workoutId]);

    const { rows: templateExercises } = await client.query(
      `SELECT * FROM program_exercises WHERE program_day_id = $1 ORDER BY order_index ASC`,
      [workout.program_day_id]
    );

    for (const ex of templateExercises) {
      for (let setIndex = 0; setIndex < ex.target_sets; setIndex++) {
        await client.query(
          `INSERT INTO workout_sets (workout_id, exercise_id, order_index)
           VALUES ($1, $2, $3)`,
          [workoutId, ex.exercise_id, ex.order_index * 100 + setIndex]
        );
      }
    }

    await client.query('COMMIT');
    return getWorkoutWithSets(workoutId, userId);
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const updateWorkoutStatus = async (workoutId, userId, status) => {
  const { rows } = await query(
    `UPDATE workouts SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [status, workoutId, userId]
  );
  if (!rows.length) throw new apiError(404, 'Тренировка не найдена');
  return rows[0];
};

export const deleteWorkout = async (workoutId, userId) => {
  const { rows } = await query(
    `DELETE FROM workouts WHERE id = $1 AND user_id = $2 RETURNING id`,
    [workoutId, userId]
  );
  if (!rows.length) throw new apiError(404, 'Тренировка не найдена');
};

export const upsertWorkoutSet = async ({ workoutId, userId, setId, exerciseId, weight, reps, rpe, isCompleted, orderIndex }) => {
  const { rows: workoutRows } = await query(
    `SELECT id FROM workouts WHERE id = $1 AND user_id = $2`,
    [workoutId, userId]
  );
  if (!workoutRows.length) throw new apiError(404, 'Тренировка не найдена');

  if (setId) {
    const { rows } = await query(
      `UPDATE workout_sets
       SET weight = $1, reps = $2, rpe = $3, is_completed = $4
       WHERE id = $5 AND workout_id = $6
       RETURNING *`,
      [weight, reps, rpe, isCompleted, setId, workoutId]
    );
    if (!rows.length) throw new apiError(404, 'Сет не найден');
    return rows[0];
  }

  const { rows } = await query(
    `INSERT INTO workout_sets (workout_id, exercise_id, order_index, weight, reps, rpe, is_completed)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [workoutId, exerciseId, orderIndex ?? 0, weight, reps, rpe, isCompleted ?? false]
  );
  return rows[0];
};

export const deleteWorkoutSet = async (setId, workoutId, userId) => {
  const { rows: workoutRows } = await query(
    `SELECT id FROM workouts WHERE id = $1 AND user_id = $2`,
    [workoutId, userId]
  );
  if (!workoutRows.length) throw new apiError(404, 'Тренировка не найдена');

  await query(`DELETE FROM workout_sets WHERE id = $1 AND workout_id = $2`, [setId, workoutId]);
};