import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listNutritionEntries,
  createNutritionEntry,
  updateNutritionEntry,
  deleteNutritionEntry,
  getDailySummary,
  getOrCreateTargets,
  updateTargets,
  listRecentFoods,
} from './nutrition.service.js';

const entrySchema = z.object({
  date: z.string(),
  mealType: z.enum(['breakfast', 'lunch', 'dinner', 'snack']),
  name: z.string().min(1).max(200),
  calories: z.number().int().min(0),
  protein: z.number().min(0).optional(),
  fat: z.number().min(0).optional(),
  carbs: z.number().min(0).optional(),
});

const targetsSchema = z.object({
  calories: z.number().int().min(0),
  protein: z.number().min(0),
  fat: z.number().min(0),
  carbs: z.number().min(0),
});

export const getEntries = asyncHandler(async (req, res) => {
  const { from, to } = req.query;
  const entries = await listNutritionEntries(req.userId, { from, to });
  res.json({ entries });
});

export const getRecentFoods = asyncHandler(async (req, res) => {
  const foods = await listRecentFoods(req.userId, req.query.q);
  res.json({ foods });
});

export const postEntry = asyncHandler(async (req, res) => {
  const data = entrySchema.parse(req.body);
  const entry = await createNutritionEntry({ userId: req.userId, ...data });
  res.status(201).json({ entry });
});

export const patchEntry = asyncHandler(async (req, res) => {
  const data = entrySchema.parse(req.body);
  const entry = await updateNutritionEntry(req.params.id, req.userId, data);
  res.json({ entry });
});

export const removeEntry = asyncHandler(async (req, res) => {
  await deleteNutritionEntry(req.params.id, req.userId);
  res.status(204).send();
});

export const getSummary = asyncHandler(async (req, res) => {
  const { date } = req.query;
  if (!date) throw new Error('Параметр date обязателен');
  const summary = await getDailySummary(req.userId, date);
  res.json({ summary });
});

export const getTargets = asyncHandler(async (req, res) => {
  const targets = await getOrCreateTargets(req.userId);
  res.json({ targets });
});

export const putTargets = asyncHandler(async (req, res) => {
  const data = targetsSchema.parse(req.body);
  const targets = await updateTargets(req.userId, data);
  res.json({ targets });
});