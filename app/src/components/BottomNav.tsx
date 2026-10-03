import { CalendarCheck, ClipboardList, LineChart, Settings, Utensils } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export type Tab = 'today' | 'plan' | 'progress' | 'nutrition' | 'settings'

interface TabDef {
  id: Tab
  label: string
  icon: LucideIcon
}

const TABS: TabDef[] = [
  { id: 'today', label: 'Today', icon: CalendarCheck },
  { id: 'plan', label: 'Plan', icon: ClipboardList },
  { id: 'progress', label: 'Progress', icon: LineChart },
  { id: 'nutrition', label: 'Nutrition', icon: Utensils },
  { id: 'settings', label: 'Settings', icon: Settings },
]

interface BottomNavProps {
  active: Tab
  onSelect: (tab: Tab) => void
}

export function BottomNav({ active, onSelect }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Main">
      {TABS.map((tab) => {
        const Icon = tab.icon
        const isActive = tab.id === active
        return (
          <button
            key={tab.id}
            type="button"
            className={isActive ? 'bottom-nav-item active' : 'bottom-nav-item'}
            aria-current={isActive ? 'page' : undefined}
            onClick={() => onSelect(tab.id)}
          >
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
            <span>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
