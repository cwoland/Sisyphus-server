import { Router } from 'express';
import { z } from 'zod';
import { authGuard } from '../../middlewares/auth.middleware.js';

import {
  getWorkouts,
  getWorkout,
  postWorkout,
  patchWorkout,
  postScheduleProgram,
  postSyncWorkout,
  patchWorkoutStatus,
  patchActiveExercise,
  postStartWorkout,
  getActive,
  removeWorkout,
  putWorkoutSet,
  removeWorkoutSet,
} from './workouts.controller.js';

import { changeWorkoutGroup } from './workout-groups.controller.js';

const router = Router();

router.use(authGuard);

const validateId = (_req, _res, next, value) => {
  const result = z.guid().safeParse(value);
  next(result.success ? undefined : result.error);
};
router.param('id', validateId);
router.param('setId', validateId);

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
router.patch('/:id/active-exercise', patchActiveExercise);

router.put('/:id/sets', putWorkoutSet);
router.delete('/:id/sets/:setId', removeWorkoutSet);

router.patch('/:id/groups', changeWorkoutGroup);

export default router;
