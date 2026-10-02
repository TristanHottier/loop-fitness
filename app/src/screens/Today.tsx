import { useEffect, useState } from 'react'
import { loadPlan, type PlanData, type Workout } from '../data/plan'
import './today.css'

// JS getDay(): 0=Sunday ... 6=Saturday. Map the training days to their workout.
const DAY_TO_WORKOUT: Record<number, string> = {
  1: 'Monday',
  3: 'Wednesday',
  5: 'Friday',
}

export function Today({ onStartWorkout }: { onStartWorkout: (workout: Workout) => void }) {
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
        <h1>Today</h1>
        <p className="screen-subtitle">Could not load the plan.</p>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="screen">
        <h1>Today</h1>
        <p className="screen-subtitle">Loading plan</p>
      </div>
    )
  }

  const todayKey = DAY_TO_WORKOUT[new Date().getDay()]
  const todayWorkout = todayKey
    ? plan.workouts.find((w) => w.day === todayKey) ?? null
    : null

  const others = todayWorkout
    ? plan.workouts.filter((w) => w.id !== todayWorkout.id)
    : plan.workouts

  return (
    <div className="screen">
      <h1>Today</h1>
      <p className="screen-subtitle">Your next workout and quick entries.</p>

      {todayWorkout ? (
        <section className="today-card">
          <div className="today-card-head">
            <span className="today-card-day">{todayWorkout.day}</span>
            <h2 className="today-card-name">{todayWorkout.name}</h2>
          </div>
          <button
            type="button"
            className="today-start"
            onClick={() => onStartWorkout(todayWorkout)}
          >
            Start workout
          </button>
        </section>
      ) : (
        <p className="today-rest">Rest day. No workout scheduled today.</p>
      )}

      {others.length > 0 && (
        <section className="today-others">
          <h2>Other workouts</h2>
          <div className="today-list">
            {others.map((workout) => (
              <button
                key={workout.id}
                type="button"
                className="today-row"
                onClick={() => onStartWorkout(workout)}
              >
                <span className="today-row-day">{workout.day}</span>
                <span className="today-row-name">{workout.name}</span>
              </button>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
