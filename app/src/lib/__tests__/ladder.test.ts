import { describe, expect, it } from 'vitest'
import { buildLadder, defaultBandInventory, nominalFromLabel, nextStep, parseBandId, prevStep, rankOf, stepOf } from '../ladder'
import { plan } from './fixtures'

describe('ladder', () => {
  it('keeps the plan.json order exactly', () => {
    const l = buildLadder(plan)
    expect(l.tube.map((s) => s.label)).toEqual(plan.bandLadders.tube)
    expect(l.loop.map((s) => s.label)).toEqual(plan.bandLadders.loop)
    expect(l.tube.map((s) => s.rank)).toEqual(l.tube.map((_, i) => i))
    expect(l.tube[3]).toMatchObject({ id: 'T30+40', bands: ['30', '40'], ladder: 'tube', resistanceKg: null })
  })
  it('parses band ids', () => {
    expect(parseBandId('T40')).toEqual({ ladder: 'tube', label: '40' })
    expect(parseBandId('L35-95')).toEqual({ ladder: 'loop', label: '35-95' })
    expect(parseBandId('X40')).toBeNull()
    expect(parseBandId('T')).toBeNull()
  })
  it('ranks band ids per ladder, -1 when unknown', () => {
    expect(rankOf('T30', plan)).toBe(0)
    expect(rankOf('T40', plan)).toBe(1)
    expect(rankOf('T30+50', plan)).toBe(4)
    expect(rankOf('T30+40+50', plan)).toBe(6)
    expect(rankOf('L5-30', plan)).toBe(0)
    expect(rankOf('L50-145', plan)).toBe(4)
    expect(rankOf('T99', plan)).toBe(-1)
    expect(rankOf('L40', plan)).toBe(-1)
    expect(rankOf('40', plan)).toBe(-1)
  })
  it('every plan start band is on the ladder', () => {
    for (const ex of Object.values(plan.exercises)) expect(rankOf(ex.startBand, plan)).toBeGreaterThanOrEqual(0)
  })
  it('nextStep walks up and stops at the top', () => {
    expect(nextStep('T50', plan)?.id).toBe('T30+40')
    expect(nextStep('T30+40+50', plan)).toBeNull()
    expect(nextStep('L50-145', plan)).toBeNull()
    expect(nextStep('nope', plan)).toBeNull()
  })
  it('default inventory is single bands only, all owned', () => {
    const inv = defaultBandInventory(plan)
    expect(inv.map((i) => i.id)).toEqual(['T30', 'T40', 'T50', 'L5-30', 'L15-50', 'L25-75', 'L35-95', 'L50-145'])
    expect(inv.every((i) => i.owned && i.resistanceKg === null)).toBe(true)
    expect(inv[0].nominal).toBe(30)
    expect(inv[3].nominal).toBeNull()
    expect(nominalFromLabel('30+40')).toBeNull()
  })
  it('inventory resistance sums over stacked parts', () => {
    const inv = defaultBandInventory(plan).map((i) =>
      i.id === 'T30' ? { ...i, resistanceKg: 5 } : i.id === 'T40' ? { ...i, resistanceKg: 7 } : i
    )
    expect(stepOf('T30', plan, inv)?.resistanceKg).toBe(5)
    expect(stepOf('T30+40', plan, inv)?.resistanceKg).toBe(12)
    expect(stepOf('T40+50', plan, inv)?.resistanceKg).toBeNull()
  })
})

describe('inventory-aware ladder', () => {
  const inv = (m: Record<string, number | null>, owned: Record<string, boolean> = {}) =>
    defaultBandInventory(plan).map((i) => ({ ...i, resistanceKg: m[i.id] ?? null, owned: owned[i.id] ?? true }))

  it('excludes steps with unowned bands and keeps plan order when kg is unknown', () => {
    const l = buildLadder(plan, inv({}, { T50: false }))
    expect(l.tube.map((s) => s.id)).toEqual(['T30', 'T40', 'T30+40'])
    expect(l.tube.map((s) => s.rank)).toEqual([0, 1, 2])
    expect(buildLadder(plan, inv({}, { 'L5-30': false })).loop.map((s) => s.label)).toEqual(['15-50', '25-75', '35-95', '50-145'])
  })
  it('keeps plan order when only some owned bands are measured', () => {
    const l = buildLadder(plan, inv({ T30: 5, T40: 7 }))
    expect(l.tube.map((s) => s.label)).toEqual(plan.bandLadders.tube)
  })
  it('generates stacks sorted by resistance when all owned bands are measured', () => {
    const l = buildLadder(plan, inv({ T30: 5, T40: 8, T50: 12 }, { T50: false })).tube
    expect(l.map((s) => s.id)).toEqual(['T30', 'T40', 'T30+40'])
    expect(l.map((s) => s.resistanceKg)).toEqual([5, 8, 13])
    expect(l.map((s) => s.rank)).toEqual([0, 1, 2])
  })
  it('generates 2- and 3-band stacks with ids in plan order, and dedupes near-equal totals', () => {
    const l = buildLadder(plan, inv({ T30: 5, T40: 7, T50: 12 })).tube
    // 5, 7, 12 ; 5+7=12 (dup of T50, single wins) ; 5+12=17 ; 7+12=19 ; 5+7+12=24
    expect(l.map((s) => s.id)).toEqual(['T30', 'T40', 'T50', 'T30+50', 'T40+50', 'T30+40+50'])
    expect(l.map((s) => s.resistanceKg)).toEqual([5, 7, 12, 17, 19, 24])
  })
  it('prefers the plan-defined stack among near-equal totals', () => {
    // T40 and T50 are near-equal singles, so 30+40 (plan) and 30+50 are near-equal too.
    const l = buildLadder(plan, inv({ T30: 5, T40: 10, T50: 10.2 })).tube
    const ids = l.map((s) => s.id)
    expect(ids).toContain('T30+40')
    expect(ids).not.toContain('T30+50')
    expect(ids).not.toContain('T50')
    const kgs = l.map((s) => s.resistanceKg as number)
    expect(kgs).toEqual([...kgs].sort((a, b) => a - b))
  })
  it('stepOf, nextStep and prevStep use the generated ladder', () => {
    const i = inv({ T30: 5, T40: 7, T50: 12 })
    expect(nextStep('T50', plan, i)?.id).toBe('T30+50')
    expect(prevStep('T30+50', plan, i)?.id).toBe('T50')
    expect(prevStep('T30', plan, i)).toBeNull()
  })
})
