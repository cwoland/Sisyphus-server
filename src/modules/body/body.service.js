import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export const listBodyMetrics = async (userId, limit = 30) => {
  const { rows } = await query(
    `SELECT * FROM body_metrics WHERE user_id = $1 ORDER BY date DESC LIMIT $2`,
    [userId, limit]
  );
  return rows;
};

export const getLatestBodyMetric = async (userId) => {
  const { rows } = await query(
    `SELECT * FROM body_metrics
      WHERE user_id = $1 AND weight IS NOT NULL
      ORDER BY date DESC LIMIT 2`,
    [userId]
  );
  return { current: rows[0] || null, previous: rows[1] || null };
};

export const upsertBodyMetric = async (userId, { date, weight, biceps, chest, waist, hip }) => {
  const { rows } = await query(
    `INSERT INTO body_metrics (user_id, date, weight, biceps, chest, waist, hip)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (user_id, date) DO UPDATE SET
       weight = COALESCE(EXCLUDED.weight, body_metrics.weight),
       biceps = COALESCE(EXCLUDED.biceps, body_metrics.biceps),
       chest  = COALESCE(EXCLUDED.chest,  body_metrics.chest),
       waist  = COALESCE(EXCLUDED.waist,  body_metrics.waist),
       hip    = COALESCE(EXCLUDED.hip,    body_metrics.hip),
       updated_at = now()
     RETURNING *`,
    [userId, date, weight ?? null, biceps ?? null, chest ?? null, waist ?? null, hip ?? null]
  );
  return rows[0];
};

export const deleteBodyMetric = async (id, userId) => {
  const { rows } = await query(
    `DELETE FROM body_metrics WHERE id = $1 AND user_id = $2 RETURNING id`,
    [id, userId]
  );
  if (!rows.length) throw new ApiError(404, 'Запись не найдена');
};