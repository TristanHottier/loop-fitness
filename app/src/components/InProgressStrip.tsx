import { useEffect, useState } from 'react'
import { loadPlan, resolveExercise, type Workout } from '../data/plan'
import { db, getSetLogsForSession } from '../db/db'
import { getLastDeloadDate } from '../db/config'
import { isDeloadActive } from '../lib/progression'
import { todayISODate } from '../lib/format'
import { hueFor } from './workoutHue'
import './in-progress-strip.css'

interface Info {
  workout: Workout
  done: number
  total: number
}

// Slim strip above the bottom nav while a session is open and the user is
// elsewhere. `refreshKey` changes whenever the app navigates, so the count
// stays current.
export function InProgressStrip({
  refreshKey,
  onResume,
}: {
  refreshKey: string
  onResume: (workout: Workout) => void
}) {
  const [info, setInfo] = useState<Info | null>(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const open = await db.sessions.filter((s) => !s.deleted && s.ended_at === null).toArray()
        if (open.length === 0) {
          if (!cancelled) setInfo(null)
          return
        }
        const today = todayISODate()
        const todays = open.filter((s) => s.date === today)
        const pool = todays.length > 0 ? todays : open
        const session = pool.reduce((a, b) => (a.started_at >= b.started_at ? a : b))
        const plan = await loadPlan()
        const workout = plan.workouts.find((w) => w.id === session.workout_id)
        if (!workout) {
          if (!cancelled) setInfo(null)
          return
        }
        const deload = isDeloadActive(await getLastDeloadDate(), today)
        let total = 0
        for (const slug of workout.exercises) {
          const ex = resolveExercise(plan, workout, slug)
          const sets = deload ? Math.ceil(ex.sets / 2) : ex.sets
          total += sets * (ex.unilateral ? 2 : 1)
        }
        const logs = await getSetLogsForSession(session.id)
        const done = logs.filter((l) => l.set_type !== 'warmup' && l.set_index > 0 && l.set_index < 100).length
        if (!cancelled) setInfo({ workout, done, total })
      } catch {
        if (!cancelled) setInfo(null)
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [refreshKey])

  if (!info) return null
  return (
    <div
      className="ip-strip"
      style={{ ['--session-hue' as string]: hueFor(info.workout.id) }}
      role="status"
    >
      <span className="ip-strip-text">
        {info.workout.name} in progress, {info.done} of {info.total}
      </span>
      <button type="button" className="ip-strip-btn" onClick={() => onResume(info.workout)}>
        Resume
      </button>
    </div>
  )
}
