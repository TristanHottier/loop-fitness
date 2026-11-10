// Plateau detection and deload advice. Pure (no React, no Dexie).
// The per-session progression engine lives in suggestions.ts.

import type { PlanData } from '../data/plan'
import type { SetLog } from '../db/db'
import { addDays, daysBetween, dayKey, type DayKey } from './dates'

// Turn a stored date (YYYY-MM-DD or a full ISO string) into a local day key,
// or null when unparseable.
function toDayKey(value: string): DayKey | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value
  const t = Date.parse(value)
  return Number.isNaN(t) ? null : dayKey(new Date(t))
}

// Deload ACTIVE contract (shared with the session screen): a deload week is
// active when the last deload date is within the last 7 days inclusive, that
// is 0 to 7 calendar days before todayKey. Future dates, null and unparseable
// values are not active.
export function isDeloadActive(lastDeloadDate: string | null, todayKey: string): boolean {
  if (!lastDeloadDate) return false
  const key = toDayKey(lastDeloadDate)
  if (!key) return false
  const diff = daysBetween(key, todayKey)
  return Number.isFinite(diff) && diff >= 0 && diff <= 7
}

// The date that ends a deload: 8 days before today is outside the active window.
export function endedDeloadDate(todayKey: string): DayKey {
  return addDays(todayKey, -8)
}

// --- Plateaus ---------------------------------------------------------------

// Per exercise slug, its sessions' logs, most recent session first.
export type ExerciseHistory = Record<string, SetLog[][]>

export type PlateauReason = 'no-gain' | 'failing'

export interface PlateauInfo {
  plateaued: boolean
  reason: PlateauReason | null
  sessions: number // sessions with working sets that were examined
}

const isWorking = (l: SetLog) => !l.deleted && l.set_type !== 'warmup' && l.set_type !== 'drop'

// Group set logs into per-exercise sessions, most recent session first.
// `sessions` supplies the order (date, then started_at); logs of unknown or
// deleted sessions are ignored.
export function groupHistory(
  sessions: { id: string; date: string; started_at?: string; deleted?: boolean }[],
  logs: SetLog[]
): ExerciseHistory {
  const order = new Map<string, number>()
  const sorted = sessions
    .filter((s) => !s.deleted)
    .sort((a, b) => (b.date + (b.started_at ?? '')).localeCompare(a.date + (a.started_at ?? '')))
  sorted.forEach((s, i) => order.set(s.id, i))
  const bySlug = new Map<string, Map<string, SetLog[]>>()
  for (const l of logs) {
    if (l.deleted || !order.has(l.session_id)) continue
    const m = bySlug.get(l.exercise_slug) ?? new Map<string, SetLog[]>()
    const arr = m.get(l.session_id) ?? []
    arr.push(l)
    m.set(l.session_id, arr)
    bySlug.set(l.exercise_slug, m)
  }
  const out: ExerciseHistory = {}
  for (const [slug, m] of bySlug) {
    out[slug] = [...m.entries()]
      .sort((a, b) => order.get(a[0])! - order.get(b[0])!)
      .map(([, arr]) => arr.slice().sort((a, b) => a.set_index - b.set_index))
  }
  return out
}

function singleBand(sets: SetLog[]): string | null {
  const bands = new Set(sets.map((s) => s.band))
  return bands.size === 1 ? sets[0].band : null
}

const totalReps = (sets: SetLog[]) => sets.reduce((a, s) => a + s.reps, 0)

// One exercise. `sessions` most recent first. Plateaued when
// - over the last 3 sessions, all on the same single band, no later session
//   beat the total working reps of the earliest of the three (no rank or rep
//   gain), or
// - in at least 2 of the last 3 sessions the exercise hit RIR 0 below repMin.
export function plateauOf(
  sessions: SetLog[][],
  ex: { repMin: number }
): PlateauInfo {
  const working = sessions.map((s) => s.filter(isWorking)).filter((s) => s.length > 0)
  const last3 = working.slice(0, 3)
  const info: PlateauInfo = { plateaued: false, reason: null, sessions: working.length }
  if (last3.length < 2) return info
  const failing = last3.filter((s) => s.some((l) => l.rir === 0 && l.reps < ex.repMin)).length
  if (failing >= 2) return { ...info, plateaued: true, reason: 'failing' }
  if (last3.length === 3) {
    const bands = last3.map(singleBand)
    if (bands[0] !== null && bands.every((b) => b === bands[0])) {
      const [latest, mid, first] = last3.map(totalReps)
      if (latest <= first && mid <= first) return { ...info, plateaued: true, reason: 'no-gain' }
    }
  }
  return info
}

// Plateau status for every plan exercise that has history.
export function plateauStatus(
  history: ExerciseHistory,
  plan: PlanData
): Record<string, PlateauInfo> {
  const out: Record<string, PlateauInfo> = {}
  for (const [slug, ex] of Object.entries(plan.exercises)) {
    const sessions = history[slug]
    if (!sessions || sessions.length === 0) continue
    out[slug] = plateauOf(sessions, ex)
  }
  return out
}

// --- Deload advice ------------------------------------------------------------

export const PLATEAU_SHARE = 0.3
export const CALENDAR_WEEKS = 6
// After a deload, plateau-driven advice waits this many days.
export const PLATEAU_COOLDOWN_DAYS = 21

export interface DeloadAdvice {
  due: boolean
  basis: 'plateau' | 'calendar' | null
  message: string
  plateaued: string[] // slugs
  tracked: number // exercises with at least 2 sessions
  weeksSince: number | null // since the last deload, else the first session
}

// Suggest a deload when at least 30% of the exercises with enough history
// (at least 3 of them) are plateaued, or, as a fallback, when 6 or more weeks
// have passed since the anchor: the last deload date if set, else the first
// session. Never due while a deload is active.
export function deloadAdvice(args: {
  status: Record<string, PlateauInfo>
  lastDeloadDate: string | null
  firstSessionDate: string | null
  todayKey: string
}): DeloadAdvice {
  const { status, lastDeloadDate, firstSessionDate, todayKey } = args
  const lastKey = lastDeloadDate ? toDayKey(lastDeloadDate) : null
  const anchor = lastKey ?? (firstSessionDate ? toDayKey(firstSessionDate) : null)
  const days = anchor ? daysBetween(anchor, todayKey) : NaN
  const weeksSince = Number.isFinite(days) && days >= 0 ? Math.floor(days / 7) : null
  const entries = Object.entries(status).filter(([, s]) => s.sessions >= 2)
  const plateaued = entries.filter(([, s]) => s.plateaued).map(([slug]) => slug)
  const base = { plateaued, tracked: entries.length, weeksSince }
  const none: DeloadAdvice = { due: false, basis: null, message: '', ...base }
  if (isDeloadActive(lastDeloadDate, todayKey)) return none

  const sinceDeload = lastKey ? daysBetween(lastKey, todayKey) : Infinity
  if (
    entries.length >= 3 &&
    plateaued.length / entries.length >= PLATEAU_SHARE &&
    sinceDeload >= PLATEAU_COOLDOWN_DAYS
  ) {
    return {
      due: true,
      basis: 'plateau',
      message: `${plateaued.length} of ${entries.length} exercises have stalled. A lighter week usually helps.`,
      ...base,
    }
  }
  if (weeksSince !== null && weeksSince >= CALENDAR_WEEKS) {
    const from = lastKey ? 'your last deload' : 'your first session'
    return {
      due: true,
      basis: 'calendar',
      message: `It has been ${weeksSince} weeks since ${from}. A deload is due every 6 to 8 weeks.`,
      ...base,
    }
  }
  return none
}
