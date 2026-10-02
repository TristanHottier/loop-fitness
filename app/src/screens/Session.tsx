import { useEffect, useState } from 'react'
import { loadPlan, resolveExercise, type PlanData, type Workout } from '../data/plan'
import {
  newSession,
  createSession,
  newSetLog,
  createSetLog,
  getLatestBandForExercise,
  getLatestRepsForExercise,
  endSession,
  type Session as SessionRecord,
} from '../db/db'
import { RestTimer } from '../components/RestTimer'
import { todayISODate } from '../lib/format'
import './session.css'

type InputState = { reps: string; band: string; note: string }

// Returns 'last' if this slug is the final exercise of its superset group,
// 'not-last' if it is an earlier exercise in the group, or null if it is not
// part of a superset. The rest timer starts only after the last exercise of a
// group (and, for unilateral exercises, only after the second side).
function getSupersetRole(plan: PlanData, workout: Workout, slug: string): 'last' | 'not-last' | null {
  const ex = resolveExercise(plan, workout, slug)
  if (!ex.supersetGroup) return null
  const groupSlugs = workout.exercises.filter((s) => {
    const e = resolveExercise(plan, workout, s)
    return e.supersetGroup === ex.supersetGroup
  })
  const idx = groupSlugs.indexOf(slug)
  return idx === groupSlugs.length - 1 ? 'last' : 'not-last'
}

export function Session({ workout, onExit }: { workout: Workout; onExit: () => void }) {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [inputs, setInputs] = useState<Record<string, InputState>>({})
  const [logged, setLogged] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const [activeTimer, setActiveTimer] = useState<{ seconds: number; label: string } | null>(null)
  const [timerKey, setTimerKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const p = await loadPlan()
        if (cancelled) return
        const date = todayISODate()
        const s = newSession(workout.id, date)
        await createSession(s)
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
        setInputs(init)
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
    const reps = parseInt(input.reps, 10) || 0
    const log = newSetLog(activeSession.id, slug, setIndex, side, reps, input.band, input.note || null)
    await createSetLog(log)
    setLogged((prev) => ({ ...prev, [key]: true }))

    const ex = resolveExercise(activePlan, workout, slug)
    const role = getSupersetRole(activePlan, workout, slug)

    // Superset: no timer after the first exercise of a pair.
    if (role === 'not-last') return

    // Unilateral: the timer starts only after the second side (R) is logged.
    if (ex.unilateral && side !== 'R') return

    setActiveTimer({ seconds: ex.restSeconds, label: ex.name })
    setTimerKey((k) => k + 1)
  }

  async function finish() {
    await endSession(activeSession.id)
    onExit()
  }

  function setRow(key: string, slug: string, setIndex: number, side: string | null) {
    const input = inputs[key]
    const isLogged = logged[key]
    return (
      <>
        <input
          className="session-input session-input-reps"
          type="number"
          inputMode="numeric"
          value={input?.reps ?? ''}
          onChange={(e) => updateInput(key, 'reps', e.target.value)}
        />
        <input
          className="session-input session-input-band"
          type="text"
          value={input?.band ?? ''}
          onChange={(e) => updateInput(key, 'band', e.target.value)}
        />
        <input
          className="session-input session-input-note"
          type="text"
          placeholder="Note"
          value={input?.note ?? ''}
          onChange={(e) => updateInput(key, 'note', e.target.value)}
        />
        <button
          className={'session-check' + (isLogged ? ' session-check-logged' : '')}
          onClick={() => logSet(key, slug, setIndex, side)}
        >
          {isLogged ? 'Done' : 'Check'}
        </button>
      </>
    )
  }

  return (
    <div className="session">
      <div className="session-header">
        <h1 className="session-title">{workout.name}</h1>
        <button className="session-finish" onClick={finish}>
          Finish
        </button>
      </div>
      {workout.exercises.map((slug) => {
        const ex = resolveExercise(plan, workout, slug)
        return (
          <section className="session-exercise" key={slug}>
            <h2 className="session-exercise-title">{ex.name}</h2>
            {ex.unilateral && <p className="session-note">One set per side.</p>}
            {ex.supersetGroup && <p className="session-note">Superset {ex.supersetGroup}.</p>}
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
          </section>
        )
      })}
      {activeTimer && (
        <RestTimer
          key={timerKey}
          seconds={activeTimer.seconds}
          label={activeTimer.label}
          onDone={() => setActiveTimer(null)}
        />
      )}
    </div>
  )
}
