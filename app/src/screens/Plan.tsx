import { useEffect, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { loadPlan, resolveExercise } from '../data/plan'
import type { Exercise, PlanData, Workout } from '../data/plan'
import { MuscleMap } from '../components/MuscleMap'
import { MuscleVolumeList } from '../components/MuscleVolumeList'
import { useTrainingData } from '../components/useTrainingData'
import { getVolumeTargets, DEFAULT_VOLUME_TARGETS, type VolumeTargets } from '../db/config'
import { weeklyVolume } from '../lib/analytics'
import { addDays, dayKey, weekStart } from '../lib/dates'
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
  const [view, setView] = useState<'planned' | 'week'>('planned')
  const [targets, setTargets] = useState<VolumeTargets>(DEFAULT_VOLUME_TARGETS)
  const training = useTrainingData()

  useEffect(() => {
    let cancelled = false
    getVolumeTargets()
      .then((t) => {
        if (!cancelled) setTargets(t)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

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
        <h1 className="page-title">Plan</h1>
        <p className="screen-subtitle">Could not load the plan.</p>
      </div>
    )
  }

  if (!plan) {
    return (
      <div className="screen">
        <h1 className="page-title">Plan</h1>
        <p className="screen-subtitle">Loading plan</p>
      </div>
    )
  }

  return (
    <div className="screen plan">
      <h1 className="page-title">Plan</h1>
      <ProgramSection
        plan={plan}
        view={view}
        onView={setView}
        targets={targets}
        training={training}
      />
      <h2 className="section-head plan-workouts-head">Workouts</h2>
      {plan.workouts.map((workout) => {
        const isOpen = expanded.has(workout.id)
        return (
          <section
            key={workout.id}
            className="plan-workout"
            style={{ ['--plan-hue' as string]: hueFor(workout.id) }}
          >
            <button
              type="button"
              className="plan-cover"
              aria-expanded={isOpen}
              onClick={() => toggleWorkout(workout.id)}
            >
              <span className="plan-cover-text">
                <span className="plan-cover-name">{workout.name}</span>
                <span className="plan-cover-day">
                  {workout.day}, {workout.exercises.length} exercises, {totalSetsFor(plan, workout)} sets
                </span>
              </span>
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
            {isOpen && (
              <>
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
                <div className="plan-muscle-map">
                  <MuscleMap
                    primary={[]}
                    secondary={[]}
                    volume={workoutVolume(plan, workout)}
                  />
                </div>
              </>
            )}
          </section>
        )
      })}
    </div>
  )
}

function ProgramSection({
  plan,
  view,
  onView,
  targets,
  training,
}: {
  plan: PlanData
  view: 'planned' | 'week'
  onView: (v: 'planned' | 'week') => void
  targets: VolumeTargets
  training: ReturnType<typeof useTrainingData>
}) {
  const planned = programVolume(plan)
  const week = weekStart(dayKey())
  const logged = training ? weeklyVolume(training.logs, training.sessions, plan, week) : {}
  const lastWeek = training ? weeklyVolume(training.logs, training.sessions, plan, addDays(week, -7)) : {}
  const isWeek = view === 'week'
  const [mapOpen, setMapOpen] = useState(false)
  // List every muscle the program trains, plus anything logged outside of it.
  const values: Record<string, number> = {}
  for (const k of Object.keys(planned)) values[k] = isWeek ? (logged[k] ?? 0) : planned[k]
  if (isWeek) for (const k of Object.keys(logged)) values[k] = logged[k]
  const options: { id: 'planned' | 'week'; label: string }[] = [
    { id: 'planned', label: 'Planned' },
    { id: 'week', label: 'This week' },
  ]
  return (
    <section className="plan-program">
      <h2 className="section-head">Muscle volume</h2>
      <div className="plan-toggle" role="group" aria-label="Volume view">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            className="plan-toggle-btn"
            aria-pressed={view === o.id}
            onClick={() => onView(o.id)}
          >
            {o.label}
          </button>
        ))}
      </div>
      <p className="plan-program-map-sub">
        {isWeek
          ? 'Hard sets logged since Monday. Warmups are not counted, drop sets count half.'
          : `Planned set volume across ${plan.workouts.length} workouts`}
      </p>
      {isWeek && !training ? (
        <p className="plan-program-map-sub">Loading logged sets</p>
      ) : (
        <MuscleVolumeList
          values={values}
          targets={targets}
          previous={isWeek ? lastWeek : undefined}
          caption={isWeek ? 'Logged sets per muscle this week' : 'Planned sets per muscle per week'}
        />
      )}
      <button
        type="button"
        className="prop-row plan-map-toggle"
        aria-expanded={mapOpen}
        onClick={() => setMapOpen((o) => !o)}
      >
        <span>Muscle map</span>
        <span className="plan-map-toggle-state">
          {mapOpen ? 'Hide' : 'Show'}
          <ChevronDown
            size={18}
            strokeWidth={1.75}
            aria-hidden="true"
            className={mapOpen ? '' : 'plan-cover-chevron-collapsed'}
          />
        </span>
      </button>
      {mapOpen && (
        <div className="plan-muscle-map">
          <MuscleMap primary={[]} secondary={[]} volume={isWeek ? logged : planned} />
        </div>
      )}
    </section>
  )
}
