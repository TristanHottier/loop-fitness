import { describe, expect, it } from 'vitest'
import { addDays, dayKey, daysBetween, monthGrid, parseDayKey, weekDays, weekStart, weekdayIndex } from '../dates'

describe('dates', () => {
  it('formats local day keys, not UTC', () => {
    expect(dayKey(new Date(2026, 0, 5, 23, 59))).toBe('2026-01-05')
    expect(dayKey(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05')
    expect(dayKey(parseDayKey('2026-03-08'))).toBe('2026-03-08')
  })
  it('does day arithmetic across month, year and leap days', () => {
    expect(addDays('2026-01-31', 1)).toBe('2026-02-01')
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(addDays('2024-02-28', 2)).toBe('2024-03-01')
    expect(daysBetween('2026-03-01', '2026-03-29')).toBe(28)
    expect(daysBetween('2026-03-07', '2026-03-09')).toBe(2) // DST in US
    expect(daysBetween('2026-03-09', '2026-03-07')).toBe(-2)
  })
  it('weeks start on Monday', () => {
    expect(weekdayIndex('2026-11-09')).toBe(0) // Monday
    expect(weekdayIndex('2026-11-15')).toBe(6) // Sunday
    expect(weekStart('2026-11-15')).toBe('2026-11-09')
    expect(weekStart('2026-11-09')).toBe('2026-11-09')
    expect(weekDays('2026-11-11')).toEqual([
      '2026-11-09', '2026-11-10', '2026-11-11', '2026-11-12', '2026-11-13', '2026-11-14', '2026-11-15',
    ])
  })
  it('builds a Monday-first month grid', () => {
    const g = monthGrid(2026, 11) // 1 Nov 2026 is a Sunday
    expect(g.every((r) => r.length === 7)).toBe(true)
    expect(g[0][0]).toEqual({ date: '2026-10-26', inMonth: false })
    expect(g[0][6]).toEqual({ date: '2026-11-01', inMonth: true })
    expect(g[g.length - 1][6].date).toBe('2026-12-06')
    expect(g.flat().filter((c) => c.inMonth)).toHaveLength(30)
    expect(monthGrid(2026, 2)).toHaveLength(5) // starts on a Sunday
    expect(monthGrid(2027, 2)).toHaveLength(4) // Monday start, 28 days
  })
  it('handles December and invalid keys', () => {
    expect(monthGrid(2026, 12).flat().filter((c) => c.inMonth)).toHaveLength(31)
    expect(Number.isNaN(daysBetween('bad', '2026-01-01'))).toBe(true)
  })
})
