import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import type { PlanData } from '../data/plan'
import type { Session, SetLog } from '../db/db'
import { dayKey, monthGrid, parseDayKey, weekStart } from '../lib/dates'
import type { BandItem } from '../lib/ladder'
import { monthSummary, muscleLabel, sessionsByDay, streakWeeks, weekCounts } from '../lib/analytics'
import { Collapsible } from './Collapsible'
import './consistency-calendar.css'

const WEEKDAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export function workoutHue(workoutId: string): string {
  switch (workoutId) {
    case 'pull':
      return 'var(--hue-pull)'
    case 'push':
      return 'var(--hue-push)'
    case 'shoulders-arms':
      return 'var(--hue-shoulders)'
    case 'legs-forearms':
      return 'var(--hue-legs)'
    default:
      return 'var(--color-accent)'
  }
}

function fullDate(key: string): string {
  const d = parseDayKey(key)
  const wd = WEEKDAYS[(d.getDay() + 6) % 7]
  return `${wd} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

const fmt = (n: number) => String(Number(n.toFixed(1)))

interface Props {
  sessions: Session[]
  logs: SetLog[]
  plan: PlanData
  inventory?: BandItem[]
  todayKey?: string
}

export function ConsistencyCalendar({ sessions, logs, plan, inventory, todayKey = dayKey() }: Props) {
  const today = parseDayKey(todayKey)
  const [ym, setYm] = useState({ year: today.getFullYear(), month: today.getMonth() + 1 })
  const perWeek = plan.workouts.length

  const byDay = useMemo(() => sessionsByDay(sessions), [sessions])
  const streak = useMemo(() => streakWeeks(sessions, todayKey, perWeek), [sessions, todayKey, perWeek])
  const thisWeek = weekCounts(sessions).get(weekStart(todayKey)) ?? 0
  const summary = useMemo(
    () => monthSummary(logs, sessions, plan, ym.year, ym.month, inventory),
    [logs, sessions, plan, ym, inventory]
  )
  const grid = useMemo(() => monthGrid(ym.year, ym.month), [ym])
  const workoutName = (id: string) => plan.workouts.find((w) => w.id === id)?.name ?? id

  const shift = (delta: number) =>
    setYm(({ year, month }) => {
      const idx = year * 12 + (month - 1) + delta
      return { year: Math.floor(idx / 12), month: (idx % 12) + 1 }
    })

  const monthTitle = `${MONTHS[ym.month - 1]} ${ym.year}`
  const usedWorkouts = plan.workouts

  return (
    <section className="cal" aria-label="Consistency">
      <Collapsible
        id="history.calendar"
        title="Consistency"
        defaultOpen
        summary={`Streak ${streak} ${streak === 1 ? 'week' : 'weeks'}`}
      >
      <div className="cal-streak">
        <div>
          <p className="cal-streak-value">
            {streak} {streak === 1 ? 'week' : 'weeks'}
          </p>
          <p className="cal-streak-sub">Streak of weeks with {perWeek} sessions</p>
        </div>
        <p className="cal-streak-week">
          This week: {Math.min(thisWeek, 99)} of {perWeek}
        </p>
      </div>

      <div className="cal-head">
        <button type="button" className="cal-nav" aria-label="Previous month" onClick={() => shift(-1)}>
          <ChevronLeft size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
        <h2 className="cal-title" aria-live="polite">
          {monthTitle}
        </h2>
        <button type="button" className="cal-nav" aria-label="Next month" onClick={() => shift(1)}>
          <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>

      <div className="cal-grid" role="grid" aria-label={monthTitle}>
        <div className="cal-row" role="row">
          {WEEKDAYS.map((w) => (
            <span key={w} className="cal-dow" role="columnheader" aria-label={w}>
              {w.slice(0, 1)}
            </span>
          ))}
        </div>
        {grid.map((row, ri) => (
          <div className="cal-row" role="row" key={ri}>
            {row.map((cell) => {
              if (!cell.inMonth) return <span key={cell.date} className="cal-cell cal-cell-out" role="gridcell" aria-hidden="true" />
              const day = Number(cell.date.slice(8))
              const list = byDay.get(cell.date) ?? []
              const isToday = cell.date === todayKey
              const label =
                fullDate(cell.date) +
                (list.length > 0 ? `, ${list.map((s) => workoutName(s.workout_id)).join(' and ')}, completed` : '') +
                (isToday ? ', today' : '')
              return (
                <span
                  key={cell.date}
                  role="gridcell"
                  aria-label={label}
                  className={'cal-cell' + (list.length ? ' cal-cell-done' : '') + (isToday ? ' cal-cell-today' : '')}
                  style={list.length ? { ['--cal-hue' as string]: workoutHue(list[0].workout_id) } : undefined}
                >
                  {day}
                </span>
              )
            })}
          </div>
        ))}
      </div>

      <ul className="cal-legend" aria-label="Legend">
        {usedWorkouts.map((w) => (
          <li key={w.id} className="cal-legend-item">
            <span className="cal-legend-dot" style={{ background: workoutHue(w.id) }} aria-hidden="true" />
            {w.name}
          </li>
        ))}
      </ul>
      </Collapsible>

      <Collapsible
        id="history.month"
        title="Month summary"
        summary={`${MONTHS[ym.month - 1].slice(0, 3)}: ${summary.sessions} ${summary.sessions === 1 ? 'session' : 'sessions'}`}
      >
      <dl className="cal-summary" aria-label={`Summary for ${monthTitle}`}>
        <div>
          <dt>Sessions</dt>
          <dd>{summary.sessions}</dd>
        </div>
        <div>
          <dt>Working sets</dt>
          <dd>{fmt(summary.sets)}</dd>
        </div>
        <div>
          <dt>Total reps</dt>
          <dd>{summary.reps}</dd>
        </div>
        <div>
          <dt>Personal records</dt>
          <dd>{summary.prs}</dd>
        </div>
        <div className="cal-summary-wide">
          <dt>Most trained muscle</dt>
          <dd>{summary.topMuscle ? `${muscleLabel(summary.topMuscle.muscle)}, ${fmt(summary.topMuscle.sets)} sets` : 'None yet'}</dd>
        </div>
      </dl>
      </Collapsible>
    </section>
  )
}
