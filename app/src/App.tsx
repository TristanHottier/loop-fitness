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
import type { Workout } from './data/plan'

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<Workout | null>(null)
  const [showHistory, setShowHistory] = useState(false)

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
    setShowHistory(false)
  }

  return (
    <div className="app-shell">
      <main className="app-content">
        {activeSession ? (
          <Session workout={activeSession} onExit={() => setActiveSession(null)} />
        ) : selectedExercise ? (
          <Exercise slug={selectedExercise} onBack={() => setSelectedExercise(null)} />
        ) : showHistory ? (
          <History onBack={() => setShowHistory(false)} />
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
