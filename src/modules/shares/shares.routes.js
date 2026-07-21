import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
  postShareProgram,
  postShareWorkout,
  getReceivedShares,
  removeShare,
} from './shares.controller.js';

const router = Router();

router.use(authGuard);
router.get('/', getReceivedShares);
router.post('/programs', postShareProgram);
router.post('/workouts', postShareWorkout);
router.delete('/:id', removeShare);

export default router;