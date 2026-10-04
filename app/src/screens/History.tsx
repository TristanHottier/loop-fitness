import { useEffect, useState } from 'react'
import {
  getSessions,
  updateSession,
  deleteSession,
  type Session,
} from '../db/db'
import { loadPlan, type PlanData } from '../data/plan'
import { formatDuration } from '../lib/format'
import './history.css'

interface HistoryProps {
  onBack: () => void
  onOpenSession: (id: string) => void
  version?: number
}

export function History({ onBack, onOpenSession, version }: HistoryProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [plan, setPlan] = useState<PlanData | null>(null)
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
  const [deleteBusyIds, setDeleteBusyIds] = useState<Record<string, boolean>>({})

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

  function workoutName(workoutId: string): string {
    if (!plan) return workoutId
    return plan.workouts.find((w) => w.id === workoutId)?.name ?? workoutId
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

  async function confirmDelete(session: Session) {
    setDeleteBusyIds((prev) => ({ ...prev, [session.id]: true }))
    try {
      await deleteSession(session.id)
      setSessions((prev) => prev.filter((s) => s.id !== session.id))
      setConfirmDeleteId((prev) => (prev === session.id ? null : prev))
    } finally {
      setDeleteBusyIds((prev) => ({ ...prev, [session.id]: false }))
    }
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
            const secs = durationSeconds(session)
            return (
              <div className="history-card" key={session.id}>
                <div className="history-card-head">
                  <span className="history-card-name">
                    {workoutName(session.workout_id)}
                  </span>
                  <span className="history-card-date">{session.date}</span>
                </div>
                {secs !== null ? (
                  <p className="history-card-meta">{formatDuration(secs)}</p>
                ) : null}
                <div className="history-card-actions">
                  <button
                    type="button"
                    className="history-card-toggle"
                    onClick={() => onOpenSession(session.id)}
                  >
                    Show sets
                  </button>
                  <button
                    type="button"
                    className="history-card-delete"
                    onClick={() => {
                      if (deleteBusyIds[session.id]) return
                      setConfirmDeleteId(session.id)
                    }}
                  >
                    Delete
                  </button>
                </div>
                {confirmDeleteId === session.id ? (
                  <div className="history-delete-confirm">
                    <p className="history-delete-note">
                      This deletes the session and its sets. This cannot be undone.
                    </p>
                    <div className="history-card-actions">
                      <button
                        type="button"
                        className="history-card-delete-confirm"
                        onClick={() => confirmDelete(session)}
                        disabled={deleteBusyIds[session.id]}
                      >
                        Confirm delete
                      </button>
                      <button
                        type="button"
                        className="history-card-cancel"
                        onClick={() => setConfirmDeleteId(null)}
                        disabled={deleteBusyIds[session.id]}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : null}
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
