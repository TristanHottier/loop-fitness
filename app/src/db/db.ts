import Dexie, { type Table } from 'dexie';

export interface Session {
  id: string;
  workout_id: string;
  date: string; // YYYY-MM-DD
  started_at: string; // ISO
  ended_at: string | null; // ISO
  note: string | null;
  updated_at: string; // ISO
  deleted: boolean;
}

export interface SetLog {
  id: string;
  session_id: string;
  exercise_slug: string;
  set_index: number;
  side: string | null; // null, "L", "R"
  reps: number;
  band: string;
  note: string | null;
  updated_at: string; // ISO
  deleted: boolean;
}

export type BodyMetricType =
  | 'weight_kg'
  | 'arm_left_cm'
  | 'arm_right_cm'
  | 'shoulders_cm'
  | 'chest_cm'
  | 'waist_cm';

export interface BodyMetric {
  id: string;
  date: string; // YYYY-MM-DD
  type: BodyMetricType;
  value: number;
  updated_at: string; // ISO
  deleted: boolean;
}

export interface Setting {
  key: string;
  value: string;
  updated_at: string; // ISO
  deleted: boolean;
}

export interface NutritionEntry {
  id: string;
  date: string; // YYYY-MM-DD
  calories: number;
  protein: number;
  updated_at: string; // ISO
  deleted: boolean;
}

export interface SyncQueueEntry {
  id: string;
  table: string; // 'sessions' | 'set_logs' | 'body_metrics' | 'settings' | 'nutrition'
  record_id: string;
  updated_at: string; // ISO
}

class FitnessDB extends Dexie {
  sessions!: Table<Session>;
  set_logs!: Table<SetLog>;
  body_metrics!: Table<BodyMetric>;
  settings!: Table<Setting>;
  nutrition!: Table<NutritionEntry>;
  sync_queue!: Table<SyncQueueEntry>;

  constructor() {
    super('fitness-tracker');
    this.version(1).stores({
      sessions: 'id, date',
      set_logs: 'id, session_id',
    });
    this.version(2).stores({
      body_metrics: 'id, date, type',
    });
    this.version(3).stores({
      settings: 'key',
      sync_queue: 'id, table, record_id',
    });
    this.version(4).stores({
      nutrition: 'id, date',
    });
  }
}

export const db = new FitnessDB();

// Outbox: record a mutation so the sync layer can push it later.
export async function enqueue(table: string, recordId: string, updatedAt: string): Promise<void> {
  await db.sync_queue.put({
    id: crypto.randomUUID(),
    table,
    record_id: recordId,
    updated_at: updatedAt,
  });
}

export async function getSetting(key: string): Promise<string | null> {
  const row = await db.settings.get(key);
  if (!row || row.deleted) return null;
  return row.value;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const now = new Date().toISOString();
  const row: Setting = {
    key,
    value,
    updated_at: now,
    deleted: false,
  };
  await db.settings.put(row);
  await enqueue('settings', key, now);
}

export async function getSyncQueue(): Promise<SyncQueueEntry[]> {
  return db.sync_queue.toArray();
}

export async function clearSyncQueue(ids: string[]): Promise<void> {
  await db.sync_queue.where('id').anyOf(ids).delete();
}

export function newSession(workoutId: string, date: string): Session {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    workout_id: workoutId,
    date,
    started_at: now,
    ended_at: null,
    note: null,
    updated_at: now,
    deleted: false,
  };
}

export async function createSession(session: Session): Promise<void> {
  await db.sessions.put(session);
  await enqueue('sessions', session.id, session.updated_at);
}

export function newSetLog(
  sessionId: string,
  exerciseSlug: string,
  setIndex: number,
  side: string | null,
  reps: number,
  band: string,
  note?: string | null
): SetLog {
  return {
    id: crypto.randomUUID(),
    session_id: sessionId,
    exercise_slug: exerciseSlug,
    set_index: setIndex,
    side,
    reps,
    band,
    note: note ?? null,
    updated_at: new Date().toISOString(),
    deleted: false,
  };
}

export async function createSetLog(log: SetLog): Promise<void> {
  await db.set_logs.put(log);
  await enqueue('set_logs', log.id, log.updated_at);
}

export async function updateSetLog(log: SetLog): Promise<void> {
  log.updated_at = new Date().toISOString();
  await db.set_logs.put(log);
  await enqueue('set_logs', log.id, log.updated_at);
}

