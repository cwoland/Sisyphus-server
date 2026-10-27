export const up = (pgm) => {
  pgm.addColumns(
    'programs',
    { kind: { type: 'varchar(12)', notNull: true, default: 'strength' } },
    { ifNotExists: true }
  );

  pgm.addColumns(
    'program_exercises',
    { group_index: { type: 'integer', notNull: true, default: 0 } },
    { ifNotExists: true }
  );

  pgm.sql(`UPDATE program_exercises SET group_index = order_index;`);

  pgm.addColumns(
    'workout_sets',
    {
      group_index: { type: 'integer', notNull: true, default: 0 },
      round_index: { type: 'integer', notNull: true, default: 0 },
    },
    { ifNotExists: true }
  );

  pgm.sql(`
    UPDATE workout_sets
       SET group_index = order_index / 100,
           round_index = order_index % 100
     WHERE set_kind = 'normal';
  `);

  pgm.sql(`
    UPDATE workout_sets d
       SET group_index = p.group_index,
           round_index = p.round_index
      FROM workout_sets p
     WHERE d.parent_set_id = p.id;
  `);
};

export const down = (pgm) => {
  pgm.dropColumns('workout_sets', ['group_index', 'round_index'], { ifExists: true });
  pgm.dropColumns('program_exercises', ['group_index'], { ifExists: true });
  pgm.dropColumns('programs', ['kind'], { ifExists: true });
};
