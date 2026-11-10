// Helpers for the live session and history-edit screens: set index encoding
// for extra rows (warm-up and drop sets), band display, lighter-band lookup
// and live PR detection. Pure (no React, no Dexie).
//
// Planned sets use set_index 1..n. Extra rows live outside that range so the
// planned sets stay intact:
//   warm-up n (n >= 1)  -> set_index 1 - n   (0, -1, -2, ...)
//   drop k after set p  -> set_index p * 100 + k   (101, 102, 201, ...)

import type { PlanData } from '../data/plan'
import type { SetLog } from '../db/db'
import { buildLadder, parseBandId, stepOf, type BandItem } from './ladder'
import { bestByExercise, isPR, type ExerciseBest } from './records'

export const DROP_BASE = 100

export type RowKind = 'planned' | 'warmup' | 'drop'

export function warmupIndex(n: number): number {
  return 1 - n
}

export function dropIndex(parent: number, k: number): number {
  return parent * DROP_BASE + k
}

export function kindOf(setIndex: number): RowKind {
  if (setIndex <= 0) return 'warmup'
  if (setIndex >= DROP_BASE) return 'drop'
  return 'planned'
}

export function dropParent(setIndex: number): number {
  return Math.floor(setIndex / DROP_BASE)
}

// Display order: warm-ups first, then planned sets with their drop sets after.
export function orderOf(setIndex: number): number {
  const kind = kindOf(setIndex)
  if (kind === 'warmup') return -1000 + (1 - setIndex)
  if (kind === 'planned') return setIndex
  return dropParent(setIndex) + 0.5 + (setIndex % DROP_BASE) / 1000
}

export function labelFor(setIndex: number): string {
  const kind = kindOf(setIndex)
  if (kind === 'warmup') return `Warm-up ${1 - setIndex}`
  if (kind === 'drop') return `Drop ${setIndex % DROP_BASE}`
  return `Set ${setIndex}`
}

export function setKey(slug: string, setIndex: number, side: string | null): string {
  return side ? `${slug}|${setIndex}|${side}` : `${slug}|${setIndex}`
}

// "T30+40" -> "30 + 40", "L35-95" -> "35-95". Unknown ids pass through.
export function formatBand(id: string): string {
  const parsed = parseBandId(id)
  return (parsed ? parsed.label : id).replace(/\+/g, ' + ')
}

// One ladder step lighter, or the same band when it is already the lightest
// or not on a ladder.
export function lighterBand(band: string, plan: PlanData, inventory?: BandItem[]): string {
  const step = stepOf(band, plan, inventory)
  if (!step || step.rank === 0) return band
  return buildLadder(plan, inventory)[step.ladder][step.rank - 1].id
}

// Keys of the logs that are new bests. A log is a best when it beats the
// history from earlier sessions (`prior`) and also every counting set logged
// earlier in this session, so only the set that actually raises the bar is
// flagged. Logs are compared in display order (warm-ups ignored).
export function prKeys(
  records: Record<string, SetLog>,
  prior: Record<string, ExerciseBest | null>,
  plan: PlanData,
  inventory?: BandItem[]
): Set<string> {
  const out = new Set<string>()
  const bySlug = new Map<string, Array<[string, SetLog]>>()
  for (const [key, log] of Object.entries(records)) {
    const list = bySlug.get(log.exercise_slug) ?? []
    list.push([key, log])
    bySlug.set(log.exercise_slug, list)
  }
  for (const [slug, entries] of bySlug) {
    entries.sort(
      (a, b) =>
        orderOf(a[1].set_index) - orderOf(b[1].set_index) ||
        (a[1].side ?? '').localeCompare(b[1].side ?? '')
    )
    const running: SetLog[] = []
    for (const [key, log] of entries) {
      if (isPR(log, prior[slug], plan, inventory)) {
        const runBest = running.length ? bestByExercise(running, plan, inventory)[slug] : undefined
        if (!runBest || runBest.bestSet === null || isPR(log, runBest, plan, inventory)) out.add(key)
      }
      running.push(log)
    }
  }
  return out
}
