import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  shareProgram,
  shareWorkout,
  listReceivedShares,
  deleteShare,
} from './shares.service.js';

const shareProgramSchema = z.object({
  toUserId: z.string().uuid(),
  programId: z.string().uuid(),
});

const shareWorkoutSchema = z.object({
  toUserId: z.string().uuid(),
  workoutId: z.string().uuid(),
});

export const postShareProgram = asyncHandler(async (req, res) => {
  const data = shareProgramSchema.parse(req.body);
  const share = await shareProgram({ fromUserId: req.userId, ...data });
  res.status(201).json({ share });
});

export const postShareWorkout = asyncHandler(async (req, res) => {
  const data = shareWorkoutSchema.parse(req.body);
  const share = await shareWorkout({ fromUserId: req.userId, ...data });
  res.status(201).json({ share });
});

export const getReceivedShares = asyncHandler(async (req, res) => {
  const shares = await listReceivedShares(req.userId);
  res.json({ shares });
});

export const removeShare = asyncHandler(async (req, res) => {
  await deleteShare(req.params.id, req.userId);
  res.status(204).send();
});