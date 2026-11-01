import { randomUUID } from 'node:crypto';

export const defaultSetPlan = () => ({
  mode: 'normal',
  restSec: 120,
  steps: [],
});

// Построение плана без записи в БД и зависимости от часового пояса.
export const buildPlannedSets = (exercises) => {
  const groups = new Map();

  for (const ex of exercises) {
    const key = ex.group_index ?? ex.order_index;

    if (!groups.has(key)) groups.set(key, []);

    groups.get(key).push(ex);
  }

  const result = [];

  [...groups.entries()].forEach(
    ([groupIndex, members], groupOrdinal) => {
      const rounds = Math.max(
        ...members.map((ex) => ex.target_sets)
      );

      for (let round = 0; round < rounds; round++) {
        const active = members.filter(
          (ex) => round < ex.target_sets
        );

        active.forEach((ex, slot) => {
          const plan = ex.set_plan || defaultSetPlan();
          const steps = plan.mode === 'drop'
            ? plan.steps
            : [null];

          const parentId = randomUUID();

          steps.forEach((step, index) => {
            const lastExercise = slot === active.length - 1;
            const lastStep = index === steps.length - 1;

            result.push({
              id: index === 0 ? parentId : randomUUID(),
              exerciseId: ex.exercise_id,
              orderIndex:
                groupOrdinal * 100000 +
                round * 1000 +
                slot * 100 +
                index,
              groupIndex,
              roundIndex: round,
              weight: step?.weight ?? null,
              reps: step?.reps ?? null,
              targetReps: step
                ? String(step.reps)
                : ex.target_reps,
              kind: index === 0 ? 'normal' : 'drop',
              parentId: index === 0 ? null : parentId,
              restAfterSec:
                lastExercise && lastStep
                  ? plan.restSec
                  : 0,
            });
          });
        });
      }
    }
  );

  return result;
};

export const materializeSetsFromProgramDay = async (
  client,
  workoutId,
  programDayId
) => {
  const { rows } = await client.query(
    `
      SELECT *
      FROM program_exercises
      WHERE program_day_id = $1
      ORDER BY order_index, id
    `,
    [programDayId]
  );

  const sets = buildPlannedSets(rows);

  if (!sets.length) return 0;

  await client.query(
    `
      INSERT INTO workout_sets (
        id,
        workout_id,
        exercise_id,
        order_index,
        group_index,
        round_index,
        weight,
        reps,
        set_kind,
        parent_set_id,
        rest_after_sec,
        target_reps
      )
      SELECT
        id,
        $1,
        "exerciseId",
        "orderIndex",
        "groupIndex",
        "roundIndex",
        weight,
        reps,
        kind,
        "parentId",
        "restAfterSec",
        "targetReps"
      FROM jsonb_to_recordset($2::jsonb) AS s(
        id uuid,
        "exerciseId" uuid,
        "orderIndex" integer,
        "groupIndex" integer,
        "roundIndex" integer,
        weight numeric,
        reps integer,
        kind text,
        "parentId" uuid,
        "restAfterSec" integer,
        "targetReps" text
      )
      ORDER BY "orderIndex"
    `,
    [workoutId, JSON.stringify(sets)]
  );

  return sets.length;
};