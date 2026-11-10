import { describe, expect, it } from 'vitest'
import type { Session } from '../../db/db'
import {
  exerciseHistory,
  exerciseSeries,
  formatSets,
  monthSummary,
  prsInRange,
  recordsByBand,
  streakWeeks,
  volumeStatus,
  weeklyVolume,
} from '../analytics'
import { defaultBandInventory } from '../ladder'
import { log as baseLog, plan } from './fixtures'

// The shared fixture uses set_index 0 (a warm-up row by the setRows encoding);
// default to a planned set here.
const log: typeof baseLog = (over = {}) => baseLog({ set_index: 1, ...over })

function sess(id: string, date: string, over: Partial<Session> = {}): Session {
  return {
    id,
    workout_id: 'pull',
    date,
    started_at: `${date}T10:00:00.000Z`,
    ended_at: `${date}T11:00:00.000Z`,
    note: null,
    updated_at: `${date}T11:00:00.000Z`,
    deleted: false,
    ...over,
  }
}

// 2026-11-02 is a Monday.
describe('weeklyVolume', () => {
  const sessions = [sess('a', '2026-11-02'), sess('b', '2026-11-08'), sess('c', '2026-11-09'), sess('d', '2026-11-03', { deleted: true })]
  it('credits primary 1, secondary 0.5, within the Monday week only', () => {
    const logs = [
      log({ session_id: 'a', reps: 10 }),
      log({ session_id: 'a', reps: 10 }),
      log({ session_id: 'b' }), // Sunday, same week
      log({ session_id: 'c' }), // next week
    ]
    const v = weeklyVolume(logs, sessions, plan, '2026-11-05') // any day of the week
    expect(v.lats).toBe(3)
    expect(v.biceps).toBe(1.5)
    expect(weeklyVolume(logs, sessions, plan, '2026-11-09').lats).toBe(1)
  })
  it('weights set types, ignores deleted logs and deleted sessions', () => {
    const logs = [
      log({ session_id: 'a', set_type: 'warmup' }),
      log({ session_id: 'a', set_type: 'drop' }),
      log({ session_id: 'a', set_type: 'failure' }),
      log({ session_id: 'a', deleted: true }),
      log({ session_id: 'd' }),
    ]
    expect(weeklyVolume(logs, sessions, plan, '2026-11-02').lats).toBe(1.5)
  })
  it('counts an L/R pair of a unilateral exercise as one set', () => {
    const logs = [
      log({ session_id: 'a', exercise_slug: 'side-pull-biceps', side: 'L' }),
      log({ session_id: 'a', exercise_slug: 'side-pull-biceps', side: 'R' }),
    ]
    const v = weeklyVolume(logs, sessions, plan, '2026-11-02')
    expect(v.biceps).toBe(1)
    expect(v.forearms).toBe(0.5)
  })
  it('honours set_index encoding of warm-ups and drops', () => {
    const logs = [
      log({ session_id: 'a', set_index: 0 }), // warm-up row, type left normal
      log({ session_id: 'a', set_index: -1 }),
      log({ session_id: 'a', set_index: 101 }), // drop row
      log({ session_id: 'a', set_index: 1 }),
    ]
    expect(weeklyVolume(logs, sessions, plan, '2026-11-02').lats).toBe(1.5)
    const h = exerciseHistory([log({ session_id: 'a', set_index: 0, reps: 5 }), log({ session_id: 'a', set_index: 101, reps: 6 }), log({ session_id: 'a', set_index: 1, reps: 12 }), log({ session_id: 'a', set_index: 2, reps: 11 })], sessions, 'pull-down')
    expect(h[0].text).toBe('12, 6, 11 @ T40')
  })
  it('ignores unknown exercises', () => {
    expect(weeklyVolume([log({ session_id: 'a', exercise_slug: 'nope' })], sessions, plan, '2026-11-02')).toEqual({})
  })
  it('classifies against targets', () => {
    const t = { min: 10, max: 20 }
    expect([volumeStatus(9.5, t), volumeStatus(10, t), volumeStatus(20, t), volumeStatus(21, t)]).toEqual([
      'below',
      'within',
      'within',
      'above',
    ])
  })
})

describe('exerciseSeries', () => {
  const sessions = [sess('a', '2026-11-02'), sess('b', '2026-11-09')]
  const logs = [
    log({ session_id: 'a', band: 'T40', reps: 10 }),
    log({ session_id: 'a', band: 'T40', reps: 12 }),
    log({ session_id: 'a', band: 'T50', reps: 5, set_type: 'warmup' }),
    log({ session_id: 'b', band: 'T50', reps: 8 }),
  ]
  it('uses rank mode when resistance is unknown, one best point per session', () => {
    const s = exerciseSeries(logs, sessions, 'pull-down', plan, defaultBandInventory(plan))
    expect(s.mode).toBe('rank')
    expect(s.points.map((p) => p.label)).toEqual(['12 @ T40', '8 @ T50'])
    expect(s.points[0].y).toBeCloseTo(1 + 12 / 40)
    expect(s.points[1].y).toBeGreaterThan(s.points[0].y)
    expect(s.ticks.map((t) => t.label)).toEqual(['T40', 'T50'])
  })
  it('uses kg mode only when every set has a known resistance', () => {
    const inv = defaultBandInventory(plan).map((b) => ({ ...b, resistanceKg: b.id === 'T40' ? 10 : b.id === 'T50' ? 15 : null }))
    const s = exerciseSeries(logs, sessions, 'pull-down', plan, inv)
    expect(s.mode).toBe('kg')
    expect(s.points[0].y).toBeCloseTo(10 * (1 + 12 / 30))
    const partial = inv.map((b) => (b.id === 'T50' ? { ...b, resistanceKg: null } : b))
    expect(exerciseSeries(logs, sessions, 'pull-down', plan, partial).mode).toBe('rank')
  })
  it('returns nothing for an exercise without logs', () => {
    expect(exerciseSeries(logs, sessions, 'squat', plan).points).toEqual([])
  })
})

