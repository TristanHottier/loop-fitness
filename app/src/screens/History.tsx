import { useEffect, useState } from 'react'
import {
  getSessions,
  updateSession,
  getSetLogsForSession,
  type Session,
  type SetLog,
} from '../db/db'
import { loadPlan, type PlanData } from '../data/plan'
import { formatDuration } from '../lib/format'
import './history.css'

interface HistoryProps {
  onBack: () => void
}

export function History({ onBack }: HistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, SetLog[]>>({})
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})

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
  }, [])

  function workoutName(workoutId: string): string {
    if (!plan) return workoutId
    return plan.workouts.find((w) => w.id === workoutId)?.name ?? workoutId
  }

  function exerciseName(slug: string): string {
    if (!plan) return slug
    return plan.exercises[slug]?.name ?? slug
  }

  async function toggle(session: Session) {
    if (expanded === session.id) {
      setExpanded(null)
      return
    }
    setExpanded(session.id)
    if (!details[session.id]) {
      const logs = await getSetLogsForSession(session.id)
      setDetails((prev) => ({ ...prev, [session.id]: logs }))
    }
  }

  function durationSeconds(session: Session): number | null {
    if (!session.ended_at) return null
    const start = new Date(session.started_at).getTime()
    const end = new Date(session.ended_at).getTime()
    const secs = Math.round((end - start) / 1000)
    return secs > 0 ? secs : null
  }

  function noteValue(session: Session): string {
    return noteDrafts[session.id] ?? session.note ?? ''
  }

  async function saveNote(session: Session) {
    const value = (noteDrafts[session.id] ?? session.note ?? '').trim()
    const next = value === '' ? null : value
    if (next === session.note) return
    await updateSession({ ...session, note: next })
    setSessions((prev) =>
      prev.map((s) => (s.id === session.id ? { ...s, note: next } : s))
    )
  }

  return (
    <div className="screen history">
      <button type="button" className="history-back" onClick={onBack}>
        Back
      </button>
      <h1>History</h1>
      <p className="screen-subtitle">Past sessions, editable.</p>

      {sessions.length === 0 ? (
        <p className="history-empty">No sessions yet.</p>
      ) : (
        <div className="history-list">
          {sessions.map((session) => {
            const logs = details[session.id] ?? []
            const secs = durationSeconds(session)
            return (
              <div className="history-card" key={session.id}>
                <div className="history-card-head">
                  <span className="history-card-name">
                    {workoutName(session.workout_id)}
                  </span>
                  <span className="history-card-date">{session.date}</span>
                </div>
                <p className="history-card-meta">
                  {logs.length > 0 ? `${logs.length} sets logged` : 'No sets logged'}
                  {secs !== null ? `, ${formatDuration(secs)}` : ''}
                </p>
                <button
                  type="button"
                  className="history-card-toggle"
                  onClick={() => toggle(session)}
                >
                  {expanded === session.id ? 'Hide sets' : 'Show sets'}
                </button>
                {expanded === session.id && (
                  <div className="history-sets">
                    {logs.length === 0 ? (
                      <p className="history-empty">No sets logged.</p>
                    ) : (
                      logs.map((log) => (
                        <div className="history-set-row" key={log.id}>
                          <span className="history-set-exercise">
                            {exerciseName(log.exercise_slug)}
                            {log.side ? ` (${log.side})` : ''}
                          </span>
                          <span className="history-set-detail">
                            {log.reps} reps, {log.band}
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
                <div className="history-note">
                  <label className="history-note-label" htmlFor={`note-${session.id}`}>
                    Note
                  </label>
                  <input
                    id={`note-${session.id}`}
                    className="history-note-input"
                    type="text"
                    value={noteValue(session)}
                    onChange={(e) =>
                      setNoteDrafts((prev) => ({ ...prev, [session.id]: e.target.value }))
                    }
                    onBlur={() => saveNote(session)}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
