import { useEffect, useMemo, useState } from 'react'
import {
  newBodyMetric,
  createBodyMetric,
  getBodyMetrics,
  type BodyMetric,
  type BodyMetricType,
} from '../db/db'
import { Chart, type ChartPoint } from '../components/Chart'
import { Collapsible } from '../components/Collapsible'
import { lastUsedBySlug } from '../lib/lastUsed'
import type { TrainingData } from '../components/useTrainingData'
import { useTrainingData } from '../components/useTrainingData'
import { EmptyState } from '../components/EmptyState'
import { todayISODate } from '../lib/format'
import { Plus, X } from 'lucide-react'
import './progress.css'

const VISIBLE_TYPES: BodyMetricType[] = ['weight_kg', 'arm_left_cm', 'arm_right_cm']

const TYPE_LABELS: Record<BodyMetricType, string> = {
  weight_kg: 'Weight',
  arm_left_cm: 'Arm (left)',
  arm_right_cm: 'Arm (right)',
  shoulders_cm: 'Shoulders',
  chest_cm: 'Chest',
  waist_cm: 'Waist',
}

const TYPE_UNITS: Record<BodyMetricType, string> = {
  weight_kg: 'kg',
  arm_left_cm: 'cm',
  arm_right_cm: 'cm',
  shoulders_cm: 'cm',
  chest_cm: 'cm',
  waist_cm: 'cm',
}

function toPoints(metrics: BodyMetric[]): ChartPoint[] {
  return metrics.map((m) => ({ date: m.date, value: m.value }))
}

const DAY_MS = 86400000

function parseDate(d: string): number {
  return new Date(d + 'T00:00:00Z').getTime()
}

function addDaysISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

// The most recent entry's value, by date. Null when there are no entries.
function latestValue(metrics: BodyMetric[]): number | null {
  if (metrics.length === 0) return null
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date))
  return sorted[sorted.length - 1].value
}

// Delta between the two most recent entries, by date. Rounded to one decimal
// place; zero returns null.
function latestDelta(metrics: BodyMetric[]): number | null {
  if (metrics.length < 2) return null
  const sorted = [...metrics].sort((a, b) => a.date.localeCompare(b.date))
  const last = sorted[sorted.length - 1]
  const prev = sorted[sorted.length - 2]
  const delta = Math.round((last.value - prev.value) * 10) / 10
  return delta === 0 ? null : delta
}

// Average of the entries in the 7-day window ending on `endDate` (inclusive).
// Null when the window has no entries.
function windowAverage(metrics: BodyMetric[], endDate: string): number | null {
  const end = parseDate(endDate)
  const start = end - 6 * DAY_MS
  let sum = 0
  let count = 0
  for (const m of metrics) {
    const t = parseDate(m.date)
    if (t <= end && t >= start) {
      sum += m.value
      count += 1
    }
  }
  return count ? sum / count : null
}

// Delta between the average of the last 7 days and the average of the 7 days
// before that. Null when either window has no entries.
function weekDelta(metrics: BodyMetric[]): number | null {
  const today = todayISODate()
  const current = windowAverage(metrics, today)
  if (current === null) return null
  const past = windowAverage(metrics, addDaysISO(today, -7))
  if (past === null) return null
  const delta = Math.round((current - past) * 10) / 10
  return delta === 0 ? null : delta
}

// One decimal place. A positive delta gets a plus sign; a negative delta
// shows the absolute change without a sign. A unit is appended only when given.
function deltaLabel(delta: number, unit: string | null): string {
  const abs = Math.abs(delta).toFixed(1)
  const text = unit ? `${abs} ${unit}` : abs
  return delta > 0 ? `+${text}` : text
}

interface MetricAddProps {
  type: BodyMetricType
  onAdded: () => Promise<void>
  showLabel?: boolean
}

// Inline add form for one metric: date, value, Add.
function MetricAdd({ type, onAdded, showLabel }: MetricAddProps) {
  const [date, setDate] = useState(todayISODate())
  const [value, setValue] = useState('')

  async function submit() {
    const v = parseFloat(value.replace(',', '.'))
    if (!Number.isFinite(v) || !date) return
    await createBodyMetric(newBodyMetric(type, date, v))
    setValue('')
    await onAdded()
  }

  return (
    <form
      className="progress-add-form"
      onSubmit={(e) => {
        e.preventDefault()
        void submit()
      }}
    >
      {showLabel && <span className="progress-add-label">{TYPE_LABELS[type]}</span>}
      <input
        className="progress-input progress-input-date"
        type="date"
        aria-label={`${TYPE_LABELS[type]} date`}
        value={date}
        onChange={(e) => setDate(e.target.value)}
      />
      <input
        className="progress-input progress-input-value"
        type="number"
        inputMode="decimal"
        step="0.1"
        placeholder={TYPE_UNITS[type]}
        aria-label={`${TYPE_LABELS[type]} in ${TYPE_UNITS[type]}`}
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
      <button type="submit" className="progress-add" disabled={value === ''}>
        Add
      </button>
    </form>
  )
}

interface MetricProps {
  type: BodyMetricType
  metrics: BodyMetric[]
  showAverage?: boolean
  delta: number | null
  deltaUnit: string | null
  deltaNote?: string
  onAdded: () => Promise<void>
}

