import { describe, expect, it } from 'vitest'
import { bestByExercise, isPR, strengthScore } from '../records'
import { defaultBandInventory } from '../ladder'
import { log, plan } from './fixtures'

describe('records', () => {
  const logs = [
    log({ band: 'T30', reps: 12 }),
    log({ band: 'T40', reps: 8 }),
    log({ band: 'T40', reps: 10 }),
    log({ band: 'T50', reps: 5, set_type: 'warmup' }),
    log({ band: 'T50', reps: 5, deleted: true }),
    log({ exercise_slug: 'curl', band: 'L5-30', reps: 9 }),
  ]
  it('summarises per exercise, ignoring warmup and deleted', () => {
    const best = bestByExercise(logs, plan)
    expect(Object.keys(best).sort()).toEqual(['curl', 'pull-down'])
    const pd = best['pull-down']
    expect(pd.maxRank).toBe(1)
    expect(pd.repsByBand).toEqual({ T30: 12, T40: 10 })
    expect(pd.bestSet).toMatchObject({ band: 'T40', reps: 10 })
  })
  it('detects PRs', () => {
    const prior = bestByExercise(logs, plan)['pull-down']
    expect(isPR(log({ band: 'T50', reps: 1 }), prior, plan)).toBe(true) // higher band
    expect(isPR(log({ band: 'T40', reps: 11 }), prior, plan)).toBe(true) // more reps
    expect(isPR(log({ band: 'T40', reps: 10 }), prior, plan)).toBe(false) // equal
    expect(isPR(log({ band: 'T30', reps: 13 }), prior, plan)).toBe(true) // more reps, lower band
    expect(isPR(log({ band: 'T30', reps: 11 }), prior, plan)).toBe(false)
    expect(isPR(log({ band: 'T50', reps: 9, set_type: 'warmup' }), prior, plan)).toBe(false)
    expect(isPR(log({ band: 'T50', reps: 9, deleted: true }), prior, plan)).toBe(false)
    expect(isPR(log({ band: 'T50' }), null, plan)).toBe(false) // no history
  })
  it('scores by rank when resistance is unknown', () => {
    const a = strengthScore(log({ band: 'T40', reps: 10 }), plan)
    const b = strengthScore(log({ band: 'T50', reps: 1 }), plan)
    expect(a).toEqual({ score: 2010, mode: 'rank' })
    expect(b.score).toBeGreaterThan(a.score)
    expect(strengthScore(log({ band: 'weird', reps: 7 }), plan)).toEqual({ score: 7, mode: 'rank' })
  })
  it('scores Epley kg when resistance is known', () => {
    const inv = defaultBandInventory(plan).map((i) => (i.id === 'T40' ? { ...i, resistanceKg: 10 } : i))
    const s = strengthScore(log({ band: 'T40', reps: 15 }), plan, inv)
    expect(s.mode).toBe('kg')
    expect(s.score).toBeCloseTo(15)
    expect(strengthScore(log({ band: 'T40', reps: 15 }), plan, inv, 'rank').mode).toBe('rank')
  })
})
