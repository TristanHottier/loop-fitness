import { useState } from 'react'
import type { ComponentType } from 'react'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { Today } from './screens/Today'
import { Plan } from './screens/Plan'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'
import { Exercise } from './screens/Exercise'

interface ScreenProps {
  onOpenExercise: (slug: string) => void
}

const SCREENS: Record<Tab, ComponentType<ScreenProps>> = {
  today: Today,
  plan: Plan,
  progress: Progress,
  settings: Settings,
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const [selectedExercise, setSelectedExercise] = useState<string | null>(null)
  const Screen = SCREENS[tab]

  return (
    <div className="app-shell">
      <main className="app-content">
        {selectedExercise ? (
          <Exercise slug={selectedExercise} onBack={() => setSelectedExercise(null)} />
        ) : (
          <Screen onOpenExercise={(slug) => setSelectedExercise(slug)} />
        )}
      </main>
      <BottomNav
        active={tab}
        onSelect={(next) => {
          setTab(next)
          setSelectedExercise(null)
        }}
      />
    </div>
  )
}