function Metric({ type, metrics, showAverage, delta, deltaUnit, deltaNote, onAdded }: MetricProps) {
  const [adding, setAdding] = useState(false)
  const latest = latestValue(metrics)
  const title = TYPE_LABELS[type]
  const unit = TYPE_UNITS[type]
  return (
    <Collapsible
      id={`progress.${type}`}
      title={title}
      defaultOpen={type === 'weight_kg'}
      summary={latest !== null ? `${latest.toFixed(1)} ${unit}` : 'No entries'}
    >
      <div className="progress-metric-header">
        {latest !== null ? (
          <div className="progress-card-value">
            <span className="big-number">{latest.toFixed(1)}</span>
            <span className="progress-card-unit">{unit}</span>
            {delta !== null && (
              <span
                className={
                  delta > 0
                    ? 'progress-delta progress-delta-positive'
                    : 'progress-delta progress-delta-negative'
                }
              >
                {deltaLabel(delta, deltaUnit)}
                {deltaNote ? <span className="progress-delta-note">{deltaNote}</span> : null}
              </span>
            )}
          </div>
        ) : (
          <span />
        )}
        <button
          type="button"
          className="icon-button"
          aria-label={adding ? `Close ${title.toLowerCase()} entry` : `Add ${title.toLowerCase()} entry`}
          aria-expanded={adding}
          onClick={() => setAdding((a) => !a)}
        >
          {adding ? <X size={20} strokeWidth={1.75} aria-hidden="true" /> : <Plus size={20} strokeWidth={1.75} aria-hidden="true" />}
        </button>
      </div>
      {adding && (
        <MetricAdd
          type={type}
          onAdded={async () => {
            await onAdded()
            setAdding(false)
          }}
        />
      )}
      {latest !== null && (
        <Chart title={title} points={toPoints(metrics)} unit={unit} showAverage={showAverage} />
      )}
    </Collapsible>
  )
}

// Every exercise of the plan by workout with the sets of its last session.
function LastUsedList({ training, onOpenExercise }: { training: TrainingData; onOpenExercise: (slug: string) => void }) {
  const { plan, logs, sessions } = training
  const map = useMemo(() => lastUsedBySlug(logs, sessions, 1), [logs, sessions])
  let total = 0
  let done = 0
  for (const w of plan.workouts) {
    for (const slug of w.exercises) {
      total += 1
      if (map.has(slug)) done += 1
    }
  }
  return (
    <Collapsible id="progress.lastused" title="Last used" summary={`${done} of ${total} exercises`}>
      {plan.workouts.map((w) => (
        <div key={w.id} className="progress-lastused-group">
          <h3 className="section-head progress-lastused-head">{w.name}</h3>
          {w.exercises.map((slug) => {
            const last = map.get(slug)?.[0]
            return (
              <button
                key={slug}
                type="button"
                className="prop-row progress-lastused-row"
                onClick={() => onOpenExercise(slug)}
              >
                <span className="progress-lastused-name">{plan.exercises[slug]?.name ?? slug}</span>
                <span className="progress-lastused-value">
                  {last ? `${last.text} · ${last.shortDate}` : 'Not done yet'}
                </span>
              </button>
            )
          })}
        </div>
      ))}
    </Collapsible>
  )
}

export function Progress({
  onOpenHistory,
  onOpenExercise,
}: {
  onOpenHistory: () => void
  onOpenExercise: (slug: string) => void
}) {
  const training = useTrainingData()
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [loading, setLoading] = useState(true)

  async function refresh() {
    const all = await Promise.all(VISIBLE_TYPES.map((t) => getBodyMetrics(t)))
    setMetrics(all.flat())
    setLoading(false)
  }

  useEffect(() => {
    let cancelled = false
    async function init() {
      const all = await Promise.all(VISIBLE_TYPES.map((t) => getBodyMetrics(t)))
      if (cancelled) return
      setMetrics(all.flat())
      setLoading(false)
    }
    init()
    return () => {
      cancelled = true
    }
  }, [])

  function byType(type: BodyMetricType): BodyMetric[] {
    return metrics.filter((m) => m.type === type)
  }

  if (loading) {
    return (
      <div className="screen">
        <h1 className="page-title">Progress</h1>
        <p className="screen-subtitle">Loading entries</p>
      </div>
    )
  }

  const filled = VISIBLE_TYPES.filter((t) => byType(t).length > 0)
  const empty = VISIBLE_TYPES.filter((t) => byType(t).length === 0)

  function deltaFor(type: BodyMetricType): number | null {
    return type === 'weight_kg' ? weekDelta(byType(type)) : latestDelta(byType(type))
  }

  return (
    <div className="screen progress">
      <div className="progress-top">
        <h1 className="page-title">Progress</h1>
        <button type="button" className="progress-history" onClick={onOpenHistory}>
          Session history
        </button>
      </div>

      {filled.map((type) => (
        <Metric
          key={type}
          type={type}
          metrics={byType(type)}
          showAverage={type === 'weight_kg'}
          delta={deltaFor(type)}
          deltaUnit={type === 'weight_kg' ? null : 'cm'}
          deltaNote={type === 'weight_kg' ? 'vs last week' : undefined}
          onAdded={refresh}
        />
      ))}

      {filled.length === 0 && (!training || training.logs.length === 0) && (
        <EmptyState>Add a measurement or finish a workout to see progress here.</EmptyState>
      )}

      {training ? <LastUsedList training={training} onOpenExercise={onOpenExercise} /> : null}

      {empty.length > 0 && (
        <Collapsible
          id="progress.add"
          title="Add measurements"
          summary={empty.map((t) => TYPE_LABELS[t]).join(', ')}
        >
          {empty.map((t) => (
            <MetricAdd key={t} type={t} onAdded={refresh} showLabel />
          ))}
        </Collapsible>
      )}
    </div>
  )
}
