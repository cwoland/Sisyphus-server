import { pool } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { getWorkoutWithSets } from './workouts.service.js';
import { planExerciseChange } from './exercise-change.js';

export async function changeActiveExercise(workoutId, userId, { requestId, ...action }) {
  const client = await pool.connect();
  const sql = client.query.bind(client);
  try {
    await sql('BEGIN');
    await sql('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);
    const workout = await getWorkoutWithSets(workoutId, userId, sql);
    const payload = JSON.stringify(action);
    const { rows: previous } = await sql(
      'SELECT payload = $3::jsonb AS matches FROM workout_exercise_changes WHERE workout_id = $1 AND request_id = $2',
      [workoutId, requestId, payload]
    );
    if (previous.length) {
      if (!previous[0].matches) throw new ApiError(409, 'Это действие уже использовано');
      await sql('COMMIT');
      return workout;
    }
    if (workout.status !== 'in_progress') throw new ApiError(409, 'Тренировка должна быть активной');
    const { anchorId, exerciseId, replacementId } = action;
    let changes;
    try {
      changes = planExerciseChange(workout.sets, anchorId, exerciseId, replacementId);
    } catch (error) {
      throw new ApiError(409, error.message);
    }
    if (replacementId) {
      const { rows } = await sql(
        'SELECT id FROM exercises WHERE id = $1 AND (created_by IS NULL OR created_by = $2)',
        [replacementId, userId]
      );
      if (!rows.length) throw new ApiError(404, 'Упражнение для замены недоступно');
      await sql(`UPDATE workout_sets SET original_exercise_id = coalesce(original_exercise_id, exercise_id),
        exercise_id = $2, weight = NULL, reps = NULL, rpe = NULL, duration_sec = NULL, target_reps = NULL
        WHERE workout_id = $1 AND id = ANY($3::uuid[])`, [workoutId, replacementId, changes.replace]);
    }
    if (changes.skip.length) {
      await sql('UPDATE workout_sets SET is_skipped = true WHERE workout_id = $1 AND id = ANY($2::uuid[])',
        [workoutId, changes.skip]);
    }
    await sql('INSERT INTO workout_exercise_changes (workout_id, request_id, payload) VALUES ($1, $2, $3)',
      [workoutId, requestId, payload]);
    const updated = await getWorkoutWithSets(workoutId, userId, sql);
    await sql('COMMIT');
    return updated;
  } catch (error) {
    await sql('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
