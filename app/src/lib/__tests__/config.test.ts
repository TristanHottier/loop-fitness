import { describe, expect, it } from 'vitest'
import { parseBandInventory, parseExerciseOverrides, parseVolumeTargets } from '../../db/config'

describe('config parsing', () => {
  it('falls back on malformed JSON', () => {
    expect(parseBandInventory('{bad')).toBeNull()
    expect(parseBandInventory(null)).toBeNull()
    expect(parseExerciseOverrides('{bad')).toEqual({})
    expect(parseVolumeTargets('{bad')).toEqual({ min: 10, max: 20 })
    expect(parseVolumeTargets(null)).toEqual({ min: 10, max: 20 })
  })
  it('validates volume targets', () => {
    expect(parseVolumeTargets('{"min":8,"max":16}')).toEqual({ min: 8, max: 16 })
    expect(parseVolumeTargets('{"min":20,"max":10}')).toEqual({ min: 10, max: 20 })
  })
  it('cleans overrides', () => {
    const o = parseExerciseOverrides(
      JSON.stringify({ a: { rule: 'total-reps', totalRepsTarget: 30, junk: 1 }, b: { rule: 'nope', restSeconds: -3 }, c: 5 })
    )
    expect(o).toEqual({ a: { rule: 'total-reps', totalRepsTarget: 30 } })
  })
  it('cleans inventory entries', () => {
    const inv = parseBandInventory(
      JSON.stringify([{ id: 'T40', resistanceKg: 7, owned: false }, { id: 'zzz' }, { id: 'L5-30', resistanceKg: -1 }, 3])
    )
    expect(inv).toEqual([
      { id: 'T40', ladder: 'tube', label: '40', resistanceKg: 7, owned: false, nominal: 40 },
      { id: 'L5-30', ladder: 'loop', label: '5-30', resistanceKg: null, owned: true, nominal: null },
    ])
  })
})
