import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getExercises, postExercise } from './exercises.controller.js';

const router = Router();

router.use(authGuard);
router.get('/', getExercises);
router.post('/', postExercise);

export default router;