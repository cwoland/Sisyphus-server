import { query } from '../../config/db.js';

// The catalog is populated by Open Food Facts searches. On a fresh install
// provide name shortcuts for the manual form until there are cached products.
const starterNames = ['Банан', 'Гречка', 'Овсянка', 'Рис', 'Творог', 'Яблоко'];

// Keep Cyrillic case folding independent of the database installation's locale.
const folded = (expression) =>
  `lower(translate(btrim(${expression}), 'АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯ',
                                         'абвгдеёжзийклмнопрстуфхцчшщъыьэюя'))`;

export async function listFoodChoices(userId, term, { historyOnly = false, remoteCodes = [] } = {}) {
  const { rows } = await query(`
    WITH keyed AS (
      SELECT n.*, CASE WHEN barcode IS NULL THEN 'name:' || ${folded('name')}
                       ELSE 'code:' || barcode END AS key
      FROM nutrition_entries n WHERE user_id = $1
    ), history AS (
      SELECT DISTINCT ON (key) key, barcode, name, calories, protein, fat, carbs, grams,
             count(*) OVER (PARTITION BY key)::int AS usage_count
      FROM keyed ORDER BY key, created_at DESC, id DESC
    ), catalog AS (
      SELECT 'code:' || barcode AS key, barcode, name, brand,
             kcal_100g, protein_100g, fat_100g, carbs_100g
      FROM food_products WHERE NOT $3
      UNION ALL
      SELECT 'name:' || ${folded('name')}, NULL, name, NULL, NULL, NULL, NULL, NULL
      FROM unnest($4::text[]) AS starters(name)
      WHERE NOT $3 AND NOT EXISTS (SELECT 1 FROM food_products)
    ), choices AS (
      SELECT coalesce(h.key, c.key) AS key, coalesce(c.name, h.name) AS name,
             coalesce(c.barcode, h.barcode) AS barcode, c.brand, c.kcal_100g,
             c.protein_100g, c.fat_100g, c.carbs_100g, coalesce(h.usage_count, 0) AS usage_count,
             CASE WHEN h.key IS NOT NULL THEN to_jsonb(h) - 'key' - 'usage_count' END AS entry
      FROM history h FULL JOIN catalog c USING (key)
      WHERE NOT $3 OR h.key IS NOT NULL
    )
    SELECT * FROM choices
    WHERE $2 = '' OR strpos(${folded('name')}, ${folded('$2')}) > 0
       OR strpos(${folded('brand')}, ${folded('$2')}) > 0
       OR strpos(${folded("entry->>'name'")}, ${folded('$2')}) > 0
       OR barcode = ANY($5::text[])
    ORDER BY usage_count DESC, replace(${folded('name')}, 'ё', 'е') COLLATE "C",
             ${folded('name')} COLLATE "C", ${folded('brand')} COLLATE "C", key COLLATE "C"
    LIMIT $6
  `, [userId, term, historyOnly, starterNames, remoteCodes, historyOnly ? 8 : 20]);
  return rows;
}
