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

class FitnessDB extends Dexie {
  sessions!: Table<Session>;
  set_logs!: Table<SetLog>;

  constructor() {
    super('fitness-tracker');
    this.version(1).stores({
      sessions: 'id, date',
      set_logs: 'id, session_id',
    });
  }
}

export const db = new FitnessDB();

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
}
