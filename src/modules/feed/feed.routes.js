import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getFeed } from './feed.controller.js';

const router = Router();
router.use(authGuard);
router.get('/', getFeed);

export default router;