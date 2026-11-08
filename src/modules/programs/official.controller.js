import { query } from '../../config/db.js';
import { ApiError } from '../../utils/apiError.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { createProgram } from './programs.service.js';
import { officialPrograms } from './official-catalog.js';

const findProgram = (slug) => {
  const program = officialPrograms.find((item) => item.slug === slug);
  if (!program) throw new ApiError(404, 'Программа не найдена');
  return program;
};
export const listOfficial = asyncHandler(async (_req, res) => {
  res.json({ programs: officialPrograms.map(({ days, ...program }) => ({ ...program, days_count: days.length })) });
});
export const getOfficial = asyncHandler(async (req, res) => {
  res.json({ program: findProgram(req.params.slug) });
});
export const copyOfficial = asyncHandler(async (req, res) => {
  const template = findProgram(req.params.slug);
  const names = [...new Set(template.days.flatMap((day) => day.exercises.map((ex) => ex.name)))];
  const { rows } = await query(
    `SELECT DISTINCT ON (lower(name)) id, name FROM exercises
     WHERE lower(name) = ANY($1::text[]) ORDER BY lower(name), created_by NULLS FIRST, id`,
    [names.map((name) => name.toLowerCase())]
  );
  const ids = new Map(rows.map((row) => [row.name.toLowerCase(), row.id]));
  const missing = names.filter((name) => !ids.has(name.toLowerCase()));
  if (missing.length) throw new ApiError(409, `Не найдены упражнения: ${missing.join(', ')}. Заполните библиотеку упражнений.`);
  const program = await createProgram({
    ownerId: req.userId, title: template.title, description: template.description, isPublic: false, kind: 'strength',
    days: template.days.map((day) => ({ title: day.title, exercises: day.exercises.map((ex, index) => ({
      exerciseId: ids.get(ex.name.toLowerCase()), targetSets: ex.sets, targetReps: ex.reps,
      groupIndex: index, setPlan: { mode: 'normal', restSec: 120, steps: [] },
    })) })),
  });
  res.status(201).json({ program });
});
