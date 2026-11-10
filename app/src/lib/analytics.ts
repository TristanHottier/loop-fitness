// Training analytics. Pure (no React, no Dexie).
//
// Conventions
// - Deleted logs, logs of deleted or unknown sessions are ignored everywhere.
// - A log belongs to the day of its session (Session.date, a local day key).
// - Set weights (hard sets): normal 1, failure 1, drop 0.5 (an extension of a
//   set, not a full extra set), warmup 0. For a unilateral exercise a log with
//   side "L" or "R" counts half its weight, so an L/R pair is one set.
// - Muscle credit per set: primary muscle 1, secondary muscle 0.5 (the same
//   convention as the planned volume on the Plan screen).
// - "Completed" session = not deleted and ended_at set (matches Today).

import type { PlanData } from '../data/plan'
import type { Session, SetLog } from '../db/db'
import { addDays, weekStart, type DayKey } from './dates'
import { buildLadder, parseBandId, rankOf, stepOf, type BandItem } from './ladder'
import { bestByExercise, isPR, strengthScore, type ExerciseBest, type StrengthMode } from './records'
import { kindOf, orderOf } from './setRows'
import { normalizeSetType } from './setlog'

const pad = (n: number) => String(n).padStart(2, '0')

// --- Basics -----------------------------------------------------------------

export const SET_WEIGHT = { normal: 1, failure: 1, drop: 0.5, warmup: 0 } as const

// Hard-set weight of one log (see header).
// Both set_type and the set_index encoding of extra rows (setRows.ts: warm-ups
// <= 0, drops >= 100) are honoured, whichever says "less".
export function isWarmup(log: SetLog): boolean {
  return normalizeSetType(log.set_type) === 'warmup' || kindOf(log.set_index) === 'warmup'
}

export function setWeight(log: SetLog, unilateral: boolean): number {
  let w: number = SET_WEIGHT[normalizeSetType(log.set_type)]
  if (isWarmup(log)) w = 0
  else if (kindOf(log.set_index) === 'drop') w = Math.min(w, SET_WEIGHT.drop)
  return unilateral && (log.side === 'L' || log.side === 'R') ? w / 2 : w
}

export const isCompleted = (s: Session): boolean => !s.deleted && s.ended_at !== null

// Logs that are not deleted and belong to a non-deleted session in `sessions`.
export function liveLogs(logs: SetLog[], sessions: Session[]): SetLog[] {
  const ok = new Set(sessions.filter((s) => !s.deleted).map((s) => s.id))
  return logs.filter((l) => !l.deleted && ok.has(l.session_id) && !isWarmup(l))
}

