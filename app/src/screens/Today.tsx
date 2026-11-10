import { useEffect, useState } from 'react'
import { Minus, Plus } from 'lucide-react'
import { Collapsible } from '../components/Collapsible'
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

const SHORT_NAMES: Record<string, string> = {
  pull: 'Pull',
  push: 'Push',
  'shoulders-arms': 'Arms',
  'legs-forearms': 'Legs',
}

function shortName(w: Workout): string {
  return SHORT_NAMES[w.id] ?? w.name.split(' ')[0]
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
  const [latestWeightDate, setLatestWeightDate] = useState<string | null>(null)
  // The value the stepper shows; starts from the last logged weight.
  const [draftWeight, setDraftWeight] = useState<number | null>(null)
  const [typedWeight, setTypedWeight] = useState('')

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
        if (cancelled) return
        setLatestWeight(metric ? metric.value : null)
        setLatestWeightDate(metric ? metric.date : null)
        setDraftWeight(metric ? metric.value : null)
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

  // Next scheduled workout after today (used on rest days).
  let nextWorkout: Workout | null = null
  for (let offset = 1; offset <= 7 && !nextWorkout; offset += 1) {
    const name = DAY_TO_WORKOUT[(new Date().getDay() + offset) % 7]
    if (name) nextWorkout = plan.workouts.find((w) => w.day === name) ?? null
  }

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

  const primary = inProgressWorkout ?? todayWorkout ?? nextWorkout
  const primaryLabel =
    primary === null
      ? ''
      : inProgressWorkout && primary.id === inProgressWorkout.id && primary.id !== todayWorkout?.id
        ? `In progress: ${primary.name}`
        : todayWorkout && primary.id === todayWorkout.id
          ? `Today: ${primary.name}`
          : `Next: ${primary.day}, ${primary.name}`
  const primaryDone = primary !== null && primary.id === todayWorkout?.id && todayDone
  const others = plan.workouts.filter((w) => w.id !== primary?.id)

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
    setLatestWeightDate(metric ? metric.date : null)
    setDraftWeight(metric ? metric.value : null)
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

  function stepWeight(delta: number) {
    if (draftWeight === null) return
    const next = Math.round((draftWeight + delta) * 10) / 10
    if (next <= 0) return
    setDraftWeight(next)
  }

  function setWeight() {
    if (draftWeight === null) return
    void saveTodayWeight(draftWeight)
  }

  function setTypedWeightValue() {
    const v = parseFloat(typedWeight.replace(',', '.'))
    if (!Number.isFinite(v) || v <= 0) return
    setTypedWeight('')
    void saveTodayWeight(v)
  }

  const weightLoggedToday =
    latestWeightDate === todayISO && draftWeight !== null && draftWeight === latestWeight

  return (
    <div className="screen today">
      <h1 className="page-title">Today</h1>

      <section className="today-week" aria-label="This week">
        {weekDays.map((day) => (
          <div
            key={day.dateISO}
            className={'today-week-day' + (day.isToday ? ' today-week-today' : '')}
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
              {day.workout ? shortName(day.workout) : ''}
            </span>
          </div>
        ))}
      </section>

      {primary && (
        <section
          className="today-primary"
          style={{ ['--day-hue' as string]: hueFor(primary.id) }}
        >
          <h2 className="today-primary-title">{primaryLabel}</h2>
          {primaryDone ? (
            <p className="today-primary-done">You're all set for today.</p>
          ) : (
            <button
              type="button"
              className="today-start"
              onClick={() => onStartWorkout(primary)}
            >
              {inProgress && inProgress.workout_id === primary.id
                ? 'Resume workout'
                : 'Start workout'}
            </button>
          )}
          {inProgress && inProgressWorkout && (
            <div className="today-progress">
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
            </div>
          )}
        </section>
      )}

      <section className="today-section">
        <h2 className="section-head">Weight today</h2>
        {draftWeight !== null ? (
          <div className="today-weight-row">
            <span className="big-number today-weight-value">{draftWeight.toFixed(1)}</span>
            <span className="today-weight-unit">kg</span>
            <div className="today-weight-actions">
              <button
                type="button"
                className="icon-button today-step"
                aria-label="Decrease by 0.1"
                onClick={() => stepWeight(-0.1)}
              >
                <Minus size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="icon-button today-step"
                aria-label="Increase by 0.1"
                onClick={() => stepWeight(0.1)}
              >
                <Plus size={20} strokeWidth={1.75} aria-hidden="true" />
              </button>
              <button
                type="button"
                className="today-set"
                onClick={setWeight}
                disabled={weightLoggedToday}
              >
                {weightLoggedToday ? 'Logged' : 'Set'}
              </button>
            </div>
          </div>
        ) : (
          <form
            className="today-weight-row"
            onSubmit={(e) => {
              e.preventDefault()
              setTypedWeightValue()
            }}
          >
            <input
              className="today-weight-input"
              type="number"
              inputMode="decimal"
              step="0.1"
              placeholder="kg"
              aria-label="Weight in kg"
              value={typedWeight}
              onChange={(e) => setTypedWeight(e.target.value)}
            />
            <button type="submit" className="today-set" disabled={typedWeight === ''}>
              Set
            </button>
          </form>
        )}
        {armDue && (
          <p className="prop-row today-due">
            <span>Arm measurement due</span>
            <span>Add it on Progress</span>
          </p>
        )}
      </section>

      {deloadActive && (
        <section className="today-line">
          <p className="today-line-text">Deload week: half the sets, one band lighter.</p>
          <button type="button" className="today-link" onClick={() => void endDeload()}>
            End
          </button>
        </section>
      )}

      {!deloadActive && advice?.due && (
        <section className="today-line">
          <p className="today-line-text">{advice.message}</p>
          <button type="button" className="today-link" onClick={() => void startDeload()}>
            Start deload week
          </button>
        </section>
      )}

      {deloadError && <p className="today-error">{deloadError}</p>}

      {others.length > 0 && (
        <Collapsible id="today.others" title="Other workouts" summary={String(others.length)}>
          <div className="today-list">
            {others.map((workout) => (
              <button
                key={workout.id}
                type="button"
                className="today-row prop-row"
                onClick={() => onStartWorkout(workout)}
              >
                <span className="today-row-name">{workout.name}</span>
                <span className="today-row-day">{workout.day}</span>
              </button>
            ))}
          </div>
        </Collapsible>
      )}
    </div>
  )
}
