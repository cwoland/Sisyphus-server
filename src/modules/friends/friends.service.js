import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export const searchUsersByUsername = async (userId, rawQuery) => {
    const term = (rawQuery || '').trim();
    if (term.length < 2) return [];
    const pattern = term.replace(/[\\%_]/g, '\\$&').toLowerCase() + '%';

    const { rows } = await query(
        `SELECT u.id, u.username, u.name, u.avatar_url
           FROM users u
          WHERE lower(u.username) LIKE $1 ESCAPE '\\'
            AND u.id <> $2
            AND NOT EXISTS (
              SELECT 1 FROM friendships f
              WHERE (f.requester_id = $2 AND f.addressee_id = u.id)
                 OR (f.requester_id = u.id AND f.addressee_id = $2)
            )
          ORDER BY u.username ASC
          LIMIT 10`,
        [pattern, userId]
    );
    return rows;
};

export const sendFriendRequest = async (requesterId, addresseeEmail) => {
    const { rows: userRows } = await query(
        `SELECT id FROM users WHERE lower(username) = lower($1)`,
        [addresseeEmail.toLowerCase()]
    );
    const addressee = userRows[0];
    if (!addressee) throw new ApiError(404, 'Пользователь с таким email не найден');
    if (addressee.id === requesterId) throw new ApiError(400, 'Нельзя дружить только с собой');

    const { rows: existing } = await query(
        `SELECT * FROM friendships
        WHERE (requester_id = $1 AND addressee_id = $2)
        OR (requester_id = $2 AND addressee_id = $1)`,
        [requesterId, addressee.id]
    );

    if (existing.length) {
        const rel = existing[0];
        if (rel.status === 'accepted') throw new ApiError(409, 'Вы уже друзья');
        if (rel.status === 'pending') throw new ApiError(409, 'Заявка уже отправлена');
        if (rel.status === 'blocked') throw new ApiError(403, 'Невозможно отправить заявку');
    }

    const { rows } = await query(
        `INSERT INTO friendships (requester_id, addressee_id, status)
        VALUES ($1, $2, 'pending')
        RETURNING *`,
        [requesterId, addressee.id]
    );
    return rows[0];
};

export const respondToFriendRequest = async (friendshipId, userId, accept) => {
    const { rows: friendshipRows } = await query(
        `SELECT * FROM friendships WHERE id = $1 AND addressee_id = $2 AND status = 'pending'`,
        [friendshipId, userId]
    );
    const friendship = friendshipRows[0];
    if (!friendship) throw new ApiError(404, 'Заявка не найдена');

    if (!accept) {
        await query(`DELETE FROM friendships WHERE id = $1`, [friendshipId]);
        return { status: 'rejected' };
    }

    const { rows } = await query(
        `UPDATE friendships SET status = 'accepted' WHERE id = $1 RETURNING *`,
        [friendshipId]
    );
    return rows[0];
};

export const listFriends = async (userId) => {
    const { rows } = await query(
        `SELECT
           f.id AS friendship_id,
           u.id, u.name, u.username, u.email, u.avatar_url
           FROM friendships f
           JOIN users u ON u.id = CASE
            WHEN f.requester_id = $1 THEN f.addressee_id
            ELSE f.requester_id
            END
            WHERE (f.requester_id = $1 OR f.addressee_id = $1) AND f.status = 'accepted'
            ORDER BY u.name ASC`,
            [userId]
    );
    return rows;
};

export const listPendingRequests = async (userId) => {
    const { rows } = await query(
        `SELECT f.id AS friendship_id, u.id, u.name, u.username, u.email, u.avatar_url, f.created_at
        FROM friendships f
        JOIN users u ON u.id = f.requester_id
        WHERE f.addressee_id = $1 AND f.status = 'pending'
        ORDER BY f.created_at DESC`,
        [userId]
    );
    return rows;
};

export const removeFriend = async (friendshipId, userId) => {
    const { rows } = await query(
        `DELETE FROM friendships
        WHERE id = $1 AND (requester_id = $2 OR addressee_id = $2)
        RETURNING id`,
        [friendshipId, userId]
    );
    if (!rows.length) throw new ApiError(404, 'Связь не найдена');
};