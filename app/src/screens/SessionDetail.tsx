import { useEffect, useState } from 'react'
import { loadPlan, resolveExercise, type PlanData, type Workout } from '../data/plan'
import {
  getSession,
  getSetLogsForSession,
  newSetLog,
  createSetLog,
  updateSetLog,
  deleteSetLog,
  normalizeRir,
  SET_TYPES,
  type Session as SessionRecord,
  type SetLog,
  type SetType,
} from '../db/db'
import { RirPicker } from '../components/RirPicker'
import { labelFor, orderOf, setKey } from '../lib/setRows'
import './session-detail.css'

type InputState = { reps: string; band: string; note: string; rir: number | null; type: SetType }

const TYPE_LABEL: Record<SetType, string> = {
  normal: 'Normal',
  warmup: 'Warm-up',
  drop: 'Drop',
  failure: 'Failure',
}

type Row = { key: string; setIndex: number; side: string | null }

// Planned rows (1..sets, both sides when unilateral) plus any extra rows that
// were logged: warm-up and drop sets, or planned sets beyond the plan.
function rowsFor(slug: string, sets: number, unilateral: boolean, existing: Record<string, SetLog>): Row[] {
  const sides: Array<string | null> = unilateral ? ['L', 'R'] : [null]
  const rows: Row[] = []
  const seen = new Set<string>()
  for (let i = 1; i <= sets; i++) {
    for (const side of sides) {
      const key = setKey(slug, i, side)
      rows.push({ key, setIndex: i, side })
      seen.add(key)
    }
  }
  for (const log of Object.values(existing)) {
    if (log.exercise_slug !== slug) continue
    const key = setKey(slug, log.set_index, log.side)
    if (seen.has(key)) continue
    seen.add(key)
    rows.push({ key, setIndex: log.set_index, side: log.side })
  }
  return rows.sort(
    (a, b) => orderOf(a.setIndex) - orderOf(b.setIndex) || (a.side ?? '').localeCompare(b.side ?? '')
  )
}

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
          existing[setKey(log.exercise_slug, log.set_index, log.side)] = log
        }
        const init: Record<string, InputState> = {}
        for (const slug of w.exercises) {
          const ex = resolveExercise(p, w, slug)
          for (const row of rowsFor(slug, ex.sets, ex.unilateral, existing)) {
            const log = existing[row.key]
            init[row.key] = log
              ? {
                  reps: String(log.reps),
                  band: log.band,
                  note: log.note ?? '',
                  rir: log.rir,
                  type: log.set_type,
                }
              : { reps: '', band: '', note: '', rir: null, type: 'normal' }
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

  function updateInput(key: string, field: 'reps' | 'band' | 'note', value: string) {
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  function patchInput(key: string, patch: Partial<InputState>) {
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  function setRow(key: string, name: string) {
    const input = inputs[key]
    return (
      <>
        <input
          className="session-input session-input-reps"
          type="number"
          inputMode="numeric"
          value={input?.reps ?? ''}
          aria-label={`Reps, ${name}`}
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
        <select
          className="session-input session-detail-type"
          value={input?.type ?? 'normal'}
          aria-label={`Set type, ${name}`}
          onChange={(e) => patchInput(key, { type: e.target.value as SetType })}
        >
          {SET_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABEL[t]}
            </option>
          ))}
        </select>
        <div className="session-set-meta">
          <RirPicker
            value={input?.rir ?? null}
            onChange={(v) => patchInput(key, { rir: v })}
            name={name}
          />
        </div>
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
        for (const row of rowsFor(slug, ex.sets, ex.unilateral, existingLogs)) {
          const { key, setIndex: i, side } = row
          {
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
                existing.rir = normalizeRir(input.rir)
                existing.set_type = input.type
                await updateSetLog(existing)
              } else {
                const log = newSetLog(
                  session.id,
                  slug,
                  i,
                  side,
                  reps,
                  band,
                  noteValue,
                  input.rir,
                  input.type
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
            {rowsFor(slug, ex.sets, ex.unilateral, existingLogs).map((row) => {
              const label = labelFor(row.setIndex)
              const name =
                label.toLowerCase() + (row.side ? `, ${row.side === 'L' ? 'left' : 'right'}` : '')
              return (
                <div className={row.side ? 'session-side' : 'session-set'} key={row.key}>
                  <span className={row.side ? 'session-side-label' : 'session-set-label'}>
                    {row.side ? `${label} ${row.side}` : label}
                  </span>
                  {setRow(row.key, name)}
                </div>
              )
            })}
          </section>
        )
      })}
    </div>
  )
}
