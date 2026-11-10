// JSON backup and restore of every synced table.
//
// File shape (version 1):
//   { app: 'loop-fitness', version: 1, exported_at, tables: {
//       sessions, set_logs, body_metrics, nutrition, settings } }
// Rows are exported exactly as stored (ids, updated_at, deleted included).
// Restore merges row by row, last write wins on updated_at (strictly newer
// incoming wins; ties keep local), enqueues merged rows for sync, and runs in
// one Dexie transaction. The parse/plan functions are pure (no Dexie use).

import { db, enqueue } from '../db/db'
import { normalizeSetLog } from './setlog'

export const BACKUP_APP = 'loop-fitness'
export const BACKUP_VERSION = 1

export const BACKUP_TABLES = ['sessions', 'set_logs', 'body_metrics', 'nutrition', 'settings'] as const
export type BackupTable = (typeof BACKUP_TABLES)[number]

export type BackupRow = Record<string, unknown> & { updated_at: string; deleted: boolean }

export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exported_at: string
  tables: Record<BackupTable, BackupRow[]>
}

const pkOf = (table: BackupTable): string => (table === 'settings' ? 'key' : 'id')

// Required string/number fields per table, beyond pk/updated_at/deleted.
const REQUIRED: Record<BackupTable, Array<[string, 'string' | 'number']>> = {
  sessions: [['workout_id', 'string'], ['date', 'string'], ['started_at', 'string']],
  set_logs: [['session_id', 'string'], ['exercise_slug', 'string'], ['set_index', 'number'], ['reps', 'number'], ['band', 'string']],
  body_metrics: [['date', 'string'], ['type', 'string'], ['value', 'number']],
  nutrition: [['date', 'string'], ['calories', 'number'], ['protein', 'number']],
  settings: [['value', 'string']],
}

export type ParseResult = { ok: true; backup: Backup } | { ok: false; error: string }

// Parse and validate backup text. Returns a normalised Backup (set_logs get
// rir/set_type defaults, deleted coerced to boolean) or a readable error.
export function parseBackup(text: string): ParseResult {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'This file is not valid JSON.' }
  }
  if (typeof data !== 'object' || data === null || (data as Backup).app !== BACKUP_APP) {
    return { ok: false, error: 'This is not a Loop Fitness backup.' }
  }
  const d = data as Record<string, unknown>
  if (typeof d.version !== 'number' || d.version > BACKUP_VERSION || d.version < 1) {
    return { ok: false, error: `Unsupported backup version ${String(d.version)}.` }
  }
  const tables = d.tables as Record<string, unknown> | undefined
  if (typeof tables !== 'object' || tables === null) {
    return { ok: false, error: 'The backup has no tables.' }
  }
  const out = {} as Record<BackupTable, BackupRow[]>
  for (const table of BACKUP_TABLES) {
    const rows = tables[table] ?? []
    if (!Array.isArray(rows)) return { ok: false, error: `Table ${table} is not a list.` }
    const pk = pkOf(table)
    const clean: BackupRow[] = []
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i] as Record<string, unknown> | null
      const bad = (what: string) => ({ ok: false as const, error: `Row ${i + 1} of ${table}: ${what}.` })
      if (typeof r !== 'object' || r === null) return bad('not an object')
      if (typeof r[pk] !== 'string' || r[pk] === '') return bad(`missing ${pk}`)
      if (typeof r.updated_at !== 'string' || Number.isNaN(Date.parse(r.updated_at))) return bad('bad updated_at')
      for (const [field, type] of REQUIRED[table]) {
        if (typeof r[field] !== type) return bad(`bad ${field}`)
      }
      let row: Record<string, unknown> = { ...r, deleted: r.deleted === true || r.deleted === 1 }
      if (table === 'set_logs') row = normalizeSetLog(row)
      clean.push(row as BackupRow)
    }
    out[table] = clean
  }
  return {
    ok: true,
    backup: {
      app: BACKUP_APP,
      version: d.version,
      exported_at: typeof d.exported_at === 'string' ? d.exported_at : '',
      tables: out,
    },
  }
}

