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
  supersetGroup: string | null
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

export interface PlanData {
  bandLadders: {
    tube: string[]
    loop: string[]
  }
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

export async function loadPlan(): Promise<PlanData> {
  const res = await fetch('/plan.json')
  return res.json() as Promise<PlanData>
}

export async function loadMedia(): Promise<MediaMap> {
  const res = await fetch('/media.json')
  return res.json() as Promise<MediaMap>
}

export function resolveExercise(plan: PlanData, workout: Workout, slug: string): Exercise {
  return { ...plan.exercises[slug], ...workout.overrides[slug] }
}
