/**
 * Момент фактического старта тренировки.
 *
 * created_at ставится при создании записи в календаре, а не при нажатии
 * «Начать», поэтому для счётчика времени на экране активной тренировки он
 * не годится: у тренировки, запланированной вчера, счётчик показал бы сутки.
 */

export const up = (pgm) => {
  pgm.addColumns('workouts', { started_at: { type: 'timestamptz' } }, { ifNotExists: true });

  // Уже идущим тренировкам проставляем created_at — другого источника нет,
  // а NULL сломал бы счётчик у того, кто сейчас в зале.
  pgm.sql(`UPDATE workouts SET started_at = created_at WHERE status = 'in_progress' AND started_at IS NULL;`);

  pgm.sql(`CREATE INDEX IF NOT EXISTS workouts_user_in_progress_idx
             ON workouts (user_id) WHERE status = 'in_progress';`);
};

export const down = (pgm) => {
  pgm.sql(`DROP INDEX IF EXISTS workouts_user_in_progress_idx;`);
  pgm.dropColumns('workouts', ['started_at'], { ifExists: true });
};
