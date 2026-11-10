import { describe, expect, it } from 'vitest'
import { plan, log } from './fixtures'
import { bestByExercise } from '../records'
import { dropIndex, formatBand, kindOf, labelFor, lighterBand, orderOf, prKeys, warmupIndex } from '../setRows'

describe('setRows', () => {
  it('encodes extra rows outside the planned range', () => {
    expect(warmupIndex(1)).toBe(0)
    expect(warmupIndex(2)).toBe(-1)
    expect(dropIndex(2, 1)).toBe(201)
    expect(kindOf(0)).toBe('warmup')
    expect(kindOf(3)).toBe('planned')
    expect(kindOf(201)).toBe('drop')
    expect(labelFor(-1)).toBe('Warm-up 2')
    expect(labelFor(201)).toBe('Drop 1')
    expect([201, 3, 2, 0, -1, 1].sort((a, b) => orderOf(a) - orderOf(b))).toEqual([0, -1, 1, 2, 201, 3])
  })

  it('formats and lightens bands', () => {
    expect(formatBand('T30+40')).toBe('30 + 40')
    expect(formatBand('L35-95')).toBe('35-95')
    const lighter = lighterBand('T40', plan)
    expect(lighter).not.toBe('T40')
    expect(lighterBand('T40', plan)).toMatch(/^T/)
  })

  it('flags only the set that raises the bar', () => {
    const prior = bestByExercise([log({ session_id: 'old', reps: 10, band: 'T40' })], plan)
    const a = log({ set_index: 1, reps: 11, band: 'T40' })
    const b = log({ set_index: 2, reps: 11, band: 'T40' })
    const c = log({ set_index: 3, reps: 12, band: 'T40' })
    const w = log({ set_index: 0, reps: 30, band: 'T40', set_type: 'warmup' })
    const keys = prKeys({ a, b, c, w }, prior, plan)
    expect([...keys].sort()).toEqual(['a', 'c'])
    expect(prKeys({ a }, {}, plan).size).toBe(0)
  })
})