// "mid_back" -> "Mid back"
export function muscleLabel(key: string): string {
  const s = key.replace(/_/g, ' ')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

// --- Volume -----------------------------------------------------------------

// Hard sets per muscle key for the given logs (no date filtering).
export function muscleSets(logs: SetLog[], plan: PlanData): Record<string, number> {
  const out: Record<string, number> = {}
  for (const l of logs) {
    const ex = plan.exercises[l.exercise_slug]
    if (!ex) continue
    const w = setWeight(l, ex.unilateral)
    if (w === 0) continue
    for (const m of ex.muscles.primary) out[m] = (out[m] ?? 0) + w
    for (const m of ex.muscles.secondary) out[m] = (out[m] ?? 0) + w / 2
  }
  return out
}

// Logged hard sets per muscle for the Monday-start local week containing
// weekStartKey (any day of that week is accepted).
export function weeklyVolume(
  logs: SetLog[],
  sessions: Session[],
  plan: PlanData,
  weekStartKey: DayKey
): Record<string, number> {
  const start = weekStart(weekStartKey)
  const end = addDays(start, 6)
  const inWeek = new Set(
    sessions.filter((s) => !s.deleted && s.date >= start && s.date <= end).map((s) => s.id)
  )
  return muscleSets(
    logs.filter((l) => !l.deleted && inWeek.has(l.session_id)),
    plan
  )
}

export type VolumeStatus = 'below' | 'within' | 'above'

export function volumeStatus(value: number, targets: { min: number; max: number }): VolumeStatus {
  if (value < targets.min) return 'below'
  if (value > targets.max) return 'above'
  return 'within'
}

// Target range for one muscle: the plan's own entry (plan.json muscleTargets)
// if it has one, otherwise the fallback (the user's default range).
export function targetFor(
  muscle: string,
  planTargets: { [muscle: string]: { min: number; max: number } } | undefined,
  fallback: { min: number; max: number }
): { min: number; max: number } {
  const t = planTargets?.[muscle]
  return t && Number.isFinite(t.min) && Number.isFinite(t.max) && t.min <= t.max ? t : fallback
}

// Status of a muscle's weekly volume against its own target.
export function muscleVolumeStatus(
  muscle: string,
  value: number,
  planTargets: { [muscle: string]: { min: number; max: number } } | undefined,
  fallback: { min: number; max: number }
): VolumeStatus {
  return volumeStatus(value, targetFor(muscle, planTargets, fallback))
}

// --- Per-exercise strength --------------------------------------------------

export interface SeriesPoint {
  date: DayKey
  sessionId: string
  y: number // value to plot
  label: string // short point label, e.g. "12 @ T40"
  reps: number
  band: string
  rank: number
}

export interface ExerciseSeries {
  mode: StrengthMode
  points: SeriesPoint[]
  // Rank mode only: y ticks, one per ladder step in range, labelled with band ids.
  ticks: { value: number; label: string }[]
}

const bySessionOrder = (a: Session, b: Session) =>
  a.date.localeCompare(b.date) || a.started_at.localeCompare(b.started_at)

// Best set per session, over time. Mode 'kg' only if every counting set of the
// exercise has a known resistance; otherwise 'rank' where y = rank +
// min(reps, 39) / 40, so the band step is the integer part and reps move the
// point inside the step (ticks are labelled with the band ids).
export function exerciseSeries(
  logs: SetLog[],
  sessions: Session[],
  slug: string,
  plan: PlanData,
  inventory?: BandItem[]
): ExerciseSeries {
  const mine = liveLogs(logs, sessions).filter((l) => l.exercise_slug === slug && !isWarmup(l))
  if (mine.length === 0) return { mode: 'rank', points: [], ticks: [] }
  const allKg = mine.every((l) => stepOf(l.band, plan, inventory)?.resistanceKg != null)
  const mode: StrengthMode = allKg ? 'kg' : 'rank'

  const sessById = new Map(sessions.map((s) => [s.id, s]))
  const bySession = new Map<string, SetLog[]>()
  for (const l of mine) {
    const arr = bySession.get(l.session_id)
    if (arr) arr.push(l)
    else bySession.set(l.session_id, [l])
  }
  const points: SeriesPoint[] = []
  const ordered = [...bySession.keys()]
    .map((id) => sessById.get(id)!)
    .sort(bySessionOrder)
  for (const s of ordered) {
    let best: SetLog | null = null
    let bestScore = -Infinity
    for (const l of bySession.get(s.id)!) {
      const sc = strengthScore(l, plan, inventory, mode).score
      if (sc > bestScore) {
        best = l
        bestScore = sc
      }
    }
    if (!best) continue
    const rank = rankOf(best.band, plan, inventory)
    const y = mode === 'kg' ? bestScore : Math.max(rank, -1) + Math.min(best.reps, 39) / 40
    points.push({
      date: s.date,
      sessionId: s.id,
      y,
      label: `${best.reps} @ ${best.band}`,
      reps: best.reps,
      band: best.band,
      rank,
    })
  }

  const ticks: { value: number; label: string }[] = []
  if (mode === 'rank') {
    const ranks = points.map((p) => p.rank)
    const lo = Math.min(...ranks)
    const hi = Math.max(...ranks)
    const ladderName = parseBandId(points[0].band)?.ladder
    const steps = ladderName ? buildLadder(plan, inventory)[ladderName] : []
    for (let r = lo; r <= hi; r++) ticks.push({ value: r, label: r < 0 ? '?' : (steps[r]?.id ?? '?') })
  }
  return { mode, points, ticks }
}

export interface HistoryEntry {
  sessionId: string
  date: DayKey
  sets: { reps: number; band: string; side: string | null }[]
  text: string // "12, 12, 10 @ T40" (runs of the same band joined with "; ")
}

// "12, 12, 10 @ T40; 8 @ T30+40". Unilateral sides are suffixed (12L, 12R).
export function formatSets(sets: { reps: number; band: string; side: string | null }[]): string {
  const groups: { band: string; reps: string[] }[] = []
  for (const s of sets) {
    const rep = `${s.reps}${s.side === 'L' || s.side === 'R' ? s.side : ''}`
    const g = groups[groups.length - 1]
    if (g && g.band === s.band) g.reps.push(rep)
    else groups.push({ band: s.band, reps: [rep] })
  }
  return groups.map((g) => `${g.reps.join(', ')} @ ${g.band}`).join('; ')
}

// The last `limit` sessions (newest first) in which the exercise was logged.
// Warmups are left out.
export function exerciseHistory(
  logs: SetLog[],
  sessions: Session[],
  slug: string,
  limit = 5
): HistoryEntry[] {
  const mine = liveLogs(logs, sessions).filter((l) => l.exercise_slug === slug && !isWarmup(l))
  const bySession = new Map<string, SetLog[]>()
  for (const l of mine) {
    const arr = bySession.get(l.session_id)
    if (arr) arr.push(l)
    else bySession.set(l.session_id, [l])
  }
  const sessById = new Map(sessions.map((s) => [s.id, s]))
  return [...bySession.keys()]
    .map((id) => sessById.get(id)!)
    .sort((a, b) => -bySessionOrder(a, b))
    .slice(0, limit)
    .map((s) => {
      const sets = bySession
        .get(s.id)!
        .sort((a, b) => orderOf(a.set_index) - orderOf(b.set_index) || (a.side ?? '').localeCompare(b.side ?? ''))
        .map((l) => ({ reps: l.reps, band: l.band, side: l.side }))
      return { sessionId: s.id, date: s.date, sets, text: formatSets(sets) }
    })
}

// Best reps per band for one exercise, heaviest band first.
export function recordsByBand(
  logs: SetLog[],
  sessions: Session[],
  slug: string,
  plan: PlanData,
  inventory?: BandItem[]
): { band: string; reps: number }[] {
  const mine = liveLogs(logs, sessions).filter((l) => l.exercise_slug === slug)
  const best = bestByExercise(mine, plan, inventory)[slug]
  if (!best) return []
  return Object.entries(best.repsByBand)
    .map(([band, reps]) => ({ band, reps, rank: rankOf(band, plan, inventory) }))
    .sort((a, b) => b.rank - a.rank || a.band.localeCompare(b.band))
    .map(({ band, reps }) => ({ band, reps }))
}

// --- Personal records over time ---------------------------------------------

export interface PRHit {
  date: DayKey
  sessionId: string
  slug: string
  log: SetLog // the best qualifying set of that session
}

// Personal records set on days in [startKey, endKey] (inclusive). Walks the
// history chronologically: a session is a PR for an exercise when one of its
// sets is a record against everything logged in EARLIER sessions (so at most
// one hit per exercise per session, and a first-ever session is never a PR).
// Same-day sessions are ordered by started_at.
export function prsInRange(
  logs: SetLog[],
  sessions: Session[],
  plan: PlanData,
  startKey: DayKey,
  endKey: DayKey,
  inventory?: BandItem[],
  opts: { slug?: string } = {}
): PRHit[] {
  const live = liveLogs(logs, sessions).filter(
    (l) => !isWarmup(l) && (!opts.slug || l.exercise_slug === opts.slug)
  )
  const bySession = new Map<string, SetLog[]>()
  for (const l of live) {
    const arr = bySession.get(l.session_id)
    if (arr) arr.push(l)
    else bySession.set(l.session_id, [l])
  }
  const sessById = new Map(sessions.map((s) => [s.id, s]))
  const ordered = [...bySession.keys()].map((id) => sessById.get(id)!).sort(bySessionOrder)

  const running: Record<string, ExerciseBest> = {}
  const hits: PRHit[] = []
  for (const s of ordered) {
    const perEx = new Map<string, SetLog[]>()
    for (const l of bySession.get(s.id)!) {
      const arr = perEx.get(l.exercise_slug)
      if (arr) arr.push(l)
      else perEx.set(l.exercise_slug, [l])
    }
    for (const [slug, sessLogs] of perEx) {
      const prior = running[slug]
      if (prior && s.date >= startKey && s.date <= endKey) {
        const winners = sessLogs.filter((l) => isPR(l, prior, plan, inventory))
        if (winners.length > 0) {
          const best = winners.reduce((a, b) => {
            const ra = rankOf(a.band, plan, inventory)
            const rb = rankOf(b.band, plan, inventory)
            return rb > ra || (rb === ra && b.reps > a.reps) ? b : a
          })
          hits.push({ date: s.date, sessionId: s.id, slug, log: best })
        }
      }
      // Fold this session into the running best.
      const sessBest = bestByExercise(sessLogs, plan, inventory)[slug]
      if (!prior) running[slug] = sessBest
      else {
        const merged: ExerciseBest = {
          maxRank: Math.max(prior.maxRank, sessBest.maxRank),
          repsByBand: { ...prior.repsByBand },
          bestSet: prior.bestSet,
        }
        for (const [b, r] of Object.entries(sessBest.repsByBand))
          merged.repsByBand[b] = Math.max(merged.repsByBand[b] ?? 0, r)
        running[slug] = merged
      }
    }
  }
  return hits
}

// --- Consistency ------------------------------------------------------------

// Completed sessions per Monday week start key.
export function weekCounts(sessions: Session[]): Map<DayKey, number> {
  const m = new Map<DayKey, number>()
  for (const s of sessions) {
    if (!isCompleted(s)) continue
    const w = weekStart(s.date)
    m.set(w, (m.get(w) ?? 0) + 1)
  }
  return m
}

// Consecutive weeks (Monday-start) with at least `perWeek` completed sessions,
// ending at the current week. The current week counts once it is met; while
// it is not yet met it neither counts nor breaks the streak. Week based, so
// moving a session to another day of the same week changes nothing.
export function streakWeeks(sessions: Session[], todayKey: DayKey, perWeek: number): number {
  if (perWeek <= 0) return 0
  const counts = weekCounts(sessions)
  const cur = weekStart(todayKey)
  let n = (counts.get(cur) ?? 0) >= perWeek ? 1 : 0
  let w = addDays(cur, -7)
  while ((counts.get(w) ?? 0) >= perWeek) {
    n += 1
    w = addDays(w, -7)
  }
  return n
}

// Completed sessions grouped by day key (session order within a day).
export function sessionsByDay(sessions: Session[]): Map<DayKey, Session[]> {
  const m = new Map<DayKey, Session[]>()
  for (const s of sessions.filter(isCompleted).sort(bySessionOrder)) {
    const arr = m.get(s.date)
    if (arr) arr.push(s)
    else m.set(s.date, [s])
  }
  return m
}

export interface MonthSummary {
  sessions: number
  sets: number // hard sets (see SET_WEIGHT)
  reps: number // all non-warmup reps
  prs: number
  topMuscle: { muscle: string; sets: number } | null
}

// Totals over completed sessions dated in the given month (month 1-12).
export function monthSummary(
  logs: SetLog[],
  sessions: Session[],
  plan: PlanData,
  year: number,
  month: number,
  inventory?: BandItem[]
): MonthSummary {
  const prefix = `${year}-${pad(month)}`
  const inMonth = sessions.filter((s) => isCompleted(s) && s.date.slice(0, 7) === prefix)
  const ids = new Set(inMonth.map((s) => s.id))
  const mine = logs.filter((l) => !l.deleted && ids.has(l.session_id) && !isWarmup(l))
  let sets = 0
  let reps = 0
  for (const l of mine) {
    sets += setWeight(l, plan.exercises[l.exercise_slug]?.unilateral ?? false)
    reps += l.reps
  }
  const perMuscle = muscleSets(mine, plan)
  let top: MonthSummary['topMuscle'] = null
  for (const [muscle, v] of Object.entries(perMuscle)) {
    if (!top || v > top.sets || (v === top.sets && muscle < top.muscle)) top = { muscle, sets: v }
  }
  const nextFirst = month === 12 ? `${year + 1}-01-01` : `${year}-${pad(month + 1)}-01`
  const prs = prsInRange(logs, sessions, plan, `${prefix}-01`, addDays(nextFirst, -1), inventory).length
  return { sessions: inMonth.length, sets, reps, prs, topMuscle: top }
}
