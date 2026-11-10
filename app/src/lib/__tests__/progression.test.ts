import { describe, expect, it } from 'vitest'
import { suggestForExercise } from '../suggestions'
import { deloadAdvice, groupHistory, isDeloadActive, plateauOf, plateauStatus } from '../progression'
import { defaultBandInventory } from '../ladder'
import { log, plan } from './fixtures'

const ex = { ...plan.exercises['pull-down'], repMin: 8, repMax: 12, sets: 3 }
const sess = (reps: number[], over = {}) => reps.map((r, i) => log({ reps: r, set_index: i, ...over }))

describe('engine: working sets only', () => {
  it('ignores warmup and drop sets', () => {
    const logs = [...sess([12, 12, 12]), log({ reps: 5, set_type: 'warmup', set_index: 3 }), log({ reps: 4, set_type: 'drop', set_index: 4 })]
    expect(suggestForExercise(ex, logs, plan)?.kind).toBe('progress')
  })
  it('only warmups gives nothing', () => {
    expect(suggestForExercise(ex, [log({ set_type: 'warmup' })], plan)).toBeNull()
  })
})

describe('engine: rules', () => {
  it('all-sets-max is the default', () => {
    expect(suggestForExercise(ex, sess([12, 12, 11]), plan)).toBeNull()
  })
  it('total-reps uses the target (default sets * repMax)', () => {
    const o = { rule: 'total-reps' as const, totalRepsTarget: 32 }
    const s = suggestForExercise(ex, sess([12, 10, 10]), plan, { override: o })
    expect(s).toMatchObject({ kind: 'progress', target: { band: 'T50' } })
    expect(suggestForExercise(ex, sess([12, 10, 9]), plan, { override: o })).toBeNull()
    expect(suggestForExercise(ex, sess([12, 12, 12]), plan, { override: { rule: 'total-reps' } })?.kind).toBe('progress')
    expect(suggestForExercise(ex, sess([12, 12, 11]), plan, { overrides: { 'pull-down': { rule: 'total-reps' } } })).toBeNull()
  })
  it('two-of-three needs top reps in 2 of the last 3 sessions at the same band', () => {
    const o = { rule: 'two-of-three' as const }
    const hit = sess([12, 12, 12])
    const miss = sess([12, 10, 9])
    expect(suggestForExercise(ex, miss, plan, { override: o, history: [miss, hit, miss] })).toBeNull()
    expect(suggestForExercise(ex, hit, plan, { override: o, history: [hit, miss, hit] })?.kind).toBe('progress')
    // A session at another band does not count.
    const other = sess([12, 12, 12], { band: 'T30' })
    expect(suggestForExercise(ex, hit, plan, { override: o, history: [hit, other, miss] })).toBeNull()
  })
})

describe('engine: RIR gating', () => {
  it('top of range with 3+ RIR on the last set notes "felt easy"', () => {
    const s = suggestForExercise(ex, [log({ reps: 12, set_index: 0, rir: 1 }), log({ reps: 12, set_index: 1, rir: 3 })], plan)
    expect(s).toMatchObject({ kind: 'progress', note: 'felt easy' })
  })
  it('rule met with RIR 0 still progresses', () => {
    const s = suggestForExercise(ex, [log({ reps: 12, rir: 0 })], plan)
    expect(s?.kind).toBe('progress')
    expect(s?.note).toBeUndefined()
  })
  it('suggests progress early when every set has RIR 3 and reps >= repMin + 2', () => {
    const s = suggestForExercise(ex, sess([10, 10, 11], { rir: 3 }), plan)
    expect(s).toMatchObject({ kind: 'progress', target: { band: 'T50' } })
    expect(suggestForExercise(ex, sess([10, 9, 11], { rir: 3 }), plan)).toBeNull()
    expect(suggestForExercise(ex, [log({ reps: 10, rir: 3 }), log({ reps: 10, rir: 2 })], plan)).toBeNull()
  })
})

describe('engine: step down', () => {
  const bad = sess([6, 7, 9])
  it('steps down after two consecutive sessions with most sets under repMin', () => {
    const s = suggestForExercise(ex, bad, plan, { history: [bad, sess([5, 7, 8])] })
    expect(s).toMatchObject({ kind: 'step-down', target: { band: 'T30' } })
  })
  it('only stays after one bad session', () => {
    expect(suggestForExercise(ex, bad, plan, { history: [bad, sess([10, 10, 10])] })?.kind).toBe('stay')
  })
  it('stays at the bottom of the ladder', () => {
    const low = sess([6, 6, 6], { band: 'T30' })
    expect(suggestForExercise(ex, low, plan, { history: [low, low] })?.kind).toBe('stay')
  })
})

