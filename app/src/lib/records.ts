// Personal records and a chartable strength score. Pure (no React, no Dexie).
// Deleted logs and warmup sets are ignored everywhere here.

import type { PlanData } from '../data/plan'
import type { SetLog } from '../db/db'
import { rankOf, stepOf, type BandItem } from './ladder'

export interface ExerciseBest {
  maxRank: number // highest ladder rank used (-1 if only unknown bands)
  repsByBand: Record<string, number> // best reps at each band id
  bestSet: SetLog | null // highest (rank, reps); ties keep the earlier set in input order
}

const counts = (l: SetLog) => !l.deleted && l.set_type !== 'warmup'

// Per exercise slug, the best numbers over all counting logs.
export function bestByExercise(
  logs: SetLog[],
  plan: PlanData,
  inventory?: BandItem[]
): Record<string, ExerciseBest> {
  const out: Record<string, ExerciseBest> = {}
  for (const log of logs) {
    if (!counts(log)) continue
    const rank = rankOf(log.band, plan, inventory)
    const best = (out[log.exercise_slug] ??= { maxRank: -1, repsByBand: {}, bestSet: null })
    best.maxRank = Math.max(best.maxRank, rank)
    best.repsByBand[log.band] = Math.max(best.repsByBand[log.band] ?? 0, log.reps)
    const cur = best.bestSet
    if (
      !cur ||
      rank > rankOf(cur.band, plan, inventory) ||
      (rank === rankOf(cur.band, plan, inventory) && log.reps > cur.reps)
    ) {
      best.bestSet = log
    }
  }
  return out
}

// Is `log` a new record against `prior` (the best of the logs BEFORE it, built
// with bestByExercise)? True when its band outranks every prior band, or it
// beats the prior reps at the same band. False for warmup/deleted logs and
// when there is no prior history (a first ever log is not announced as a PR).
// Assumes one ladder per exercise (ranks of different ladders are not
// comparable).
export function isPR(
  log: SetLog,
  prior: ExerciseBest | null | undefined,
  plan: PlanData,
  inventory?: BandItem[]
): boolean {
  if (!counts(log) || !prior || prior.bestSet === null) return false
  const rank = rankOf(log.band, plan, inventory)
  if (rank > prior.maxRank) return true
  const priorReps = prior.repsByBand[log.band]
  return priorReps !== undefined && log.reps > priorReps
}

export type StrengthMode = 'kg' | 'rank'

export interface StrengthScore {
  score: number
  mode: StrengthMode
}

// A single number per set for strength charts.
// - mode 'kg': the band's resistanceKg is known (from the inventory), score =
//   resistanceKg * (1 + reps / 30), an Epley estimated one-rep max in kg.
// - mode 'rank': resistance unknown, score = (rank + 1) * 1000 + reps, which
//   only orders sets (higher band first, then reps). Unknown bands (rank -1)
//   score just their reps. Not a physical quantity; do not mix with 'kg'.
// Charts should plot one mode per exercise: use 'kg' only if every set of the
// series scores in 'kg', otherwise pass forceMode 'rank'.
export function strengthScore(
  log: SetLog,
  plan: PlanData,
  inventory?: BandItem[],
  forceMode?: StrengthMode
): StrengthScore {
  const step = stepOf(log.band, plan, inventory)
  if (forceMode !== 'rank' && step && step.resistanceKg !== null) {
    return { score: step.resistanceKg * (1 + log.reps / 30), mode: 'kg' }
  }
  return { score: ((step?.rank ?? -1) + 1) * 1000 + log.reps, mode: 'rank' }
}
