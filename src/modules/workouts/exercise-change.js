export function planExerciseChange(sets, anchorId, exerciseId, replacementId) {
  const anchor = sets.find((s) => s.id === anchorId);
  if (!anchor || anchor.exercise_id !== exerciseId || anchor.is_completed || anchor.is_skipped) {
    throw new Error('Этот подход уже изменился. Обновите тренировку.');
  }
  const slot = (s) => s.original_exercise_id ?? s.exercise_id;
  const group = sets.filter((s) => s.group_index === anchor.group_index);
  if (replacementId === exerciseId || (replacementId && group.some((s) =>
    !s.is_skipped && slot(s) !== slot(anchor) && s.exercise_id === replacementId))) {
    throw new Error('Это упражнение уже есть в связке.');
  }
  const family = (s) => s.parent_set_id ?? s.id;
  const started = new Set(group.filter((s) => s.is_completed).map(family));
  const skip = [];
  const replace = [];
  for (const s of group) {
    if (slot(s) !== slot(anchor) || s.exercise_id !== exerciseId || s.is_completed || s.is_skipped) continue;
    if (replacementId && !started.has(family(s))) replace.push(s.id);
    else skip.push(s.id);
  }
  if (replacementId && !replace.length) {
    throw new Error('В этой серии остались только дропы. Их можно пропустить.');
  }
  return { skip, replace };
}
