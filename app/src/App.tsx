import { useState } from 'react'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { Today } from './screens/Today'
import { Plan } from './screens/Plan'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { Exercise } from './screens/Exercise'
import { Session } from './screens/Session'
import { History } from './screens/History'
import { SessionDetail } from './screens/SessionDetail'
import { useSync } from './sync/useSync'
import type { Workout } from './data/plan'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<Workout | null>(null)
  const [sessionExercise, setSessionExercise] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historySession, setHistorySession] = useState<string | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)

  useSync()

  function openExercise(slug: string) {
    setSelectedExercise(slug)
  }

  function startWorkout(workout: Workout) {
    setActiveSession(workout)
  }

  function openHistory() {
    setShowHistory(true)
  }

  function selectTab(next: Tab) {
    setTab(next)
    setSelectedExercise(null)
    setActiveSession(null)
    setSessionExercise(null)
    setShowHistory(false)
    setHistorySession(null)
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        {activeSession ? (
          <>
            <div style={sessionExercise ? { display: 'none' } : undefined}>
              <Session
                workout={activeSession}
                onExit={() => {
                  setActiveSession(null)
                  setSessionExercise(null)
                }}
                onOpenExercise={(slug) => setSessionExercise(slug)}
              />
            </div>
            {sessionExercise ? (
              <Exercise slug={sessionExercise} onBack={() => setSessionExercise(null)} />
            ) : null}
          </>
        ) : selectedExercise ? (
          <Exercise slug={selectedExercise} onBack={() => setSelectedExercise(null)} />
        ) : showHistory ? (
          <>
            <div style={historySession ? { display: 'none' } : undefined}>
              <History
                onBack={() => setShowHistory(false)}
                onOpenSession={(id) => setHistorySession(id)}
                version={historyVersion}
              />
            </div>
            {historySession ? (
              <SessionDetail
                sessionId={historySession}
                onBack={() => {
                  setHistorySession(null)
                  setHistoryVersion((v) => v + 1)
                }}
              />
            ) : null}
          </>
        ) : tab === 'today' ? (
          <Today onStartWorkout={startWorkout} />
        ) : tab === 'plan' ? (
          <Plan onOpenExercise={openExercise} />
        ) : tab === 'progress' ? (
          <Progress onOpenHistory={openHistory} />
        ) : (
          <Settings />
        )}
      </main>
      <BottomNav active={tab} onSelect={selectTab} />
    </div>
  )
}
