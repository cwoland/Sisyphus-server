import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getStreak, getVolumeStats } from './stats.controller.js';

const router = Router();
router.use(authGuard);
router.get('/streak', getStreak);
router.get('/volume', getVolumeStats);
export default router;
