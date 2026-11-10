import { describe, expect, it } from 'vitest'
import { armMeasurementDue, deloadDue, nextBand, suggestForExercise } from '../suggestions'
import { log, plan } from './fixtures'

const ex = { ...plan.exercises['pull-down'], repMin: 8, repMax: 12 }

describe('nextBand', () => {
  it('walks the tube ladder, including stacks', () => {
    expect(nextBand('T30', plan)).toBe('T40')
    expect(nextBand('T50', plan)).toBe('T30+40')
    expect(nextBand('T30+40', plan)).toBe('T40+50')
    expect(nextBand('T40+50', plan)).toBe('T30+40+50')
  })
  it('walks the loop ladder', () => {
    expect(nextBand('L5-30', plan)).toBe('L15-50')
    expect(nextBand('L35-95', plan)).toBe('L50-145')
  })
  it('returns null at the top or when unknown', () => {
    expect(nextBand('T30+40+50', plan)).toBeNull()
    expect(nextBand('L50-145', plan)).toBeNull()
    expect(nextBand('T99', plan)).toBeNull()
    expect(nextBand('', plan)).toBeNull()
  })
})

describe('suggestForExercise', () => {
  it('no logs gives no suggestion', () => {
    expect(suggestForExercise(ex, [], plan)).toBeNull()
  })
  it('stays when any set is under repMin', () => {
    const s = suggestForExercise(ex, [log({ reps: 12 }), log({ reps: 7 })], plan)
    // Intentional change: the result is richer (reason, target), so match the locked fields only.
    expect(s).toMatchObject({ kind: 'stay', message: 'Some sets were under 8 reps. Stay on T40.' })
  })
  it('stay message names "your current band" for mixed bands', () => {
    const s = suggestForExercise(ex, [log({ reps: 7 }), log({ reps: 9, band: 'T30' })], plan)
    expect(s?.message).toBe('Some sets were under 8 reps. Stay on your current band.')
  })
  it('progresses to the next band when all sets hit repMax', () => {
    const s = suggestForExercise(ex, [log({ reps: 12 }), log({ reps: 13 })], plan)
    expect(s).toMatchObject({ kind: 'progress', message: 'All sets hit 12 reps on T40. Try T50.' })
    expect(s?.target).toEqual({ band: 'T50', repMin: 8, repMax: 12 })
  })
  it('suggests single-arm at the top of the ladder', () => {
    const s = suggestForExercise(ex, [log({ reps: 12, band: 'T30+40+50' })], plan)
    expect(s?.message).toBe('All sets hit 12 reps on T30+40+50. Go single-arm.')
  })
  it('gives nothing in the middle or with mixed bands at max', () => {
    expect(suggestForExercise(ex, [log({ reps: 12 }), log({ reps: 10 })], plan)).toBeNull()
    expect(suggestForExercise(ex, [log({ reps: 12 }), log({ reps: 12, band: 'T50' })], plan)).toBeNull()
  })
})

describe('due prompts use local days', () => {
  const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h)
  it('armMeasurementDue', () => {
    expect(armMeasurementDue(null)).toBe(true)
    expect(armMeasurementDue('2026-01-01', at(2026, 1, 28))).toBe(false) // 27 days
    expect(armMeasurementDue('2026-01-01', at(2026, 1, 29, 0))).toBe(true) // 28 days, just after midnight
    expect(armMeasurementDue('2026-01-01', at(2026, 1, 29, 23))).toBe(true)
  })
  it('deloadDue is true in weeks 6-7 of each 8-week cycle', () => {
    expect(deloadDue(null)).toBe(false)
    expect(deloadDue('2026-01-01', at(2026, 1, 1))).toBe(false)
    expect(deloadDue('2026-01-01', at(2026, 2, 11))).toBe(false) // day 41 = week 5
    expect(deloadDue('2026-01-01', at(2026, 2, 12))).toBe(true) // day 42 = week 6
    expect(deloadDue('2026-01-01', at(2026, 2, 26))).toBe(false) // day 56 = week 8 -> position 0
  })
})
