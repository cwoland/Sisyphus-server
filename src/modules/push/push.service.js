import { query } from '../../config/db.js';
import { webpush } from '../../config/webPush.js';

export const saveSubscription = async (userId, subscription) => {
  const { endpoint, keys } = subscription;

  const { rows } = await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, keys)
     VALUES ($1, $2, $3)
     ON CONFLICT (endpoint) DO UPDATE SET keys = $3
     RETURNING *`,
    [userId, endpoint, keys]
  );
  return rows[0];
};

export const removeSubscription = async (userId, endpoint) => {
  await query(
    `DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2`,
    [userId, endpoint]
  );
};

export const sendPushToUser = async (userId, payload) => {
  const { rows: subscriptions } = await query(
    `SELECT * FROM push_subscriptions WHERE user_id = $1`,
    [userId]
  );

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        { endpoint: sub.endpoint, keys: sub.keys },
        JSON.stringify(payload)
      )
    )
  );

  results.forEach((result, index) => {
    if (result.status === 'rejected' && result.reason?.statusCode === 410) {
      query(`DELETE FROM push_subscriptions WHERE id = $1`, [subscriptions[index].id]).catch(() => {});
    }
  });

  return results;
};