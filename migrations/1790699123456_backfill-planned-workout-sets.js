export const up = (pgm) => {
  pgm.sql(`
    INSERT INTO workout_sets (workout_id, exercise_id, order_index)
    SELECT w.id, pe.exercise_id, pe.order_index * 100 + gs.i
      FROM workouts w
      JOIN program_exercises pe ON pe.program_day_id = w.program_day_id
      CROSS JOIN LATERAL generate_series(0, pe.target_sets - 1) AS gs(i)
     WHERE w.status = 'planned'
       AND w.program_day_id IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM workout_sets ws WHERE ws.workout_id = w.id);
  `);
};

export const down = () => {};