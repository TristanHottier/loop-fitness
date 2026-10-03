// Progression suggestions and due prompts for the loop-fitness PWA.
// Reference: docs/fitness-app-brief.md, section 4 (progression rule) and
// section 6 (Today due prompts). Suggestions are never automatic changes.

import type { Exercise, PlanData } from '../data/plan'
import type { SetLog } from '../db/db'

export interface BandSuggestion {
  kind: 'progress' | 'stay'
  message: string
}

// Given a band string (e.g. "T40" or "L35-95") and the plan's band ladders,
// return the next band on the ladder, or null if already at the top.
export function nextBand(band: string, plan: PlanData): string | null {
  const isTube = band.startsWith('T')
  const ladder = isTube ? plan.bandLadders.tube : plan.bandLadders.loop
  const prefix = isTube ? 'T' : 'L'
  const entry = band.slice(prefix.length)
  const idx = ladder.indexOf(entry)
  if (idx === -1) return null
  if (idx >= ladder.length - 1) return null
  return prefix + ladder[idx + 1]
}

// Compute a progression suggestion for an exercise from its logged sets.
// - If any set is under repMin, suggest staying on the band.
// - If every set hit repMax with the same band, suggest the next band
//   (or single-arm if already at the top of the ladder).
// - Otherwise, no suggestion.
export function suggestForExercise(
  ex: Exercise,
  logs: SetLog[],
  plan: PlanData
): BandSuggestion | null {
  if (logs.length === 0) return null
  const bands = new Set(logs.map((l) => l.band))
  const anyUnderMin = logs.some((l) => l.reps < ex.repMin)
  if (anyUnderMin) {
    const bandLabel = bands.size === 1 ? logs[0].band : 'your current band'
    return {
      kind: 'stay',
      message: `Some sets were under ${ex.repMin} reps. Stay on ${bandLabel}.`,
    }
  }
  const allAtMax = logs.every((l) => l.reps >= ex.repMax)
  if (allAtMax && bands.size === 1) {
    const band = logs[0].band
    const next = nextBand(band, plan)
    if (next) {
      return {
        kind: 'progress',
        message: `All sets hit ${ex.repMax} reps on ${band}. Try ${next}.`,
      }
    }
    return {
      kind: 'progress',
      message: `All sets hit ${ex.repMax} reps on ${band}. Go single-arm.`,
    }
  }
  return null
}

// Arm measurement is due every 4 weeks (28 days). Returns true when no
// measurement exists yet or the last one is older than 28 days.
export function armMeasurementDue(lastArmDate: string | null): boolean {
  if (!lastArmDate) return true
  const days = (Date.now() - new Date(lastArmDate + 'T00:00:00Z').getTime()) / 86400000
  return days >= 28
}

// A deload week (half the sets, same bands) is due every 6 to 8 weeks.
// Returns true during weeks 6-7 of each 8-week cycle, measured from the
// first logged session.
export function deloadDue(firstSessionDate: string | null): boolean {
  if (!firstSessionDate) return false
  const days = (Date.now() - new Date(firstSessionDate + 'T00:00:00Z').getTime()) / 86400000
  const weeks = Math.floor(days / 7)
  const position = weeks % 8
  return position >= 6
}
