import { useEffect, useRef, useState } from 'react'
import { loadPlan, resolveExercise, type Exercise, type PlanData, type Workout } from '../data/plan'
import {
  newSession,
  createSession,
  newSetLog,
  createSetLog,
  updateSetLog,
  getLatestBandForExercise,
  getLatestRepsForExercise,
  getOpenSession,
  getSetLogsForSession,
  deleteSetLog,
  endSession,
  db,
  SET_TYPES,
  type Session as SessionRecord,
  type SetLog,
  type SetType,
} from '../db/db'
import {
  getBandInventory,
  getExerciseOverrides,
  getLastDeloadDate,
  setExerciseOverride,
  type BandItem,
  type ExerciseOverride,
} from '../db/config'
import { Check, ChevronDown, Ellipsis, X } from 'lucide-react'
import { RestTimer } from '../components/RestTimer'
import { BandPicker } from '../components/BandPicker'
import { RirChip, RirPicker } from '../components/RirPicker'
import { hueFor } from '../components/workoutHue'
import { Toast } from '../components/Toast'
import { ExerciseMenu } from '../components/ExerciseMenu'
import { formatClock, todayISODate } from '../lib/format'
import { suggestForExercise, type BandSuggestion } from '../lib/suggestions'
import { isDeloadActive } from '../lib/progression'
import { bestByExercise, type ExerciseBest } from '../lib/records'
import {
  dropIndex,
  dropParent,
  formatBand,
  kindOf,
  labelFor,
  lighterBand,
  orderOf,
  prKeys,
  setKey,
  warmupIndex,
} from '../lib/setRows'
import './session.css'

type InputState = { reps: string; band: string; note: string; rir: number | null; type: SetType }
type Suggestion = BandSuggestion | null
type PrevStats = { sets: number; reps: number }

function naturalType(kind: 'planned' | 'warmup' | 'drop'): SetType {
  return kind === 'warmup' ? 'warmup' : kind === 'drop' ? 'drop' : 'normal'
}

function reducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

const TYPE_LABEL: Record<SetType, string> = {
  normal: 'Normal',
  warmup: 'Warm-up',
  drop: 'Drop',
  failure: 'Failure',
}

// Planned sets for an exercise: half (rounded up) in a deload week.
function plannedSets(ex: Exercise, deload: boolean): number {
  return deload ? Math.ceil(ex.sets / 2) : ex.sets
}

function sidesOf(ex: Exercise): Array<string | null> {
  return ex.unilateral ? ['L', 'R'] : [null]
}

function restFor(ex: Exercise, overrides: Record<string, ExerciseOverride>): number {
  return overrides[ex.slug]?.restSeconds ?? ex.restSeconds
}

