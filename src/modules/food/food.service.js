import { query } from '../../config/db.js';
import { searchOff, fetchOffProduct } from './off.client.js';

const LOCAL_LIMIT = 20;

const cacheProducts = async (products) => {
  if (!products.length) return;

  const values = [];
  const params = [];

  for (const p of products) {
    params.push(p.barcode, p.name, p.brand, p.kcal_100g, p.protein_100g, p.fat_100g, p.carbs_100g);
    const base = params.length - 7;
    values.push(`($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5}, $${base + 6}, $${base + 7})`);
  }

  await query(
    `INSERT INTO food_products (barcode, name, brand, kcal_100g, protein_100g, fat_100g, carbs_100g)
     VALUES ${values.join(', ')}
     ON CONFLICT (barcode) DO UPDATE SET
       name = EXCLUDED.name,
       brand = EXCLUDED.brand,
       kcal_100g = EXCLUDED.kcal_100g,
       protein_100g = EXCLUDED.protein_100g,
       fat_100g = EXCLUDED.fat_100g,
       carbs_100g = EXCLUDED.carbs_100g,
       fetched_at = now()`,
    params
  );
};

const searchLocal = async (term) => {
  const { rows } = await query(
    `SELECT barcode, name, brand, kcal_100g, protein_100g, fat_100g, carbs_100g
       FROM food_products
      WHERE lower(name) LIKE '%' || lower($1) || '%'
         OR lower(coalesce(brand, '')) LIKE '%' || lower($1) || '%'
      ORDER BY length(name), name
      LIMIT $2`,
    [term, LOCAL_LIMIT]
  );
  return rows;
};

export const searchFood = async (rawTerm) => {
  const term = (rawTerm || '').trim();
  if (term.length < 2) return [];

  const local = await searchLocal(term);
  const remote = await searchOff(term);

  if (remote.length) await cacheProducts(remote);

  const byBarcode = new Map();
  for (const p of [...local, ...remote]) {
    if (!byBarcode.has(p.barcode)) byBarcode.set(p.barcode, p);
  }

  return [...byBarcode.values()].slice(0, LOCAL_LIMIT);
};

export const getFoodByBarcode = async (barcode) => {
  const { rows } = await query(
    `SELECT barcode, name, brand, kcal_100g, protein_100g, fat_100g, carbs_100g
       FROM food_products WHERE barcode = $1`,
    [barcode]
  );
  if (rows[0]) return rows[0];

  const product = await fetchOffProduct(barcode);
  if (!product) return null;

  await cacheProducts([product]);
  return product;
};
