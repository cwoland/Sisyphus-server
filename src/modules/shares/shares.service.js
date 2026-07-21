import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

const areFriends = async (userA, userB) => {
  const { rows } = await query(
    `SELECT 1 FROM friendships
     WHERE status = 'accepted'
       AND ((requester_id = $1 AND addressee_id = $2)
         OR (requester_id = $2 AND addressee_id = $1))`,
    [userA, userB]
  );
  return rows.length > 0;
};

export const shareProgram = async ({ fromUserId, toUserId, programId }) => {
  if (!(await areFriends(fromUserId, toUserId))) {
    throw new ApiError(403, 'Делиться можно только с друзьями');
  }

  const { rows: programRows } = await query(
    `SELECT id FROM programs WHERE id = $1 AND owner_id = $2`,
    [programId, fromUserId]
  );
  if (!programRows.length) throw new ApiError(404, 'Программа не найдена');

  const { rows } = await query(
    `INSERT INTO shares (from_user_id, to_user_id, program_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [fromUserId, toUserId, programId]
  );
  return rows[0];
};

export const shareWorkout = async ({ fromUserId, toUserId, workoutId }) => {
  if (!(await areFriends(fromUserId, toUserId))) {
    throw new ApiError(403, 'Делиться можно только с друзьями');
  }

  const { rows: workoutRows } = await query(
    `SELECT id FROM workouts WHERE id = $1 AND user_id = $2`,
    [workoutId, fromUserId]
  );
  if (!workoutRows.length) throw new ApiError(404, 'Тренировка не найдена');

  const { rows } = await query(
    `INSERT INTO shares (from_user_id, to_user_id, workout_id)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [fromUserId, toUserId, workoutId]
  );
  return rows[0];
};

export const listReceivedShares = async (userId) => {
  const { rows } = await query(
    `SELECT
       s.id, s.created_at,
       u.name AS from_user_name, u.avatar_url AS from_user_avatar,
       p.id AS program_id, p.title AS program_title,
       w.id AS workout_id, w.title AS workout_title, w.date AS workout_date
     FROM shares s
     JOIN users u ON u.id = s.from_user_id
     LEFT JOIN programs p ON p.id = s.program_id
     LEFT JOIN workouts w ON w.id = s.workout_id
     WHERE s.to_user_id = $1
     ORDER BY s.created_at DESC`,
    [userId]
  );
  return rows;
};

export const deleteShare = async (shareId, userId) => {
  const { rows } = await query(
    `DELETE FROM shares WHERE id = $1 AND to_user_id = $2 RETURNING id`,
    [shareId, userId]
  );
  if (!rows.length) throw new ApiError(404, 'Не найдено');
};