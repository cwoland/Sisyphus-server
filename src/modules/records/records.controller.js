import { asyncHandler } from '../../utils/asyncHandler.js';
import { ApiError } from '../../utils/apiError.js';
import { listPersonalRecords, getExerciseHistory } from './records.service.js';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const getRecords = asyncHandler(async (req, res) => {
  const records = await listPersonalRecords(req.userId);
  res.json({ records });
});

export const getHistory = asyncHandler(async (req, res) => {
  const { exerciseId } = req.params;
  if (!UUID.test(exerciseId)) throw new ApiError(400, 'Некорректный идентификатор упражнения');

  const history = await getExerciseHistory(req.userId, exerciseId);
  res.json(history);
});
