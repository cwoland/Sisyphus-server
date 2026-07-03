import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
    getWorkouts,
    getWorkout,
    postWorkout,
    postScheduleProgram,
    postSyncWorkout,
    patchWorkoutStatus,
    removeWorkout,
    putWorkoutSet,
    removeWorkoutSet,
} from './workouts.controller.js';

const router = Router();

router.use(authGuard);
router.get('/', getWorkouts);
router.get('/:id', getWorkout);
router.post('/', postWorkout);
router.post('/schedule-program', postScheduleProgram);
router.post('/:id/sync', postSyncWorkout);
router.patch('/:id/status', patchWorkoutStatus);
router.delete('/:id', removeWorkout);
router.put('/:id/sets', putWorkoutSet);
router.delete('/:id/sets/:setId', removeWorkoutSet);

export default router;