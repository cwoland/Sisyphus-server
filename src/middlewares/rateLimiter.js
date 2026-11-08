import rateLimit from 'express-rate-limit';
import { PostgresRateLimitStore } from './postgresRateLimitStore.js';

export const authLimiter = rateLimit({
  store: new PostgresRateLimitStore('auth'),
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { message: 'Слишком много попыток, попробуйте позже' },
});
