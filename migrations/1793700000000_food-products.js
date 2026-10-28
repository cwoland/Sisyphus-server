export const up = (pgm) => {
  pgm.createTable('food_products', {
    barcode: { type: 'text', primaryKey: true },
    name: { type: 'text', notNull: true },
    brand: { type: 'text' },
    kcal_100g: { type: 'numeric(7,2)', notNull: true },
    protein_100g: { type: 'numeric(6,2)', notNull: true, default: 0 },
    fat_100g: { type: 'numeric(6,2)', notNull: true, default: 0 },
    carbs_100g: { type: 'numeric(6,2)', notNull: true, default: 0 },
    source: { type: 'text', notNull: true, default: 'off' },
    fetched_at: { type: 'timestamptz', notNull: true, default: pgm.func('now()') },
  });

  pgm.addColumns(
    'nutrition_entries',
    {
      barcode: { type: 'text' },
      grams: { type: 'numeric(7,1)' },
    },
    { ifNotExists: true }
  );
};

export const down = (pgm) => {
  pgm.dropColumns('nutrition_entries', ['barcode', 'grams'], { ifExists: true });
  pgm.dropTable('food_products', { ifExists: true });
};
