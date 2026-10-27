export const up = (pgm) => {
  pgm.createTable('feed_reactions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    entity_type: { type: 'varchar(20)', notNull: true },
    entity_id: { type: 'uuid', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('feed_reactions', 'feed_reactions_user_entity_key', {
    unique: ['user_id', 'entity_type', 'entity_id'],
  });

  pgm.createIndex('feed_reactions', ['entity_type', 'entity_id']);
};

export const down = (pgm) => {
  pgm.dropTable('feed_reactions', { ifExists: true });
};
