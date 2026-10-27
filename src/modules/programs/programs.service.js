import { query, pool } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';

export const listUserPrograms = async (userId) => {
    const { rows } = await query(
        `SELECT p.*,
                (SELECT count(*) FROM program_days pd
                  WHERE pd.program_id = p.id) AS days_count,
                (SELECT count(*) FROM program_exercises pe
                   JOIN program_days pd ON pd.id = pe.program_day_id
                  WHERE pd.program_id = p.id) AS exercises_count
           FROM programs p
          WHERE p.owner_id = $1
          ORDER BY p.created_at DESC`,
        [userId]
    );
    return rows;
};

export const listPublicPrograms = async (userId, rawQuery) => {
  const term = (rawQuery || '').trim();
  const params = [userId];
  let where = `p.is_public = true AND p.owner_id <> $1`;

  if (term.length >= 2) {
    params.push('%' + term.replace(/[\\%_]/g, '\\$&').toLowerCase() + '%');
    where += ` AND lower(p.title) LIKE $${params.length} ESCAPE '\\'`;
  }

  const { rows } = await query(
    `SELECT p.id, p.title, p.description, p.created_at,
            u.username AS author_username,
            (SELECT count(*) FROM program_days pd
              WHERE pd.program_id = p.id) AS days_count,
            (SELECT count(*) FROM program_exercises pe
               JOIN program_days pd ON pd.id = pe.program_day_id
              WHERE pd.program_id = p.id) AS exercises_count
       FROM programs p
       JOIN users u ON u.id = p.owner_id
      WHERE ${where}
      ORDER BY p.created_at DESC
      LIMIT 30`,
    params
  );
  return rows;
};

export const getProgramWithDays = async (programId, userId) => {
    const { rows: programRows } = await query(
        `SELECT * FROM programs WHERE id = $1`,
        [programId]
    );
    const program = programRows[0];

    if (!program) throw new ApiError(404, 'Программа не найдена');
    if (program.owner_id !== userId && !program.is_public) {
        throw new ApiError(403, 'Нет доступа к этой программе');
    }

    const { rows: days } = await query(
        `SELECT * FROM program_days WHERE program_id = $1 ORDER BY day_index ASC`,
        [programId]
    );

    const dayIds = days.map((d) => d.id);
    let exercisesByDay = {};

    if (dayIds.length) {
        const { rows: exercises } = await query(
            `SELECT pe.*, e.name AS exercise_name, e.muscle_group, e.equipment, e.tracking
            FROM program_exercises pe
            JOIN exercises e ON e.id = pe.exercise_id
            WHERE pe.program_day_id = ANY($1)
            ORDER BY pe.order_index ASC`,
            [dayIds]
        );
        exercisesByDay = exercises.reduce((acc, ex) => {
            acc[ex.program_day_id] = acc[ex.program_day_id] || [];
            acc[ex.program_day_id].push(ex);
            return acc;
        }, {});
    }

    return {
        ...program,
        days: days.map((day) => ({
            ...day,
            exercises: exercisesByDay[day.id] || [],
        })),
    };
};

export const createProgram = async ({ ownerId, title, description, isPublic, kind, days }) => {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const { rows: programRows } = await client.query(
      `INSERT INTO programs (owner_id, title, description, is_public, kind)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [ownerId, title, description ?? null, isPublic ?? false, kind ?? 'strength']
    );
    const program = programRows[0];

    for (const [dayIndex, day] of days.entries()) {
      const { rows: dayRows } = await client.query(
        `INSERT INTO program_days (program_id, day_index, title)
         VALUES ($1, $2, $3)
         RETURNING *`,
        [program.id, dayIndex, day.title]
      );
      const createdDay = dayRows[0];

      for (const [exIndex, ex] of day.exercises.entries()) {
        await client.query(
          `INSERT INTO program_exercises
             (program_day_id, exercise_id, order_index, target_sets, target_reps, notes, group_index)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            createdDay.id, ex.exerciseId, exIndex, ex.targetSets, ex.targetReps,
            ex.notes ?? null, ex.groupIndex ?? exIndex,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return program;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

export const deleteProgram = async (programId, userId) => {
    const { rows } = await query(
        `DELETE FROM programs WHERE id = $1 AND owner_id = $2 RETURNING id`,
        [programId, userId]
    );
    if (!rows.length) throw new ApiError(404, 'Программа не найдена или нет доступа');
};

export const forkProgram = async (programId, userId) => {
    const { rows: metaRows } = await query(
        `SELECT id, owner_id, is_public FROM programs WHERE id = $1`,
        [programId]
    );
    const meta = metaRows[0];
    if (!meta) throw new ApiError(404, 'Программа не найдена');

    if (!meta.is_public && meta.owner_id !== userId) {
        const { rows: shared } = await query(
            `SELECT 1 FROM shares WHERE program_id = $1 AND to_user_id = $2 LIMIT 1`,
            [programId, userId]
        );
        if (!shared.length) throw new ApiError(403, 'Нет доступа к этой программе');
    }

    const original = await getProgramWithDays(programId, meta.owner_id);

    return createProgram({
        ownerId: userId,
        title: `${original.title} (копия)`,
        description: original.description,
        isPublic: false,
        kind: original.kind,
        days: original.days.map((day) => ({
            title: day.title,
            exercises: day.exercises.map((ex) => ({
                exerciseId: ex.exercise_id,
                targetSets: ex.target_sets,
                targetReps: ex.target_reps,
                notes: ex.notes,
                groupIndex: ex.group_index,
            })),
        })),
    }).then(async (newProgram) => {
        await query(`UPDATE programs SET forked_from = $1 WHERE id = $2`, [programId, newProgram.id]);
        return newProgram;
    });
};

export const updateProgram = async (programId, userId, { title, description, isPublic, kind, days }) => {
    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        const { rows: owned } = await client.query(
            `SELECT id FROM programs WHERE id = $1 AND owner_id = $2`,
            [programId, userId]
        );
        if (!owned.length) throw new ApiError(404, 'Программа не найдена или нет прав доступа');

        await client.query(
            `UPDATE programs SET title = $1, description = $2, is_public = $3,
                                kind = COALESCE($4, kind), updated_at = now()
            WHERE id = $5`,
            [title, description ?? null, isPublic ?? false, kind ?? null, programId]
        );

        await client.query(`DELETE FROM program_days WHERE program_id = $1`, [programId]);

        for (const [dayIndex, day] of days.entries()) {
            const { rows: dayRows } = await client.query(
                `INSERT INTO program_days (program_id, day_index, title)
                VALUES ($1, $2, $3) RETURNING *`,
                [programId, dayIndex, day.title]
            );
            const createdDay = dayRows[0];

            for (const [exIndex, ex] of day.exercises.entries()) {
                await client.query(
                    `INSERT INTO program_exercises
                       (program_day_id, exercise_id, order_index, target_sets, target_reps, notes, group_index)
                       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
                       [
                         createdDay.id, ex.exerciseId, exIndex, ex.targetSets, ex.targetReps,
                         ex.notes ?? null, ex.groupIndex ?? exIndex,
                       ]
                );
            }
        }

        await client.query('COMMIT');
        return getProgramWithDays(programId, userId);
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};