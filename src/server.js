import app from './app.js';
import { env } from './config/env.js';

app.listen(env.port, () => {
  console.log(`Sisyphus API запущен на порту ${env.port}`);
});