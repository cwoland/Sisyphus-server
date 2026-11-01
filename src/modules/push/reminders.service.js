import { query } from '../../config/db.js';
import { sendPushToUser } from './push.service.js';

export const sendTodayReminders = async () => {
  // Claim atomically: concurrent or repeated cron calls cannot send the same reminder.
  const { rows: todayWorkouts } = await query(`
    UPDATE workouts w SET last_reminded_on = w.date
      FROM users u
      WHERE u.id = w.user_id AND w.status = 'planned'
        AND w.date = (now() AT TIME ZONE COALESCE(
          (SELECT name FROM pg_timezone_names WHERE name = u.settings->>'timeZone' LIMIT 1), 'UTC'))::date
        AND w.last_reminded_on IS DISTINCT FROM w.date
      RETURNING w.id, w.user_id, w.title, w.date
  `);
  let sent = 0;
  for (const workout of todayWorkouts) {
    try {
      const results = await sendPushToUser(workout.user_id, {
        title: 'Тренировка сегодня', body: workout.title, url: '/calendar',
      });
      if (!results.some((r) => r.status === 'fulfilled')) throw new Error('No notification delivered');
      sent++;
    } catch (error) {
      await query('UPDATE workouts SET last_reminded_on = NULL WHERE id = $1 AND last_reminded_on = $2',
        [workout.id, workout.date]);
      console.error('Push send failed for workout', workout.id, error.message);
    }
  }
  return { total: todayWorkouts.length, sent };
};
