import { query } from '../../config/db.js';

export const listFriendsFeed = async (userId, { limit = 30, before } = {}) => {
    const params = [userId, limit];
    let cursor = '';

    if (before) {
        params.push(before);
        cursor = ` AND e.occurred_at < $${params.length}`;
    }

    const { rows } = await query(
        `WITH friends AS (
            SELECT CASE WHEN requester_id = $1 THEN addressee_id ELSE requester_id END AS friend_id
                FROM friendships
            WHERE (requester_id = $1 OR addressee_id = $1) AND status = 'accepted'
        ),
        events AS (
            SELECT 'workout::text AS type,
                    w.id,
                    w.user_id,
                    w.date::timestamptz AS occurred_at,
                    jsonb_build_object('title', w.title) AS meta
                FROM workouts w
                JOIN friends f ON f.friend_id = w.user_id
            WHERE w.status = 'completed'

            UNION ALL

            SELECT 'record'::text,
                    pr.id,
                    pr.user_id,
                    pr.updated_at,
                    jsonb_build_object(
                        'exercise', e2.name,
                        'oneRm', pr.one_rm,
                        'weight', pr.weight,
                        'reps', pr.reps   
                    )
                FROM personal_records pr
                JOIN friends f ON f.friend_id = pr.user_id
                JOIN exercises e2 ON e2.id = pr.exercise_id
            
            UNION ALL

            SELECT 'program'::text,
                    p.id,
                    p.owner_id,
                    p.created_at,
                    jsonb_build_object('title', p.title)
                FROM programs p
                JOIN friends f ON f.friend_id = p.owner_id
                WHERE p.is_public = true
        )
        SELECT e.type, e.id, e.occurred_at, e.meta,
                u.id AS author_id, u.name AS author_name,
                u.username AS author_username, u.avatar_url AS author_avatar
        FROM events e
        JOIN users u ON u.id = e.user_id
        WHERE true${cursor}
        ORDER BY e.occurred_at DESC
        LIMIT $2`,
        params
    );
    return rows;
}