export const up = (pgm) => {
  pgm.addColumns('program_exercises', {
    set_plan: { type: 'jsonb' },
  });

  pgm.addColumns('workout_sets', {
    rest_after_sec: { type: 'integer' },
    target_reps: { type: 'varchar(20)' },
  });

  pgm.sql(`
    ALTER TABLE workout_sets
    ADD CONSTRAINT workout_sets_rest_after_check
    CHECK (
      rest_after_sec IS NULL
      OR rest_after_sec BETWEEN 0 AND 900
    );
  `);
};

export const down = (pgm) => {
  pgm.dropColumns('workout_sets', [
    'rest_after_sec',
    'target_reps',
  ]);

  pgm.dropColumns('program_exercises', ['set_plan']);
};