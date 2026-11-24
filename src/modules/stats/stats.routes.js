import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getWeeklyOverview, getStreak, getVolumeStats, getVisits, postVisit } from './stats.controller.js';

const router = Router();
router.use(authGuard);
router.get('/streak', getStreak);
router.get('/week', getWeeklyOverview);
router.get('/volume', getVolumeStats);
router.get('/visits', getVisits);
router.post('/visits', postVisit);
export default router;
