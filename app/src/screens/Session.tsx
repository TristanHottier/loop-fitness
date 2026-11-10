import { useEffect, useRef, useState } from 'react'
import { loadPlan, resolveExercise, type PlanData, type Workout } from '../data/plan'
import {
  newSession,
  createSession,
  newSetLog,
  createSetLog,
  getLatestBandForExercise,
  getLatestRepsForExercise,
  getLatestSessionLogsForExercise,
  getOpenSession,
  getSetLogsForSession,
  deleteSetLog,
  endSession,
  db,
  type Session as SessionRecord,
  type SetLog,
} from '../db/db'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { RestTimer } from '../components/RestTimer'
import { BandPicker } from '../components/BandPicker'
import { todayISODate } from '../lib/format'
import { suggestForExercise, type BandSuggestion } from '../lib/suggestions'
import './session.css'

type InputState = { reps: string; band: string; note: string }

// The best earlier performance for an exercise, from sessions other than the
// current one: the highest band ladder position, and the most reps per band.
type PriorBest = { maxBandIdx: number; repsByBand: Record<string, number> }

function setKey(slug: string, setIndex: number, side: string | null): string {
  return side ? `${slug}|${setIndex}|${side}` : `${slug}|${setIndex}`
}

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

function totalSetsFor(plan: PlanData, workout: Workout): number {
  let total = 0
  for (const slug of workout.exercises) {
    const ex = resolveExercise(plan, workout, slug)
    total += ex.unilateral ? ex.sets * 2 : ex.sets
  }
  return total
}

// The position of a band in its ladder. Bands starting with "L" are loop
// ladders, "T" are tube ladders. Returns -1 when the band is not in the
// ladder, which is treated as not better.
function bandIndex(band: string, plan: PlanData): number {
  if (band.startsWith('L')) return plan.bandLadders.loop.indexOf(band)
  if (band.startsWith('T')) return plan.bandLadders.tube.indexOf(band)
  return -1
}

