import { programSchema } from './program.schema.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import {
  listUserPrograms,
  getProgramWithDays,
  createProgram,
  deleteProgram,
  forkProgram,
  updateProgram,
  listPublicPrograms,
} from './programs.service.js';

export const getMyPrograms = asyncHandler(async (req, res) => {
  const programs = await listUserPrograms(req.userId);
  res.json({ programs });
});

export const getProgram = asyncHandler(async (req, res) => {
  const program = await getProgramWithDays(
    req.params.id,
    req.userId
  );

  res.json({ program });
});

export const getPublicPrograms = asyncHandler(async (req, res) => {
  const programs = await listPublicPrograms(
    req.userId,
    req.query.q
  );

  res.json({ programs });
});

export const postProgram = asyncHandler(async (req, res) => {
  const data = programSchema.parse(req.body);

  const program = await createProgram({
    ownerId: req.userId,
    ...data,
  });

  res.status(201).json({ program });
});

export const putProgram = asyncHandler(async (req, res) => {
  const data = programSchema.parse(req.body);

  const program = await updateProgram(
    req.params.id,
    req.userId,
    data
  );

  res.json({ program });
});

export const removeProgram = asyncHandler(async (req, res) => {
  await deleteProgram(req.params.id, req.userId);
  res.status(204).send();
});

export const postForkProgram = asyncHandler(async (req, res) => {
  const program = await forkProgram(
    req.params.id,
    req.userId
  );

  res.status(201).json({ program });
});