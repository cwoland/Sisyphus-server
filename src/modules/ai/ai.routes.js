import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import rateLimit from 'express-rate-limit';
import {
  postConversation,
  getConversations,
  getMessages,
  postMessage,
  removeConversation,
} from './ai.controller.js';

const router = Router();

const aiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 15,
  message: { message: 'Слишком много запросов к AI, подождите немного' },
});

router.use(authGuard);
router.get('/conversations', getConversations);
router.post('/conversations', postConversation);
router.get('/conversations/:id', getMessages);
router.post('/conversations/:id/messages', aiLimiter, postMessage);
router.delete('/conversations/:id', removeConversation);

export default router;