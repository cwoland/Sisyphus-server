import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import { getExercises, postExercise, putTechniqueNote } from './exercises.controller.js';

const router = Router();
router.use(authGuard);
router.get('/', getExercises);
router.post('/', postExercise);
router.put('/:id/technique-note', putTechniqueNote);
export default router;
