export const up = (pgm) => {
  pgm.addColumns(
    'exercises',
    { tracking: { type: 'varchar(16)', notNull: true, default: 'weight_reps' } },
    { ifNotExists: true }
  );

  pgm.sql(`UPDATE exercises SET tracking = 'duration' WHERE muscle_group = 'cardio';`);
  pgm.sql(`UPDATE exercises SET tracking = 'duration' WHERE name ILIKE '%планк%';`);
  pgm.sql(`
    UPDATE exercises SET tracking = 'reps'
     WHERE equipment = 'bodyweight' AND tracking = 'weight_reps';
  `);

  pgm.addColumns(
    'workout_sets',
    {
      duration_sec: { type: 'integer' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      set_kind: { type: 'varchar(12)', notNull: true, default: 'normal' },
      parent_set_id: { type: 'uuid', references: 'workout_sets', onDelete: 'CASCADE' },
    },
    { ifNotExists: true }
  );

  pgm.createIndex('workout_sets', 'parent_set_id', { ifNotExists: true });
};

export const down = (pgm) => {
  pgm.dropIndex('workout_sets', 'parent_set_id', { ifExists: true });
  pgm.dropColumns('workout_sets', ['duration_sec', 'created_at', 'set_kind', 'parent_set_id'], { ifExists: true });
  pgm.dropColumns('exercises', ['tracking'], { ifExists: true });
};
