import app from './app.js';
import { env } from './config/env.js';
import { startReminderCron } from './modules/push/reminders.cron.js';

app.listen(env.port, () => {
  console.log(`Sisyphus API запущен на порту ${env.port}`);
  startReminderCron();
});