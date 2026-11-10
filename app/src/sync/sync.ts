// Sync layer for the loop-fitness PWA.
// Local-first: mutations are queued in the outbox (sync_queue) and pushed to
// the Worker; pulls merge remote rows with last-write-wins by updated_at.
// Reference: docs/fitness-app-brief.md, sections 2 and 5.

import {
  db,
  normalizeSetLog,
  getSetting,
  setSetting,
  getSyncQueue,
  clearSyncQueue,
  type Session,
  type SetLog,
  type BodyMetric,
  type Setting,
  type NutritionEntry,
} from '../db/db'

const TOKEN_KEY = 'loop.token'
const LAST_PULL_KEY = 'loop.last_pull_at'

// The Worker base URL. The URL is public (the passphrase gates access, not the
// URL), so it ships as a default. VITE_API_URL can override it for local dev;
// set it to an empty string to run in offline-only mode.
const DEFAULT_API_BASE = 'https://loop-fitness-api.tristan-ho2tier.workers.dev'
const API_BASE = (import.meta.env.VITE_API_URL ?? DEFAULT_API_BASE).replace(/\/$/, '')

export type SyncStatus =
  | { state: 'idle' }
  | { state: 'syncing' }
  | { state: 'synced'; at: string }
  | { state: 'error'; message: string }
  | { state: 'not-configured' }

export function isConfigured(): boolean {
  return API_BASE.length > 0
}

// The Worker base URL, exposed so other modules (e.g. the push client) can
// build endpoint URLs without duplicating the default/override logic.
export function getApiBase(): string {
  return API_BASE
}

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token)
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export function getLastPullAt(): string {
  return localStorage.getItem(LAST_PULL_KEY) ?? ''
}

function setLastPullAt(value: string): void {
  localStorage.setItem(LAST_PULL_KEY, value)
}

// Exchange the passphrase for a long-lived token.
export async function authenticate(passphrase: string): Promise<boolean> {
  if (!isConfigured()) return false
  try {
    const res = await fetch(`${API_BASE}/auth`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passphrase }),
    })
    const data = (await res.json()) as { ok: boolean; token?: string }
    if (res.ok && data.ok && data.token) {
      setToken(data.token)
      return true
    }
    clearToken()
    return false
  } catch {
    return false
  }
}

// Fetch a local record by primary key, for the push payload.
async function fetchRecord(table: string, recordId: string): Promise<Record<string, unknown> | null> {
  switch (table) {
    case 'sessions': {
      const r = await db.sessions.get(recordId)
      return r ? (r as unknown as Record<string, unknown>) : null
    }
    case 'set_logs': {
      const r = await db.set_logs.get(recordId)
      return r ? (r as unknown as Record<string, unknown>) : null
    }
    case 'body_metrics': {
      const r = await db.body_metrics.get(recordId)
      return r ? (r as unknown as Record<string, unknown>) : null
    }
    case 'settings': {
      const r = await db.settings.get(recordId)
      return r ? (r as unknown as Record<string, unknown>) : null
    }
    case 'nutrition': {
      const r = await db.nutrition.get(recordId)
      return r ? (r as unknown as Record<string, unknown>) : null
    }
    default:
      return null
  }
}

// Push all queued mutations to the Worker.
export async function push(): Promise<number> {
  const queue = await getSyncQueue()
  if (queue.length === 0) return 0
  const token = getToken()
  if (!token) throw new Error('not authenticated')

  const byTable: Record<string, Record<string, unknown>[]> = {}
  const pushedIds: string[] = []
  const skippedIds: string[] = []

  for (const entry of queue) {
    const record = await fetchRecord(entry.table, entry.record_id)
    if (!record) {
      // The local record no longer exists (should not happen, since the app
      // only soft-deletes). Drop the orphan entry so it does not block the queue.
      skippedIds.push(entry.id)
      continue
    }
    ;(byTable[entry.table] ??= []).push(record)
    pushedIds.push(entry.id)
  }

  const res = await fetch(`${API_BASE}/sync/push`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ records: byTable }),
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `push failed (${res.status})`)
  }
  // Rows the Worker rejected as invalid would never succeed; drop them too
  // (with a warning) so they cannot block the queue forever.
  const data = (await res.json().catch(() => ({}))) as { rejected?: Record<string, string[]> }
  const rejected = data.rejected ?? {}
  const rejectedIds: string[] = []
  for (const entry of queue) {
    if (rejected[entry.table]?.includes(entry.record_id)) {
      console.warn(`sync: dropping rejected ${entry.table} record ${entry.record_id}`)
      rejectedIds.push(entry.id)
    }
  }
  await clearSyncQueue([...pushedIds, ...skippedIds])
  return pushedIds.length - rejectedIds.length
}

