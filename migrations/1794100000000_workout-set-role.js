export const up = (pgm) => {
  pgm.addColumns('workout_sets', {
    set_role: { type: 'varchar(12)', notNull: true, default: 'normal' },
  });

  pgm.sql(`
    ALTER TABLE workout_sets
    ADD CONSTRAINT workout_sets_role_check
    CHECK (set_role IN ('normal', 'warmup', 'failure'));

    ALTER TABLE workout_sets
    ADD CONSTRAINT workout_sets_drop_role_check
    CHECK (set_kind <> 'drop' OR set_role = 'normal');
  `);
};

export const down = (pgm) => {
  pgm.sql(`
    ALTER TABLE workout_sets DROP CONSTRAINT IF EXISTS workout_sets_drop_role_check;
    ALTER TABLE workout_sets DROP CONSTRAINT IF EXISTS workout_sets_role_check;
  `);
  pgm.dropColumns('workout_sets', ['set_role']);
};
