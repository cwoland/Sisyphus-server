import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export const listExercises = async ({ muscleGroup, search, userId }) => {
  const params = [userId];
  const conditions = ['(e.created_by IS NULL OR e.created_by = $1)'];
  if (muscleGroup) { params.push(muscleGroup); conditions.push(`e.muscle_group = $${params.length}`); }
  if (search) { params.push(`%${search}%`); conditions.push(`e.name ILIKE $${params.length}`); }
  const { rows } = await query(`SELECT e.*, n.technique AS personal_technique
    FROM exercises e LEFT JOIN exercise_technique_notes n ON n.exercise_id = e.id AND n.user_id = $1
    WHERE ${conditions.join(' AND ')} ORDER BY e.name ASC`, params);
  return rows;
};

export const createExercise = async ({ name, muscleGroup, muscleDetail, equipment, tracking, userId }) => {
  const { rows } = await query(`INSERT INTO exercises (name, muscle_group, muscle_detail, equipment, tracking, created_by)
    VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`, [name, muscleGroup, muscleDetail ?? null, equipment ?? null, tracking ?? 'weight_reps', userId]);
  return rows[0];
};

export const saveTechniqueNote = async (userId, exerciseId, technique) => {
  const { rows } = await query(`INSERT INTO exercise_technique_notes (user_id, exercise_id, technique)
    SELECT $1, e.id, $3 FROM exercises e WHERE e.id = $2 AND (e.created_by IS NULL OR e.created_by = $1)
    ON CONFLICT (user_id, exercise_id) DO UPDATE SET technique = EXCLUDED.technique, updated_at = now()
    RETURNING technique, updated_at`, [userId, exerciseId, technique]);
  if (!rows.length) throw new ApiError(404, 'Упражнение не найдено');
  return rows[0];
};
