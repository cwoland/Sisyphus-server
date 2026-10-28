import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { sendPushToUser } from '../push/push.service.js';

export const listFriendsFeed = async (userId, { limit = 30, before, beforeId } = {}) => {
  const params = [userId, limit];
  let cursor = '';

  if (before && beforeId) {
    params.push(before, beforeId);
    cursor = ` AND (e.occurred_at, e.id) < ($${params.length - 1}::timestamptz, $${params.length}::uuid)`;
  }

  const sql = [
    "WITH friends AS (",
    "  SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id",
    "  FROM friendships",
    "  WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'",
    "),",
    "events AS (",
    "  SELECT 'workout'::text AS type, w.id, w.user_id,",
    "         w.date::timestamptz AS occurred_at,",
    "         jsonb_build_object('title', w.title) AS meta",
    "  FROM workouts w JOIN friends f ON f.friend_id = w.user_id",
    "  WHERE w.status = 'completed'",
    "  UNION ALL",
    "  SELECT 'record'::text, pr.id, pr.user_id, pr.updated_at,",
    "         jsonb_build_object('exercise', e2.name, 'oneRm', pr.one_rm, 'weight', pr.weight, 'reps', pr.reps)",
    "  FROM personal_records pr JOIN friends f ON f.friend_id = pr.user_id",
    "  JOIN exercises e2 ON e2.id = pr.exercise_id",
    "  UNION ALL",
    "  SELECT 'program'::text, p.id, p.owner_id, p.created_at,",
    "         jsonb_build_object('title', p.title)",
    "  FROM programs p JOIN friends f ON f.friend_id = p.owner_id",
    "  WHERE p.is_public = true",
    ")",
    "SELECT e.type, e.id, e.occurred_at, e.meta,",
    "       u.id AS author_id, u.name AS author_name,",
    "       u.username AS author_username, u.avatar_url AS author_avatar,",
    "       (SELECT count(*) FROM feed_reactions fr",
    "         WHERE fr.entity_type = e.type AND fr.entity_id = e.id)::int AS reactions,",
    "       COALESCE((",
    "         SELECT jsonb_object_agg(g.kind, g.n) FROM (",
    "           SELECT fr.kind, count(*)::int AS n FROM feed_reactions fr",
    "             WHERE fr.entity_type = e.type AND fr.entity_id = e.id",
    "             GROUP BY fr.kind",
    "           ) g",
    "       ), '{}'::jsonb) AS reaction_counts,",
    "       (SELECT fr.kind FROM feed_reactions fr",
    "         WHERE fr.entity_type = e.type AND fr.entity_id = e.id",
    "           AND fr.user_id = $1) AS my_reaction,",
    "       EXISTS (SELECT 1 FROM feed_reactions fr",
    "                WHERE fr.entity_type = e.type AND fr.entity_id = e.id",
    "                  AND fr.user_id = $1) AS reacted",
    "FROM events e JOIN users u ON u.id = e.user_id",
    "WHERE true" + cursor,
    "ORDER BY e.occurred_at DESC, e.id DESC",
    "LIMIT $2",
  ].join("\n");

  const { rows } = await query(sql, params);
  return rows;
};

const ENTITY_TYPES = ['workout', 'record', 'program'];

export const REACTION_KINDS = ['heart', 'bicep', 'clap'];

const REACTION_MARK = { heart: '❤️', bicep: '💪', clap: '👏' };

const AUTHOR_SQL = {
  workout: `SELECT w.user_id AS author_id, w.title AS label FROM workouts w WHERE w.id = $1`,
  record: `SELECT pr.user_id AS author_id, e.name AS label
             FROM personal_records pr
             JOIN exercises e ON e.id = pr.exercise_id
            WHERE pr.id = $1`,
  program: `SELECT p.owner_id AS author_id, p.title AS label FROM programs p WHERE p.id = $1`,
};

const notifyAuthor = async (reactorId, entityType, entityId, kind) => {
  const { rows } = await query(AUTHOR_SQL[entityType], [entityId]);
  const target = rows[0];
  if (!target || target.author_id === reactorId) return;

  const { rows: who } = await query(`SELECT name FROM users WHERE id = $1`, [reactorId]);
  const name = who[0]?.name || 'Кто-то';

  await sendPushToUser(target.author_id, {
    title: 'Ваше достижение оценили',
    body: `${name}: ${REACTION_MARK[kind]} ${target.label}`,
    url: '/friends',
  });
};

export const addReaction = async (userId, entityType, entityId, rawKind) => {
  if (!ENTITY_TYPES.includes(entityType)) throw new ApiError(400, 'Неизвестный тип события');
  const kind = REACTION_KINDS.includes(rawKind) ? rawKind : 'heart';

  const { rows } = await query(
    `INSERT INTO feed_reactions (user_id, entity_type, entity_id, kind)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, entity_type, entity_id)
     DO UPDATE SET kind = EXCLUDED.kind, created_at = now()
     WHERE feed_reactions.kind IS DISTINCT FROM EXCLUDED.kind
     RETURNING (xmax = 0) AS inserted`,
    [userId, entityType, entityId, kind]
  );

  if (rows[0]?.inserted) {
    notifyAuthor(userId, entityType, entityId, kind)
      .catch((err) => console.error('Reaction push failed:', err.message));
  }

  return { kind };
};

export const removeReaction = async (userId, entityType, entityId) => {
  if (!ENTITY_TYPES.includes(entityType)) throw new ApiError(400, 'Неизвестный тип события');

  await query(
    `DELETE FROM feed_reactions WHERE user_id = $1 AND entity_type = $2 AND entity_id = $3`,
    [userId, entityType, entityId]
  );
};