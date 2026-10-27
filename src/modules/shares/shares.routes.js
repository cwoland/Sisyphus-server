import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
  postShareProgram,
  postShareWorkout,
  getReceivedShares,
  removeShare,
  getShareDetail,
} from './shares.controller.js';

const router = Router();

router.use(authGuard);
router.get('/', getReceivedShares);
router.get('/:id', getShareDetail);
router.post('/programs', postShareProgram);
router.post('/workouts', postShareWorkout);
router.delete('/:id', removeShare);

export default router;