describe('history and records', () => {
  const sessions = [sess('a', '2026-11-02'), sess('b', '2026-11-09')]
  const logs = [
    log({ session_id: 'a', set_index: 2, reps: 10 }),
    log({ session_id: 'a', set_index: 1, reps: 12 }),
    log({ session_id: 'b', set_index: 1, reps: 12 }),
    log({ session_id: 'b', set_index: 2, reps: 8, band: 'T30+40' }),
  ]
  it('lists newest sessions first with formatted sets', () => {
    const h = exerciseHistory(logs, sessions, 'pull-down', 5)
    expect(h.map((e) => e.date)).toEqual(['2026-11-09', '2026-11-02'])
    expect(h[1].text).toBe('12, 10 @ T40')
    expect(h[0].text).toBe('12 @ T40; 8 @ T30+40')
    expect(exerciseHistory(logs, sessions, 'pull-down', 1)).toHaveLength(1)
  })
  it('formats sides', () => {
    expect(formatSets([{ reps: 12, band: 'T40', side: 'L' }, { reps: 11, band: 'T40', side: 'R' }])).toBe('12L, 11R @ T40')
  })
  it('records best reps per band, heaviest first', () => {
    expect(recordsByBand(logs, sessions, 'pull-down', plan)).toEqual([
      { band: 'T30+40', reps: 8 },
      { band: 'T40', reps: 12 },
    ])
  })
})

describe('prsInRange', () => {
  const sessions = [sess('a', '2026-10-05'), sess('b', '2026-11-02'), sess('c', '2026-11-09')]
  const logs = [
    log({ session_id: 'a', band: 'T40', reps: 10 }),
    log({ session_id: 'b', band: 'T40', reps: 11 }),
    log({ session_id: 'b', band: 'T40', reps: 12 }), // same session: still one hit
    log({ session_id: 'c', band: 'T40', reps: 12 }), // equal, no PR
    log({ session_id: 'c', band: 'T50', reps: 3 }), // higher band
  ]
  it('never flags the first ever session and counts once per exercise per session', () => {
    const hits = prsInRange(logs, sessions, plan, '2026-10-01', '2026-12-31')
    expect(hits.map((h) => h.sessionId)).toEqual(['b', 'c'])
    expect(hits[0].log.reps).toBe(12)
  })
  it('filters by range but keeps earlier history as the baseline', () => {
    const hits = prsInRange(logs, sessions, plan, '2026-11-09', '2026-11-30')
    expect(hits.map((h) => h.sessionId)).toEqual(['c'])
  })
})

describe('streakWeeks', () => {
  // weeks start 10-26, 11-02, 11-09 (today is Wed 11-11)
  const mk = (dates: string[]) => dates.map((d, i) => sess(`s${i}`, d))
  const today = '2026-11-11'
  it('counts consecutive met weeks; unmet current week does not break', () => {
    const s = mk(['2026-10-26', '2026-10-28', '2026-11-02', '2026-11-04', '2026-11-09'])
    expect(streakWeeks(s, today, 2)).toBe(2)
  })
  it('counts the current week once met', () => {
    const s = mk(['2026-10-26', '2026-10-28', '2026-11-02', '2026-11-04', '2026-11-09', '2026-11-10'])
    expect(streakWeeks(s, today, 2)).toBe(3)
  })
  it('breaks on a missed week', () => {
    const s = mk(['2026-10-26', '2026-10-28', '2026-11-09', '2026-11-10'])
    expect(streakWeeks(s, today, 2)).toBe(1)
  })
  it('survives rescheduling within a week', () => {
    const a = mk(['2026-11-02', '2026-11-04'])
    const b = mk(['2026-11-03', '2026-11-08'])
    expect(streakWeeks(a, today, 2)).toBe(streakWeeks(b, today, 2))
  })
  it('ignores open and deleted sessions; zero target gives 0', () => {
    const s = [sess('x', '2026-11-02', { ended_at: null }), sess('y', '2026-11-03', { deleted: true })]
    expect(streakWeeks(s, today, 1)).toBe(0)
    expect(streakWeeks(s, today, 0)).toBe(0)
  })
})

describe('monthSummary', () => {
  const sessions = [sess('a', '2026-10-05'), sess('b', '2026-11-02'), sess('c', '2026-11-09'), sess('d', '2026-11-10', { ended_at: null })]
  const logs = [
    log({ session_id: 'a', band: 'T40', reps: 10 }),
    log({ session_id: 'b', band: 'T40', reps: 12 }),
    log({ session_id: 'b', band: 'T40', reps: 12 }),
    log({ session_id: 'b', band: 'T40', reps: 5, set_type: 'warmup' }),
    log({ session_id: 'c', band: 'T40', reps: 14 }),
    log({ session_id: 'd', band: 'T40', reps: 14 }),
  ]
  it('summarises completed sessions in the month', () => {
    const m = monthSummary(logs, sessions, plan, 2026, 11)
    expect(m.sessions).toBe(2)
    expect(m.sets).toBe(3)
    expect(m.reps).toBe(38)
    expect(m.prs).toBe(2) // b beats 10 (october), c beats 12
    expect(m.topMuscle).toEqual({ muscle: 'lats', sets: 3 })
  })
  it('handles an empty month', () => {
    expect(monthSummary(logs, sessions, plan, 2026, 12)).toEqual({ sessions: 0, sets: 0, reps: 0, prs: 0, topMuscle: null })
  })
})
