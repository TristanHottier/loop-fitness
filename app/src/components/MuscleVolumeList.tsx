import { useEffect, useState } from 'react'
import { loadPlan, type MuscleTarget } from '../data/plan'
import { muscleLabel, targetFor, volumeStatus } from '../lib/analytics'
import './muscle-volume-list.css'

interface Props {
  values: Record<string, number>
  // Fallback range for muscles the plan has no own target for.
  targets: MuscleTarget
  // Per-muscle ranges (plan.json muscleTargets). When omitted the list reads
  // them from the plan itself (shared, cached fetch).
  muscleTargets?: Record<string, MuscleTarget>
  previous?: Record<string, number> // last week's values, for the change column
  caption: string
}

const fmt = (n: number) => String(Number(n.toFixed(1)))

// Compact per-muscle list: value, a bar against that muscle's own target
// range, change vs the previous period, and a quiet "below target" note.
export function MuscleVolumeList({ values, targets, muscleTargets, previous, caption }: Props) {
  const [loaded, setLoaded] = useState<Record<string, MuscleTarget> | undefined>(undefined)
  useEffect(() => {
    if (muscleTargets) return
    let alive = true
    loadPlan()
      .then((p) => alive && setLoaded(p.muscleTargets))
      .catch(() => {}) // keep the fallback range
    return () => {
      alive = false
    }
  }, [muscleTargets])
  const planTargets = muscleTargets ?? loaded
  const rangeOf = (k: string) => targetFor(k, planTargets, targets)

  const keys = Object.keys(values).sort((a, b) => muscleLabel(a).localeCompare(muscleLabel(b)))
  // One shared scale so bars stay comparable between rows.
  const scaleMax = Math.max(...keys.map((k) => rangeOf(k).max * 1.25), ...keys.map((k) => values[k] ?? 0), 1)
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`
  return (
    <ul className="mvl" aria-label={caption}>
      {keys.map((k) => {
        const v = values[k] ?? 0
        const range = rangeOf(k)
        const status = volumeStatus(v, range)
        const delta = previous ? v - (previous[k] ?? 0) : null
        const deltaText = delta === null || delta === 0 ? null : `${delta > 0 ? '+' : '-'}${fmt(Math.abs(delta))}`
        return (
          <li key={k} className="mvl-row">
            <span className="mvl-name">
              {muscleLabel(k)}
              <span className="mvl-range">
                {range.min} to {range.max}
              </span>
            </span>
            <span className="mvl-value">{fmt(v)}</span>
            <span className="mvl-bar" aria-hidden="true">
              <span className="mvl-target" style={{ left: pct(range.min), width: `calc(${pct(range.max)} - ${pct(range.min)})` }} />
              <span className="mvl-fill" style={{ width: pct(v) }} />
            </span>
            <span className="mvl-note">
              {deltaText ? <span className="mvl-delta" aria-label={`${deltaText} versus last week`}>{deltaText}</span> : null}
              {status === 'below' ? <span className="mvl-status">below target</span> : null}
              {status === 'above' ? <span className="mvl-status">above target</span> : null}
            </span>
          </li>
        )
      })}
      <li className="mvl-foot">
        Sets per week. The shaded band on each bar is that muscle's target range (shown under its name).
      </li>
    </ul>
  )
}
