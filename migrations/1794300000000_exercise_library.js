const groups = [
  ['chest', ['Бабочка','Жим в грудном тренажёре','Жим гантелей в наклоне','Жим гантелей лёжа','Жим штанги в наклоне вверх','Жим штанги в наклоне вниз','Жим штанги лёжа','Отжимания на брусьях','Отжимания от пола','Разведение гантелей лёжа','Сведение рук в кроссовере']],
  ['biceps', ['Молотковые сгибания','Подъём гантелей на бицепс','Подъём на скамье Скотта','Подъём штанги на бицепс','Сгибания на нижнем блоке']],
  ['triceps', ['Обратные отжимания от скамьи','Отжимания узким хватом','Разгибание гантели из-за головы','Разгибание рук на блоке','Французский жим лёжа']],
  ['lower_back', ['Гиперэкстензия','Становая тяга']],
  ['hamstrings', ['Становая тяга на прямых ногах','Румынская тяга','Сгибание ног в тренажёре']],
  ['upper_lats', ['Подтягивания','Подтягивания обратным хватом','Пулловер с гантелью','Тяга верхнего блока','Тяга верхнего блока узким хватом','Тяга гантели в наклоне','Тяга горизонтального блока','Тяга Т-грифа','Тяга штанги в наклоне']],
  ['trapezius', ['Шраги с гантелями','Шраги со штангой']],
  ['core', ['Боковая планка','Велосипед','Колесо для пресса','Планка','Подъём ног в висе','Русские скручивания','Скручивания']],
  ['quadriceps', ['Болгарские выпады','Выпады с гантелями','Гоблет-приседания','Жим ногами','Зашагивания на скамью','Приседания в Смите','Приседания со штангой','Разгибание ног в тренажёре','Фронтальные приседания']],
  ['calves', ['Подъёмы на носки сидя','Подъёмы на носки стоя']],
  ['glutes', ['Ягодичный мост со штангой']],
  ['anterior_deltoid', ['Жим Арнольда','Жим гантелей сидя','Жим штанги стоя','Подъём штанги перед собой']],
  ['lateral_deltoid', ['Махи гантелями в стороны','Тяга штанги к подбородку']],
  ['posterior_deltoid', ['Махи гантелями в наклоне','Обратная бабочка']],
];

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
