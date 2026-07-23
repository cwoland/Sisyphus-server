import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { hashPassword, comparePassword } from '../auth/auth.service.js';

export const updateProfile = async (userId, { name, username, avatarUrl }) => {
  const fields = [];
  const params = [];
  if (name !== undefined)      { params.push(name);                  fields.push(`name = $${params.length}`); }
  if (username !== undefined)  { params.push(username.toLowerCase()); fields.push(`username = $${params.length}`); }
  if (avatarUrl !== undefined) { params.push(avatarUrl);             fields.push(`avatar_url = $${params.length}`); }
  if (!fields.length) throw new ApiError(400, 'Нет полей для обновления');

  params.push(userId);
  const { rows } = await query(
    `UPDATE users SET ${fields.join(', ')}
      WHERE id = $${params.length}
      RETURNING id, email, name, username, avatar_url, settings, created_at`,
    params
  );
  if (!rows.length) throw new ApiError(404, 'Пользователь не найден');
  return rows[0];
};

export const changePassword = async (userId, currentPassword, newPassword) => {
  const { rows } = await query(`SELECT password_hash FROM users WHERE id = $1`, [userId]);
  const user = rows[0];
  if (!user) throw new ApiError(404, 'Пользователь не найден');

  const ok = await comparePassword(currentPassword, user.password_hash);
  if (!ok) throw new ApiError(400, 'Текущий пароль неверен');

  const passwordHash = await hashPassword(newPassword);
  await query(`UPDATE users SET password_hash = $1 WHERE id = $2`, [passwordHash, userId]);
  await query(`DELETE FROM refresh_tokens WHERE user_id = $1`, [userId]);
};