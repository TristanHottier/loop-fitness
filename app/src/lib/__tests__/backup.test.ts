import { describe, expect, it } from 'vitest'
import { BACKUP_TABLES, parseBackup, planMerge, shouldWrite, totalCounts, type Backup, type BackupTable } from '../backup'

const T = (s: string) => `2026-01-0${s}T00:00:00.000Z`
const file = (over: Record<string, unknown> = {}) =>
  JSON.stringify({
    app: 'loop-fitness',
    version: 1,
    exported_at: T('9'),
    tables: {
      sessions: [{ id: 's1', workout_id: 'pull', date: '2026-01-01', started_at: T('1'), ended_at: null, note: null, updated_at: T('1'), deleted: false }],
      set_logs: [
        { id: 'l1', session_id: 's1', exercise_slug: 'x', set_index: 0, side: null, reps: 10, band: 'T40', note: null, updated_at: T('2'), deleted: 0 },
        { id: 'l2', session_id: 's1', exercise_slug: 'x', set_index: 1, side: null, reps: 9, band: 'T40', note: null, rir: 2, set_type: 'drop', updated_at: T('2'), deleted: true },
      ],
      body_metrics: [],
      settings: [{ key: 'k', value: 'v', updated_at: T('3'), deleted: false }],
    },
    ...over,
  })

describe('parseBackup', () => {
  it('accepts a valid file and normalises set logs', () => {
    const r = parseBackup(file())
    expect(r.ok).toBe(true)
    if (!r.ok) return
    const [a, b] = r.backup.tables.set_logs
    expect(a).toMatchObject({ rir: null, set_type: 'normal', deleted: false })
    expect(b).toMatchObject({ rir: 2, set_type: 'drop', deleted: true })
    expect(r.backup.tables.nutrition).toEqual([]) // missing table tolerated
  })
  it('rejects bad input with readable errors', () => {
    expect(parseBackup('{nope')).toMatchObject({ ok: false })
    expect(parseBackup('[]')).toMatchObject({ ok: false })
    expect(parseBackup(file({ app: 'other' }))).toMatchObject({ ok: false })
    expect(parseBackup(file({ version: 2 }))).toMatchObject({ ok: false })
    expect(parseBackup(file({ version: 'x' }))).toMatchObject({ ok: false })
    expect(parseBackup(file({ tables: null }))).toMatchObject({ ok: false })
    expect(parseBackup(file({ tables: { sessions: {} } }))).toMatchObject({ ok: false })
    const noId = file({ tables: { settings: [{ value: 'v', updated_at: T('1') }] } })
    expect(parseBackup(noId)).toMatchObject({ ok: false, error: expect.stringContaining('settings') })
    const badField = file({ tables: { body_metrics: [{ id: 'b', date: 'd', type: 't', value: 'x', updated_at: T('1') }] } })
    expect(parseBackup(badField)).toMatchObject({ ok: false, error: expect.stringContaining('value') })
    const badTime = file({ tables: { nutrition: [{ id: 'n', date: 'd', calories: 1, protein: 1, updated_at: 'zzz' }] } })
    expect(parseBackup(badTime)).toMatchObject({ ok: false })
  })
})

describe('merge decisions', () => {
  it('last write wins, ties keep local', () => {
    expect(shouldWrite(undefined, { updated_at: T('1') })).toBe(true)
    expect(shouldWrite({ updated_at: T('1') }, { updated_at: T('2') })).toBe(true)
    expect(shouldWrite({ updated_at: T('2') }, { updated_at: T('2') })).toBe(false)
    expect(shouldWrite({ updated_at: T('3') }, { updated_at: T('2') })).toBe(false)
  })
  it('plans per table', () => {
    const r = parseBackup(file())
    if (!r.ok) throw new Error(r.error)
    const local = Object.fromEntries(BACKUP_TABLES.map((t) => [t, new Map()])) as Record<BackupTable, Map<string, { updated_at: string }>>
    local.sessions.set('s1', { updated_at: T('5') }) // local newer: skip
    local.set_logs.set('l1', { updated_at: T('1') }) // incoming newer: write
    const plan = planMerge(r.backup as Backup, local)
    expect(plan.sessions.counts).toEqual({ total: 1, write: 0, skip: 1 })
    expect(plan.set_logs.toWrite.map((x) => x.id)).toEqual(['l1', 'l2'])
    expect(plan.settings.counts.write).toBe(1)
    expect(totalCounts(plan)).toEqual({ total: 4, write: 3 })
  })
})
