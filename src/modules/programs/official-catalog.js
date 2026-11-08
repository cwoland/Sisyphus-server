// Starter templates for healthy adults; users can edit their own copy.
const day = (title, exercises) => ({ title, exercises: exercises.map(([name, sets, reps]) => ({ name, sets, reps })) });
const A = day('Всё тело A', [['Жим ногами',2,'8-12'],['Жим в грудном тренажёре',2,'8-12'],['Тяга верхнего блока',2,'8-12'],['Сгибание ног в тренажёре',2,'10-15'],['Планка',2,'30-45']]);
const B = day('Всё тело B', [['Гоблет-приседания',2,'8-12'],['Тяга горизонтального блока',2,'8-12'],['Жим гантелей сидя',2,'8-12'],['Ягодичный мост со штангой',2,'8-12'],['Скручивания',2,'10-15']]);
const U = day('Верх тела', [['Жим штанги лёжа',3,'6-10'],['Тяга горизонтального блока',3,'8-12'],['Жим гантелей сидя',3,'8-12'],['Тяга верхнего блока',3,'8-12'],['Махи гантелями в стороны',2,'12-15']]);
const L = day('Низ тела', [['Приседания со штангой',3,'6-10'],['Румынская тяга',3,'8-12'],['Жим ногами',3,'10-12'],['Сгибание ног в тренажёре',3,'10-15'],['Подъёмы на носки стоя',3,'10-15']]);
const descriptions = {
 beginner:'Начни с комфортного веса и освой технику. Между тренировками оставляй время на восстановление.',
 intermediate:'Увеличивай нагрузку постепенно, сохраняя технику и время на восстановление.',
 advanced:'Объём рассчитан на опытных посетителей зала; подбирай нагрузку по своему восстановлению.',
};
const adjusted = (day, sets, strength = false) => ({ ...day, exercises: day.exercises.map((ex, index) => ({ ...ex, sets, reps: strength && index < 2 ? '6-8' : ex.reps })) });
const item = (slug,title,level,goal,image,minutes,days) => ({slug,title,level,goal,image,minutes,equipment:'gym',description:descriptions[level],days});
export const officialPrograms = [
 item('foundation','Основание','beginner','fitness','temple-foundation',45,[A,B]),
 item('first-ascent','Первое восхождение','beginner','strength','sisyphus-ascent',50,[A,B,A]),
 item('athlete-path','Путь атлета','intermediate','fitness','athena-wisdom',60,[U,L,A]),
 item('spartan-form','Форма Спарты','intermediate','muscle','spartan-discipline',65,[U,L,U,L]),
 item('olympus','Олимп','advanced','muscle','athena-wisdom',70,[adjusted(U,4),adjusted(L,4),adjusted(U,4),adjusted(L,4)]),
 item('spartan-strength','Сила Спарты','advanced','strength','spartan-discipline',75,[adjusted(U,4,true),adjusted(L,4,true),adjusted(U,4,true),adjusted(L,4,true)]),
];
