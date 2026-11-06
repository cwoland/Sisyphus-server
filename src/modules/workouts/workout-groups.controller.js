import { z } from 'zod';
import { pool } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getWorkoutWithSets } from './workouts.service.js';

const schema = z.object({
  action: z.enum(['link', 'split']),
  firstExerciseId: z.string().uuid(),
  secondExerciseId: z.string().uuid(),
}).refine(
  (value) => value.firstExerciseId !== value.secondExerciseId,
  'Выберите два разных упражнения'
);

export const changeWorkoutGroup = asyncHandler(async (req, res) => {
  const {
    action,
    firstExerciseId,
    secondExerciseId,
  } = schema.parse(req.body);

  const workoutId = req.params.id;
  const userId = req.userId;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    await client.query(
      'SELECT id FROM users WHERE id = $1 FOR UPDATE',
      [userId]
    );

    const { rows: workoutRows } = await client.query(
      `
        SELECT id, status
        FROM workouts
        WHERE id = $1 AND user_id = $2
        FOR UPDATE
      `,
      [workoutId, userId]
    );

    const workout = workoutRows[0];

    if (!workout) {
      throw new ApiError(404, 'Тренировка не найдена');
    }

    if (workout.status !== 'planned') {
      throw new ApiError(
        409,
        'Связки можно менять только в запланированной тренировке'
      );
    }

    const { rows: sets } = await client.query(
      `
        SELECT
          id,
          exercise_id,
          set_kind,
          parent_set_id,
          group_index,
          round_index,
          order_index,
          rest_after_sec,
          created_at
        FROM workout_sets
        WHERE workout_id = $1
        ORDER BY order_index, created_at, id
        FOR UPDATE
      `,
      [workoutId]
    );

    const normalSets = sets.filter(
      (set) => set.set_kind === 'normal'
    );

    const exerciseIds = [];

    for (const set of normalSets) {
      if (!exerciseIds.includes(set.exercise_id)) {
        exerciseIds.push(set.exercise_id);
      }
    }

    const firstPosition = exerciseIds.indexOf(firstExerciseId);

    if (
      firstPosition < 0 ||
      exerciseIds[firstPosition + 1] !== secondExerciseId
    ) {
      throw new ApiError(
        400,
        'Можно связать или разделить только соседние упражнения'
      );
    }

    const firstSets = normalSets.filter(
      (set) => set.exercise_id === firstExerciseId
    );

    const secondSets = normalSets.filter(
      (set) => set.exercise_id === secondExerciseId
    );

    if (!firstSets.length || !secondSets.length) {
      throw new ApiError(
        400,
        'В каждом упражнении должен быть хотя бы один подход'
      );
    }

    const firstGroupIds = new Set(
      firstSets.map((set) => set.group_index)
    );
    const secondGroupIds = new Set(
      secondSets.map((set) => set.group_index)
    );

    if (firstGroupIds.size !== 1 || secondGroupIds.size !== 1) {
      throw new ApiError(
        409,
        'Подходы упражнения находятся в разных группах. Проверьте структуру тренировки'
      );
    }

    const firstGroup = firstSets[0].group_index;
    const secondGroup = secondSets[0].group_index;

    const membersOf = (groupIndex) =>
      new Set(
        normalSets
          .filter((set) => set.group_index === groupIndex)
          .map((set) => set.exercise_id)
      );

    const firstMembers = membersOf(firstGroup);
    const secondMembers = membersOf(secondGroup);

    if (action === 'link') {
      if (
        firstGroup === secondGroup ||
        firstMembers.size !== 1 ||
        secondMembers.size !== 1
      ) {
        throw new ApiError(
          409,
          'Для создания суперсета нужны два отдельных упражнения'
        );
      }

      if (firstSets.length !== secondSets.length) {
        throw new ApiError(
          400,
          'Для суперсета число подходов в упражнениях должно совпадать'
        );
      }
    } else {
      if (
        firstGroup !== secondGroup ||
        firstMembers.size !== 2 ||
        !firstMembers.has(firstExerciseId) ||
        !firstMembers.has(secondExerciseId)
      ) {
        throw new ApiError(
          409,
          'Выбранные упражнения не образуют отдельный суперсет из двух упражнений'
        );
      }
    }

    const maxGroup = sets.reduce(
      (max, set) => Math.max(max, Number(set.group_index) || 0),
      -1
    );

    const splitSecondGroup = maxGroup + 1;

    const plannedRest = [...secondSets, ...firstSets]
      .reverse()
      .find((set) => set.rest_after_sec != null)
      ?.rest_after_sec ?? 120;

    const updateExercise = async (
      exerciseSets,
      groupIndex,
      isFirstInSuperset
    ) => {
      for (
        let roundIndex = 0;
        roundIndex < exerciseSets.length;
        roundIndex += 1
      ) {
        const parent = exerciseSets[roundIndex];

        const restAfter =
          action === 'link' && isFirstInSuperset
            ? 0
            : plannedRest;

        await client.query(
          `
            UPDATE workout_sets
            SET
              group_index = $1,
              round_index = $2,
              rest_after_sec = CASE
                WHEN id = $3 THEN $4
                ELSE 0
              END
            WHERE workout_id = $5
              AND (id = $3 OR parent_set_id = $3)
          `,
          [
            groupIndex,
            roundIndex,
            parent.id,
            restAfter,
            workoutId,
          ]
        );
      }
    };

    if (action === 'link') {
      await updateExercise(firstSets, firstGroup, true);
      await updateExercise(secondSets, firstGroup, false);
    } else {
      await updateExercise(firstSets, firstGroup, false);
      await updateExercise(secondSets, splitSecondGroup, false);
    }

    const updatedWorkout = await getWorkoutWithSets(
      workoutId,
      userId,
      client.query.bind(client)
    );

    await client.query('COMMIT');

    res.json({ workout: updatedWorkout });
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
});