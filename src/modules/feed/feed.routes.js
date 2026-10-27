import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getFeed, postReaction, deleteReaction } from './feed.controller.js';

const router = Router();
router.use(authGuard);
router.get('/', getFeed);
router.post('/reactions/:type/:id', postReaction);
router.delete('/reactions/:type/:id', deleteReaction);

export default router;
