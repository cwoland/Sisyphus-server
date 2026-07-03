export const up = (pgm) => {

  pgm.createTable('exercises', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    name: { type: 'varchar(150)', notNull: true },
    muscle_group: { type: 'varchar(50)', notNull: true },
    equipment: { type: 'varchar(50)' },
    created_by: { type: 'uuid', references: 'users', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('exercises', 'muscle_group');
  pgm.createIndex('exercises', 'name');

  pgm.createTable('programs', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    owner_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    title: { type: 'varchar(150)', notNull: true },
    description: { type: 'text' },
    is_public: { type: 'boolean', notNull: true, default: false },
    forked_from: { type: 'uuid', references: 'programs', onDelete: 'SET NULL' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('programs', 'owner_id');
  pgm.createIndex('programs', 'is_public');

  pgm.createTable('program_days', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    program_id: { type: 'uuid', notNull: true, references: 'programs', onDelete: 'CASCADE' },
    day_index: { type: 'integer', notNull: true },
    title: { type: 'varchar(150)', notNull: true },
  });

  pgm.createIndex('program_days', 'program_id');

  pgm.createTable('program_exercises', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    program_day_id: { type: 'uuid', notNull: true, references: 'program_days', onDelete: 'CASCADE' },
    exercise_id: { type: 'uuid', notNull: true, references: 'exercises', onDelete: 'RESTRICT' },
    order_index: { type: 'integer', notNull: true, default: 0 },
    target_sets: { type: 'integer', notNull: true, default: 3 },
    target_reps: { type: 'varchar(20)', notNull: true, default: '8-12' },
    notes: { type: 'text' },
  });

  pgm.createIndex('program_exercises', 'program_day_id');

  pgm.createTable('workouts', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    program_day_id: { type: 'uuid', references: 'program_days', onDelete: 'SET NULL' },
    title: { type: 'varchar(150)', notNull: true },
    date: { type: 'date', notNull: true },
    status: {
      type: 'varchar(20)',
      notNull: true,
      default: 'planned',
    },
    notes: { type: 'text' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('workouts', ['user_id', 'date']);
  pgm.createIndex('workouts', 'program_day_id');

  pgm.createTable('workout_sets', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    workout_id: { type: 'uuid', notNull: true, references: 'workouts', onDelete: 'CASCADE' },
    exercise_id: { type: 'uuid', notNull: true, references: 'exercises', onDelete: 'RESTRICT' },
    order_index: { type: 'integer', notNull: true, default: 0 },
    weight: { type: 'numeric(6,2)' },
    reps: { type: 'integer' },
    rpe: { type: 'numeric(3,1)' },
    is_completed: { type: 'boolean', notNull: true, default: false },
  });

  pgm.createIndex('workout_sets', 'workout_id');

  pgm.createTable('nutrition_entries', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    date: { type: 'date', notNull: true },
    meal_type: { type: 'varchar(20)', notNull: true },
    name: { type: 'varchar(200)', notNull: true },
    calories: { type: 'integer', notNull: true },
    protein: { type: 'numeric(6,2)', notNull: true, default: 0 },
    fat: { type: 'numeric(6,2)', notNull: true, default: 0 },
    carbs: { type: 'numeric(6,2)', notNull: true, default: 0 },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('nutrition_entries', ['user_id', 'date']);

  pgm.createTable('nutrition_targets', {
    user_id: { type: 'uuid', primaryKey: true, references: 'users', onDelete: 'CASCADE' },
    calories: { type: 'integer', notNull: true, default: 2000 },
    protein: { type: 'numeric(6,2)', notNull: true, default: 150 },
    fat: { type: 'numeric(6,2)', notNull: true, default: 60 },
    carbs: { type: 'numeric(6,2)', notNull: true, default: 200 },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('friendships', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    requester_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    addressee_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    status: { type: 'varchar(20)', notNull: true, default: 'pending' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('friendships', 'unique_friendship_pair', {
    unique: ['requester_id', 'addressee_id'],
  });
  pgm.createIndex('friendships', 'requester_id');
  pgm.createIndex('friendships', 'addressee_id');

  pgm.createTable('shares', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    from_user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    to_user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    program_id: { type: 'uuid', references: 'programs', onDelete: 'CASCADE' },
    workout_id: { type: 'uuid', references: 'workouts', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('shares', 'to_user_id');

  pgm.createTable('chats', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_a_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    user_b_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addConstraint('chats', 'unique_chat_pair', {
    unique: ['user_a_id', 'user_b_id'],
  });

  pgm.createTable('chat_messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    chat_id: { type: 'uuid', notNull: true, references: 'chats', onDelete: 'CASCADE' },
    sender_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    text: { type: 'text', notNull: true },
    read_at: { type: 'timestamptz' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('chat_messages', ['chat_id', 'created_at']);

  pgm.createTable('push_subscriptions', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    endpoint: { type: 'text', notNull: true, unique: true },
    keys: { type: 'jsonb', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('push_subscriptions', 'user_id');

  pgm.createTable('ai_conversations', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    context_type: { type: 'varchar(20)', notNull: true, default: 'free' },
    context_id: { type: 'uuid' }, 
    title: { type: 'varchar(150)' },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createTable('ai_messages', {
    id: { type: 'uuid', primaryKey: true, default: pgm.func('gen_random_uuid()') },
    conversation_id: { type: 'uuid', notNull: true, references: 'ai_conversations', onDelete: 'CASCADE' },
    role: { type: 'varchar(20)', notNull: true },
    content: { type: 'text', notNull: true },
    created_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.createIndex('ai_messages', 'conversation_id');
};

export const down = (pgm) => {
  pgm.dropTable('ai_messages');
  pgm.dropTable('ai_conversations');
  pgm.dropTable('push_subscriptions');
  pgm.dropTable('chat_messages');
  pgm.dropTable('chats');
  pgm.dropTable('shares');
  pgm.dropTable('friendships');
  pgm.dropTable('nutrition_targets');
  pgm.dropTable('nutrition_entries');
  pgm.dropTable('workout_sets');
  pgm.dropTable('workouts');
  pgm.dropTable('program_exercises');
  pgm.dropTable('program_days');
  pgm.dropTable('programs');
  pgm.dropTable('exercises');
};