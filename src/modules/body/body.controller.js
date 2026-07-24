import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listBodyMetrics, getLatestBodyMetric, upsertBodyMetric, deleteBodyMetric,
} from './body.service.js';

const metricSchema = z.object({
  date: z.string(),
  weight: z.number().min(20).max(400).nullable().optional(),
  biceps: z.number().min(10).max(100).nullable().optional(),
  chest:  z.number().min(40).max(250).nullable().optional(),
  waist:  z.number().min(30).max(250).nullable().optional(),
  hip:    z.number().min(30).max(250).nullable().optional(),
});

export const getMetrics = asyncHandler(async (req, res) => {
  const metrics = await listBodyMetrics(req.userId);
  res.json({ metrics });
});

export const getLatest = asyncHandler(async (req, res) => {
  const latest = await getLatestBodyMetric(req.userId);
  res.json({ latest });
});

export const postMetric = asyncHandler(async (req, res) => {
  const data = metricSchema.parse(req.body);
  const metric = await upsertBodyMetric(req.userId, data);
  res.status(201).json({ metric });
});

export const removeMetric = asyncHandler(async (req, res) => {
  await deleteBodyMetric(req.params.id, req.userId);
  res.status(204).send();
});