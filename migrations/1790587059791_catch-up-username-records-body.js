export const up = async (pgm) => {
  pgm.addColumns(
    'users',
    { username: { type: 'varchar(30)' } },
    { ifNotExists: true }
  );

  pgm.sql(`
    WITH candidates AS (
      SELECT
        id,
        left(
          regexp_replace(split_part(email, '@', 1), '[^a-zA-Z0-9_]', '_', 'g'),
          24
        ) AS base
      FROM users
      WHERE username IS NULL
    ),
    numbered AS (
      SELECT
        id,
        CASE WHEN length(base) >= 3 THEN base ELSE base || '_user' END AS base,
        row_number() OVER (
          PARTITION BY CASE WHEN length(base) >= 3 THEN base ELSE base || '_user' END
          ORDER BY id
        ) AS rn
      FROM candidates
    )
    UPDATE users u
    SET username = CASE WHEN n.rn = 1 THEN n.base ELSE n.base || n.rn::text END
    FROM numbered n
    WHERE u.id = n.id;
  `);

  pgm.sql(`ALTER TABLE users ALTER COLUMN username SET NOT NULL;`);

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS users_username_lower_idx
      ON users (lower(username));
  `);

  pgm.createTable(
    'personal_records',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
      exercise_id: { type: 'uuid', notNull: true, references: 'exercises', onDelete: 'CASCADE' },
      one_rm: { type: 'numeric(6,2)', notNull: true },
      weight: { type: 'numeric(6,2)', notNull: true },
      reps: { type: 'integer', notNull: true },
      workout_id: { type: 'uuid', references: 'workouts', onDelete: 'SET NULL' },
      achieved_at: { type: 'date', notNull: true },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true }
  );

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS personal_records_user_id_exercise_id_key
      ON personal_records (user_id, exercise_id);
  `);

  pgm.createTable(
    'body_metrics',
    {
      id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
      user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
      date: { type: 'date', notNull: true },
      weight: { type: 'numeric(5,2)' },
      biceps: { type: 'numeric(5,1)' },
      chest: { type: 'numeric(5,1)' },
      waist: { type: 'numeric(5,1)' },
      hip: { type: 'numeric(5,1)' },
      created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
      updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    },
    { ifNotExists: true }
  );

  pgm.sql(`
    CREATE UNIQUE INDEX IF NOT EXISTS body_metrics_user_id_date_key
      ON body_metrics (user_id, date);
  `);

  pgm.sql(`
    CREATE INDEX IF NOT EXISTS body_metrics_user_date_idx
      ON body_metrics (user_id, date DESC);
  `);
};

export const down = async (pgm) => {
  pgm.dropTable('body_metrics', { ifExists: true });
  pgm.dropTable('personal_records', { ifExists: true });
  pgm.sql(`DROP INDEX IF EXISTS users_username_lower_idx;`);
  pgm.dropColumns('users', ['username'], { ifExists: true });
};
