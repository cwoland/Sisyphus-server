import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
  postStartChat,
  getChats,
  getMessages,
  postMessage,
  patchMessagesRead,
} from './chat.controller.js';

const router = Router();

router.use(authGuard);
router.get('/', getChats);
router.post('/', postStartChat);
router.get('/:chatId/messages', getMessages);
router.post('/:chatId/messages', postMessage);
router.patch('/:chatId/read', patchMessagesRead);

export default router;