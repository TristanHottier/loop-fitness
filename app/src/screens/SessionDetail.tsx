import { useEffect, useState } from 'react'
import { Collapsible } from '../components/Collapsible'
import { loadPlan, resolveExercise, type PlanData, type Workout } from '../data/plan'
import {
  getSession,
  getSetLogsForSession,
  deleteSession,
  updateSession,
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
import { BackButton } from '../components/BackButton'
import { kindOf, labelFor, orderOf, setKey } from '../lib/setRows'
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
  const [extraRows, setExtraRows] = useState<Record<string, Row[]>>({})
  const [noteDraft, setNoteDraft] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [deleting, setDeleting] = useState(false)

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

  // Planned rows, logged extras and rows added in this view, merged.
  function allRows(slug: string, sets: number, unilateral: boolean): Row[] {
    const base = rowsFor(slug, sets, unilateral, existingLogs)
    const seen = new Set(base.map((r) => r.key))
    const extra = (extraRows[slug] ?? []).filter((r) => !seen.has(r.key))
    return [...base, ...extra].sort(
      (a, b) => orderOf(a.setIndex) - orderOf(b.setIndex) || (a.side ?? '').localeCompare(b.side ?? '')
    )
  }

  // Only rows that have a saved log, or that were added in this view.
  function shownRows(slug: string, sets: number, unilateral: boolean): Row[] {
    const added = new Set((extraRows[slug] ?? []).map((r) => r.key))
    return allRows(slug, sets, unilateral).filter((r) => existingLogs[r.key] || added.has(r.key))
  }

  function addSet(slug: string, sets: number, unilateral: boolean) {
    const rows = shownRows(slug, sets, unilateral)
    const planned = rows.filter((r) => kindOf(r.setIndex) === 'planned').map((r) => r.setIndex)
    const next = (planned.length ? Math.max(...planned) : 0) + 1
    const sides: Array<string | null> = unilateral ? ['L', 'R'] : [null]
    const added = sides.map((side) => ({ key: setKey(slug, next, side), setIndex: next, side }))
    setExtraRows((prev) => ({ ...prev, [slug]: [...(prev[slug] ?? []), ...added] }))
    setInputs((prev) => {
      const out = { ...prev }
      for (const r of added) {
        if (!out[r.key]) out[r.key] = { reps: '', band: '', note: '', rir: null, type: 'normal' }
      }
      return out
    })
  }

  async function saveNote() {
    if (!session || noteDraft === null) return
    const v = noteDraft.trim()
    const next = v === '' ? null : v
    if (next === session.note) return
    const updated = { ...session, note: next }
    await updateSession(updated)
    setSession(updated)
  }

  async function removeSession() {
    if (deleting) return
    setDeleting(true)
    try {
      await deleteSession(sessionId)
      onBack()
    } finally {
      setDeleting(false)
    }
  }

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
        for (const row of allRows(slug, ex.sets, ex.unilateral)) {
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

  if (notFound || !plan || !session || !workout) {
    return (
      <div className="session-detail">
        <div className="session-detail-header">
          <BackButton onClick={onBack} />
        </div>
        <p className="session-note">{notFound ? 'Session not found.' : 'Loading session'}</p>
      </div>
    )
  }

  const resolved = workout.exercises.map((slug) => {
    const ex = resolveExercise(plan, workout, slug)
    return { slug, ex, rows: shownRows(slug, ex.sets, ex.unilateral) }
  })
  const done = resolved.filter((r) => r.rows.length > 0)
  const notDone = resolved.filter((r) => r.rows.length === 0)

  function addButton(r: (typeof resolved)[number]) {
    return (
      <button
        type="button"
        className="session-detail-add"
        aria-label={`Add set, ${r.ex.name}`}
        onClick={() => addSet(r.slug, r.ex.sets, r.ex.unilateral)}
      >
        Add set
      </button>
    )
  }

  return (
    <div className="session-detail">
      <div className="session-detail-header">
        <BackButton onClick={onBack} />
        <h1 className="session-detail-title">{workout.name}</h1>
        <button className="session-finish" onClick={save} disabled={saving}>
          {saving ? 'Saving' : 'Save'}
        </button>
      </div>
      <p className="session-detail-date">{session.date}</p>
      <input
        className="session-input session-detail-note"
        type="text"
        placeholder="Session note"
        aria-label="Session note"
        value={noteDraft ?? session.note ?? ''}
        onChange={(e) => setNoteDraft(e.target.value)}
        onBlur={saveNote}
      />
      {done.length === 0 ? <p className="session-note">No sets logged in this session.</p> : null}
      {done.map((r) => (
        <section className="session-exercise" key={r.slug}>
          <h2 className="session-detail-exercise-title">{r.ex.name}</h2>
          {r.rows.map((row) => {
            const label = labelFor(row.setIndex)
            const name = label.toLowerCase() + (row.side ? `, ${row.side === 'L' ? 'left' : 'right'}` : '')
            return (
              <div className={row.side ? 'session-side' : 'session-set'} key={row.key}>
                <span className={row.side ? 'session-side-label' : 'session-set-label'}>
                  {row.side ? `${label} ${row.side}` : label}
                </span>
                {setRow(row.key, name)}
              </div>
            )
          })}
          {addButton(r)}
        </section>
      ))}
      {notDone.length > 0 ? (
        <Collapsible id="sessiondetail.notdone" title="Not done" summary={String(notDone.length)}>
          {notDone.map((r) => (
            <div className="prop-row" key={r.slug}>
              <span className="session-detail-notdone-name">{r.ex.name}</span>
              {addButton(r)}
            </div>
          ))}
        </Collapsible>
      ) : null}
      <section className="session-detail-danger">
        {confirmDelete ? (
          <>
            <p className="session-note">This deletes the session and its sets. This cannot be undone.</p>
            <div className="session-detail-danger-actions">
              <button type="button" className="session-detail-delete" onClick={removeSession} disabled={deleting}>
                {deleting ? 'Deleting' : 'Confirm delete'}
              </button>
              <button type="button" className="session-detail-cancel" onClick={() => setConfirmDelete(false)} disabled={deleting}>
                Cancel
              </button>
            </div>
          </>
        ) : (
          <button type="button" className="session-detail-delete" onClick={() => setConfirmDelete(true)}>
            Delete session
          </button>
        )}
      </section>
    </div>
  )
}
