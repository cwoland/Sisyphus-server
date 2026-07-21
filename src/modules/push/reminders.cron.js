import cron from 'node-cron';
import { sendTodayReminders } from './reminders.service.js';

export const startReminderCron = () => {
  cron.schedule('0 8 * * *', async () => {
    console.log('Internal cron: sending reminders...');
    const result = await sendTodayReminders();
    console.log(`Internal cron sent ${result.sent}/${result.total} reminders`);
  });
};