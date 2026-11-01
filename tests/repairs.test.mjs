import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';
import { estimateOneRepMax } from '../src/utils/oneRepMax.js';
import { up as reliabilityMigration } from '../migrations/1793900000000_workout-reliability.js';
import { ApiError } from '../src/utils/apiError.js';

const id = () => crypto.randomUUID();
async function loadService(path, dependencies) {
  const source = await readFile(new URL(path, import.meta.url), 'utf8');
  const key = `serviceTest${Math.random()}`;
  globalThis[key] = dependencies;
  const module = await import('data:text/javascript;base64,' + Buffer.from(
    `const { ${Object.keys(dependencies).join(', ')} } = globalThis[${JSON.stringify(key)}];\n` +
    source.replace(/^import .*;\n/gm, '')).toString('base64'));
  delete globalThis[key];
  return module;
}

// An isolated PostgreSQL engine: no environment variables or production DB connection.
const db = new PGlite({ parsers: { 1082: (value) => value } });
await db.exec(`
CREATE TABLE users (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), settings jsonb DEFAULT '{}'::jsonb);
CREATE TABLE exercises (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text, muscle_group text, equipment text, tracking text);
CREATE TABLE programs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), owner_id uuid REFERENCES users,
 title text, description text, is_public boolean DEFAULT false, kind text, updated_at timestamptz DEFAULT now());
CREATE TABLE program_days (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_id uuid REFERENCES programs ON DELETE CASCADE,
 day_index int, title text);
CREATE TABLE program_exercises (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), program_day_id uuid REFERENCES program_days ON DELETE CASCADE,
 exercise_id uuid REFERENCES exercises, order_index int, target_sets int, target_reps text, notes text, group_index int);
CREATE TABLE workouts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users,
 program_day_id uuid REFERENCES program_days ON DELETE SET NULL, title text, date date, notes text,
 status text DEFAULT 'planned', started_at timestamptz);
CREATE TABLE workout_sets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), workout_id uuid REFERENCES workouts ON DELETE CASCADE,
 exercise_id uuid REFERENCES exercises, order_index int DEFAULT 0, group_index int DEFAULT 0, round_index int DEFAULT 0,
 weight numeric, reps int, rpe numeric, duration_sec int, is_completed boolean DEFAULT false, set_kind text DEFAULT 'normal',
 parent_set_id uuid REFERENCES workout_sets ON DELETE CASCADE, created_at timestamptz DEFAULT now());
CREATE TABLE personal_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid REFERENCES users,
 exercise_id uuid REFERENCES exercises, one_rm numeric, weight numeric, reps int,
 workout_id uuid REFERENCES workouts ON DELETE SET NULL, achieved_at date, updated_at timestamptz DEFAULT now(),
 UNIQUE(user_id, exercise_id));
CREATE TABLE nutrition_entries (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, date date,
 meal_type text, name text, calories int, protein numeric, fat numeric, carbs numeric, barcode text, grams numeric);
CREATE TABLE nutrition_targets (user_id uuid PRIMARY KEY);
CREATE TABLE ai_conversations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid, context_type text, context_id uuid);
CREATE TABLE ai_messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), conversation_id uuid REFERENCES ai_conversations ON DELETE CASCADE,
 role text, content text, created_at timestamptz DEFAULT now());
`);
const query = async (sql, params) => db.query(sql, params);
const client = { query, release() {} };
const pool = { connect: async () => client };
const workouts = await loadService('../src/modules/workouts/workouts.service.js', { query, pool, ApiError, estimateOneRepMax });
const programs = await loadService('../src/modules/programs/programs.service.js', { query, pool, ApiError });
const nutrition = await loadService('../src/modules/nutrition/nutrition.service.js', { query, ApiError });
const user = id(), other = id(), exercise = id(), exerciseB = id();
await query('INSERT INTO users (id) VALUES ($1), ($2)', [user, other]);
await query("INSERT INTO exercises (id, name, tracking) VALUES ($1, 'A', 'weight_reps'), ($2, 'B', 'weight_reps')", [exercise, exerciseB]);

