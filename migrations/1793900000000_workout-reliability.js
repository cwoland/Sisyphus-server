export const up = (pgm) => {
  pgm.sql(`
    ALTER TABLE personal_records ALTER COLUMN one_rm TYPE numeric(12,2);
    -- Retain the most recently started session. Earlier sessions keep their sets
    -- and remain available in the calendar for an explicit restart.
    WITH ranked AS (
      SELECT id, row_number() OVER (
        PARTITION BY user_id ORDER BY started_at DESC NULLS LAST, date DESC, id DESC
      ) AS n FROM workouts WHERE status = 'in_progress'
    )
    UPDATE workouts SET status = 'planned', started_at = NULL
      WHERE id IN (SELECT id FROM ranked WHERE n > 1);
    CREATE UNIQUE INDEX workouts_one_active_per_user
      ON workouts(user_id) WHERE status = 'in_progress';

    -- Older manually created sets all used group=0/round=0. They represent
    -- ordinary sequential exercises, not a single large superset.
    WITH affected AS (
      SELECT w.id FROM workouts w JOIN workout_sets s ON s.workout_id = w.id
       WHERE w.program_day_id IS NULL AND s.set_kind = 'normal'
       GROUP BY w.id HAVING count(*) > 1 AND bool_and(s.group_index = 0 AND s.round_index = 0)
    ), groups AS (
      SELECT s.workout_id, s.exercise_id, min(s.order_index) AS first_order
        FROM workout_sets s JOIN affected a ON a.id = s.workout_id
       WHERE s.set_kind = 'normal' GROUP BY s.workout_id, s.exercise_id
    ), numbered_groups AS (
      SELECT *, dense_rank() OVER (PARTITION BY workout_id ORDER BY first_order, exercise_id) - 1 AS gi
      FROM groups
    ), positions AS (
      SELECT s.id, g.gi,
        row_number() OVER (PARTITION BY s.workout_id, s.exercise_id ORDER BY s.order_index, s.created_at, s.id) - 1 AS ri
      FROM workout_sets s JOIN numbered_groups g
        ON g.workout_id = s.workout_id AND g.exercise_id = s.exercise_id
      WHERE s.set_kind = 'normal'
    )
    UPDATE workout_sets s SET group_index = p.gi, round_index = p.ri FROM positions p WHERE s.id = p.id;
    UPDATE workout_sets d SET group_index = p.group_index, round_index = p.round_index
      FROM workout_sets p WHERE d.parent_set_id = p.id;
  `);
  pgm.addColumns('workouts', { last_reminded_on: { type: 'date' } });
};

export const down = (pgm) => {
  pgm.dropColumns('workouts', ['last_reminded_on']);
  pgm.sql('DROP INDEX IF EXISTS workouts_one_active_per_user;');
};
