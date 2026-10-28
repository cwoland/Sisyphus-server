export const up = (pgm) => {
  pgm.createTable('user_visits', {
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE', primaryKey: true },
    visit_date: { type: 'date', notNull: true, primaryKey: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addColumns('feed_reactions', {
    kind: { type: 'varchar(12)', notNull: true, default: 'heart' },
  });

  pgm.addConstraint('feed_reactions', 'feed_reactions_kind_check', {
    check: "kind IN ('heart', 'bicep', 'clap')",
  });
};

export const down = (pgm) => {
  pgm.dropConstraint('feed_reactions', 'feed_reactions_kind_check', { ifExists: true });
  pgm.dropColumns('feed_reactions', ['kind'], { ifExists: true });
  pgm.dropTable('user_visits', { ifExists: true });
};