// Merge a single remote row into the local store (last write wins).
async function mergeRecord(table: string, record: Record<string, unknown>): Promise<void> {
  const incomingUpdatedAt = String(record.updated_at ?? '')
  switch (table) {
    case 'sessions': {
      const local = await db.sessions.get(String(record.id))
      if (!local || local.updated_at <= incomingUpdatedAt) {
        await db.sessions.put(record as unknown as Session)
      }
      break
    }
    case 'set_logs': {
      const local = await db.set_logs.get(String(record.id))
      if (!local || local.updated_at <= incomingUpdatedAt) {
        await db.set_logs.put(normalizeSetLog(record) as unknown as SetLog)
      }
      break
    }
    case 'body_metrics': {
      const local = await db.body_metrics.get(String(record.id))
      if (!local || local.updated_at <= incomingUpdatedAt) {
        await db.body_metrics.put(record as unknown as BodyMetric)
      }
      break
    }
    case 'settings': {
      const key = String(record.key)
      const local = await db.settings.get(key)
      if (!local || local.updated_at <= incomingUpdatedAt) {
        await db.settings.put(record as unknown as Setting)
      }
      break
    }
    case 'nutrition': {
      const local = await db.nutrition.get(String(record.id))
      if (!local || local.updated_at <= incomingUpdatedAt) {
        await db.nutrition.put(record as unknown as NutritionEntry)
      }
      break
    }
  }
}

// Pull remote rows newer than the last cursor and merge them locally.
export async function pull(): Promise<number> {
  const token = getToken()
  if (!token) throw new Error('not authenticated')
  const since = getLastPullAt()
  const res = await fetch(`${API_BASE}/sync/pull?since=${encodeURIComponent(since)}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string }
    throw new Error(data.error ?? `pull failed (${res.status})`)
  }
  const data = (await res.json()) as Record<string, Record<string, unknown>[]>
  let count = 0
  for (const table of ['sessions', 'set_logs', 'body_metrics', 'settings', 'nutrition']) {
    const rows = data[table] ?? []
    for (const row of rows) {
      await mergeRecord(table, row)
      count += 1
    }
  }
  if (count > 0) {
    setLastPullAt(new Date().toISOString())
  }
  return count
}

// The reminder cron computes local time from a stored UTC offset. If reminders
// are on and the device's offset changed (travel, DST), update it through the
// normal settings write path so it syncs. Keys mirror push.ts (not imported:
// push.ts imports this module).
async function refreshReminderOffset(): Promise<void> {
  if ((await getSetting('reminder_weighin_enabled')) !== '1') return
  const current = String(-new Date().getTimezoneOffset())
  if ((await getSetting('reminder_timezone_offset')) !== current) {
    await setSetting('reminder_timezone_offset', current)
  }
}

// Full sync: push local changes, then pull remote changes.
export async function syncNow(): Promise<SyncStatus> {
  if (!isConfigured()) return { state: 'not-configured' }
  if (!getToken()) return { state: 'error', message: 'not authenticated' }
  try {
    await push()
    await pull()
    await refreshReminderOffset().catch(() => {})
    return { state: 'synced', at: new Date().toISOString() }
  } catch (err) {
    return { state: 'error', message: err instanceof Error ? err.message : String(err) }
  }
}

export async function pendingCount(): Promise<number> {
  return (await getSyncQueue()).length
}
