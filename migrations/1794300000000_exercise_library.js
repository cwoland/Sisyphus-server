import { groups } from '../data/exercise-muscles-v1.js';

export const up = (pgm) => {
  pgm.addColumns('exercises', {
    muscle_detail: { type: 'varchar(50)' },
    technique: { type: 'text' },
  });
  pgm.createTable('exercise_technique_notes', {
    user_id: { type: 'uuid', notNull: true, references: 'users', onDelete: 'CASCADE' },
    exercise_id: { type: 'uuid', notNull: true, references: 'exercises', onDelete: 'CASCADE' },
    technique: { type: 'text', notNull: true },
    updated_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  }, { constraints: { primaryKey: ['user_id', 'exercise_id'] } });
  for (const [muscle, names] of groups) {
    for (const name of names) {
      pgm.sql(`UPDATE exercises SET muscle_detail = '${muscle.replaceAll("'", "''")}' WHERE created_by IS NULL AND name = '${name.replaceAll("'", "''")}'`);
    }
  }
  pgm.sql(`INSERT INTO exercises (name, muscle_group, equipment, tracking, muscle_detail, technique)
    SELECT 'Махи в блоке в сторону', 'shoulders', 'cable', 'weight_reps', 'lateral_deltoid', 'Встаньте боком к нижнему блоку, возьмите рукоять дальней рукой. С небольшим сгибом локтя поднимайте руку в сторону до уровня плеча и плавно опускайте, не раскачивая корпус.'
    WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE created_by IS NULL AND lower(name) = lower('Махи в блоке в сторону'))`);
};

export const down = (pgm) => {
  pgm.dropTable('exercise_technique_notes');
  pgm.dropColumns('exercises', ['muscle_detail', 'technique']);
};
