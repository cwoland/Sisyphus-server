import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export const listPersonalRecords = async (userId) => {
  const { rows } = await query(
    `SELECT pr.*, e.name AS exercise_name, e.muscle_group
       FROM personal_records pr
       JOIN exercises e ON e.id = pr.exercise_id
      WHERE pr.user_id = $1
      ORDER BY pr.updated_at DESC`,
    [userId]
  );
  return rows;
};

export const getExerciseHistory = async (userId, exerciseId, { limit = 200 } = {}) => {
  const { rows: exerciseRows } = await query(
    `SELECT id, name, muscle_group, equipment FROM exercises e WHERE id = $1
        AND (e.created_by IS NULL OR e.created_by = $2 OR EXISTS (
          SELECT 1 FROM workout_sets s JOIN workouts w ON w.id = s.workout_id
          WHERE s.exercise_id = e.id AND w.user_id = $2
        ))`,
    [exerciseId, userId]
  );
  const exercise = exerciseRows[0];
  if (!exercise) throw new ApiError(404, 'Упражнение не найдено');

  const { rows: sets } = await query(
    `SELECT ws.id, ws.weight, ws.reps, ws.rpe, ws.duration_sec, ws.set_kind, ws.order_index,
            w.id AS workout_id, w.date, w.title AS workout_title
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
      WHERE w.user_id = $1
        AND w.status IN ('completed', 'in_progress')
        AND ws.exercise_id = $2
        AND ws.is_completed = true
        AND (ws.reps IS NOT NULL OR ws.duration_sec IS NOT NULL)
      ORDER BY w.date DESC, ws.order_index ASC
      LIMIT $3`,
    [userId, exerciseId, limit]
  );

  const { rows: recordRows } = await query(
    `SELECT one_rm, weight, reps, achieved_at
       FROM personal_records
      WHERE user_id = $1 AND exercise_id = $2`,
    [userId, exerciseId]
  );

  return { exercise, sets, record: recordRows[0] || null };
};
