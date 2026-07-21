import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
  postFriendRequest,
  patchFriendRequest,
  getFriends,
  getPendingRequests,
  deleteFriend,
} from './friends.controller.js';

const router = Router();

router.use(authGuard);
router.get('/', getFriends);
router.get('/requests', getPendingRequests);
router.post('/requests', postFriendRequest);
router.patch('/requests/:id', patchFriendRequest);
router.delete('/:id', deleteFriend);

export default router;