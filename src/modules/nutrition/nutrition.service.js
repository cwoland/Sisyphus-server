import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export const listNutritionEntries = async (userId, { from, to }) => {
  const conditions = ['user_id = $1'];
  const params = [userId];

  if (from) {
    params.push(from);
    conditions.push(`date >= $${params.length}`);
  }
  if (to) {
    params.push(to);
    conditions.push(`date <= $${params.length}`);
  }

  const { rows } = await query(
    `SELECT * FROM nutrition_entries WHERE ${conditions.join(' AND ')} ORDER BY date DESC, created_at DESC`,
    params
  );
  return rows;
};

export const createNutritionEntry = async ({ userId, date, mealType, name, calories, protein, fat, carbs }) => {
  const { rows } = await query(
    `INSERT INTO nutrition_entries (user_id, date, meal_type, name, calories, protein, fat, carbs)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [userId, date, mealType, name, calories, protein ?? 0, fat ?? 0, carbs ?? 0]
  );
  return rows[0];
};

export const updateNutritionEntry = async (entryId, userId, data) => {
  const { rows } = await query(
    `UPDATE nutrition_entries
     SET name = $1, calories = $2, protein = $3, fat = $4, carbs = $5, meal_type = $6
     WHERE id = $7 AND user_id = $8
     RETURNING *`,
    [data.name, data.calories, data.protein, data.fat, data.carbs, data.mealType, entryId, userId]
  );
  if (!rows.length) throw new ApiError(404, 'Запись не найдена');
  return rows[0];
};

export const deleteNutritionEntry = async (entryId, userId) => {
  const { rows } = await query(
    `DELETE FROM nutrition_entries WHERE id = $1 AND user_id = $2 RETURNING id`,
    [entryId, userId]
  );
  if (!rows.length) throw new ApiError(404, 'Запись не найдена');
};

export const getDailySummary = async (userId, date) => {
  const { rows: entryRows } = await query(
    `SELECT
       COALESCE(SUM(calories), 0) AS total_calories,
       COALESCE(SUM(protein), 0) AS total_protein,
       COALESCE(SUM(fat), 0) AS total_fat,
       COALESCE(SUM(carbs), 0) AS total_carbs
     FROM nutrition_entries
     WHERE user_id = $1 AND date = $2`,
    [userId, date]
  );

  const { rows: targetRows } = await query(
    `SELECT * FROM nutrition_targets WHERE user_id = $1`,
    [userId]
  );

  return {
    consumed: entryRows[0],
    target: targetRows[0] || null,
  };
};

export const getOrCreateTargets = async (userId) => {
  const { rows } = await query(`SELECT * FROM nutrition_targets WHERE user_id = $1`, [userId]);
  if (rows.length) return rows[0];

  const { rows: created } = await query(
    `INSERT INTO nutrition_targets (user_id) VALUES ($1) RETURNING *`,
    [userId]
  );
  return created[0];
};

export const updateTargets = async (userId, { calories, protein, fat, carbs }) => {
  const { rows } = await query(
    `INSERT INTO nutrition_targets (user_id, calories, protein, fat, carbs, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id)
     DO UPDATE SET calories = $2, protein = $3, fat = $4, carbs = $5, updated_at = now()
     RETURNING *`,
    [userId, calories, protein, fat, carbs]
  );
  return rows[0];
};

export const listRecentFoods = async (userId, rawQuery) => {
  const term = (rawQuery || '').trim();
  const params = [userId];
  let filter = '';

  if (term.length >= 2) {
    params.push('%' + term.replace(/[\\%_]/g, '\\$&').toLowerCase() + '%');
    filter = ` AND lower(name) LIKE $${params.length} ESCAPE '\\'`;
  }

  const { rows } = await query(
    `SELECT name, calories, protein, fat, carbs FROM (
      SELECT DISTINCT ON (lower(name))
            name, calories, protein, fat, carbs, created_at
          FROM nutrition_entries
        WHERE user_id = $1${filter}
        ORDER BY lower(name), created_at DESC
      ) t
      ORDER BY created_at DESC
      LIMIT 8`,
      params
  );
  return rows;
};