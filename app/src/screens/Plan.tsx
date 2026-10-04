import { useEffect, useState } from 'react'
import { loadPlan, resolveExercise } from '../data/plan'
import type { Exercise, PlanData, Workout } from '../data/plan'
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

// The most common rest duration across the workout's exercises. When two
// durations tie for the lead there is no single most common value, so the
// row reads "varies".
function restLabelFor(plan: PlanData, workout: Workout): string {
  const counts = new Map<number, number>()
  for (const slug of workout.exercises) {
    const ex = resolveExercise(plan, workout, slug)
    counts.set(ex.restSeconds, (counts.get(ex.restSeconds) ?? 0) + 1)
  }
  let best: number | null = null
  let bestCount = 0
  let tie = false
  for (const [seconds, count] of counts) {
    if (count > bestCount) {
      best = seconds
      bestCount = count
      tie = false
    } else if (count === bestCount) {
      tie = true
    }
  }
  if (best === null || tie) {
    return 'varies'
  }
  return `${best} s`
}

export function Plan({ onOpenExercise }: { onOpenExercise: (slug: string) => void }) {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [failed, setFailed] = useState(false)

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
      <p className="screen-subtitle">Your four weekly workouts and exercises.</p>
      {plan.workouts.map((workout) => (
        <section key={workout.id} className="plan-workout">
          <div
            className="plan-cover"
            style={{ ['--plan-hue' as string]: hueFor(workout.id) }}
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
              <p className="plan-cover-day">{workout.day}</p>
              <h2 className="plan-cover-name">{workout.name}</h2>
            </div>
          </div>
          <div className="plan-props">
            <div className="plan-prop-row">
              <span className="plan-prop-label">Day</span>
              <span className="plan-prop-value">{workout.day}</span>
            </div>
            <div className="plan-prop-row">
              <span className="plan-prop-label">Exercises</span>
              <span className="plan-prop-value">{workout.exercises.length}</span>
            </div>
            <div className="plan-prop-row">
              <span className="plan-prop-label">Total sets</span>
              <span className="plan-prop-value">{totalSetsFor(plan, workout)}</span>
            </div>
            <div className="plan-prop-row">
              <span className="plan-prop-label">Rest</span>
              <span className="plan-prop-value">{restLabelFor(plan, workout)}</span>
            </div>
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
        </section>
      ))}
    </div>
  )
}
