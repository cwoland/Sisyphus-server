import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getStreak, getVolumeStats, getVisits, postVisits } from './stats.controller.js';

const router = Router();
router.use(authGuard);
router.get('/streak', getStreak);
router.get('/volume', getVolumeStats);
router.get('/visits', getVisits);
router.post('/visits', postVisits);
export default router;
