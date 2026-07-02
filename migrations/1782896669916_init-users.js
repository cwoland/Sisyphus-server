export const up = (pgm) => {
    pgm.createExtension('pgcrypto', { ifNotExists: true });

    pgm.createTable('users', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        email: { type: 'varchar(255)', notNull: true, unique: true },
        password_hash: { type: 'text', notNull: true },
        name: { type: 'varchar(100)', notNull: true },
        avatar_url: { type: 'text' },
        settings: { type: 'jsonb', notNull: true, default: '{}' },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
        updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.createIndex('users', 'email');

    pgm.createTable('refresh_tokens', {
        id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
        user_id: {
            type: 'uuid',
            notNull: true,
            references: 'users',
            onDelete: 'CASCADE',
        },
        token_hash: { type: 'text', notNull: true },
        expires_at: { type: 'timestamptz', notNull: true },
        created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    });

    pgm.createIndex('refresh_tokens', 'user_id');
};

export const down = (pgm) => {
    pgm.dropTable('refresh_tokens');
    pgm.dropTable('users');
};
