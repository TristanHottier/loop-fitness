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

export interface SyncQueueEntry {
  id: string;
  table: string; // 'sessions' | 'set_logs' | 'body_metrics' | 'settings'
  record_id: string;
  updated_at: string; // ISO
}

class FitnessDB extends Dexie {
  sessions!: Table<Session>;
  set_logs!: Table<SetLog>;
  body_metrics!: Table<BodyMetric>;
  settings!: Table<Setting>;
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

export async function updateSession(session: Session): Promise<void> {
  session.updated_at = new Date().toISOString();
  await db.sessions.put(session);
  await enqueue('sessions', session.id, session.updated_at);
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
