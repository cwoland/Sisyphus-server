import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listWorkouts,
  getWorkoutWithSets,
  createWorkout,
  scheduleProgramToCalendar,
  syncWorkoutWithProgram,
  updateWorkoutStatus,
  deleteWorkout,
  upsertWorkoutSet,
  deleteWorkoutSet,
} from './workouts.service.js';

const createWorkoutSchema = z.object({
  title: z.string().min(1).max(150),
  date: z.string(),
  notes: z.string().optional(),
});

const updateWorkoutSchema = z.object({
  title: z.string().min(1).max(150).optional(),
  date: z.string().optional(),
  notes: z.string().nullable().optional(),
});

const scheduleSchema = z.object({
  programId: z.string().uuid(),
  startDate: z.string(),
  weekdays: z.array(z.number().int().min(0).max(6)).min(1),
  weeksCount: z.number().int().min(1).max(52),
});

const statusSchema = z.object({
  status: z.enum(['planned', 'completed', 'skipped']),
});

const setSchema = z.object({
  setId: z.string().uuid().optional(),
  exerciseId: z.string().uuid().optional(),
  weight: z.number().nullable().optional(),
  reps: z.number().int().nullable().optional(),
  rpe: z.number().min(1).max(10).nullable().optional(),
  isCompleted: z.boolean().optional(),
  orderIndex: z.number().int().optional(),
});

export const getWorkouts = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const workouts = await listWorkouts(req.userId, { from, to });
  res.json({ workouts });
});

export const getWorkout = asyncHandler(async (req, res) => {
  const workout = await getWorkoutWithSets(req.params.id, req.userId);
  res.json({ workout });
});

export const postWorkout = asyncHandler(async (req, res) => {
  const data = createWorkoutSchema.parse(req.body);
  const workout = await createWorkout({ userId: req.userId, ...data });
  res.status(201).json({ workout });
});

export const patchWorkout = asyncHandler(async (req, res) => {
  const data = updateWorkoutSchema.parse(req.body);
  const workout = await updateWorkout(req.params.id, req.userId, data);
  res.json({ workout });
});

export const postScheduleProgram = asyncHandler(async (req, res) => {
  const data = scheduleSchema.parse(req.body);
  const workouts = await scheduleProgramToCalendar({ userId: req.userId, ...data });
  res.status(201).json({ workouts });
});

export const postSyncWorkout = asyncHandler(async (req, res) => {
  const workout = await syncWorkoutWithProgram(req.params.id, req.userId);
  res.json({ workout });
});

export const patchWorkoutStatus = asyncHandler(async (req, res) => {
  const { status } = statusSchema.parse(req.body);
  const workout = await updateWorkoutStatus(req.params.id, req.userId, status);
  res.json({ workout });
});

export const removeWorkout = asyncHandler(async (req, res) => {
  await deleteWorkout(req.params.id, req.userId);
  res.status(204).send();
});

export const putWorkoutSet = asyncHandler(async (req, res) => {
  const data = setSchema.parse(req.body);
  const set = await upsertWorkoutSet({ workoutId: req.params.id, userId: req.userId, ...data });
  res.json({ set });
});

export const removeWorkoutSet = asyncHandler(async (req, res) => {
  await deleteWorkoutSet(req.params.setId, req.params.id, req.userId);
  res.status(204).send();
});