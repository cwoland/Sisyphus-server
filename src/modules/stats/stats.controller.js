import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { getWeekOverview, getContinuity, getVolume, getVisitStreak, recordVisit } from './stats.service.js';

export const getStreak = asyncHandler(async (req, res) => {
  const continuity = await getContinuity(req.userId);
  res.json(continuity);
});

export const getVolumeStats = asyncHandler(async (req, res) => {
  const volume = await getVolume(req.userId, { weeks: req.query.weeks });
  res.json(volume);
});

const localDate = (req) => {
  const raw = req.body?.date ?? req.query?.date;
  return raw == null ? null : z.iso.date().parse(raw);
};

export const getVisits = asyncHandler(async (req, res) => {
  res.json(await getVisitStreak(req.userId, localDate(req)));
});

export const postVisit = asyncHandler(async (req, res) => {
  res.json(await recordVisit(req.userId, localDate(req)));
});

export const getWeeklyOverview = asyncHandler(async (req, res) => {
  const date = z.iso.date().parse(req.query.date);
  res.json(await getWeekOverview(req.userId, date));
});
