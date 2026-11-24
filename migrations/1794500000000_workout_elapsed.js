export const up = (pgm) => {
  pgm.addColumns('workouts', { elapsed_seconds: { type: 'integer', check: 'elapsed_seconds >= 0' } });
};

export const down = (pgm) => {
  pgm.dropColumns('workouts', ['elapsed_seconds']);
};
