import { env } from '../../config/env.js';
import { Router } from 'express';
import { register, login, refresh, logout, me } from './auth.controller.js';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { authLimiter } from '../../middlewares/rateLimiter.js';

const router = Router();
router.use((req, res, next) => {
  if (req.method !== 'GET' && req.headers.origin &&
      req.headers.origin !== new URL(env.clientUrl).origin) {
    return res.status(403).json({ message: 'Недопустимый источник запроса' });
  }
  next();
});

router.post('/register', authLimiter, register);
router.post('/login', authLimiter, login);
router.post('/refresh', refresh);
router.post('/logout', logout);
router.get('/me', authGuard, me);

export default router;