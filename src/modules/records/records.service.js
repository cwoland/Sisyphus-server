import { query } from '../../config/db.js';

export const listPersonalRecords = async (userId) => {
  const { rows } = await query(
    `SELECT pr.*, e.name AS exercise_name, e.muscle_group
       FROM personal_records pr
       JOIN exercises e ON e.id = pr.exercise_id
      WHERE pr.user_id = $1
      ORDER BY pr.updated_at DESC`,
    [userId]
  );
  return rows;
};