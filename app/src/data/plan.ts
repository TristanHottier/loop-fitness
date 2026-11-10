export interface ExerciseInstructions {
  setup: string[]
  execution: string[]
  cues: string
  mistakes: string
  progress: string
}

export interface Exercise {
  slug: string
  name: string
  equipment: string
  repMin: number
  repMax: number
  sets: number
  restSeconds: number
  startBand: string
  unilateral: boolean
  optional: boolean
  targets: string
  muscles: { primary: string[]; secondary: string[] }
  instructions: ExerciseInstructions
}

export interface Workout {
  id: string
  name: string
  day: string
  exercises: string[]
  overrides: { [slug: string]: Partial<Exercise> }
}

// Weekly hard-set range for one muscle (primary 1, secondary 0.5).
export interface MuscleTarget {
  min: number
  max: number
}

export interface PlanData {
  bandLadders: {
    tube: string[]
    loop: string[]
  }
  // Per-muscle weekly set targets. Optional: muscles without an entry fall
  // back to the user's default range (see targetFor in lib/analytics.ts).
  muscleTargets?: { [muscle: string]: MuscleTarget }
  exercises: { [slug: string]: Exercise }
  workouts: Workout[]
}

export interface MediaEntry {
  youtube: string | null
  images: string[]
}

export interface MediaMap {
  [slug: string]: MediaEntry
}

// Fetch JSON once per page load and share the promise between screens. A
// failure clears the cache so a later call can retry.
function cachedJson<T>(url: string, cache: { p: Promise<T> | null }): Promise<T> {
  if (!cache.p) {
    cache.p = fetch(url)
      .then((res) => {
        if (!res.ok) throw new Error(`Could not load ${url} (HTTP ${res.status})`)
        return res.json() as Promise<T>
      })
      .catch((err) => {
        cache.p = null
        throw err
      })
  }
  return cache.p
}

const planCache: { p: Promise<PlanData> | null } = { p: null }
const mediaCache: { p: Promise<MediaMap> | null } = { p: null }

export function loadPlan(): Promise<PlanData> {
  return cachedJson('/plan.json', planCache)
}

export function loadMedia(): Promise<MediaMap> {
  return cachedJson('/media.json', mediaCache)
}

export function resolveExercise(plan: PlanData, workout: Workout, slug: string): Exercise {
  return { ...plan.exercises[slug], ...workout.overrides[slug] }
}
