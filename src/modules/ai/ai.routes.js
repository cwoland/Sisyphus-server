import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import rateLimit from 'express-rate-limit';
import { PostgresRateLimitStore } from '../../middlewares/postgresRateLimitStore.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  postConversation,
  getConversations,
  getMessages,
  postMessage,
  removeConversation,
} from './ai.controller.js';
import { generateProgram } from './program-generator.js';

const router = Router();

const aiLimiter = rateLimit({
  store: new PostgresRateLimitStore('ai'),
  windowMs: 60 * 1000,
  max: 15,
  message: { message: 'Слишком много запросов к AI, подождите немного' },
});

const generatorLimiter = rateLimit({
  store: new PostgresRateLimitStore('ai_program_generator'),
  windowMs: 60 * 1000,
  max: 3,
  message: {
    message: 'Слишком много запросов к генератору программ, подождите немного',
  },
});

router.use(authGuard);
router.get('/conversations', getConversations);
router.post('/conversations', postConversation);
router.get('/conversations/:id', getMessages);
router.post('/conversations/:id/messages', aiLimiter, postMessage);
router.delete('/conversations/:id', removeConversation);
router.post('/program-generator', generatorLimiter, asyncHandler(async (req, res) => {
  const program = await generateProgram(req.userId, req.body);
  res.json({ program });
}));

export default router;
