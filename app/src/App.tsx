import { useState } from 'react'
import type { ComponentType } from 'react'
import { BottomNav } from './components/BottomNav'
import type { Tab } from './components/BottomNav'
import { Today } from './screens/Today'
import { Plan } from './screens/Plan'
import { Progress } from './screens/Progress'
import { Settings } from './screens/Settings'

const SCREENS: Record<Tab, ComponentType> = {
  today: Today,
  plan: Plan,
  progress: Progress,
  settings: Settings,
}

export default function App() {
  const [tab, setTab] = useState<Tab>('today')
  const Screen = SCREENS[tab]

  return (
    <div className="app-shell">
      <main className="app-content">
        <Screen />
      </main>
      <BottomNav active={tab} onSelect={setTab} />
    </div>
  )
}