// Last write wins: write the incoming row if there is no local row or it is
// strictly newer. Ties keep the local row (no-op, nothing to re-sync).
export function shouldWrite(local: { updated_at: string } | undefined | null, incoming: { updated_at: string }): boolean {
  return !local || incoming.updated_at > local.updated_at
}

export interface TableCounts {
  total: number // rows in the file
  write: number // rows that would be written (new or newer than local)
  skip: number
}
export type MergePlan = Record<BackupTable, { toWrite: BackupRow[]; counts: TableCounts }>

// Decide, per table, which incoming rows win against the local rows
// (localByKey maps pk to the local row).
export function planMerge(
  backup: Backup,
  localByKey: Record<BackupTable, Map<string, { updated_at: string }>>
): MergePlan {
  const plan = {} as MergePlan
  for (const table of BACKUP_TABLES) {
    const pk = pkOf(table)
    const toWrite = backup.tables[table].filter((r) => shouldWrite(localByKey[table].get(String(r[pk])), r))
    plan[table] = {
      toWrite,
      counts: {
        total: backup.tables[table].length,
        write: toWrite.length,
        skip: backup.tables[table].length - toWrite.length,
      },
    }
  }
  return plan
}

export function totalCounts(plan: MergePlan): { total: number; write: number } {
  let total = 0
  let write = 0
  for (const t of BACKUP_TABLES) {
    total += plan[t].counts.total
    write += plan[t].counts.write
  }
  return { total, write }
}

// --- Dexie side -------------------------------------------------------------

export async function buildBackup(): Promise<Backup> {
  const [sessions, set_logs, body_metrics, nutrition, settings] = await Promise.all([
    db.sessions.toArray(),
    db.set_logs.toArray(),
    db.body_metrics.toArray(),
    db.nutrition.toArray(),
    db.settings.toArray(),
  ])
  return {
    app: BACKUP_APP,
    version: BACKUP_VERSION,
    exported_at: new Date().toISOString(),
    tables: { sessions, set_logs, body_metrics, nutrition, settings } as unknown as Backup['tables'],
  }
}

export async function exportToJson(): Promise<void> {
  const backup = await buildBackup()
  const blob = new Blob([JSON.stringify(backup)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `loop-fitness-backup-${backup.exported_at.slice(0, 10)}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

const tableOf = (table: BackupTable) => db.table(table)

async function loadLocal(backup: Backup): Promise<Record<BackupTable, Map<string, { updated_at: string }>>> {
  const out = {} as Record<BackupTable, Map<string, { updated_at: string }>>
  for (const table of BACKUP_TABLES) {
    const pk = pkOf(table)
    const keys = backup.tables[table].map((r) => String(r[pk]))
    const rows = (await tableOf(table).bulkGet(keys)) as Array<{ updated_at: string } | undefined>
    out[table] = new Map()
    rows.forEach((row, i) => {
      if (row) out[table].set(keys[i], row)
    })
  }
  return out
}

// Read-only preview: what restoring would write.
export async function previewRestore(backup: Backup): Promise<MergePlan> {
  return planMerge(backup, await loadLocal(backup))
}

// Merge the backup into the local database and enqueue every written row for
// sync, in one transaction. Returns the plan that was applied.
export async function restoreBackup(backup: Backup): Promise<MergePlan> {
  return db.transaction('rw', [db.sessions, db.set_logs, db.body_metrics, db.nutrition, db.settings, db.sync_queue], async () => {
    const plan = planMerge(backup, await loadLocal(backup))
    for (const table of BACKUP_TABLES) {
      const pk = pkOf(table)
      const rows = plan[table].toWrite
      if (rows.length === 0) continue
      await tableOf(table).bulkPut(rows)
      for (const r of rows) await enqueue(table, String(r[pk]), r.updated_at)
    }
    return plan
  })
}