describe('engine: intermediate before a big jump', () => {
  const kg = (m: Record<string, number>) => defaultBandInventory(plan).map((i) => ({ ...i, resistanceKg: m[i.id] ?? null }))
  it('suggests tempo, then a pause, then progresses', () => {
    const inv = kg({ T30: 5, T40: 7, T50: 12 }) // T50 -> T30+40 = 12 -> 12 no; T40 -> T50 = +71%
    const at40 = sess([12, 12, 12])
    const s1 = suggestForExercise(ex, at40, plan, { inventory: inv })
    expect(s1).toMatchObject({ kind: 'stay', intermediate: { type: 'tempo' }, target: { band: 'T40' } })
    expect(s1?.message).toContain('slow the tempo (3-1-1)')
    const s2 = suggestForExercise(ex, at40, plan, { inventory: inv, history: [at40, at40] })
    expect(s2?.intermediate?.type).toBe('pause')
    const s3 = suggestForExercise(ex, at40, plan, { inventory: inv, history: [at40, at40, at40] })
    expect(s3).toMatchObject({ kind: 'progress', target: { band: 'T50' } })
  })
  it('does not trigger for small jumps', () => {
    const inv = kg({ T30: 5, T40: 6, T50: 7 })
    expect(suggestForExercise(ex, sess([12, 12, 12]), plan, { inventory: inv })?.kind).toBe('progress')
  })
  it('no single-arm advice for unilateral exercises at the top', () => {
    const uni = { ...ex, unilateral: true }
    const s = suggestForExercise(uni, sess([12, 12, 12, 12, 12, 12], { band: 'T30+40+50' }), plan)
    expect(s?.message).not.toContain('single-arm')
    expect(s?.kind).toBe('progress')
    expect(suggestForExercise(ex, sess([12, 12, 12], { band: 'T30+40+50' }), plan)?.message).toContain('Go single-arm')
  })
})

describe('plateau', () => {
  const s = (reps: number[], over = {}) => sess(reps, over)
  it('no gain over 3 sessions on the same band', () => {
    expect(plateauOf([s([10, 10, 10]), s([10, 10, 10]), s([10, 10, 10])], ex).plateaued).toBe(true)
    expect(plateauOf([s([11, 10, 10]), s([10, 10, 10]), s([10, 10, 10])], ex).plateaued).toBe(false)
    expect(plateauOf([s([10, 10, 10]), s([11, 10, 10]), s([10, 10, 10])], ex).plateaued).toBe(false)
  })
  it('a band change is a gain', () => {
    expect(plateauOf([s([10, 10], { band: 'T50' }), s([10, 10]), s([10, 10])], ex).plateaued).toBe(false)
  })
  it('RIR 0 below repMin twice', () => {
    const f = s([6, 7], { rir: 0 })
    const r = plateauOf([f, s([10, 10]), f], ex)
    expect(r).toMatchObject({ plateaued: true, reason: 'failing' })
    expect(plateauOf([f, s([10, 10])], ex).plateaued).toBe(false)
  })
  it('needs enough history', () => {
    expect(plateauOf([s([10])], ex).plateaued).toBe(false)
  })
  it('groups history and reports per plan exercise', () => {
    const sessions = [1, 2, 3].map((n) => ({ id: `s${n}`, date: `2026-01-0${n}` }))
    const logs = sessions.flatMap((x) => sess([10, 10], { session_id: x.id }))
    const h = groupHistory(sessions, logs)
    expect(h['pull-down']).toHaveLength(3)
    expect(h['pull-down'][0][0].session_id).toBe('s3')
    expect(plateauStatus(h, plan)['pull-down'].plateaued).toBe(true)
  })
})

describe('deload', () => {
  const pl = { plateaued: true, reason: 'no-gain' as const, sessions: 3 }
  const ok = { plateaued: false, reason: null, sessions: 3 }
  it('isDeloadActive covers the last 7 days inclusive', () => {
    expect(isDeloadActive(null, '2026-11-10')).toBe(false)
    expect(isDeloadActive('2026-11-10', '2026-11-10')).toBe(true)
    expect(isDeloadActive('2026-11-03', '2026-11-10')).toBe(true)
    expect(isDeloadActive('2026-11-02', '2026-11-10')).toBe(false)
    expect(isDeloadActive('2026-11-12', '2026-11-10')).toBe(false)
    expect(isDeloadActive('garbage', '2026-11-10')).toBe(false)
    expect(isDeloadActive('2026-11-09T22:00:00.000Z', '2026-11-10')).toBe(true)
  })
  it('plateau share drives advice', () => {
    const status = { a: pl, b: pl, c: ok, d: ok, e: ok }
    const a = deloadAdvice({ status, lastDeloadDate: null, firstSessionDate: '2026-11-01', todayKey: '2026-11-10' })
    expect(a).toMatchObject({ due: true, basis: 'plateau', tracked: 5 })
    const lo = deloadAdvice({ status: { a: pl, b: ok, c: ok, d: ok }, lastDeloadDate: null, firstSessionDate: '2026-11-01', todayKey: '2026-11-10' })
    expect(lo.due).toBe(false)
  })
  it('falls back to the calendar, anchored on the last deload', () => {
    const base = { status: {}, todayKey: '2026-11-10' }
    expect(deloadAdvice({ ...base, lastDeloadDate: null, firstSessionDate: '2026-09-01' })).toMatchObject({ due: true, basis: 'calendar' })
    expect(deloadAdvice({ ...base, lastDeloadDate: '2026-10-20', firstSessionDate: '2026-09-01' }).due).toBe(false)
    expect(deloadAdvice({ ...base, lastDeloadDate: '2026-09-20', firstSessionDate: '2026-01-01' }).due).toBe(true)
    expect(deloadAdvice({ ...base, lastDeloadDate: null, firstSessionDate: null }).due).toBe(false)
  })
  it('is not due while active or right after a deload (plateau)', () => {
    const status = { a: pl, b: pl, c: pl }
    expect(deloadAdvice({ status, lastDeloadDate: '2026-11-08', firstSessionDate: '2026-01-01', todayKey: '2026-11-10' }).due).toBe(false)
    expect(deloadAdvice({ status, lastDeloadDate: '2026-10-25', firstSessionDate: '2026-01-01', todayKey: '2026-11-10' }).due).toBe(false)
    expect(deloadAdvice({ status, lastDeloadDate: '2026-10-10', firstSessionDate: '2026-01-01', todayKey: '2026-11-10' }).basis).toBe('plateau')
  })
})
