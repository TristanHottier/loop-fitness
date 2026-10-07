import { useEffect, useState } from 'react'
import {
  newBodyMetric,
  createBodyMetric,
  getBodyMetrics,
  type BodyMetric,
  type BodyMetricType,
} from '../db/db'
import { Chart, type ChartPoint } from '../components/Chart'
import { todayISODate } from '../lib/format'
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

interface ChartCardProps {
  title: string
  points: ChartPoint[]
  unit: string
  showAverage?: boolean
  latest: number | null
  delta: number | null
  deltaUnit: string | null
  deltaNote?: string
}

function ChartCard({ title, points, unit, showAverage, latest, delta, deltaUnit, deltaNote }: ChartCardProps) {
  return (
    <div className="progress-card">
      <div className="progress-card-header">
        <h3 className="progress-card-title">{title}</h3>
        <div className="progress-card-value">
          {latest === null ? (
            <span className="progress-card-empty">No entries</span>
          ) : (
            <>
              <span className="progress-card-latest">{latest.toFixed(1)}</span>
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
            </>
          )}
        </div>
      </div>
      {latest !== null && <Chart title={title} points={points} unit={unit} showAverage={showAverage} />}
    </div>
  )
}

export function Progress({ onOpenHistory }: { onOpenHistory: () => void }) {
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [loading, setLoading] = useState(true)

  // Add-entry form state.
  const [formType, setFormType] = useState<BodyMetricType>('weight_kg')
  const [formDate, setFormDate] = useState(todayISODate())
  const [formValue, setFormValue] = useState('')

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

  async function addEntry() {
    const value = parseFloat(formValue)
    if (!Number.isFinite(value) || !formDate) return
    const metric = newBodyMetric(formType, formDate, value)
    await createBodyMetric(metric)
    setFormValue('')
    await refresh()
  }

  if (loading) {
    return (
      <div className="screen">
        <h1>Progress</h1>
        <p className="screen-subtitle">Loading entries</p>
      </div>
    )
  }

  const weightMetrics = byType('weight_kg')
  const armLeftMetrics = byType('arm_left_cm')
  const armRightMetrics = byType('arm_right_cm')

  return (
    <div className="screen progress">
      <h1>Progress</h1>

      <button type="button" className="progress-history" onClick={onOpenHistory}>
        View session history
      </button>

      <ChartCard
        title="Weight"
        points={toPoints(weightMetrics)}
        unit="kg"
        showAverage
        latest={latestValue(weightMetrics)}
        delta={weekDelta(weightMetrics)}
        deltaUnit={null}
        deltaNote="vs last week"
      />
      <ChartCard
        title="Arm (left)"
        points={toPoints(armLeftMetrics)}
        unit="cm"
        latest={latestValue(armLeftMetrics)}
        delta={latestDelta(armLeftMetrics)}
        deltaUnit="cm"
      />
      <ChartCard
        title="Arm (right)"
        points={toPoints(armRightMetrics)}
        unit="cm"
        latest={latestValue(armRightMetrics)}
        delta={latestDelta(armRightMetrics)}
        deltaUnit="cm"
      />

      <section className="progress-section">
        <h2 className="progress-section-title">Entries</h2>

        <form
          className="progress-form"
          onSubmit={(e) => {
            e.preventDefault()
            void addEntry()
          }}
        >
          <div className="progress-form-row">
            <input
              className="progress-input progress-input-date"
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
            />
            <select
              className="progress-input progress-input-type"
              value={formType}
              onChange={(e) => setFormType(e.target.value as BodyMetricType)}
            >
              {VISIBLE_TYPES.map((t) => (
                <option key={t} value={t}>
                  {TYPE_LABELS[t]}
                </option>
              ))}
            </select>
            <input
              className="progress-input progress-input-value"
              type="number"
              inputMode="decimal"
              placeholder={TYPE_UNITS[formType]}
              value={formValue}
              onChange={(e) => setFormValue(e.target.value)}
            />
          </div>
          <button type="submit" className="progress-add">
            Add entry
          </button>
        </form>
      </section>
    </div>
  )
}
