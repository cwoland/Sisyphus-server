import { asyncHandler } from '../../utils/asyncHandler.js';
import { getContinuity, getVolume } from './stats.service.js';

export const getStreak = asyncHandler(async (req, res) => {
  const continuity = await getContinuity(req.userId);
  res.json(continuity);
});

export const getVolumeStats = asyncHandler(async (req, res) => {
  const volume = await getVolume(req.userId, { weeks: req.query.weeks });
  res.json(volume);
});
