import { z } from 'zod';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { listExercises, createExercise } from './exercises.service.js';

const createExerciseSchema = z.object({
    name: z.string().min(2).max(150),
    muscleGroup: z.enum(['chest', 'back', 'legs', 'shoulders', 'arms', 'core', 'cardio']),
    equipment: z.enum(['barbell', 'dumbbell', 'machine', 'bodyweight', 'kettlebell', 'resistance_band', 'cable', 'medicine_ball', 'other']).optional(),
});

export const getExercises = asyncHandler(async (req, res) => {
    const { muscleGroup, search } = req.query;
    const exercises = await listExercises({ muscleGroup, search });
    res.json({ exercises });
});

export const postExercise = asyncHandler(async (req, res) => {
    const data = createExerciseSchema.parse(req.body);
    const exercise = await createExercise({ ...data, userId: req.userId });
    res.status(201).json({ exercise });
});