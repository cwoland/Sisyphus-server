export const up = (pgm) => {
  pgm.addColumns('workout_sets', {
    is_skipped: { type: 'boolean', notNull: true, default: false },
    original_exercise_id: { type: 'uuid' },
  });
  pgm.sql('ALTER TABLE workout_sets ADD CHECK (NOT (is_skipped AND is_completed))');
  pgm.createTable('workout_exercise_changes', {
    workout_id: { type: 'uuid', notNull: true, references: 'workouts', onDelete: 'CASCADE' },
    request_id: { type: 'uuid', notNull: true },
    payload: { type: 'jsonb', notNull: true },
  });
  pgm.addConstraint('workout_exercise_changes', 'workout_exercise_changes_pk', {
    primaryKey: ['workout_id', 'request_id'],
  });
};

export const down = (pgm) => {
  pgm.dropTable('workout_exercise_changes');
  pgm.dropColumns('workout_sets', ['original_exercise_id', 'is_skipped']);
};
