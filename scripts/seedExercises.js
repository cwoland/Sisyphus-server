import { pool, query } from '../src/config/db.js';

const EXERCISES = [
  ['Жим штанги лёжа', 'chest', 'barbell'],
  ['Жим штанги в наклоне вверх', 'chest', 'barbell'],
  ['Жим штанги в наклоне вниз', 'chest', 'barbell'],
  ['Жим гантелей лёжа', 'chest', 'dumbbell'],
  ['Жим гантелей в наклоне', 'chest', 'dumbbell'],
  ['Разведение гантелей лёжа', 'chest', 'dumbbell'],
  ['Отжимания от пола', 'chest', 'bodyweight'],
  ['Отжимания на брусьях', 'chest', 'bodyweight'],
  ['Сведение рук в кроссовере', 'chest', 'cable'],
  ['Жим в грудном тренажёре', 'chest', 'machine'],
  ['Бабочка', 'chest', 'machine'],

  ['Подтягивания', 'back', 'bodyweight'],
  ['Подтягивания обратным хватом', 'back', 'bodyweight'],
  ['Тяга верхнего блока', 'back', 'cable'],
  ['Тяга верхнего блока узким хватом', 'back', 'cable'],
  ['Тяга горизонтального блока', 'back', 'cable'],
  ['Тяга штанги в наклоне', 'back', 'barbell'],
  ['Тяга Т-грифа', 'back', 'barbell'],
  ['Тяга гантели в наклоне', 'back', 'dumbbell'],
  ['Становая тяга', 'back', 'barbell'],
  ['Становая тяга на прямых ногах', 'back', 'barbell'],
  ['Шраги со штангой', 'back', 'barbell'],
  ['Шраги с гантелями', 'back', 'dumbbell'],
  ['Гиперэкстензия', 'back', 'bodyweight'],
  ['Пулловер с гантелью', 'back', 'dumbbell'],

  ['Приседания со штангой', 'legs', 'barbell'],
  ['Фронтальные приседания', 'legs', 'barbell'],
  ['Приседания в Смите', 'legs', 'machine'],
  ['Жим ногами', 'legs', 'machine'],
  ['Разгибание ног в тренажёре', 'legs', 'machine'],
  ['Сгибание ног в тренажёре', 'legs', 'machine'],
  ['Румынская тяга', 'legs', 'barbell'],
  ['Выпады с гантелями', 'legs', 'dumbbell'],
  ['Болгарские выпады', 'legs', 'dumbbell'],
  ['Гоблет-приседания', 'legs', 'kettlebell'],
  ['Ягодичный мост со штангой', 'legs', 'barbell'],
  ['Подъёмы на носки стоя', 'legs', 'machine'],
  ['Подъёмы на носки сидя', 'legs', 'machine'],
  ['Зашагивания на скамью', 'legs', 'dumbbell'],

  ['Жим штанги стоя', 'shoulders', 'barbell'],
  ['Жим гантелей сидя', 'shoulders', 'dumbbell'],
  ['Жим Арнольда', 'shoulders', 'dumbbell'],
  ['Махи гантелями в стороны', 'shoulders', 'dumbbell'],
  ['Махи гантелями в наклоне', 'shoulders', 'dumbbell'],
  ['Подъём штанги перед собой', 'shoulders', 'barbell'],
  ['Тяга штанги к подбородку', 'shoulders', 'barbell'],
  ['Обратная бабочка', 'shoulders', 'machine'],

  ['Подъём штанги на бицепс', 'arms', 'barbell'],
  ['Подъём гантелей на бицепс', 'arms', 'dumbbell'],
  ['Молотковые сгибания', 'arms', 'dumbbell'],
  ['Подъём на скамье Скотта', 'arms', 'barbell'],
  ['Сгибания на нижнем блоке', 'arms', 'cable'],
  ['Французский жим лёжа', 'arms', 'barbell'],
  ['Разгибание рук на блоке', 'arms', 'cable'],
  ['Разгибание гантели из-за головы', 'arms', 'dumbbell'],
  ['Отжимания узким хватом', 'arms', 'bodyweight'],
  ['Обратные отжимания от скамьи', 'arms', 'bodyweight'],

  ['Скручивания', 'core', 'bodyweight'],
  ['Планка', 'core', 'bodyweight'],
  ['Боковая планка', 'core', 'bodyweight'],
  ['Подъём ног в висе', 'core', 'bodyweight'],
  ['Русские скручивания', 'core', 'bodyweight'],
  ['Велосипед', 'core', 'bodyweight'],
  ['Колесо для пресса', 'core', 'bodyweight'],
];

const run = async () => {
  let created = 0;
  let skipped = 0;

  for (const [name, muscleGroup, equipment] of EXERCISES) {
    const { rowCount } = await query(
      `INSERT INTO exercises (name, muscle_group, equipment)
       SELECT $1::text, $2::text, $3::text
       WHERE NOT EXISTS (SELECT 1 FROM exercises WHERE lower(name) = lower($1::text))`,
      [name, muscleGroup, equipment]
    );
    rowCount ? created++ : skipped++;
  }

  console.log(`Добавлено: ${created}, уже было: ${skipped}`);
  await pool.end();
};

run().catch((err) => {
  console.error(err);
  process.exit(1);
});