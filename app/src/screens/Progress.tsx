import { useEffect, useState } from 'react'
import {
  newBodyMetric,
  createBodyMetric,
  updateBodyMetric,
  deleteBodyMetric,
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

export function Progress({ onOpenHistory }: { onOpenHistory: () => void }) {
  const [metrics, setMetrics] = useState<BodyMetric[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

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

  function startEdit(metric: BodyMetric) {
    setEditingId(metric.id)
    setEditValue(String(metric.value))
  }

  async function saveEdit(metric: BodyMetric) {
    const value = parseFloat(editValue)
    if (!Number.isFinite(value)) return
    await updateBodyMetric({ ...metric, value })
    setEditingId(null)
    setEditValue('')
    await refresh()
  }

  async function removeEntry(metric: BodyMetric) {
    await deleteBodyMetric(metric.id)
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

  const tableRows = [...metrics].sort((a, b) => b.date.localeCompare(a.date))

  return (
    <div className="screen progress">
      <h1>Progress</h1>
      <p className="screen-subtitle">Body weight and arm measurements over time.</p>

      <button type="button" className="progress-history" onClick={onOpenHistory}>
        View session history
      </button>

      <Chart
        title="Weight"
        points={toPoints(byType('weight_kg'))}
        unit="kg"
        showAverage
      />
      <Chart title="Arm (left)" points={toPoints(byType('arm_left_cm'))} unit="cm" />
      <Chart title="Arm (right)" points={toPoints(byType('arm_right_cm'))} unit="cm" />

      <section className="progress-section">
        <h2 className="progress-section-title">Entries</h2>
        {tableRows.length === 0 ? (
          <p className="progress-empty">No entries yet.</p>
        ) : (
          <div className="progress-table-wrap">
            <table className="progress-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Type</th>
                  <th className="progress-table-value">Value</th>
                  <th className="progress-table-actions">Actions</th>
                </tr>
              </thead>
              <tbody>
                {tableRows.map((m) => (
                  <tr key={m.id}>
                    <td className="progress-table-date">{m.date}</td>
                    <td>{TYPE_LABELS[m.type]}</td>
                    <td className="progress-table-value">
                      {editingId === m.id ? (
                        <input
                          className="progress-input progress-input-value"
                          type="number"
                          inputMode="decimal"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={() => saveEdit(m)}
                        />
                      ) : (
                        `${m.value} ${TYPE_UNITS[m.type]}`
                      )}
                    </td>
                    <td className="progress-table-actions">
                      {editingId === m.id ? (
                        <button
                          type="button"
                          className="progress-edit"
                          onClick={() => saveEdit(m)}
                        >
                          Save
                        </button>
                      ) : (
                        <button type="button" className="progress-edit" onClick={() => startEdit(m)}>
                          Edit
                        </button>
                      )}
                      <button type="button" className="progress-delete" onClick={() => removeEntry(m)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

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
