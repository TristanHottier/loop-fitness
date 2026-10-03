import { useEffect, useState } from 'react'
import { loadPlan, resolveExercise } from '../data/plan'
import type { Exercise, PlanData } from '../data/plan'
import './plan.css'

function specLine(exercise: Exercise): string {
  const reps =
    exercise.repMin === exercise.repMax
      ? String(exercise.repMin)
      : `${exercise.repMin}-${exercise.repMax}`
  return `${exercise.sets} x ${reps}, ${exercise.startBand}, ${exercise.restSeconds} s rest`
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
      <p className="screen-subtitle">Your three weekly workouts and exercises.</p>
      {plan.workouts.map((workout) => (
        <section key={workout.id} className="plan-workout">
          <h2>{`${workout.day}, ${workout.name}`}</h2>
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