export async function deleteSetLog(id: string): Promise<void> {
  const log = await db.set_logs.get(id);
  if (!log) return;
  log.deleted = true;
  log.updated_at = new Date().toISOString();
  await db.set_logs.put(log);
  await enqueue('set_logs', id, log.updated_at);
}

export async function getSession(id: string): Promise<Session | null> {
  const session = await db.sessions.get(id);
  if (!session || session.deleted) return null;
  return session;
}

export async function getSetLogsForSession(sessionId: string): Promise<SetLog[]> {
  const logs = await db.set_logs
    .where('session_id')
    .equals(sessionId)
    .filter((log) => !log.deleted)
    .toArray();
  logs.sort(
    (a, b) =>
      a.exercise_slug.localeCompare(b.exercise_slug) ||
      a.set_index - b.set_index ||
      (a.side ?? '').localeCompare(b.side ?? '')
  );
  return logs;
}

export async function getLatestBandForExercise(exerciseSlug: string): Promise<string | null> {
  const logs = await db.set_logs
    .filter((log) => !log.deleted && log.exercise_slug === exerciseSlug)
    .toArray();
  if (logs.length === 0) return null;
  const latest = logs.reduce((a, b) => (a.updated_at >= b.updated_at ? a : b));
  return latest.band;
}

export async function getLatestRepsForExercise(exerciseSlug: string): Promise<number | null> {
  const logs = await db.set_logs
    .filter((log) => !log.deleted && log.exercise_slug === exerciseSlug)
    .toArray();
  if (logs.length === 0) return null;
  const latest = logs.reduce((a, b) => (a.updated_at >= b.updated_at ? a : b));
  return latest.reps;
}

// The set logs from the most recent session for a given exercise, used to
// compute the next-session progression suggestion. Keyed on the session date
// (not the log updated_at) so editing an old session does not change which
// session the suggestion is computed from.
export async function getLatestSessionLogsForExercise(
  exerciseSlug: string
): Promise<SetLog[]> {
  const logs = await db.set_logs
    .filter((log) => !log.deleted && log.exercise_slug === exerciseSlug)
    .toArray();
  if (logs.length === 0) return [];
  const sessionIds = [...new Set(logs.map((log) => log.session_id))];
  const sessions = await db.sessions.where('id').anyOf(sessionIds).toArray();
  const dateById = new Map(sessions.map((s) => [s.id, s.date]));
  const latestSession = logs.reduce((a, b) => {
    const aDate = dateById.get(a.session_id) ?? '';
    const bDate = dateById.get(b.session_id) ?? '';
    return aDate >= bDate ? a : b;
  }).session_id;
  return logs.filter((log) => log.session_id === latestSession);
}

export async function endSession(sessionId: string): Promise<void> {
  const session = await db.sessions.get(sessionId);
  if (!session) return;
  const now = new Date().toISOString();
  session.ended_at = now;
  session.updated_at = now;
  await db.sessions.put(session);
  await enqueue('sessions', session.id, now);
}

export async function getSessions(): Promise<Session[]> {
  const sessions = await db.sessions
    .filter((session) => !session.deleted)
    .toArray();
  sessions.sort((a, b) => b.date.localeCompare(a.date));
  return sessions;
}

// The date of the earliest logged session, or null. Used for the deload cycle.
export async function getFirstSessionDate(): Promise<string | null> {
  const sessions = await db.sessions
    .filter((session) => !session.deleted)
    .toArray();
  if (sessions.length === 0) return null;
  return sessions.reduce((a, b) => (a.date <= b.date ? a : b)).date;
}

// The date of the most recent arm measurement (left or right), or null.
export async function getLastArmMeasurementDate(): Promise<string | null> {
  const metrics = await db.body_metrics
    .filter((m) => !m.deleted && (m.type === 'arm_left_cm' || m.type === 'arm_right_cm'))
    .toArray();
  if (metrics.length === 0) return null;
  return metrics.reduce((a, b) => (a.date >= b.date ? a : b)).date;
}

export async function updateSession(session: Session): Promise<void> {
  session.updated_at = new Date().toISOString();
  await db.sessions.put(session);
  await enqueue('sessions', session.id, session.updated_at);
}

