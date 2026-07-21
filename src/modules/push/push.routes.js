import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getPublicKey, postSubscribe, postUnsubscribe, triggerReminders } from './push.controller.js';

const router = Router();

router.get('/public-key', getPublicKey);
router.post('/trigger-reminders', triggerReminders);
router.use(authGuard);
router.post('/subscribe', postSubscribe);
router.post('/unsubscribe', postUnsubscribe);

export default router;