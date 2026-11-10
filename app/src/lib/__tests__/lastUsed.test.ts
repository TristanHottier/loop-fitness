import { describe, expect, it } from 'vitest'
import type { Session } from '../../db/db'
import { dayLabel, lastUsed, lastUsedBySlug, shortDate } from '../lastUsed'
import { log as baseLog } from './fixtures'

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

describe('lastUsed', () => {
  it('formats dates', () => {
    expect(shortDate('2026-11-03')).toBe('3 Nov')
    expect(dayLabel('2026-11-03')).toBe('Tue 3 Nov')
  })

  it('formats sets in order with the band label', () => {
    const logs = [
      log({ session_id: 's1', set_index: 3, reps: 10 }),
      log({ session_id: 's1', set_index: 1, reps: 12 }),
      log({ session_id: 's1', set_index: 2, reps: 12 }),
    ]
    const [e] = lastUsed(logs, [sess('s1', '2026-11-03')], 'pull-down')
    expect(e.text).toBe('12, 12, 10 @ 40')
    expect(e.rir).toBeNull()
    expect(e.shortDate).toBe('3 Nov')
  })

  it('splits bands, stacks and labels warm-ups and drops', () => {
    const logs = [
      log({ session_id: 's1', set_index: 0, reps: 10, band: 'T20' }),
      log({ session_id: 's1', set_index: 1, reps: 12, band: 'T30+40' }),
      log({ session_id: 's1', set_index: 2, reps: 10, band: 'T30+40' }),
      log({ session_id: 's1', set_index: 201, reps: 8, band: 'T30', set_type: 'drop' }),
    ]
    const [e] = lastUsed(logs, [sess('s1', '2026-11-03')], 'pull-down')
    expect(e.text).toBe('Warm-up 10 @ 20; 12, 10 @ 30 + 40; Drop 8 @ 30')
  })

  it('groups L/R pairs and reports RIR', () => {
    const logs = [
      log({ session_id: 's1', set_index: 1, side: 'R', reps: 11, rir: 2 }),
      log({ session_id: 's1', set_index: 1, side: 'L', reps: 12, rir: 1 }),
      log({ session_id: 's1', set_index: 2, side: 'L', reps: 10, rir: 2 }),
      log({ session_id: 's1', set_index: 2, side: 'R', reps: 10, rir: 2 }),
    ]
    const [e] = lastUsed(logs, [sess('s1', '2026-11-03')], 'pull-down')
    expect(e.text).toBe('12L/11R, 10L/10R @ 40')
    expect(e.rir).toBe('RIR 1, 2')
  })

  it('uses a single RIR when all sets match', () => {
    const logs = [log({ rir: 2, set_index: 1 }), log({ rir: 2, set_index: 2 })]
    expect(lastUsed(logs, [sess('s1', '2026-11-03')], 'pull-down')[0].rir).toBe('RIR 2')
  })

  it('ignores deleted logs and sessions, sorts newest first, applies limit', () => {
    const sessions = [
      sess('s1', '2026-11-01'),
      sess('s2', '2026-11-03'),
      sess('s3', '2026-11-05', { deleted: true }),
      sess('s4', '2026-11-04'),
    ]
    const logs = [
      log({ session_id: 's1', reps: 8 }),
      log({ session_id: 's2', reps: 9 }),
      log({ session_id: 's3', reps: 99 }),
      log({ session_id: 's4', reps: 77, deleted: true }),
      log({ session_id: 'nope', reps: 55 }),
    ]
    const all = lastUsed(logs, sessions, 'pull-down')
    expect(all.map((e) => e.sessionId)).toEqual(['s2', 's1'])
    expect(lastUsed(logs, sessions, 'pull-down', 1)).toHaveLength(1)
    expect(lastUsed(logs, sessions, 'pull-down', 5, 's2').map((e) => e.sessionId)).toEqual(['s1'])
  })

  it('maps every slug', () => {
    const logs = [log({ exercise_slug: 'a' }), log({ exercise_slug: 'b' })]
    const map = lastUsedBySlug(logs, [sess('s1', '2026-11-03')])
    expect([...map.keys()].sort()).toEqual(['a', 'b'])
  })
})
