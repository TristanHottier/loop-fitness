// Local-calendar date helpers. All "day keys" are YYYY-MM-DD in the device's
// local time zone (never UTC), matching Session.date and todayISODate().
// Day arithmetic goes through UTC components only to stay immune to DST.

export type DayKey = string

const DAY_MS = 86400000
const pad = (n: number) => String(n).padStart(2, '0')

// Local day key of a Date (default: now).
export function dayKey(d: Date = new Date()): DayKey {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// Parse a day key to a Date at local midnight. Invalid keys give an Invalid Date.
export function parseDayKey(key: DayKey): Date {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return new Date(NaN)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

function utcDays(key: DayKey): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return NaN
  return Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])) / DAY_MS
}

// Whole calendar days from a to b (b - a), DST-safe. NaN for invalid keys.
export function daysBetween(a: DayKey, b: DayKey): number {
  return utcDays(b) - utcDays(a)
}

export function addDays(key: DayKey, n: number): DayKey {
  const t = new Date((utcDays(key) + n) * DAY_MS)
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`
}

// Day of week with Monday = 0 ... Sunday = 6.
export function weekdayIndex(key: DayKey): number {
  return (new Date(utcDays(key) * DAY_MS).getUTCDay() + 6) % 7
}

// Monday of the week containing key.
export function weekStart(key: DayKey): DayKey {
  return addDays(key, -weekdayIndex(key))
}

// The 7 day keys Monday..Sunday of the week containing key.
export function weekDays(key: DayKey): DayKey[] {
  const start = weekStart(key)
  return Array.from({ length: 7 }, (_, i) => addDays(start, i))
}

// A month as a Monday-first grid. month is 1-12. Each row is 7 cells; days
// outside the month are included (inMonth false) so rows are always full.
export interface MonthCell {
  date: DayKey
  inMonth: boolean
}
export function monthGrid(year: number, month: number): MonthCell[][] {
  const first = `${year}-${pad(month)}-01`
  const nextFirst = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`
  const lastDay = addDays(nextFirst, -1)
  const start = weekStart(first)
  const end = addDays(weekStart(lastDay), 6)
  const rows: MonthCell[][] = []
  for (let d = start; daysBetween(d, end) >= 0; d = addDays(d, 7)) {
    rows.push(
      Array.from({ length: 7 }, (_, i) => {
        const date = addDays(d, i)
        return { date, inMonth: date.slice(0, 7) === first.slice(0, 7) }
      })
    )
  }
  return rows
}
