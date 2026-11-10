import { useEffect, useState } from 'react'
import { loadPlan, resolveExercise, type PlanData, type Workout } from '../data/plan'
import {
  createBodyMetric,
  getBodyMetrics,
  getFirstSessionDate,
  getLastArmMeasurementDate,
  getLatestBodyMetric,
  getSessions,
  getSetLogsForSession,
  db,
  newBodyMetric,
  updateBodyMetric,
  type Session,
} from '../db/db'
import { todayISODate } from '../lib/format'
import { getLastDeloadDate, setLastDeloadDate } from '../db/config'
import { armMeasurementDue } from '../lib/suggestions'
import {
  deloadAdvice,
  endedDeloadDate,
  groupHistory,
  isDeloadActive,
  plateauStatus,
  type DeloadAdvice,
} from '../lib/progression'
import './today.css'

// JS getDay(): 0=Sunday ... 6=Saturday. Map the training days to their workout.
const DAY_TO_WORKOUT: Record<number, string> = {
  1: 'Monday',
  3: 'Wednesday',
  5: 'Friday',
  6: 'Saturday',
}

const WEEK_LETTERS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

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

function toISODate(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function Today({ onStartWorkout }: { onStartWorkout: (workout: Workout) => void }) {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [failed, setFailed] = useState(false)
  const [armDue, setArmDue] = useState(false)
  const [advice, setAdvice] = useState<DeloadAdvice | null>(null)
  const [lastDeload, setLastDeload] = useState<string | null>(null)
  const [deloadError, setDeloadError] = useState('')
  const [sessions, setSessions] = useState<Session[]>([])
  const [doneSets, setDoneSets] = useState(0)
  const [latestWeight, setLatestWeight] = useState<number | null>(null)

  useEffect(() => {
    let cancelled = false
    loadPlan()
      .then((data) => {
        if (!cancelled) setPlan(data)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    getLastArmMeasurementDate()
      .then((lastArm) => {
        if (!cancelled) setArmDue(armMeasurementDue(lastArm))
      })
      .catch(() => {
        // The prompts are non-critical; ignore db errors.
      })
    Promise.all([
      loadPlan(),
      getLastDeloadDate(),
      getFirstSessionDate(),
      getSessions(),
      db.set_logs.filter((l) => !l.deleted).toArray(),
    ])
      .then(([p, last, first, allSessions, logs]) => {
        if (cancelled) return
        setLastDeload(last)
        setAdvice(
          deloadAdvice({
            status: plateauStatus(groupHistory(allSessions, logs), p),
            lastDeloadDate: last,
            firstSessionDate: first,
            todayKey: todayISODate(),
          })
        )
      })
      .catch(() => {
        // Deload advice is non-critical; ignore db errors.
      })
    getSessions()
      .then((data) => {
        if (!cancelled) setSessions(data)
      })
      .catch(() => {
        // The week strip is non-critical; ignore db errors.
      })
    getLatestBodyMetric('weight_kg')
      .then((metric) => {
        if (!cancelled) setLatestWeight(metric ? metric.value : null)
      })
      .catch(() => {
        // The weight row is non-critical; ignore db errors.
      })
    return () => {
      cancelled = true
    }
  }, [])

  const todayISO = todayISODate()
  const inProgress = sessions.find(
    (s) => s.date === todayISO && s.ended_at === null
  )

  useEffect(() => {
    if (!inProgress) {
      setDoneSets(0)
      return
    }
    let cancelled = false
    getSetLogsForSession(inProgress.id)
      .then((logs) => {
        if (!cancelled) setDoneSets(logs.length)
      })
      .catch(() => {
        // The progress line is non-critical; ignore db errors.
      })
    return () => {
      cancelled = true
    }
  }, [inProgress])

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

  const todayDone =
    todayWorkout !== null &&
    sessions.some(
      (s) =>
        s.date === todayISO &&
        s.ended_at !== null &&
        s.workout_id === todayWorkout.id
    )

  const now = new Date()
  const monday = new Date(now)
  monday.setDate(now.getDate() - ((now.getDay() + 6) % 7))

  const weekDays = Array.from({ length: 7 }, (_, offset) => {
    const d = new Date(monday)
    d.setDate(monday.getDate() + offset)
    const dateISO = toISODate(d)
    const dow = (offset + 1) % 7
    const dayName: string | undefined = DAY_TO_WORKOUT[dow]
    const scheduled = dayName !== undefined
    const workout = scheduled
      ? plan.workouts.find((w) => w.day === dayName)
      : undefined
    const done = sessions.some((s) => s.date === dateISO && s.ended_at !== null)
    return {
      dateISO,
      letter: WEEK_LETTERS[offset],
      workout,
      scheduled,
      done,
      isToday: dateISO === todayISO,
    }
  })

  const inProgressWorkout = inProgress
    ? plan.workouts.find((w) => w.id === inProgress.workout_id) ?? null
    : null
  const totalSets = inProgressWorkout
    ? inProgressWorkout.exercises.reduce((sum, slug) => {
        const ex = resolveExercise(plan, inProgressWorkout, slug)
        return sum + (ex.unilateral ? ex.sets * 2 : ex.sets)
      }, 0)
    : 0
  const progressPct =
    totalSets > 0 ? Math.min(100, Math.round((doneSets / totalSets) * 100)) : 0

  const deloadActive = isDeloadActive(lastDeload, todayISO)

  async function startDeload() {
    setDeloadError('')
    try {
      await setLastDeloadDate(todayISO)
      setLastDeload(todayISO)
    } catch {
      setDeloadError('Could not start the deload week. Try again.')
    }
  }

  async function endDeload() {
    setDeloadError('')
    try {
      const ended = endedDeloadDate(todayISO)
      await setLastDeloadDate(ended)
      setLastDeload(ended)
    } catch {
      setDeloadError('Could not end the deload week. Try again.')
    }
  }

  async function refreshWeight() {
    const metric = await getLatestBodyMetric('weight_kg')
    setLatestWeight(metric ? metric.value : null)
  }

  async function saveTodayWeight(value: number) {
    const rounded = Math.round(value * 10) / 10
    const today = todayISODate()
    const metrics = await getBodyMetrics('weight_kg')
    const existing = metrics.find((m) => m.date === today)
    if (existing) {
      existing.value = rounded
      await updateBodyMetric(existing)
    } else {
      await createBodyMetric(newBodyMetric('weight_kg', today, rounded))
    }
    await refreshWeight()
  }

  function bumpWeight() {
    void saveTodayWeight((latestWeight ?? 0) + 0.1)
  }

  function bumpWeightDown() {
    const next = Math.round(((latestWeight ?? 0) - 0.1) * 10) / 10
    if (next <= 0) return
    void saveTodayWeight(next)
  }

  function setDisplayedWeight() {
    if (latestWeight === null) return
    void saveTodayWeight(latestWeight)
  }

  return (
    <div className="screen">
      <h1>Today</h1>

      <section className="today-week">
        {weekDays.map((day) => (
          <div
            key={day.dateISO}
            className={
              'today-week-day' + (day.isToday ? ' today-week-today' : '')
            }
          >
            <span className="today-week-letter">{day.letter}</span>
            <span
              className={
                'today-week-ring' +
                (day.done ? ' today-week-ring-done' : '') +
                (day.scheduled ? ' today-week-ring-scheduled' : '')
              }
              style={
                day.workout
                  ? { ['--day-hue' as string]: hueFor(day.workout.id) }
                  : undefined
              }
            />
            <span className="today-week-name">
              {day.workout ? day.workout.name : ''}
            </span>
          </div>
        ))}
      </section>

      {inProgress && inProgressWorkout && (
        <section
          className="today-progress"
          style={{ ['--day-hue' as string]: hueFor(inProgressWorkout.id) }}
        >
          <div className="today-progress-track">
            <div
              className="today-progress-fill"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <div className="today-progress-caption">
            <span>
              {doneSets} of {totalSets} sets
            </span>
            <span>{progressPct}%</span>
          </div>
        </section>
      )}

      <section className="today-weight">
        <div className="today-weight-row">
          <span className="today-weight-label">Weight today</span>
          {latestWeight !== null ? (
            <>
              <span className="today-weight-value">
                {latestWeight.toFixed(1)}
              </span>
              <span className="today-weight-unit">kg</span>
            </>
          ) : (
            <span className="today-weight-empty">No weight logged</span>
          )}
          <div className="today-weight-actions">
            <button
              type="button"
              className="today-weight-btn"
              onClick={bumpWeightDown}
            >
              -0.1
            </button>
            <button
              type="button"
              className="today-weight-btn"
              onClick={bumpWeight}
            >
              +0.1
            </button>
            <button
              type="button"
              className="today-weight-btn"
              onClick={setDisplayedWeight}
              disabled={latestWeight === null}
            >
              Set
            </button>
          </div>
        </div>
      </section>

      {todayWorkout ? (
        <section
          className={
            'today-card' + (todayDone ? ' today-card-done' : '')
          }
        >
          <div className="today-card-head">
            <span className="today-card-day">{todayWorkout.day}</span>
            <h2 className="today-card-name">{todayWorkout.name}</h2>
          </div>
          {todayDone ? (
            <p className="today-card-done-line">
              You're all set for today.
            </p>
          ) : (
            <button
              type="button"
              className="today-start"
              onClick={() => onStartWorkout(todayWorkout)}
            >
              {inProgress && inProgress.workout_id === todayWorkout.id
                ? 'Resume workout'
                : 'Start workout'}
            </button>
          )}
        </section>
      ) : (
        <p className="today-rest">Rest day. No workout scheduled today.</p>
      )}

      {deloadActive && (
        <section className="today-deload">
          <p className="today-deload-text">Deload week: half the sets, one band lighter</p>
          <button type="button" className="today-deload-btn" onClick={() => void endDeload()}>
            End deload
          </button>
        </section>
      )}

      {!deloadActive && advice?.due && (
        <section className="today-deload">
          <h2>Deload week</h2>
          <p className="today-deload-text">{advice.message}</p>
          <p className="today-deload-sub">Half the sets, one band lighter, for one week.</p>
          <button type="button" className="today-deload-btn" onClick={() => void startDeload()}>
            Start deload week
          </button>
        </section>
      )}

      {deloadError && <p className="today-prompt">{deloadError}</p>}

      {armDue && (
        <section className="today-prompts">
          <h2>Due</h2>
          <div className="today-prompt-list">
            <p className="today-prompt">Arm measurement due. Log it on the Progress screen.</p>
          </div>
        </section>
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
