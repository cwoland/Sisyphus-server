import { query } from '../../config/db.js';
import { sendPushToUser } from './push.service.js';


export const sendTodayReminders = async () => {
  const { rows: todayWorkouts } = await query(
    `SELECT id, user_id, title FROM workouts
     WHERE date = CURRENT_DATE AND status = 'planned'`
  );

  let sent = 0;
  for (const workout of todayWorkouts) {
    try {
      await sendPushToUser(workout.user_id, {
        title: 'Тренировка сегодня',
        body: workout.title,
        url: `/calendar`,
      });
      sent++;
    } catch (err) {
      console.error('Push send failed for workout', workout.id, err.message);
    }
  }

  return { total: todayWorkouts.length, sent };
};