export function Session({
  workout,
  onExit,
  onOpenExercise,
}: {
  workout: Workout
  onExit: () => void
  onOpenExercise: (slug: string) => void
}) {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [inputs, setInputs] = useState<Record<string, InputState>>({})
  const [logRecords, setLogRecords] = useState<Record<string, SetLog>>({})
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [activeTimer, setActiveTimer] = useState<{ seconds: number; label: string } | null>(null)
  const [timerKey, setTimerKey] = useState(0)
  const [suggestions, setSuggestions] = useState<Record<string, BandSuggestion | null>>({})
  const [priorBest, setPriorBest] = useState<Record<string, PriorBest | null>>({})
  const [bandPickerKey, setBandPickerKey] = useState<string | null>(null)
  const [latestBands, setLatestBands] = useState<Record<string, string>>({})
  const [completed, setCompleted] = useState(false)
  // Resolve (reopen or create) the session once per workout, even when
  // StrictMode mounts the effect twice.
  const sessionRef = useRef<{ workoutId: string; promise: Promise<SessionRecord> } | null>(null)
  // Set keys with a write in flight, and when each set was last logged.
  const busyKeys = useRef<Set<string>>(new Set())
  const loggedAt = useRef<Record<string, number>>({})

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const p = await loadPlan()
        if (cancelled) return
        if (!sessionRef.current || sessionRef.current.workoutId !== workout.id) {
          sessionRef.current = {
            workoutId: workout.id,
            promise: (async () => {
              const date = todayISODate()
              const open = await getOpenSession(workout.id, date)
              if (open) return open
              const created = newSession(workout.id, date)
              await createSession(created)
              return created
            })(),
          }
        }
        const s = await sessionRef.current.promise
        const existingLogs = await getSetLogsForSession(s.id)
        if (cancelled) return
        setPlan(p)
        setSession(s)

        const bandMap: Record<string, string> = {}
        const repsMap: Record<string, number> = {}
        for (const slug of workout.exercises) {
          const ex = resolveExercise(p, workout, slug)
          const latestBand = await getLatestBandForExercise(slug)
          const latestReps = await getLatestRepsForExercise(slug)
          bandMap[slug] = latestBand ?? ex.startBand
          repsMap[slug] = latestReps ?? ex.repMin
        }
        if (cancelled) return
        setLatestBands(bandMap)

        const init: Record<string, InputState> = {}
        for (const slug of workout.exercises) {
          const ex = resolveExercise(p, workout, slug)
          const band = bandMap[slug]
          const reps = String(repsMap[slug])
          for (let i = 1; i <= ex.sets; i++) {
            if (ex.unilateral) {
              for (const side of ['L', 'R']) {
                init[`${slug}|${i}|${side}`] = { reps, band, note: '' }
              }
            } else {
              init[`${slug}|${i}`] = { reps, band, note: '' }
            }
          }
        }

        // Reopened session: restore the sets that were already logged.
        const restored: Record<string, SetLog> = {}
        for (const log of existingLogs) {
          const key = setKey(log.exercise_slug, log.set_index, log.side)
          if (!(key in init)) continue
          restored[key] = log
          init[key] = { reps: String(log.reps), band: log.band, note: log.note ?? '' }
        }
        setInputs(init)
        setLogRecords(restored)

        const sugg: Record<string, BandSuggestion | null> = {}
        const best: Record<string, PriorBest | null> = {}
        for (const slug of workout.exercises) {
          const ex = resolveExercise(p, workout, slug)
          const prevLogs = await getLatestSessionLogsForExercise(slug)
          sugg[slug] = suggestForExercise(ex, prevLogs, p)
          const allLogs = await db.set_logs
            .filter((l) => !l.deleted && l.exercise_slug === slug && l.session_id !== s.id)
            .toArray()
          if (allLogs.length === 0) {
            best[slug] = null
            continue
          }
          const repsByBand: Record<string, number> = {}
          let maxBandIdx = -1
          for (const l of allLogs) {
            repsByBand[l.band] = Math.max(repsByBand[l.band] ?? 0, l.reps)
            maxBandIdx = Math.max(maxBandIdx, bandIndex(l.band, p))
          }
          best[slug] = { maxBandIdx, repsByBand }
        }
        if (cancelled) return
        setSuggestions(sugg)
        setPriorBest(best)
      } catch {
        if (!cancelled) setError('Could not start the session.')
      }
    }
    init()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workout.id])

  if (error) {
    return (
      <div className="session">
        <p className="session-note">{error}</p>
      </div>
    )
  }
  if (!plan || !session) {
    return (
      <div className="session">
        <p className="session-note">Loading session</p>
      </div>
    )
  }

  const activeSession = session
  const activePlan = plan

  function updateInput(key: string, field: keyof InputState, value: string) {
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  async function logSet(key: string, slug: string, setIndex: number, side: string | null) {
    const input = inputs[key]
    if (!input) return
    if (busyKeys.current.has(key)) return
    busyKeys.current.add(key)
    try {
      const existing = logRecords[key]
      if (existing) {
        // Tapping a logged set again un-logs it. Ignore an accidental double
        // tap right after logging, and do not restart the rest timer.
        if (Date.now() - (loggedAt.current[key] ?? 0) < 800) return
        await deleteSetLog(existing.id)
        setLogRecords((prev) => {
          const next = { ...prev }
          delete next[key]
          return next
        })
        return
      }
      const reps = parseInt(input.reps, 10) || 0
      const log = newSetLog(activeSession.id, slug, setIndex, side, reps, input.band, input.note || null)
      await createSetLog(log)
      loggedAt.current[key] = Date.now()
      setLogRecords((prev) => ({ ...prev, [key]: log }))
    } catch {
      setError('Could not save the set.')
      return
    } finally {
      busyKeys.current.delete(key)
    }

    const ex = resolveExercise(activePlan, workout, slug)

    // Unilateral: the timer starts only after the second side (R) is logged.
    if (ex.unilateral && side !== 'R') return

    setActiveTimer({ seconds: ex.restSeconds, label: ex.name })
    setTimerKey((k) => k + 1)
  }

  async function finish() {
    await endSession(activeSession.id)
    setCompleted(true)
  }

  function setRow(key: string, slug: string, setIndex: number, side: string | null) {
    const input = inputs[key]
    const isLogged = Boolean(logRecords[key])
    const sideLabel = side ? `, ${side === 'L' ? 'left' : 'right'}` : ''
    return (
      <>
        <input
          className="session-input session-input-reps"
          type="number"
          inputMode="numeric"
          value={input?.reps ?? ''}
          aria-label={`Reps, set ${setIndex}${sideLabel}`}
          onChange={(e) => updateInput(key, 'reps', e.target.value)}
        />
        <button
          type="button"
          className="session-input session-input-band session-input-band-button"
          onClick={() => setBandPickerKey(key)}
        >
          {input?.band ?? ''}
        </button>
        <input
          className="session-input session-input-note"
          type="text"
          placeholder="Note"
          aria-label={`Note, set ${setIndex}${sideLabel}`}
          value={input?.note ?? ''}
          onChange={(e) => updateInput(key, 'note', e.target.value)}
        />
        <button
          className={'session-check' + (isLogged ? ' session-check-logged' : '')}
          onClick={() => logSet(key, slug, setIndex, side)}
          aria-label={
            side
              ? `Log set ${setIndex}, ${side === 'L' ? 'left' : 'right'}`
              : `Log set ${setIndex}`
          }
          aria-pressed={isLogged}
        >
          <span className="session-check-box" aria-hidden="true">
            <svg
              className="session-check-mark"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#FFFFFF"
              strokeWidth={3}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M5 13l4 4L19 7" />
            </svg>
          </span>
        </button>
      </>
    )
  }

  const totalSets = totalSetsFor(plan, workout)
  const logged: Record<string, boolean> = {}
  for (const key of Object.keys(logRecords)) logged[key] = true
  const doneSets = Object.keys(logged).length
  const progressPct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0
  const totalReps = Object.keys(logged)
    .filter((key) => logged[key])
    .reduce((sum, key) => sum + (logRecords[key]?.reps ?? 0), 0)
  // New best: a set logged in this session beats every earlier session, by a
  // higher band or more reps at the same band.
  const newBest: Record<string, boolean> = {}
  for (const slug of workout.exercises) {
    const prior = priorBest[slug]
    if (!prior) continue
    newBest[slug] = setKeysFor(slug).some((key) => {
      const log = logRecords[key]
      if (!log) return false
      const idx = bandIndex(log.band, activePlan)
      if (idx >= 0 && idx > prior.maxBandIdx) return true
      const priorReps = prior.repsByBand[log.band]
      return priorReps !== undefined && log.reps > priorReps
    })
  }
  const newBestCount = workout.exercises.filter((slug) => newBest[slug]).length

  function setKeysFor(slug: string): string[] {
    const ex = resolveExercise(activePlan, workout, slug)
    const keys: string[] = []
    for (let i = 1; i <= ex.sets; i++) {
      if (ex.unilateral) {
        keys.push(`${slug}|${i}|L`, `${slug}|${i}|R`)
      } else {
        keys.push(`${slug}|${i}`)
      }
    }
    return keys
  }

  // The active exercise is the first one (in workout order) that still has an
  // unlogged set. It stays open by default; every other exercise is collapsed.
  const activeSlug =
    workout.exercises.find((slug) => setKeysFor(slug).some((key) => !logged[key])) ?? null

  function isCollapsedFor(slug: string): boolean {
    return collapsed[slug] ?? slug !== activeSlug
  }

  function toggleCollapsed(slug: string) {
    const current = isCollapsedFor(slug)
    setCollapsed((prev) => ({ ...prev, [slug]: !current }))
  }

  return (
    <div
      className="session"
      style={{ ['--session-hue' as string]: hueFor(workout.id) }}
    >
      <div className="session-cover">
        <svg
          className="session-cover-logo"
          viewBox="0 0 100 50"
          aria-hidden="true"
        >
          <path
            d="M50,25 C50,8 18,8 18,25 C18,42 50,42 50,25 C50,8 82,8 82,25 C82,42 50,42 50,25 Z"
            fill="none"
            stroke="var(--session-hue)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        <div className="session-cover-text">
          <p className="session-cover-day">{workout.day}</p>
          <h1 className="session-cover-title">{workout.name}</h1>
        </div>
      </div>
      {completed ? (
        <div className="session-complete">
          <svg
            className="session-complete-logo"
            viewBox="0 0 100 50"
            aria-hidden="true"
          >
            <path
              d="M50,25 C50,8 18,8 18,25 C18,42 50,42 50,25 C50,8 82,8 82,25 C82,42 50,42 50,25 Z"
              fill="none"
              stroke="var(--session-hue)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <h1 className="session-complete-title">Session complete</h1>
          <div className="session-complete-rows">
            <div className="session-complete-row">
              <span className="session-complete-label">Sets</span>
              <span className="session-complete-value">{doneSets}</span>
            </div>
            <div className="session-complete-row">
              <span className="session-complete-label">Total reps</span>
              <span className="session-complete-value">{totalReps}</span>
            </div>
            <div className="session-complete-row">
              <span className="session-complete-label">New bests</span>
              <span className="session-complete-value">{newBestCount}</span>
            </div>
          </div>
          <button
            type="button"
            className="session-complete-done"
            onClick={onExit}
          >
            Done
          </button>
        </div>
      ) : (
        <>
        <div className="session-progress">
        <div
          className="session-progress-track"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={totalSets}
          aria-valuenow={doneSets}
        >
          <div
            className="session-progress-fill"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="session-progress-caption">
          <span>
            {doneSets} of {totalSets} sets
          </span>
          <span>{progressPct}%</span>
        </div>
      </div>
      <div className="session-header">
        <button className="session-finish" onClick={finish}>
          Finish
        </button>
      </div>
      {workout.exercises.map((slug) => {
        const ex = resolveExercise(plan, workout, slug)
        const collapsedForSlug = isCollapsedFor(slug)
        const isActive = slug === activeSlug
        return (
          <section
            className={
              'session-exercise' + (isActive ? ' session-exercise-active' : '')
            }
            key={slug}
          >
            <div className="session-exercise-row">
              <button
                type="button"
                className="session-exercise-toggle"
                aria-expanded={!collapsedForSlug}
                aria-label={collapsedForSlug ? `Expand ${ex.name}` : `Collapse ${ex.name}`}
                onClick={() => toggleCollapsed(slug)}
              >
                <ChevronDown
                  className={
                    'session-exercise-toggle-chevron' +
                    (collapsedForSlug ? ' session-exercise-toggle-chevron-collapsed' : '')
                  }
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
              <button
                type="button"
                className="session-exercise-title"
                onClick={() => onOpenExercise(slug)}
              >
                <span className="session-exercise-title-text">{ex.name}</span>
                {newBest[slug] && (
                  <span className="session-new-best">new best</span>
                )}
                <ChevronRight
                  className="session-exercise-title-chevron"
                  size={18}
                  strokeWidth={1.75}
                  aria-hidden="true"
                />
              </button>
            </div>
            {!collapsedForSlug && (
              <>
                {ex.unilateral && <p className="session-note">One set per side.</p>}
                {suggestions[slug] && (
                  <p
                    className={
                      'session-suggestion ' +
                      (suggestions[slug]!.kind === 'progress' ? 'session-suggestion-progress' : '')
                    }
                  >
                    {suggestions[slug]!.message}
                  </p>
                )}
                {Array.from({ length: ex.sets }, (_, idx) => idx + 1).map((setIndex) => {
                  if (ex.unilateral) {
                    return (
                      <div key={setIndex}>
                        <div className="session-set">
                          <span className="session-set-label">Set {setIndex}</span>
                        </div>
                        {['L', 'R'].map((side) => {
                          const key = `${slug}|${setIndex}|${side}`
                          return (
                            <div className="session-side" key={side}>
                              <span className="session-side-label">{side}</span>
                              {setRow(key, slug, setIndex, side)}
                            </div>
                          )
                        })}
                      </div>
                    )
                  }
                  const key = `${slug}|${setIndex}`
                  return (
                    <div className="session-set" key={setIndex}>
                      <span className="session-set-label">Set {setIndex}</span>
                      {setRow(key, slug, setIndex, null)}
                    </div>
                  )
                })}
              </>
            )}
          </section>
        )
      })}
        </>
      )}
      {!completed && activeTimer && (
        <RestTimer
          key={timerKey}
          seconds={activeTimer.seconds}
          label={activeTimer.label}
          onDone={() => setActiveTimer(null)}
        />
      )}
      {!completed && (
        <BandPicker
          open={bandPickerKey !== null}
          tube={plan.bandLadders.tube}
          loop={plan.bandLadders.loop}
          current={bandPickerKey ? inputs[bandPickerKey]?.band ?? '' : ''}
          lastUsed={
            bandPickerKey ? latestBands[bandPickerKey.split('|')[0]] ?? null : null
          }
          onPick={(band) => {
            if (bandPickerKey) updateInput(bandPickerKey, 'band', band)
            setBandPickerKey(null)
          }}
          onClose={() => setBandPickerKey(null)}
        />
      )}
    </div>
  )
}
