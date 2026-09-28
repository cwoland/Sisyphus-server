import { Router } from 'express';
import { authGuard } from '../../middlewares/auth.middleware.js';
import {
    getWorkouts,
    getWorkout,
    postWorkout,
    patchWorkout,
    postScheduleProgram,
    postSyncWorkout,
    patchWorkoutStatus,
    postStartWorkout,
    getActive,
    removeWorkout,
    putWorkoutSet,
    removeWorkoutSet,
} from './workouts.controller.js';

const router = Router();

router.use(authGuard);

// Статические пути объявляются выше параметрических: Express матчит по порядку,
// поэтому '/:id' перехватил бы '/active' и '/schedule-program'.
router.get('/', getWorkouts);
router.get('/active', getActive);
router.post('/', postWorkout);
router.post('/schedule-program', postScheduleProgram);

router.get('/:id', getWorkout);
router.patch('/:id', patchWorkout);
router.delete('/:id', removeWorkout);
router.post('/:id/start', postStartWorkout);
router.post('/:id/sync', postSyncWorkout);
router.patch('/:id/status', patchWorkoutStatus);
router.put('/:id/sets', putWorkoutSet);
router.delete('/:id/sets/:setId', removeWorkoutSet);

export default router;
