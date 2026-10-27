import { query } from '../../config/db.js';

export const listExercises = async ({ muscleGroup, search }) => {
    const conditions = [];
    const params = [];

    if (muscleGroup) {
        params.push(muscleGroup);
        conditions.push(`muscle_group = $${params.length}`);
    }

    if (search) {
        params.push(`%${search}%`);
        conditions.push(`name ILIKE $${params.length}`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';

    const { rows } = await query(
        `SELECT * FROM exercises ${where} ORDER BY name ASC`,
        params
    );
    return rows;
};

export const createExercise = async ({ name, muscleGroup, equipment, tracking, userId }) => {
    const { rows } = await query(
        `INSERT INTO exercises (name, muscle_group, equipment, tracking, created_by)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING *`,
        [name, muscleGroup, equipment ?? null, tracking ?? 'weight_reps', userId]
    );
    return rows[0];
};