// Logs of the sessions before the current one for an exercise, most recent
// first (up to `n` sessions), without warm-up and drop sets.
async function previousSessionLogs(slug: string, currentId: string, n: number): Promise<SetLog[][]> {
  const logs = await db.set_logs
    .filter(
      (l) =>
        !l.deleted &&
        l.exercise_slug === slug &&
        l.session_id !== currentId &&
        (l.set_type === 'normal' || l.set_type === 'failure')
    )
    .toArray()
  if (logs.length === 0) return []
  const ids = [...new Set(logs.map((l) => l.session_id))]
  const sessions = await db.sessions.where('id').anyOf(ids).toArray()
  const dateById = new Map(sessions.filter((s) => !s.deleted).map((s) => [s.id, s.date]))
  const ordered = ids
    .filter((id) => dateById.has(id))
    .sort((a, b) => (dateById.get(b) ?? '').localeCompare(dateById.get(a) ?? ''))
    .slice(0, n)
  return ordered.map((id) => logs.filter((l) => l.session_id === id))
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
  const [activeTimer, setActiveTimer] = useState<{ seconds: number; label: string; slug: string } | null>(null)
  const [timerKey, setTimerKey] = useState(0)
  const [suggestions, setSuggestions] = useState<Record<string, Suggestion>>({})
  const [priorBest, setPriorBest] = useState<Record<string, ExerciseBest | null>>({})
  const [inventory, setInventory] = useState<BandItem[]>([])
  const [overrides, setOverrides] = useState<Record<string, ExerciseOverride>>({})
  const [deload, setDeload] = useState(false)
  // Extra rows per exercise (warm-up and drop sets), as set_index values.
  const [extras, setExtras] = useState<Record<string, number[]>>({})
  const [bandPickerKey, setBandPickerKey] = useState<string | null>(null)
  const [latestBands, setLatestBands] = useState<Record<string, string>>({})
  const [completed, setCompleted] = useState(false)
  const [toast, setToast] = useState<{ id: number; message: string } | null>(null)
  const toastId = useRef(0)
  // Resolve (reopen or create) the session once per workout, even when
  // StrictMode mounts the effect twice.
  const sessionRef = useRef<{ workoutId: string; promise: Promise<SessionRecord> } | null>(null)
  // Set keys with a write in flight, and when each set was last logged.
  const busyKeys = useRef<Set<string>>(new Set())
  const loggedAt = useRef<Record<string, number>>({})
  const rootRef = useRef<HTMLDivElement>(null)
  // Rows with the note / set type panel open.
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({})
  // Per exercise, the set key whose RIR picker is open (the latest log).
  const [rirOpen, setRirOpen] = useState<Record<string, string | null>>({})
  // The most recent rest length used for an exercise, offered as a default.
  const [lastRest, setLastRest] = useState<{ slug: string; seconds: number } | null>(null)
  const [confirmFinish, setConfirmFinish] = useState(false)
  const [prevStats, setPrevStats] = useState<PrevStats | null>(null)
  const [advance, setAdvance] = useState<{ slug: string; n: number } | null>(null)
  const advanceTimer = useRef<number | null>(null)

  // Smooth-scroll the newly opened exercise into view after auto-advance.
  useEffect(() => {
    if (!advance) return
    const id = window.requestAnimationFrame(() => {
      const el = rootRef.current?.querySelector<HTMLElement>(`[data-slug="${advance.slug}"]`)
      el?.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' })
    })
    return () => window.cancelAnimationFrame(id)
  }, [advance])

  useEffect(
    () => () => {
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
    },
    []
  )

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
        const [inv, ovr, lastDeload] = await Promise.all([
          getBandInventory(),
          getExerciseOverrides(),
          getLastDeloadDate(),
        ])
        if (cancelled) return
        const deloadOn = isDeloadActive(lastDeload, todayISODate())
        setPlan(p)
        setSession(s)
        setInventory(inv)
        setOverrides(ovr)
        setDeload(deloadOn)

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
          // Deload week: prefill one ladder step lighter.
          const band = deloadOn ? lighterBand(bandMap[slug], p, inv) : bandMap[slug]
          const reps = String(repsMap[slug])
          for (let i = 1; i <= ex.sets; i++) {
            for (const side of sidesOf(ex)) {
              init[setKey(slug, i, side)] = { reps, band, note: '', rir: null, type: 'normal' }
            }
          }
        }

        // Reopened session: restore the sets that were already logged,
        // including warm-up and drop rows.
        const restored: Record<string, SetLog> = {}
        const extrasInit: Record<string, number[]> = {}
        for (const log of existingLogs) {
          if (!workout.exercises.includes(log.exercise_slug)) continue
          const key = setKey(log.exercise_slug, log.set_index, log.side)
          if (kindOf(log.set_index) === 'planned') {
            if (!(key in init)) continue
          } else {
            const list = (extrasInit[log.exercise_slug] ??= [])
            if (!list.includes(log.set_index)) list.push(log.set_index)
          }
          restored[key] = log
          init[key] = {
            reps: String(log.reps),
            band: log.band,
            note: log.note ?? '',
            rir: log.rir,
            type: log.set_type,
          }
        }
        setInputs(init)
        setLogRecords(restored)
        setExtras(extrasInit)

        // History before this session: suggestions and the prior bests.
        const slugs = new Set(workout.exercises)
        const allPrior = await db.set_logs
          .filter((l) => !l.deleted && slugs.has(l.exercise_slug) && l.session_id !== s.id)
          .toArray()
        const bests = bestByExercise(allPrior, p, inv)
        const sugg: Record<string, Suggestion> = {}
        const best: Record<string, ExerciseBest | null> = {}
        for (const slug of workout.exercises) {
          const ex = resolveExercise(p, workout, slug)
          const groups = await previousSessionLogs(slug, s.id, 3)
          sugg[slug] = suggestForExercise(ex, groups[0] ?? [], p, {
            history: groups,
            override: ovr[slug],
            overrides: ovr,
            inventory: inv,
          })
          best[slug] = bests[slug] ?? null
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

  function updateInput(key: string, field: 'reps' | 'band' | 'note', value: string) {
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } }))
  }

  function patchInput(key: string, patch: Partial<InputState>) {
    setInputs((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  // Update the stored log of a logged set (RIR, set type). Does not touch the
  // rest timer.
  async function patchLog(key: string, patch: Partial<Pick<SetLog, 'rir' | 'set_type'>>) {
    const existing = logRecords[key]
    if (!existing) return
    const updated: SetLog = { ...existing, ...patch }
    try {
      await updateSetLog(updated)
      setLogRecords((prev) => (prev[key] ? { ...prev, [key]: updated } : prev))
    } catch {
      setError('Could not save the change.')
    }
  }

  function setRir(key: string, slug: string, rir: number | null) {
    patchInput(key, { rir })
    void patchLog(key, { rir })
    // Picking a value folds the picker into the small chip.
    setRirOpen((prev) => ({ ...prev, [slug]: null }))
  }

  function changeType(key: string, type: SetType) {
    patchInput(key, { type })
    void patchLog(key, { set_type: type })
  }

  function showToast(message: string) {
    toastId.current += 1
    setToast({ id: toastId.current, message })
  }

  function prMessage(log: SetLog): string {
    const name = resolveExercise(activePlan, workout, log.exercise_slug).name
    return `${name}, ${log.reps} reps at ${formatBand(log.band)}`
  }

  async function logSet(key: string, slug: string, setIndex: number, side: string | null) {
    const input = inputs[key]
    if (!input) return
    if (busyKeys.current.has(key)) return
    busyKeys.current.add(key)
    let log: SetLog
    let nextRecords: Record<string, SetLog> = logRecords
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
        patchInput(key, { rir: null })
        setRirOpen((prev) => (prev[slug] === key ? { ...prev, [slug]: null } : prev))
        return
      }
      const reps = parseInt(input.reps, 10) || 0
      log = newSetLog(
        activeSession.id,
        slug,
        setIndex,
        side,
        reps,
        input.band,
        input.note || null,
        input.rir,
        input.type
      )
      await createSetLog(log)
      loggedAt.current[key] = Date.now()
      nextRecords = { ...logRecords, [key]: log }
      setLogRecords(nextRecords)
      setRirOpen((prev) => ({ ...prev, [slug]: key }))
      // Live new best: flagged now but not before this log.
      const before = prKeys(logRecords, priorBest, activePlan, inventory)
      const after = prKeys(nextRecords, priorBest, activePlan, inventory)
      if (after.has(key) && !before.has(key)) showToast(`New best, ${prMessage(log)}`)
    } catch {
      setError('Could not save the set.')
      return
    } finally {
      busyKeys.current.delete(key)
    }

    const ex = resolveExercise(activePlan, workout, slug)

    // No rest after warm-up and drop sets.
    if (log.set_type === 'warmup' || log.set_type === 'drop') return

    // Unilateral: the timer starts only after the second side (R) is logged.
    if (ex.unilateral && side !== 'R') return

    const restSeconds = restFor(ex, overrides)
    setActiveTimer({ seconds: restSeconds, label: ex.name, slug })
    setLastRest({ slug, seconds: restSeconds })
    setTimerKey((k) => k + 1)

    // Last working set of the exercise: fold it and open the next one.
    if (kindOf(setIndex) === 'planned' && setKeysFor(slug).every((k) => nextRecords[k])) {
      const order = workout.exercises
      const from = order.indexOf(slug)
      const hasOpen = (sl: string) => setKeysFor(sl).some((k) => !nextRecords[k])
      const next =
        order.slice(from + 1).find(hasOpen) ?? order.slice(0, from).find(hasOpen) ?? null
      if (advanceTimer.current !== null) window.clearTimeout(advanceTimer.current)
      advanceTimer.current = window.setTimeout(() => {
        setCollapsed((prev) => ({ ...prev, [slug]: true, ...(next ? { [next]: false } : {}) }))
        if (next) setAdvance((a) => ({ slug: next, n: (a?.n ?? 0) + 1 }))
      }, 450)
    }
  }

  async function loadPrevStats(): Promise<PrevStats | null> {
    const prevs = await db.sessions
      .filter(
        (x) =>
          !x.deleted && x.ended_at !== null && x.workout_id === workout.id && x.id !== activeSession.id
      )
      .toArray()
    if (prevs.length === 0) return null
    const last = prevs.reduce((a, b) =>
      a.date > b.date || (a.date === b.date && a.started_at >= b.started_at) ? a : b
    )
    const logs = (await getSetLogsForSession(last.id)).filter((l) => l.set_type !== 'warmup')
    return { sets: logs.length, reps: logs.reduce((sum, l) => sum + l.reps, 0) }
  }

  async function finish() {
    try {
      await endSession(activeSession.id)
      let stats: PrevStats | null = null
      try {
        stats = await loadPrevStats()
      } catch {
        stats = null
      }
      setPrevStats(stats)
      setConfirmFinish(false)
      setCompleted(true)
    } catch {
      setError('Could not finish the session.')
    }
  }

  async function saveRestDefault(slug: string, seconds: number) {
    try {
      await setExerciseOverride(slug, { restSeconds: seconds })
      setOverrides((prev) => ({ ...prev, [slug]: { ...prev[slug], restSeconds: seconds } }))
      showToast(`Rest default saved, ${formatClock(seconds)}`)
    } catch {
      setError('Could not save the rest default.')
    }
  }

  function plannedCount(slug: string): number {
    const ex = resolveExercise(activePlan, workout, slug)
    let n = plannedSets(ex, deload)
    for (const l of Object.values(logRecords)) {
      if (l.exercise_slug === slug && kindOf(l.set_index) === 'planned') n = Math.max(n, l.set_index)
    }
    return n
  }

  function setKeysFor(slug: string): string[] {
    const ex = resolveExercise(activePlan, workout, slug)
    const keys: string[] = []
    for (let i = 1; i <= plannedCount(slug); i++) {
      for (const side of sidesOf(ex)) keys.push(setKey(slug, i, side))
    }
    return keys
  }

  function addWarmup(slug: string) {
    const ex = resolveExercise(activePlan, workout, slug)
    const cur = extras[slug] ?? []
    const n = Math.max(0, ...cur.filter((i) => kindOf(i) === 'warmup').map((i) => 1 - i)) + 1
    const idx = warmupIndex(n)
    const first = inputs[setKey(slug, 1, sidesOf(ex)[0])]
    setInputs((prev) => {
      const next = { ...prev }
      for (const side of sidesOf(ex)) {
        next[setKey(slug, idx, side)] = {
          reps: first?.reps ?? String(ex.repMin),
          band: lighterBand(first?.band ?? ex.startBand, activePlan, inventory),
          note: '',
          rir: null,
          type: 'warmup',
        }
      }
      return next
    })
    setExtras((prev) => ({ ...prev, [slug]: [...(prev[slug] ?? []), idx] }))
    setCollapsed((prev) => ({ ...prev, [slug]: false }))
  }

  // The last logged working row of an exercise (display order).
  function lastWorkingLog(slug: string): SetLog | null {
    const logs = Object.values(logRecords).filter(
      (l) => l.exercise_slug === slug && kindOf(l.set_index) !== 'warmup'
    )
    if (logs.length === 0) return null
    logs.sort(
      (a, b) => orderOf(a.set_index) - orderOf(b.set_index) || (a.side ?? '').localeCompare(b.side ?? '')
    )
    return logs[logs.length - 1]
  }

  function addDrop(slug: string) {
    const ex = resolveExercise(activePlan, workout, slug)
    const last = lastWorkingLog(slug)
    if (!last) return
    const parent = kindOf(last.set_index) === 'planned' ? last.set_index : dropParent(last.set_index)
    const cur = extras[slug] ?? []
    const k =
      Math.max(
        0,
        ...cur.filter((i) => kindOf(i) === 'drop' && dropParent(i) === parent).map((i) => i % 100)
      ) + 1
    const idx = dropIndex(parent, k)
    setInputs((prev) => {
      const next = { ...prev }
      for (const side of sidesOf(ex)) {
        const src = logRecords[setKey(slug, last.set_index, side)] ?? last
        next[setKey(slug, idx, side)] = {
          reps: String(src.reps),
          band: lighterBand(src.band, activePlan, inventory),
          note: '',
          rir: null,
          type: 'drop',
        }
      }
      return next
    })
    setExtras((prev) => ({ ...prev, [slug]: [...(prev[slug] ?? []), idx] }))
    setCollapsed((prev) => ({ ...prev, [slug]: false }))
  }

  function removeExtra(slug: string, setIndex: number) {
    const ex = resolveExercise(activePlan, workout, slug)
    setExtras((prev) => ({ ...prev, [slug]: (prev[slug] ?? []).filter((i) => i !== setIndex) }))
    setInputs((prev) => {
      const next = { ...prev }
      for (const side of sidesOf(ex)) delete next[setKey(slug, setIndex, side)]
      return next
    })
  }

  const prSet = prKeys(logRecords, priorBest, plan, inventory)

  function setLine(
    key: string,
    slug: string,
    setIndex: number,
    side: string | null,
    labelText: string
  ) {
    const input = inputs[key]
    const log = logRecords[key]
    const isLogged = Boolean(log)
    const isPr = prSet.has(key)
    const kind = kindOf(setIndex)
    const nameBase = labelFor(setIndex).toLowerCase()
    const sideLabel = side ? `, ${side === 'L' ? 'left' : 'right'}` : ''
    const name = nameBase + sideLabel
    const type = input?.type ?? 'normal'
    const ex = resolveExercise(activePlan, workout, slug)
    const anyLogged = sidesOf(ex).some((sd) => logRecords[setKey(slug, setIndex, sd)])
    const expanded = Boolean(expandedRows[key])
    const picking = isLogged && rirOpen[slug] === key
    const note = (input?.note ?? '').trim()
    const showType = type !== naturalType(kind)
    return (
      <div
        className={
          'session-set-wrap' +
          (isPr ? ' session-set-pr' : '') +
          (isLogged ? ' session-set-logged' : '')
        }
        key={key}
      >
        <div className="session-set">
          <div className="session-set-lead">
            <button
              type="button"
              className="session-set-label"
              aria-expanded={expanded}
              aria-label={`Note and set type, ${name}`}
              onClick={() => setExpandedRows((prev) => ({ ...prev, [key]: !prev[key] }))}
            >
              <span className="session-set-label-text">{labelText}</span>
              <Ellipsis size={14} strokeWidth={1.75} aria-hidden="true" />
            </button>
            {(showType || (isLogged && !picking) || isPr) && (
              <span className="session-set-sub">
                {showType && <span className="session-set-type">{TYPE_LABEL[type]}</span>}
                {isLogged && !picking && (
                  <RirChip value={log.rir} onOpen={() => setRirOpen((p) => ({ ...p, [slug]: key }))} name={name} />
                )}
                {isPr && <span className="session-pr-note">New best</span>}
              </span>
            )}
          </div>
          <input
            className="session-input session-input-reps"
            type="number"
            inputMode="numeric"
            value={input?.reps ?? ''}
            aria-label={`Reps, ${name}`}
            onChange={(e) => updateInput(key, 'reps', e.target.value)}
          />
          <button
            type="button"
            className="session-input session-input-band session-input-band-button"
            aria-label={`Band, ${name}: ${input?.band ?? 'none'}`}
            onClick={() => setBandPickerKey(key)}
          >
            {input?.band ?? ''}
          </button>
          <button
            type="button"
            className={'session-check' + (isLogged ? ' session-check-logged' : '')}
            onClick={() => logSet(key, slug, setIndex, side)}
            aria-label={`Log ${name}`}
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
        </div>
        {note !== '' && !expanded && <p className="session-set-note">{note}</p>}
        {expanded && (
          <div className="session-set-panel">
            <input
              className="session-input session-input-note"
              type="text"
              placeholder="Note"
              aria-label={`Note, ${name}`}
              value={input?.note ?? ''}
              onChange={(e) => updateInput(key, 'note', e.target.value)}
            />
            <div className="session-type-row" role="group" aria-label={`Set type, ${name}`}>
              {SET_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  className={'session-type-chip' + (type === t ? ' session-type-chip-on' : '')}
                  aria-pressed={type === t}
                  onClick={() => changeType(key, t)}
                >
                  {TYPE_LABEL[t]}
                </button>
              ))}
            </div>
            {kind !== 'planned' && !anyLogged && (
              <button
                type="button"
                className="session-remove"
                aria-label={`Remove ${nameBase}`}
                onClick={() => removeExtra(slug, setIndex)}
              >
                <X size={16} strokeWidth={1.75} aria-hidden="true" />
                <span>Remove set</span>
              </button>
            )}
          </div>
        )}
        {picking && log && (
          <div className="session-set-meta">
            <RirPicker value={log.rir} onChange={(v) => setRir(key, slug, v)} name={name} />
          </div>
        )}
      </div>
    )
  }

  function renderRow(slug: string, ex: Exercise, setIndex: number) {
    const label = labelFor(setIndex)
    if (ex.unilateral) {
      return (
        <div key={setIndex}>
          <p className="session-set-heading">{label}</p>
          {['L', 'R'].map((side) =>
            setLine(setKey(slug, setIndex, side), slug, setIndex, side, side === 'L' ? 'Left' : 'Right')
          )}
        </div>
      )
    }
    return setLine(setKey(slug, setIndex, null), slug, setIndex, null, label)
  }

  const logged: Record<string, boolean> = {}
  let totalSets = 0
  let doneSets = 0
  for (const slug of workout.exercises) {
    for (const key of setKeysFor(slug)) {
      totalSets += 1
      const l = logRecords[key]
      logged[key] = Boolean(l)
      // Planned sets re-tagged as warm-up do not count as done.
      if (l && l.set_type !== 'warmup') doneSets += 1
    }
  }
  const progressPct = totalSets > 0 ? Math.round((doneSets / totalSets) * 100) : 0
  const workingLogs = Object.values(logRecords).filter((l) => l.set_type !== 'warmup')
  const totalReps = workingLogs.reduce((sum, l) => sum + l.reps, 0)

  // New bests per exercise: the last flagged set of each.
  const prBySlug: Record<string, SetLog> = {}
  for (const key of prSet) {
    const l = logRecords[key]
    if (!l) continue
    const cur = prBySlug[l.exercise_slug]
    if (
      !cur ||
      orderOf(l.set_index) > orderOf(cur.set_index) ||
      (orderOf(l.set_index) === orderOf(cur.set_index) && (l.side ?? '') > (cur.side ?? ''))
    )
      prBySlug[l.exercise_slug] = l
  }
  const prList = workout.exercises.filter((slug) => prBySlug[slug]).map((slug) => prMessage(prBySlug[slug]))
  const newBestCount = prList.length

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

  const unloggedCount = totalSets - doneSets
  function onFinishClick() {
    if (unloggedCount > 0) setConfirmFinish(true)
    else void finish()
  }

  function deltaText(delta: number): string {
    if (delta === 0) return 'same'
    return delta > 0 ? `+${delta}` : `-${Math.abs(delta)}`
  }

  return (
    <div
      className={'session' + (activeTimer && !completed ? ' session-has-timer' : '')}
      ref={rootRef}
      style={{ ['--session-hue' as string]: hueFor(workout.id) }}
    >
      {completed ? (
        <div className="session-complete">
          <svg className="session-complete-logo" viewBox="0 0 100 50" aria-hidden="true">
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
              <span className="session-complete-value">
                {workingLogs.length}
                {prevStats && (
                  <span className="session-complete-delta">{deltaText(workingLogs.length - prevStats.sets)}</span>
                )}
              </span>
            </div>
            <div className="session-complete-row">
              <span className="session-complete-label">Total reps</span>
              <span className="session-complete-value">
                {totalReps}
                {prevStats && (
                  <span className="session-complete-delta">{deltaText(totalReps - prevStats.reps)}</span>
                )}
              </span>
            </div>
            {newBestCount > 0 && (
              <div className="session-complete-row">
                <span className="session-complete-label">New bests</span>
                <span className="session-complete-value">{newBestCount}</span>
              </div>
            )}
          </div>
          {prevStats && <p className="session-complete-hint">Compared with your last {workout.name} session.</p>}
          {prList.length > 0 && (
            <ul className="session-complete-prs" aria-label="New bests">
              {prList.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          )}
          <button type="button" className="session-complete-done" onClick={onExit}>
            Done
          </button>
        </div>
      ) : (
        <>
          <div className="session-bar">
            <div className="session-header">
              <div className="session-header-text">
                <h1 className="session-header-title">{workout.name}</h1>
                <p className="session-header-count">
                  {doneSets} of {totalSets}
                </p>
              </div>
              <button type="button" className="session-finish" onClick={onFinishClick}>
                Finish
              </button>
              <div
                className="session-progress-track"
                role="progressbar"
                aria-label="Sets logged"
                aria-valuemin={0}
                aria-valuemax={totalSets}
                aria-valuenow={doneSets}
              >
                <div className="session-progress-fill" style={{ width: `${progressPct}%` }} />
              </div>
            </div>
            {confirmFinish && (
              <div className="session-confirm" role="alertdialog" aria-label="Finish workout">
                <p className="session-confirm-text">
                  {unloggedCount} {unloggedCount === 1 ? 'set is' : 'sets are'} not logged yet.
                </p>
                <button type="button" className="session-confirm-btn" onClick={() => setConfirmFinish(false)}>
                  Keep going
                </button>
                <button
                  type="button"
                  className="session-confirm-btn session-confirm-btn-primary"
                  onClick={() => void finish()}
                >
                  Finish
                </button>
              </div>
            )}
          </div>
          {deload && (
            <p className="session-banner" role="status">
              Deload week. Half the sets, one band lighter.
            </p>
          )}
          {workout.exercises.map((slug) => {
            const ex = resolveExercise(plan, workout, slug)
            const collapsedForSlug = isCollapsedFor(slug)
            const isActive = slug === activeSlug
            const suggestion = suggestions[slug]
            const reason = suggestion?.reason ?? null
            const hasLogs = Object.values(logRecords).some((l) => l.exercise_slug === slug)
            const prefillBand = inputs[setKey(slug, 1, sidesOf(ex)[0])]?.band
            // Deload weeks target the lighter prefilled band, not the progression step.
            const target = suggestion?.target ?? { band: prefillBand, repMin: ex.repMin, repMax: ex.repMax }
            const targetBand = deload ? prefillBand : (target.band ?? prefillBand)
            const slugKeys = setKeysFor(slug)
            const slugDone = slugKeys.filter((k) => logged[k]).length
            const rowIndices = [
              ...(extras[slug] ?? []),
              ...Array.from({ length: plannedCount(slug) }, (_, i) => i + 1),
            ].sort((a, b) => orderOf(a) - orderOf(b))
            const menuItems = [
              { label: 'View exercise', onSelect: () => onOpenExercise(slug) },
              { label: 'Add warm-up set', onSelect: () => addWarmup(slug) },
              {
                label: 'Add drop set',
                onSelect: () => addDrop(slug),
                disabled: lastWorkingLog(slug) === null,
              },
            ]
            if (lastRest && lastRest.slug === slug) {
              menuItems.push({
                label: `Set rest as default (${formatClock(lastRest.seconds)})`,
                onSelect: () => void saveRestDefault(slug, lastRest.seconds),
                disabled: false,
              })
            }
            return (
              <section
                className={'session-exercise' + (isActive ? ' session-exercise-active' : '')}
                key={slug}
                data-slug={slug}
              >
                <div className="session-exercise-row">
                  <button
                    type="button"
                    className="session-exercise-toggle"
                    aria-expanded={!collapsedForSlug}
                    onClick={() => toggleCollapsed(slug)}
                  >
                    <span className="session-exercise-text">
                      <span className="session-exercise-name">{ex.name}</span>
                      <span className="session-exercise-sub">
                        {slugDone} of {slugKeys.length} sets
                        {prefillBand ? `, ${prefillBand}` : ''}
                      </span>
                    </span>
                    {slugDone === slugKeys.length && slugKeys.length > 0 && (
                      <Check
                        className="session-exercise-done"
                        size={18}
                        strokeWidth={2}
                        aria-label="All sets logged"
                      />
                    )}
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
                  <ExerciseMenu name={ex.name} items={menuItems} />
                </div>
                {!collapsedForSlug && (
                  <>
                    {ex.unilateral && <p className="session-note">One set per side.</p>}
                    {!hasLogs && targetBand && (
                      <p className="session-target">
                        Target: {formatBand(targetBand)} × {target.repMin}-{target.repMax}
                      </p>
                    )}
                    {suggestion && (
                      <p
                        className={
                          'session-suggestion ' +
                          (suggestion.kind === 'progress' ? 'session-suggestion-progress' : '')
                        }
                      >
                        {suggestion.message}
                        {reason && <span className="session-suggestion-reason"> {reason}</span>}
                        {suggestion.note && <span className="session-suggestion-reason"> {suggestion.note}.</span>}
                        {suggestion.intermediate && (
                          <span className="session-suggestion-reason">
                            {' '}
                            Before moving up, try: {suggestion.intermediate.text}.
                          </span>
                        )}
                      </p>
                    )}
                    {rowIndices.map((setIndex) => renderRow(slug, ex, setIndex))}
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
          onTotalChange={(sec) =>
            setLastRest((prev) => (prev ? { ...prev, seconds: sec } : prev))
          }
        />
      )}
      {toast && (
        <Toast
          id={toast.id}
          message={toast.message}
          aboveTimer={Boolean(activeTimer) && !completed}
          onClose={() => setToast(null)}
        />
      )}
      {!completed && (
        <BandPicker
          open={bandPickerKey !== null}
          tube={plan.bandLadders.tube}
          loop={plan.bandLadders.loop}
          current={bandPickerKey ? inputs[bandPickerKey]?.band ?? '' : ''}
          lastUsed={bandPickerKey ? latestBands[bandPickerKey.split('|')[0]] ?? null : null}
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
