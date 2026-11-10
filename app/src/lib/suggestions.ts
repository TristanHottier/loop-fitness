// Progression suggestions and due prompts for the loop-fitness PWA.
// Reference: docs/fitness-app-brief.md, section 4 (progression rule) and
// section 6 (Today due prompts). Suggestions are never automatic changes.

import type { Exercise, PlanData } from '../data/plan'
import type { SetLog } from '../db/db'
import type { ExerciseOverride, ProgressionRule } from '../db/config'
import { bandId, nextStep, prevStep, stepOf, type BandItem, type LadderStep } from './ladder'
import { dayKey, daysBetween } from './dates'

export type SuggestionKind = 'progress' | 'stay' | 'step-down'

export interface SuggestionTarget {
  band: string // band id for the next session
  repMin: number
  repMax: number
}

// What to try before a big band jump (guide section 4, order of progression).
export interface Intermediate {
  type: 'tempo' | 'pause' | 'stack'
  text: string // e.g. "slow the tempo (3-1-1)"
  band?: string // for 'stack': the in-between band id
}

export interface BandSuggestion {
  kind: SuggestionKind // 'progress' | 'stay' kept from phase 1; 'step-down' is new
  message: string // one line for the session screen
  reason: string // short why
  target: SuggestionTarget
  note?: string // e.g. "felt easy"
  intermediate?: Intermediate // set when kind is 'stay' because the next step is a big jump
}

export interface SuggestOptions {
  // Sessions of this exercise, most recent first. Falls back to the logs argument.
  history?: SetLog[][]
  // Progression settings for this exercise, or the whole map keyed by slug.
  override?: ExerciseOverride
  overrides?: Record<string, ExerciseOverride>
  inventory?: BandItem[]
}

// Given a band id (e.g. "T40" or "L35-95") and the plan's band ladders,
// return the next band id on the ladder, or null if already at the top or
// unknown. See ladder.ts for how ids map to ladder labels.
export function nextBand(band: string, plan: PlanData, inventory?: BandItem[]): string | null {
  return nextStep(band, plan, inventory)?.id ?? null
}

export const BIG_JUMP_RATIO = 1.35

const isWorking = (l: SetLog) => !l.deleted && l.set_type !== 'warmup' && l.set_type !== 'drop'

function singleBand(sets: SetLog[]): string | null {
  const bands = new Set(sets.map((s) => s.band))
  return bands.size === 1 ? sets[0].band : null
}

// Is the move from `cur` to `next` a big jump? Resistance known on both and
// more than 35% up, or from a single band to a 3-band stack.
export function isBigJump(cur: LadderStep, next: LadderStep): boolean {
  if (cur.resistanceKg !== null && next.resistanceKg !== null && next.resistanceKg > cur.resistanceKg * BIG_JUMP_RATIO)
    return true
  return cur.bands.length === 1 && next.bands.length >= 3
}

