import { query } from '../../config/db.js';

export const getContinuity = async (userId) => {
  const { rows: runs } = await query(
    `WITH weeks AS (
       SELECT DISTINCT date_trunc('week', date)::date AS wk
         FROM workouts
        WHERE user_id = $1 AND status = 'completed'
     ),
     numbered AS (
       SELECT wk, row_number() OVER (ORDER BY wk) AS rn FROM weeks
     ),
     islands AS (
       SELECT wk, (wk - (rn * INTERVAL '1 week'))::date AS grp FROM numbered
     )
     SELECT min(wk) AS started, max(wk) AS ended, count(*)::int AS len
       FROM islands
      GROUP BY grp
      ORDER BY ended DESC`,
    [userId]
  );

  const { rows: totalsRows } = await query(
    `SELECT
       count(*)::int AS total,
       max(date) AS last_date,
       count(*) FILTER (WHERE date >= date_trunc('month', CURRENT_DATE)::date)::int AS this_month,
       count(*) FILTER (
         WHERE date >= (date_trunc('month', CURRENT_DATE) - INTERVAL '1 month')::date
           AND date <  date_trunc('month', CURRENT_DATE)::date
       )::int AS last_month,
       date_trunc('week', CURRENT_DATE)::date AS this_week,
       (date_trunc('week', CURRENT_DATE) - INTERVAL '1 week')::date AS prev_week
     FROM workouts
    WHERE user_id = $1 AND status = 'completed'`,
    [userId]
  );

  const { rows: weeks } = await query(
    `SELECT g.wk::date AS week,
            EXISTS (
              SELECT 1 FROM workouts w
               WHERE w.user_id = $1
                 AND w.status = 'completed'
                 AND date_trunc('week', w.date)::date = g.wk::date
            ) AS closed
       FROM generate_series(
              date_trunc('week', CURRENT_DATE) - INTERVAL '11 weeks',
              date_trunc('week', CURRENT_DATE),
              INTERVAL '1 week'
            ) AS g(wk)
      ORDER BY g.wk`,
    [userId]
  );

  const totals = totalsRows[0] || {};
  const head = runs[0] || null;

  const continues = head && (head.ended === totals.this_week || head.ended === totals.prev_week);

  return {
    current: continues ? head.len : 0,
    longest: runs.reduce((max, r) => Math.max(max, r.len), 0),
    thisWeekClosed: head?.ended === totals.this_week,
    total: totals.total ?? 0,
    lastDate: totals.last_date ?? null,
    thisMonth: totals.this_month ?? 0,
    lastMonth: totals.last_month ?? 0,
    weeks,
  };
};

const WEEK_PRESETS = [4, 12, 26, 52];

export const getVolume = async (userId, { weeks = 12 } = {}) => {
  const span = WEEK_PRESETS.includes(Number(weeks)) ? Number(weeks) : 12;

  const { rows: series } = await query(
    `WITH bounds AS (
       SELECT (date_trunc('week', CURRENT_DATE) - (($2 - 1) || ' weeks')::interval)::date AS from_week
     ),
     grid AS (
       SELECT g.wk::date AS week
         FROM bounds b,
              generate_series(b.from_week, date_trunc('week', CURRENT_DATE)::date, INTERVAL '1 week') AS g(wk)
     ),
     agg AS (
       SELECT date_trunc('week', w.date)::date AS week,
              COALESCE(SUM(ws.weight * ws.reps), 0)::numeric AS tonnage,
              count(*)::int AS sets,
              count(DISTINCT w.id)::int AS sessions
         FROM workout_sets ws
         JOIN workouts w ON w.id = ws.workout_id
         CROSS JOIN bounds b
        WHERE w.user_id = $1
          AND w.status = 'completed'
          AND ws.is_completed = true
          AND w.date >= b.from_week
        GROUP BY 1
     )
     SELECT grid.week,
            COALESCE(agg.tonnage, 0)::float8 AS tonnage,
            COALESCE(agg.sets, 0) AS sets,
            COALESCE(agg.sessions, 0) AS sessions
       FROM grid LEFT JOIN agg ON agg.week = grid.week
      ORDER BY grid.week`,
    [userId, span]
  );

  const { rows: byMuscle } = await query(
    `SELECT e.muscle_group AS "muscleGroup",
            COALESCE(SUM(ws.weight * ws.reps), 0)::float8 AS tonnage,
            count(*)::int AS sets,
            round(avg(ws.rpe), 1)::float8 AS "avgRpe"
       FROM workout_sets ws
       JOIN workouts w ON w.id = ws.workout_id
       JOIN exercises e ON e.id = ws.exercise_id
      WHERE w.user_id = $1
        AND w.status = 'completed'
        AND ws.is_completed = true
        AND w.date >= (date_trunc('week', CURRENT_DATE) - (($2 - 1) || ' weeks')::interval)::date
      GROUP BY e.muscle_group
      ORDER BY sets DESC`,
    [userId, span]
  );

  const { rows: windows } = await query(
    `WITH bounds AS (
       SELECT (date_trunc('week', CURRENT_DATE) - (($2 - 1) || ' weeks')::interval)::date AS cur_from,
              (date_trunc('week', CURRENT_DATE) - ((2 * $2 - 1) || ' weeks')::interval)::date AS prev_from
     )
     SELECT
       COALESCE(SUM(ws.weight * ws.reps) FILTER (WHERE w.date >= b.cur_from), 0)::float8 AS cur_tonnage,
       count(*) FILTER (WHERE w.date >= b.cur_from)::int AS cur_sets,
       count(DISTINCT w.id) FILTER (WHERE w.date >= b.cur_from)::int AS cur_sessions,
       COALESCE(SUM(ws.weight * ws.reps) FILTER (WHERE w.date < b.cur_from), 0)::float8 AS prev_tonnage,
       count(*) FILTER (WHERE w.date < b.cur_from)::int AS prev_sets,
       count(DISTINCT w.id) FILTER (WHERE w.date < b.cur_from)::int AS prev_sessions
     FROM workout_sets ws
     JOIN workouts w ON w.id = ws.workout_id
     CROSS JOIN bounds b
     WHERE w.user_id = $1
       AND w.status = 'completed'
       AND ws.is_completed = true
       AND w.date >= b.prev_from`,
    [userId, span]
  );

  const w = windows[0] || {};

  return {
    weeks: span,
    series,
    byMuscle,
    totals: {
      tonnage: w.cur_tonnage ?? 0,
      sets: w.cur_sets ?? 0,
      sessions: w.cur_sessions ?? 0,
    },
    previous: {
      tonnage: w.prev_tonnage ?? 0,
      sets: w.prev_sets ?? 0,
      sessions: w.prev_sessions ?? 0,
    },
  };
};
