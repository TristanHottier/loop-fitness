import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { loadPlan, resolveExercise } from '../data/plan'
import type { Exercise, PlanData, Workout } from '../data/plan'
import { MuscleMap } from '../components/MuscleMap'
import './plan.css'

function hueFor(workoutId: string): string {
  switch (workoutId) {
    case 'pull':
      return 'var(--hue-pull)'
    case 'push':
      return 'var(--hue-push)'
    case 'shoulders-arms':
      return 'var(--hue-shoulders)'
    case 'legs-forearms':
      return 'var(--hue-legs)'
    default:
      return 'var(--color-accent)'
  }
}

function specLine(exercise: Exercise): string {
  const reps =
    exercise.repMin === exercise.repMax
      ? String(exercise.repMin)
      : `${exercise.repMin}-${exercise.repMax}`
  return `${exercise.sets} x ${reps}, ${exercise.startBand}, ${exercise.restSeconds} s rest`
}

function totalSetsFor(plan: PlanData, workout: Workout): number {
  let total = 0
  for (const slug of workout.exercises) {
    const ex = resolveExercise(plan, workout, slug)
    total += ex.unilateral ? ex.sets * 2 : ex.sets
  }
  return total
}

// Per-muscle set counts for the whole workout. Primary muscles get the full
// set count, secondary muscles get half (fractional values are fine, the
// heatmap steps are thresholds). A muscle key may appear in
// several exercises, so the counts accumulate per key.
function workoutVolume(plan: PlanData, workout: Workout): Record<string, number> {
  const volume: Record<string, number> = {}
  for (const slug of workout.exercises) {
    const ex = resolveExercise(plan, workout, slug)
    for (const key of ex.muscles.primary) {
      volume[key] = (volume[key] ?? 0) + ex.sets
    }
    for (const key of ex.muscles.secondary) {
      volume[key] = (volume[key] ?? 0) + ex.sets / 2
    }
  }
  return volume
}

// Per-muscle set counts across the whole program. Same counting rule as
// workoutVolume, summed over every workout in the plan.
function programVolume(plan: PlanData): Record<string, number> {
  const volume: Record<string, number> = {}
  for (const workout of plan.workouts) {
    const perWorkout = workoutVolume(plan, workout)
    for (const [key, sets] of Object.entries(perWorkout)) {
      volume[key] = (volume[key] ?? 0) + sets
    }
  }
  return volume
}

export function Plan({ onOpenExercise }: { onOpenExercise: (slug: string) => void }) {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [failed, setFailed] = useState(false)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    loadPlan()
      .then((data) => {
        if (!cancelled) setPlan(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [])

  const toggleWorkout = (workoutId: string) => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(workoutId)) {
        next.delete(workoutId)
      } else {
        next.add(workoutId)
      }
      return next
    })
  }

  if (failed) {
    return (
      <div className="screen">
        <h1>Plan</h1>
        <p className="screen-subtitle">Could not load the plan.</p>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="screen">
        <h1>Plan</h1>
        <p className="screen-subtitle">Loading plan</p>
      </div>
    )
  }

  return (
    <div className="screen">
      <h1>Plan</h1>
      {plan.workouts.map((workout) => {
        const isOpen = expanded.has(workout.id)
        return (
          <section key={workout.id} className="plan-workout">
            <button
              type="button"
              className="plan-cover"
              aria-expanded={isOpen}
              style={{ ['--plan-hue' as string]: hueFor(workout.id) }}
              onClick={() => toggleWorkout(workout.id)}
            >
              <svg
                className="plan-cover-logo"
                viewBox="0 0 100 50"
                aria-hidden="true"
              >
                <path
                  d="M50,25 C50,8 18,8 18,25 C18,42 50,42 50,25 C50,8 82,8 82,25 C82,42 50,42 50,25 Z"
                  fill="none"
                  stroke="var(--plan-hue)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              <div className="plan-cover-text">
                <span className="plan-cover-day">{workout.day}</span>
                <span className="plan-cover-name">{workout.name}</span>
              </div>
              <ChevronDown
                className={
                  'plan-cover-chevron' +
                  (isOpen ? '' : ' plan-cover-chevron-collapsed')
                }
                size={18}
                strokeWidth={1.75}
                aria-hidden="true"
              />
            </button>
            <div className="plan-tags">
              <span className="plan-card-tag">{workout.exercises.length} exercises</span>
              <span className="plan-card-tag">{totalSetsFor(plan, workout)} sets</span>
            </div>
            {isOpen && (
              <>
                <div className="plan-muscle-map">
                  <MuscleMap
                    primary={[]}
                    secondary={[]}
                    volume={workoutVolume(plan, workout)}
                  />
                </div>
                <div className="plan-exercise-list">
                  {workout.exercises.map((slug) => {
                    const exercise = resolveExercise(plan, workout, slug)
                    return (
                      <button
                        key={slug}
                        type="button"
                        className="plan-exercise-row"
                        onClick={() => onOpenExercise(slug)}
                      >
                        <span className="plan-exercise-name">{exercise.name}</span>
                        <span className="plan-exercise-spec">
                          <span>{specLine(exercise)}</span>
                          {exercise.optional ? <span className="plan-tag">optional</span> : null}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </>
            )}
          </section>
        )
      })}
      <section className="plan-program-map">
        <h2 className="plan-program-map-title">Muscles trained across the program</h2>
        <p className="plan-program-map-sub">
          Set volume across {plan.workouts.length} workouts
        </p>
        <div className="plan-muscle-map">
          <MuscleMap
            primary={[]}
            secondary={[]}
            volume={programVolume(plan)}
          />
        </div>
      </section>
    </div>
  )
}
