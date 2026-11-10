import { useEffect, useMemo, useState } from 'react'
import { getSessions, type Session } from '../db/db'
import { loadPlan, type PlanData } from '../data/plan'
import { ConsistencyCalendar } from '../components/ConsistencyCalendar'
import { BackButton } from '../components/BackButton'
import { useTrainingData } from '../components/useTrainingData'
import './history.css'

interface HistoryProps {
  onBack: () => void
  onOpenSession: (id: string) => void
  version?: number
}

export function formatSessionDuration(secs: number): string {
  if (secs < 60) return '<1 min'
  const m = Math.round(secs / 60)
  if (m < 60) return `${m} min`
  const h = Math.floor(m / 60)
  const rest = m % 60
  return rest === 0 ? `${h} h` : `${h} h ${rest} min`
}

export function History({ onBack, onOpenSession, version }: HistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const training = useTrainingData([version])
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [showEmpty, setShowEmpty] = useState(false)

  useEffect(() => {
    let cancelled = false
    async function init() {
      const [sessions, plan] = await Promise.all([getSessions(), loadPlan()])
      if (cancelled) return
      setSessions(sessions)
      setPlan(plan)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [version])

  // Working sets (everything but warm-ups) per session.
  const setCounts = useMemo(() => {
    const m = new Map<string, number>()
    if (!training) return m
    for (const l of training.logs) {
      if (l.set_type === 'warmup') continue
      m.set(l.session_id, (m.get(l.session_id) ?? 0) + 1)
    }
    return m
  }, [training])

  const { filled, empty } = useMemo(() => {
    const filled: Session[] = []
    const empty: Session[] = []
    for (const s of sessions) (setCounts.get(s.id) ? filled : empty).push(s)
    return { filled, empty }
  }, [sessions, setCounts])

  function workoutName(workoutId: string): string {
    if (!plan) return workoutId
    return plan.workouts.find((w) => w.id === workoutId)?.name ?? workoutId
  }

  function durationSeconds(session: Session): number | null {
    if (!session.ended_at) return null
    const secs = Math.round((new Date(session.ended_at).getTime() - new Date(session.started_at).getTime()) / 1000)
    return secs >= 0 ? secs : null
  }

  function row(session: Session) {
    const secs = durationSeconds(session)
    const n = setCounts.get(session.id) ?? 0
    const meta = [`${n} ${n === 1 ? 'set' : 'sets'}`, secs !== null ? formatSessionDuration(secs) : null]
      .filter(Boolean)
      .join(', ')
    return (
      <button type="button" className="prop-row history-row" key={session.id} onClick={() => onOpenSession(session.id)}>
        <span className="history-row-main">
          <span className="history-row-name">{workoutName(session.workout_id)}</span>
          <span className="history-row-meta">{meta}</span>
          {session.note ? <span className="history-row-note">{session.note}</span> : null}
        </span>
        <span className="history-row-date">{session.date}</span>
      </button>
    )
  }

  return (
    <div className="screen history">
      <div className="history-header">
        <BackButton onClick={onBack} />
        <h1 className="page-title">History</h1>
      </div>

      {training ? (
        <ConsistencyCalendar
          sessions={sessions}
          logs={training.logs}
          plan={training.plan}
          inventory={training.inventory}
        />
      ) : null}

      {!training ? null : sessions.length === 0 ? (
        <p className="history-empty">No sessions yet.</p>
      ) : (
        <>
          <h2 className="section-head history-section">Sessions</h2>
          <div className="history-list">
            {filled.length === 0 ? <p className="history-empty">No sessions with logged sets.</p> : filled.map(row)}
          </div>
          {empty.length > 0 ? (
            <>
              <button
                type="button"
                className="history-empty-toggle"
                aria-expanded={showEmpty}
                onClick={() => setShowEmpty((v) => !v)}
              >
                {showEmpty ? `Hide empty sessions (${empty.length})` : `Show empty sessions (${empty.length})`}
              </button>
              {showEmpty ? <div className="history-list">{empty.map(row)}</div> : null}
            </>
          ) : null}
        </>
      )}
    </div>
  )
}
