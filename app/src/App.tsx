import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { InProgressStrip } from './components/InProgressStrip'
import { Today } from './screens/Today'
import { Plan } from './screens/Plan'
import { Progress } from './screens/Progress'
import { Nutrition } from './screens/Nutrition'
import { Settings } from './screens/Settings'
import { Exercise } from './screens/Exercise'
import { Session } from './screens/Session'
import { History } from './screens/History'
import { SessionDetail } from './screens/SessionDetail'
import { useSync } from './sync/useSync'
import type { Workout } from './data/plan'

// The first-run band sheet lives in its own file. It is mounted only when the
// file exists, so this app builds with or without it.
const firstRunModules = import.meta.glob('./components/FirstRunBands.tsx')
const FirstRunBands = Object.keys(firstRunModules).length
  ? lazy(async () => {
      const mod = (await firstRunModules['./components/FirstRunBands.tsx']()) as {
        FirstRunBands: React.ComponentType
      }
      return { default: mod.FirstRunBands }
    })
  : null

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const [activeSession, setActiveSession] = useState<Workout | null>(null)
  const [sessionExercise, setSessionExercise] = useState<string | null>(null)
  const [showHistory, setShowHistory] = useState(false)
  const [historySession, setHistorySession] = useState<string | null>(null)
  const [historyVersion, setHistoryVersion] = useState(0)
  const [settingsExercises, setSettingsExercises] = useState(false)

  useSync()

  // Back gesture support. Each sub-screen pushes one history entry; the
  // popstate handler closes the top-most sub-screen. UI back buttons call
  // history.back() so the entry and the screen always close together.
  const depth = useRef(0)
  const skipPop = useRef(false)
  const screens = useRef({ historySession, sessionExercise, activeSession, selectedExercise, showHistory, settingsExercises })
  screens.current = { historySession, sessionExercise, activeSession, selectedExercise, showHistory, settingsExercises }

  const closeTop = useCallback(() => {
    const s = screens.current
    if (s.historySession) {
      setHistorySession(null)
      setHistoryVersion((v) => v + 1)
    } else if (s.sessionExercise) {
      setSessionExercise(null)
    } else if (s.activeSession) {
      setActiveSession(null)
    } else if (s.selectedExercise) {
      setSelectedExercise(null)
    } else if (s.showHistory) {
      setShowHistory(false)
    } else if (s.settingsExercises) {
      setSettingsExercises(false)
    }
  }, [])

  useEffect(() => {
    function onPop() {
      if (skipPop.current) {
        skipPop.current = false
        return
      }
      if (depth.current > 0) depth.current -= 1
      closeTop()
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [closeTop])

  function pushSub() {
    try {
      window.history.pushState({ lf: depth.current + 1 }, '')
      depth.current += 1
    } catch {
      // History unavailable; the in-app back buttons still work.
    }
  }

  function back() {
    if (depth.current > 0) window.history.back()
    else closeTop()
  }

  function openExercise(slug: string) {
    pushSub()
    setSelectedExercise(slug)
  }

  function startWorkout(workout: Workout) {
    pushSub()
    setActiveSession(workout)
  }

  function openHistory() {
    pushSub()
    setShowHistory(true)
  }

  function selectTab(next: Tab) {
    // Drop the history entries of the screens being closed.
    if (depth.current > 0) {
      const n = depth.current
      depth.current = 0
      skipPop.current = true
      try {
        window.history.go(-n)
      } catch {
        skipPop.current = false
      }
    }
    setTab(next)
    setSelectedExercise(null)
    setActiveSession(null)
    setSessionExercise(null)
    setShowHistory(false)
    setHistorySession(null)
    setSettingsExercises(false)
  }

  function resumeSession(workout: Workout) {
    if (depth.current > 0) {
      const n = depth.current
      depth.current = 0
      skipPop.current = true
      try {
        window.history.go(-n)
      } catch {
        skipPop.current = false
      }
    }
    setSelectedExercise(null)
    setSessionExercise(null)
    setShowHistory(false)
    setHistorySession(null)
    setSettingsExercises(false)
    setTab('today')
    // Let the history rewind settle before pushing the session entry.
    window.setTimeout(() => startWorkout(workout), 0)
  }

  const showStrip = !activeSession && tab !== 'today'
  const stripKey = [tab, selectedExercise, showHistory, historySession, activeSession?.id].join('|')

  return (
    <div className="app-shell">
      <main className="app-content" style={showStrip ? { paddingBottom: 'calc(96px + 44px)' } : undefined}>
        {activeSession ? (
          <>
            <div style={sessionExercise ? { display: 'none' } : undefined}>
              <Session
                workout={activeSession}
                onExit={back}
                onOpenExercise={(slug) => {
                  pushSub()
                  setSessionExercise(slug)
                }}
              />
            </div>
            {sessionExercise ? <Exercise slug={sessionExercise} onBack={back} /> : null}
          </>
        ) : selectedExercise ? (
          <Exercise slug={selectedExercise} onBack={back} />
        ) : showHistory ? (
          <>
            <div style={historySession ? { display: 'none' } : undefined}>
              <History
                onBack={back}
                onOpenSession={(id) => {
                  pushSub()
                  setHistorySession(id)
                }}
                version={historyVersion}
              />
            </div>
            {historySession ? <SessionDetail sessionId={historySession} onBack={back} /> : null}
          </>
        ) : tab === 'today' ? (
          <Today onStartWorkout={startWorkout} />
        ) : tab === 'plan' ? (
          <Plan onOpenExercise={openExercise} />
        ) : tab === 'progress' ? (
          <Progress onOpenHistory={openHistory} onOpenExercise={openExercise} />
        ) : tab === 'nutrition' ? (
          <Nutrition />
        ) : (
          <Settings
            exercisesOpen={settingsExercises}
            onOpenExercises={() => {
              pushSub()
              setSettingsExercises(true)
            }}
            onCloseExercises={back}
          />
        )}
      </main>
      {showStrip && <InProgressStrip refreshKey={stripKey} onResume={resumeSession} />}
      <BottomNav active={tab} onSelect={selectTab} />
      {FirstRunBands ? (
        <Suspense fallback={null}>
          <FirstRunBands />
        </Suspense>
      ) : null}
    </div>
  )
}
