import { query } from '../../db.js';

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

export const createExercise = async ({ name, muscleGroup, equipment, userId }) => {
    const { rows } = await query(
        `INSERT INTO exercises (name, muscle_group, equipment, created_by)
        VALUES ($1, $2, $3, $4) 
        RETURNING *`,
        [name, muscleGroup, equipment ?? null, userId]
    );
    return rows[0];
};