// Compute a progression suggestion for an exercise from its logged sets.
// Only working sets count (warmup and drop sets are ignored). Rules, in order:
// 1. Step down: most working sets under repMin in two consecutive sessions
//    on the same band, one step lighter.
// 2. The exercise's progression rule is met (default 'all-sets-max'; see
//    ExerciseOverride): progress. A last set with 3+ reps in reserve adds the
//    note "felt easy". RIR 0 does not block it.
// 3. Early progress: every working set had 3+ reps in reserve and reps of at
//    least repMin + 2.
// 4. Any working set under repMin: stay.
// 5. Otherwise null.
// Progress toward a big jump is replaced by an intermediate: first slow the
// tempo, the second consecutive time add a pause, the third time move on.
export function suggestForExercise(
  ex: Exercise,
  logs: SetLog[],
  plan: PlanData,
  opts: SuggestOptions = {}
): BandSuggestion | null {
  const src = opts.history && opts.history.length > 0 ? opts.history : [logs]
  const sessions = src.map((s) => s.filter(isWorking)).filter((s) => s.length > 0)
  if (sessions.length === 0) return null
  const latest = sessions[0]
  const inv = opts.inventory
  const ov = opts.override ?? opts.overrides?.[ex.slug] ?? {}
  const rule: ProgressionRule = ov.rule ?? 'all-sets-max'
  const sideMul = ex.unilateral ? 2 : 1
  const totalTarget = ov.totalRepsTarget ?? ex.sets * sideMul * ex.repMax
  const band = singleBand(latest)
  const range = { repMin: ex.repMin, repMax: ex.repMax }
  const allMax = (s: SetLog[]) => singleBand(s) !== null && s.every((l) => l.reps >= ex.repMax)
  const totalMet = (s: SetLog[]) => singleBand(s) !== null && s.reduce((a, l) => a + l.reps, 0) >= totalTarget
  const allEasy = (s: SetLog[]) => s.every((l) => l.rir !== null && l.rir >= 3 && l.reps >= ex.repMin + 2)
  const sessionMet = rule === 'total-reps' ? totalMet : allMax

  // 1. Step down.
  const mostUnder = (s: SetLog[]) => s.filter((l) => l.reps < ex.repMin).length * 2 > s.length
  if (sessions.length >= 2 && band !== null && mostUnder(latest) && mostUnder(sessions[1]) && singleBand(sessions[1]) === band) {
    const lighter = prevStep(band, plan, inv)
    if (lighter) {
      return {
        kind: 'step-down',
        message: `Reps were under ${ex.repMin} on most sets for two sessions. Step down to ${lighter.id}.`,
        reason: `Under ${ex.repMin} reps on most sets, two sessions in a row`,
        target: { band: lighter.id, ...range },
      }
    }
  }

  // 2. Rule met.
  let metReason: string | null = null
  let metMessage = ''
  if (band !== null) {
    if (rule === 'two-of-three') {
      const n = sessions.slice(0, 3).filter((s) => singleBand(s) === band && allMax(s)).length
      if (n >= 2) {
        metReason = `Top of the range in ${n} of the last ${Math.min(3, sessions.length)} sessions`
        metMessage = `Hit ${ex.repMax} reps on every set in ${n} of the last ${Math.min(3, sessions.length)} sessions on ${band}.`
      }
    } else if (rule === 'total-reps') {
      const total = latest.reduce((a, l) => a + l.reps, 0)
      if (total >= totalTarget) {
        metReason = `Total reps ${total} reached the target of ${totalTarget}`
        metMessage = `Total reps reached ${total} on ${band}.`
      }
    } else if (allMax(latest)) {
      metReason = `Every set reached ${ex.repMax} reps`
      metMessage = `All sets hit ${ex.repMax} reps on ${band}.`
    }
  }
  let earlyEasy = false
  if (metReason === null && band !== null) {
    earlyEasy = allEasy(latest)
    if (earlyEasy) {
      metReason = `Every set had 3 or more reps in reserve`
      metMessage = `Every set felt easy at ${ex.repMin + 2}+ reps on ${band}.`
    }
  }

  if (metReason !== null && band !== null) {
    const lastSet = latest.reduce((a, l) => (l.set_index >= a.set_index ? l : a))
    const easy = !earlyEasy && lastSet.rir !== null && lastSet.rir >= 3
    const note = easy ? 'felt easy' : undefined
    const tail = easy ? ' Felt easy.' : ''
    const cur = stepOf(band, plan, inv)
    const next = nextStep(band, plan, inv)
    if (!next) {
      const msg = ex.unilateral
        ? `${metMessage} Top of the ladder. Slow the lowering to 4 s and add a pause.`
        : `${metMessage} Go single-arm.`
      return { kind: 'progress', message: msg + tail, reason: metReason, target: { band, ...range }, ...(note ? { note } : {}) }
    }
    if (cur && isBigJump(cur, next)) {
      let streak = 0
      for (const s of sessions) {
        if (singleBand(s) === band && (sessionMet(s) || allEasy(s))) streak += 1
        else break
      }
      if (streak < 3) {
        const inter = pickIntermediate(cur, next, streak, plan, inv)
        return {
          kind: 'stay',
          message: `${metMessage} The step to ${next.id} is big, so first ${inter.text}.${tail}`,
          reason: `${metReason}, but ${next.id} is a big jump`,
          target: { band, ...range },
          intermediate: inter,
          ...(note ? { note } : {}),
        }
      }
    }
    return {
      kind: 'progress',
      message: `${metMessage} Try ${next.id}.${tail}`,
      reason: metReason,
      target: { band: next.id, ...range },
      ...(note ? { note } : {}),
    }
  }

  // 4. Under repMin somewhere.
  if (latest.some((l) => l.reps < ex.repMin)) {
    const bands = new Set(latest.map((l) => l.band))
    const bandLabel = bands.size === 1 ? latest[0].band : 'your current band'
    return {
      kind: 'stay',
      message: `Some sets were under ${ex.repMin} reps. Stay on ${bandLabel}.`,
      reason: `Some sets were under ${ex.repMin} reps`,
      target: { band: band ?? latest[latest.length - 1].band, ...range },
    }
  }
  return null
}

function pickIntermediate(
  cur: LadderStep,
  next: LadderStep,
  streak: number,
  plan: PlanData,
  inv?: BandItem[]
): Intermediate {
  // Single to a 3-band stack: a 2-band stack in between, when the inventory
  // shows one (the current band plus the lightest other owned band).
  if (cur.bands.length === 1 && next.bands.length >= 3 && inv) {
    const others = inv
      .filter((i) => i.owned && i.ladder === cur.ladder && i.label !== cur.label && !i.label.includes('+'))
      .sort((a, b) => (a.resistanceKg ?? a.nominal ?? 0) - (b.resistanceKg ?? b.nominal ?? 0))
    if (others.length > 0) {
      const order = plan.bandLadders[cur.ladder].filter((l) => !l.includes('+'))
      const parts = [cur.label, others[0].label].sort((a, b) => order.indexOf(a) - order.indexOf(b))
      const band = bandId(cur.ladder, parts.join('+'))
      return { type: 'stack', text: `use the ${parts.join(' + ')} stack`, band }
    }
  }
  return streak >= 2
    ? { type: 'pause', text: 'add a pause at the hardest point' }
    : { type: 'tempo', text: 'slow the tempo (3-1-1)' }
}

// Arm measurement is due every 4 weeks (28 days). Returns true when no
// measurement exists yet or the last one is at least 28 local calendar days
// ago. `now` is injectable for tests.
export function armMeasurementDue(lastArmDate: string | null, now: Date = new Date()): boolean {
  if (!lastArmDate) return true
  return daysBetween(lastArmDate, dayKey(now)) >= 28
}

// A deload week (half the sets, same bands) is due every 6 to 8 weeks.
// Returns true during weeks 6-7 of each 8-week cycle, measured from the
// first logged session in local calendar days.
export function deloadDue(firstSessionDate: string | null, now: Date = new Date()): boolean {
  if (!firstSessionDate) return false
  const days = daysBetween(firstSessionDate, dayKey(now))
  const weeks = Math.floor(days / 7)
  const position = weeks % 8
  return position >= 6
}
