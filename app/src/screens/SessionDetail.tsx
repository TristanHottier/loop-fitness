import { useEffect, useState } from 'react'
import { loadPlan, resolveExercise, type PlanData, type Workout } from '../data/plan'
import {
  getSession,
  getSetLogsForSession,
  newSetLog,
  createSetLog,
  updateSetLog,
  deleteSetLog,
  type Session as SessionRecord,
  type SetLog,
} from '../db/db'
import './session-detail.css'

type InputState = { reps: string; band: string; note: string }

export function SessionDetail({
  sessionId,
  onBack,
}: {
  sessionId: string
  onBack: () => void
}) {
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [session, setSession] = useState<SessionRecord | null>(null)
  const [workout, setWorkout] = useState<Workout | null>(null)
  const [inputs, setInputs] = useState<Record<string, InputState>>({})
  const [existingLogs, setExistingLogs] = useState<Record<string, SetLog>>({})
  const [saving, setSaving] = useState(false)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      try {
        const p = await loadPlan()
        if (cancelled) return
        const s = await getSession(sessionId)
        if (cancelled) return
        if (!s) {
          setNotFound(true)
          return
        }
        const w = p.workouts.find((wk) => wk.id === s.workout_id)
        if (!w) {
          setNotFound(true)
          return
        }
        const logs = await getSetLogsForSession(sessionId)
        if (cancelled) return
        const existing: Record<string, SetLog> = {}
        for (const log of logs) {
          existing[`${log.exercise_slug}|${log.set_index}|${log.side ?? ''}`] = log
        }
        const init: Record<string, InputState> = {}
        for (const slug of w.exercises) {
          const ex = resolveExercise(p, w, slug)
          for (let i = 1; i <= ex.sets; i++) {
            const sides = ex.unilateral ? ['L', 'R'] : ['']
            for (const side of sides) {
              const key = `${slug}|${i}|${side}`
              const log = existing[key]
              init[key] = log
                ? { reps: String(log.reps), band: log.band, note: log.note ?? '' }
                : { reps: '', band: '', note: '' }
            }
          }
        }
        setPlan(p)
        setSession(s)
        setWorkout(w)
        setExistingLogs(existing)
        setInputs(init)
      } catch {
        if (!cancelled) setNotFound(true)
      }
    }
    init()
    return () => {
      cancelled = true
    }
  }, [sessionId])

  function updateInput(key: string, field: keyof InputState, value: string) {
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  function setRow(key: string) {
    const input = inputs[key]
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
      </>
    )
  }

  async function save() {
    if (saving) return
    if (!session || !workout || !plan) return
    setSaving(true)
    try {
      for (const slug of workout.exercises) {
        const ex = resolveExercise(plan, workout, slug)
        for (let i = 1; i <= ex.sets; i++) {
          const sides = ex.unilateral ? ['L', 'R'] : ['']
          for (const side of sides) {
            const key = `${slug}|${i}|${side}`
            const input = inputs[key]
            if (!input) continue
            const repsParsed = parseInt(input.reps, 10)
            const hasReps = !Number.isNaN(repsParsed)
            const band = input.band.trim()
            const note = input.note.trim()
            const hasContent = hasReps || band !== '' || note !== ''
            const existing = existingLogs[key]
            if (hasContent) {
              const reps = hasReps ? repsParsed : 0
              const noteValue = note === '' ? null : note
              if (existing) {
                existing.reps = reps
                existing.band = band
                existing.note = noteValue
                await updateSetLog(existing)
              } else {
                const log = newSetLog(
                  session.id,
                  slug,
                  i,
                  side === '' ? null : side,
                  reps,
                  band,
                  noteValue
                )
                await createSetLog(log)
              }
            } else if (existing) {
              await deleteSetLog(existing.id)
            }
          }
        }
      }
      onBack()
    } finally {
      setSaving(false)
    }
  }

  if (notFound) {
    return (
      <div className="session-detail">
        <button type="button" className="session-detail-back" onClick={onBack}>
          Back
        </button>
        <p className="session-note">Session not found.</p>
      </div>
    )
  }
  if (!plan || !session || !workout) {
    return (
      <div className="session-detail">
        <button type="button" className="session-detail-back" onClick={onBack}>
          Back
        </button>
        <p className="session-note">Loading session</p>
      </div>
    )
  }

  return (
    <div className="session-detail">
      <button type="button" className="session-detail-back" onClick={onBack}>
        Back
      </button>
      <div className="session-header">
        <h1 className="session-title">{workout.name}</h1>
        <button className="session-finish" onClick={save} disabled={saving}>
          {saving ? 'Saving' : 'Save'}
        </button>
      </div>
      {workout.exercises.map((slug) => {
        const ex = resolveExercise(plan, workout, slug)
        return (
          <section className="session-exercise" key={slug}>
            <h2 className="session-detail-exercise-title">{ex.name}</h2>
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
                          {setRow(key)}
                        </div>
                      )
                    })}
                  </div>
                )
              }
              const key = `${slug}|${setIndex}|`
              return (
                <div className="session-set" key={setIndex}>
                  <span className="session-set-label">Set {setIndex}</span>
                  {setRow(key)}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
