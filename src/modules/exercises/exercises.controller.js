import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listExercises, createExercise, saveTechniqueNote } from './exercises.service.js';

const details = {
  chest: ['chest'], back: ['upper_lats', 'lower_lats', 'lower_back', 'trapezius'],
  legs: ['quadriceps', 'hamstrings', 'calves', 'glutes', 'adductors', 'abductors'],
  shoulders: ['anterior_deltoid', 'lateral_deltoid', 'posterior_deltoid'],
  arms: ['biceps', 'triceps', 'forearm_pronators', 'forearm_supinators'],
  core: ['core'], cardio: [],
};
const createExerciseSchema = z.object({
  name: z.string().trim().min(2).max(150),
  muscleGroup: z.enum(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio']),
  muscleDetail: z.string().max(50).nullable().optional(),
  equipment: z.enum(['barbell', 'dumbbell', 'machine', 'bodyweight', 'kettlebell', 'resistance_band', 'cable', 'medicine_ball', 'other']).optional(),
  tracking: z.enum(['weight_reps', 'reps', 'duration']).optional(),
}).refine((data) => !data.muscleDetail || details[data.muscleGroup].includes(data.muscleDetail), { message: 'Мышца не соответствует группе', path: ['muscleDetail'] });

export const getExercises = asyncHandler(async (req, res) => {
  const exercises = await listExercises({ ...req.query, userId: req.userId });
  res.json({ exercises });
});
export const postExercise = asyncHandler(async (req, res) => {
  const data = createExerciseSchema.parse(req.body);
  const exercise = await createExercise({ ...data, userId: req.userId });
  res.status(201).json({ exercise });
});
export const putTechniqueNote = asyncHandler(async (req, res) => {
  const id = z.string().uuid().parse(req.params.id);
  const { technique } = z.object({ technique: z.string().trim().max(5000) }).parse(req.body);
  res.json({ note: await saveTechniqueNote(req.userId, id, technique) });
});
