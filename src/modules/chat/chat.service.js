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

export const getOrCreateChat = async (userId, friendId) => {
  if (!(await areFriends(userId, friendId))) {
    throw new ApiError(403, 'Чат доступен только между друзьями');
  }

  const [userA, userB] = [userId, friendId].sort();

  const { rows: existing } = await query(
    `SELECT * FROM chats WHERE user_a_id = $1 AND user_b_id = $2`,
    [userA, userB]
  );
  if (existing.length) return existing[0];

  const { rows } = await query(
    `INSERT INTO chats (user_a_id, user_b_id) VALUES ($1, $2) RETURNING *`,
    [userA, userB]
  );
  return rows[0];
};

export const listUserChats = async (userId) => {
  const { rows } = await query(
    `SELECT
       c.id AS chat_id,
       u.id AS friend_id, u.name AS friend_name, u.avatar_url AS friend_avatar,
       lm.text AS last_message_text, lm.created_at AS last_message_at,
       (SELECT COUNT(*) FROM chat_messages
        WHERE chat_id = c.id AND sender_id != $1 AND read_at IS NULL) AS unread_count
     FROM chats c
     JOIN users u ON u.id = CASE WHEN c.user_a_id = $1 THEN c.user_b_id ELSE c.user_a_id END
     LEFT JOIN LATERAL (
       SELECT text, created_at FROM chat_messages
       WHERE chat_id = c.id
       ORDER BY created_at DESC
       LIMIT 1
     ) lm ON true
     WHERE c.user_a_id = $1 OR c.user_b_id = $1
     ORDER BY lm.created_at DESC NULLS LAST`,
    [userId]
  );
  return rows;
};

const assertChatAccess = async (chatId, userId) => {
  const { rows } = await query(
    `SELECT * FROM chats WHERE id = $1 AND (user_a_id = $2 OR user_b_id = $2)`,
    [chatId, userId]
  );
  if (!rows.length) throw new ApiError(403, 'Нет доступа к этому чату');
  return rows[0];
};

export const listMessages = async (chatId, userId, { after, limit }) => {
  await assertChatAccess(chatId, userId);

  const lim = limit || 50;

  if (!after) {
    const { rows } = await query(
      `SELECT * FROM (
         SELECT * FROM chat_messages
         WHERE chat_id = $1
         ORDER BY created_at DESC
         LIMIT $2
       ) sub ORDER BY created_at ASC`,
      [chatId, lim]
    );
    return rows;
  }

  const { rows } = await query(
    `SELECT * FROM chat_messages
     WHERE chat_id = $1 AND created_at > $2
     ORDER BY created_at ASC
     LIMIT $3`,
    [chatId, after, lim]
  );
  return rows;
};

export const sendMessage = async (chatId, senderId, text) => {
  await assertChatAccess(chatId, senderId);

  const { rows } = await query(
    `INSERT INTO chat_messages (chat_id, sender_id, text)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [chatId, senderId, text]
  );
  return rows[0];
};

export const markMessagesRead = async (chatId, userId) => {
  await assertChatAccess(chatId, userId);

  await query(
    `UPDATE chat_messages
     SET read_at = now()
     WHERE chat_id = $1 AND sender_id != $2 AND read_at IS NULL`,
    [chatId, userId]
  );
};