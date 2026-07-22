import { asyncHandler } from '../../utils/asyncHandler.js';
import { listPersonalRecords } from './records.service.js';

export const getRecords = asyncHandler(async (req, res) => {
  const records = await listPersonalRecords(req.userId);
  res.json({ records });
});