// Soft-delete every session and set log, and enqueue each so the reset
// propagates to the server. Body metrics, nutrition, and settings are
// untouched.
export async function resetSessionHistory(): Promise<void> {
  const now = new Date().toISOString();
  const sessions = await db.sessions.filter((s) => !s.deleted).toArray();
  for (const s of sessions) {
    s.deleted = true;
    s.updated_at = now;
    await db.sessions.put(s);
    await enqueue('sessions', s.id, now);
  }
  const logs = await db.set_logs.filter((l) => !l.deleted).toArray();
  for (const l of logs) {
    l.deleted = true;
    l.updated_at = now;
    await db.set_logs.put(l);
    await enqueue('set_logs', l.id, now);
  }
}

// Soft-delete a single session and its set logs, and enqueue each so the
// delete propagates to the server.
export async function deleteSession(id: string): Promise<void> {
  const now = new Date().toISOString();
  const session = await db.sessions.get(id);
  if (session && !session.deleted) {
    session.deleted = true;
    session.updated_at = now;
    await db.sessions.put(session);
    await enqueue('sessions', id, now);
  }
  const logs = await db.set_logs
    .where('session_id')
    .equals(id)
    .filter((l) => !l.deleted)
    .toArray();
  for (const log of logs) {
    log.deleted = true;
    log.updated_at = now;
    await db.set_logs.put(log);
    await enqueue('set_logs', log.id, now);
  }
}

export function newBodyMetric(type: BodyMetricType, date: string, value: number): BodyMetric {
  return {
    id: crypto.randomUUID(),
    date,
    type,
    value,
    updated_at: new Date().toISOString(),
    deleted: false,
  };
}

export async function createBodyMetric(metric: BodyMetric): Promise<void> {
  await db.body_metrics.put(metric);
  await enqueue('body_metrics', metric.id, metric.updated_at);
}

export async function updateBodyMetric(metric: BodyMetric): Promise<void> {
  metric.updated_at = new Date().toISOString();
  await db.body_metrics.put(metric);
  await enqueue('body_metrics', metric.id, metric.updated_at);
}

export async function deleteBodyMetric(id: string): Promise<void> {
  const metric = await db.body_metrics.get(id);
  if (!metric) return;
  metric.deleted = true;
  metric.updated_at = new Date().toISOString();
  await db.body_metrics.put(metric);
  await enqueue('body_metrics', id, metric.updated_at);
}

export async function getBodyMetrics(type: BodyMetricType): Promise<BodyMetric[]> {
  const metrics = await db.body_metrics
    .where('type')
    .equals(type)
    .filter((metric) => !metric.deleted)
    .toArray();
  metrics.sort((a, b) => a.date.localeCompare(b.date));
  return metrics;
}

export async function getLatestBodyMetric(type: BodyMetricType): Promise<BodyMetric | null> {
  const metrics = await getBodyMetrics(type);
  if (metrics.length === 0) return null;
  return metrics.reduce((a, b) =>
    b.date.localeCompare(a.date) > 0 ||
    (b.date === a.date && b.updated_at.localeCompare(a.updated_at) > 0)
      ? b
      : a
  );
}

export function newNutritionEntry(date: string, calories: number, protein: number): NutritionEntry {
  return {
    id: crypto.randomUUID(),
    date,
    calories,
    protein,
    updated_at: new Date().toISOString(),
    deleted: false,
  };
}

export async function createNutritionEntry(entry: NutritionEntry): Promise<void> {
  await db.nutrition.put(entry);
  await enqueue('nutrition', entry.id, entry.updated_at);
}

export async function updateNutritionEntry(entry: NutritionEntry): Promise<void> {
  entry.updated_at = new Date().toISOString();
  await db.nutrition.put(entry);
  await enqueue('nutrition', entry.id, entry.updated_at);
}

export async function deleteNutritionEntry(id: string): Promise<void> {
  const entry = await db.nutrition.get(id);
  if (!entry) return;
  entry.deleted = true;
  entry.updated_at = new Date().toISOString();
  await db.nutrition.put(entry);
  await enqueue('nutrition', id, entry.updated_at);
}

export async function getNutritionEntries(): Promise<NutritionEntry[]> {
  const entries = await db.nutrition
    .filter((e) => !e.deleted)
    .toArray();
  entries.sort((a, b) => a.date.localeCompare(b.date));
  return entries;
}

export async function getNutritionEntryByDate(date: string): Promise<NutritionEntry | null> {
  const entries = await db.nutrition
    .where('date')
    .equals(date)
    .filter((e) => !e.deleted)
    .toArray();
  if (entries.length === 0) return null;
  return entries.reduce((a, b) => (a.updated_at >= b.updated_at ? a : b));
}