test('server repairs against isolated PostgreSQL', async (t) => {
  await t.test('migration repairs legacy manual groups and duplicate active sessions', async () => {
    const old = id(), recent = id();
    await query(`INSERT INTO workouts (id, user_id, status, date, started_at) VALUES
      ($1, $3, 'in_progress', '2026-10-30', '2026-10-30'),
      ($2, $3, 'in_progress', '2026-10-31', '2026-10-31')`, [old, recent, user]);
    for (const e of [exercise, exercise, exerciseB]) await query(
      'INSERT INTO workout_sets (workout_id, exercise_id) VALUES ($1, $2)', [old, e]);
    const statements = [];
    reliabilityMigration({ sql: (sql) => statements.push(sql),
      addColumns: () => statements.push('ALTER TABLE workouts ADD COLUMN last_reminded_on date') });
    for (const statement of statements) await db.exec(statement);
    assert.equal((await query('SELECT status FROM workouts WHERE id = $1', [old])).rows[0].status, 'planned');
    assert.equal((await query('SELECT status FROM workouts WHERE id = $1', [recent])).rows[0].status, 'in_progress');
    const sets = (await workouts.getWorkoutWithSets(old, user)).sets;
    assert.equal(new Set(sets.map((s) => s.group_index)).size, 2);
    await query("UPDATE workouts SET status = 'completed' WHERE id = $1", [recent]);
  });
  await t.test('creation is idempotent and cannot reuse another user\'s ID', async () => {
    const clientId = id();
    const first = await workouts.createWorkout({ userId: user, title: 'Session', date: '2026-11-01', clientId });
    const second = await workouts.createWorkout({ userId: user, title: 'Session', date: '2026-11-01', clientId });
    assert.equal(first.id, second.id);
    await assert.rejects(workouts.createWorkout({ userId: other, title: 'Other', date: '2026-11-01', clientId }), { status: 409 });
    const food = { userId: user, date: '2026-11-01', mealType: 'snack', name: 'Apple', calories: 100, clientId: id() };
    assert.equal((await nutrition.createNutritionEntry(food)).id, (await nutrition.createNutritionEntry(food)).id);
  });
  await t.test('program day IDs survive edits, reorder and insertion; supersets materialize A/B rounds', async () => {
    const data = { title: 'Program', kind: 'strength', ownerId: user, days: [
      { title: 'One', exercises: [{ exerciseId: exercise, targetSets: 2, targetReps: '10', groupIndex: 0 },
        { exerciseId: exerciseB, targetSets: 2, targetReps: '10', groupIndex: 0 }] },
      { title: 'Two', exercises: [{ exerciseId: exercise, targetSets: 1, targetReps: '10' }] }] };
    const p = await programs.createProgram(data);
    const original = await programs.getProgramWithDays(p.id, user);
    const scheduled = await workouts.scheduleProgramToCalendar({ userId: user, programId: p.id,
      startDate: '2026-11-01', weekdays: [0], weeksCount: 1 });
    assert.equal(scheduled[0].date, '2026-11-01');
    const workout = await workouts.getWorkoutWithSets(scheduled[0].id, user);
    assert.deepEqual(workout.sets.map((s) => [s.exercise_name, s.round_index]), [['A', 0], ['B', 0], ['A', 1], ['B', 1]]);
    const editedDays = original.days.map((d, i) => ({ ...data.days[i], id: d.id })).reverse();
    await programs.updateProgram(p.id, user, { ...data, days: editedDays });
    assert.equal((await workouts.getWorkoutWithSets(workout.id, user)).program_day_id, original.days[0].id);
    assert.deepEqual((await programs.getProgramWithDays(p.id, user)).days.map((d) => d.id), editedDays.map((d) => d.id));
    const synced = await workouts.syncWorkoutWithProgram(workout.id, user);
    assert.equal(synced.id, workout.id);
    assert.equal(synced.sets.length, 4);
    const insertedDays = [...editedDays];
    insertedDays.splice(1, 0, { title: 'Inserted', exercises: data.days[1].exercises });
    const updated = await programs.updateProgram(p.id, user, { ...data, days: insertedDays });
    assert.equal(updated.days[0].id, editedDays[0].id);
    assert.equal(updated.days[2].id, editedDays[1].id);
    assert.ok(!original.days.some((d) => d.id === updated.days[1].id));
  });
  await t.test('one active workout and record corrections, unchecking and deletes', async () => {
    const w = await workouts.createWorkout({ userId: user, title: 'Active', date: '2026-11-02' });
    const w2 = await workouts.createWorkout({ userId: user, title: 'Other', date: '2026-11-03' });
    await workouts.startWorkout(w.id, user);
    await assert.rejects(workouts.startWorkout(w2.id, user), { status: 409 });
    await assert.rejects(query("UPDATE workouts SET status = 'in_progress' WHERE id = $1", [w2.id]), { code: '23505' });
    await assert.rejects(workouts.updateWorkoutStatus(w2.id, user, 'in_progress'), { status: 409 });
    const args = { workoutId: w.id, userId: user, exerciseId: exercise, weight: 100, reps: 1, isCompleted: true, clientId: id() };
    const { set } = await workouts.upsertWorkoutSet(args);
    assert.equal((await workouts.upsertWorkoutSet(args)).set.id, set.id);
    const getRecord = async () => (await query('SELECT * FROM personal_records WHERE user_id = $1', [user])).rows[0];
    assert.equal(Number((await getRecord()).one_rm), 100);
    await workouts.upsertWorkoutSet({ workoutId: w.id, userId: user, setId: set.id, weight: 50 });
    assert.equal(Number((await getRecord()).one_rm), 50);
    await workouts.updateWorkout(w.id, user, { date: '2026-11-04' });
    assert.equal((await getRecord()).achieved_at, '2026-11-04');
    await workouts.upsertWorkoutSet({ workoutId: w.id, userId: user, setId: set.id, isCompleted: false });
    assert.equal(await getRecord(), undefined);
    await workouts.upsertWorkoutSet({ workoutId: w.id, userId: user, setId: set.id, isCompleted: true });
    const higher = await workouts.upsertWorkoutSet({ ...args, weight: 80, clientId: id() });
    assert.equal(Number((await getRecord()).one_rm), 80);
    await workouts.deleteWorkoutSet(higher.set.id, w.id, user);
    assert.equal(Number((await getRecord()).one_rm), 50);
    await workouts.deleteWorkoutSet(set.id, w.id, user);
    assert.equal(await getRecord(), undefined);
    await workouts.upsertWorkoutSet({ ...args, clientId: id() });
    await workouts.deleteWorkout(w.id, user);
    assert.equal(await getRecord(), undefined);
    await workouts.startWorkout(w2.id, user);
    await workouts.updateWorkoutStatus(w2.id, user, 'completed');
  });
  await t.test('new ordinary exercises have separate groups and drop steps share the parent round', async () => {
    const w = await workouts.createWorkout({ userId: user, title: 'Manual', date: '2026-11-05' });
    const a = await workouts.upsertWorkoutSet({ workoutId: w.id, userId: user, exerciseId: exercise });
    const a2 = await workouts.upsertWorkoutSet({ workoutId: w.id, userId: user, exerciseId: exercise });
    const b = await workouts.upsertWorkoutSet({ workoutId: w.id, userId: user, exerciseId: exerciseB });
    assert.notEqual(a.set.group_index, b.set.group_index);
    assert.equal(a2.set.round_index, a.set.round_index + 1);
    const drop = await workouts.upsertWorkoutSet({ workoutId: w.id, userId: user, parentSetId: a.set.id });
    assert.equal(drop.set.round_index, a.set.round_index);
    assert.equal(drop.set.group_index, a.set.group_index);
    await assert.rejects(workouts.upsertWorkoutSet({ workoutId: w.id, userId: user, parentSetId: drop.set.id }), { status: 404 });
  });
  await t.test('AI sees latest history and nutrition without context ID; failures save no partial turn', async () => {
    let sent;
    let fail = false;
    const axios = { create: () => ({ post: async (_url, data) => {
      sent = data.messages;
      if (fail) throw new Error('provider unavailable');
      return { data: { choices: [{ message: { content: 'Answer' } }] } };
    } }) };
    const ai = await loadService('../src/modules/ai/ai.service.js', { axios, query, pool, ApiError,
      env: { openRouterApiKey: 'test', openRouterModel: 'test' } });
    const conversation = id();
    await query("INSERT INTO ai_conversations VALUES ($1, $2, 'nutrition', NULL)", [conversation, user]);
    for (let i = 0; i < 30; i++) await query(
      `INSERT INTO ai_messages (conversation_id, role, content, created_at) VALUES ($1, 'user', $2, $3)`,
      [conversation, `old-${i}`, new Date(2026, 0, 1, 0, 0, i).toISOString()]);
    await ai.sendMessageToAI(conversation, user, 'Newest question');
    assert.match(sent[0].content, /дневник питания/);
    assert.equal(sent.at(-1).content, 'Newest question');
    assert.ok(sent.some((m) => m.content === 'old-29'));
    assert.ok(!sent.some((m) => m.content === 'old-0'));
    const count = async () => Number((await query('SELECT count(*) AS n FROM ai_messages WHERE conversation_id = $1', [conversation])).rows[0].n);
    assert.equal(await count(), 32);
    fail = true;
    await assert.rejects(ai.sendMessageToAI(conversation, user, 'Retry me'), { status: 502 });
    assert.equal(await count(), 32);
  });
  await t.test('reminders use local dates, deduplicate runs and allow retry after delivery failure', async () => {
    const reminderUser = id();
    await query(`INSERT INTO users (id, settings) VALUES ($1, '{"timeZone":"Pacific/Auckland"}')`, [reminderUser]);
    const localDay = (await query("SELECT (now() AT TIME ZONE 'Pacific/Auckland')::date AS day")).rows[0].day;
    await workouts.createWorkout({ userId: reminderUser, title: 'Reminder', date: localDay });
    let count = 0;
    let deliveryFails = false;
    const reminders = await loadService('../src/modules/push/reminders.service.js', { query,
      sendPushToUser: async (userId) => { if (userId === reminderUser) count++; return [{ status: deliveryFails ? 'rejected' : 'fulfilled' }]; } });
    await reminders.sendTodayReminders();
    await reminders.sendTodayReminders();
    assert.equal(count, 1);
    await workouts.createWorkout({ userId: reminderUser, title: 'Retry reminder', date: localDay });
    deliveryFails = true;
    await reminders.sendTodayReminders();
    deliveryFails = false;
    await reminders.sendTodayReminders();
    await reminders.sendTodayReminders();
    assert.equal(count, 3);
  });
  await db.close();
});
