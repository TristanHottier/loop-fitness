import { muscleLabel, volumeStatus } from '../lib/analytics'
import './muscle-volume-list.css'

interface Props {
  values: Record<string, number>
  targets: { min: number; max: number }
  previous?: Record<string, number> // last week's values, for the change column
  caption: string
}

const fmt = (n: number) => String(Number(n.toFixed(1)))

// Compact per-muscle list: value, a bar against the target range, change vs
// the previous period, and a quiet "below target" note.
export function MuscleVolumeList({ values, targets, previous, caption }: Props) {
  const keys = Object.keys(values).sort((a, b) => muscleLabel(a).localeCompare(muscleLabel(b)))
  const scaleMax = Math.max(targets.max * 1.25, ...keys.map((k) => values[k] ?? 0), 1)
  const pct = (v: number) => `${Math.min(100, (v / scaleMax) * 100)}%`
  return (
    <ul className="mvl" aria-label={caption}>
      {keys.map((k) => {
        const v = values[k] ?? 0
        const status = volumeStatus(v, targets)
        const delta = previous ? v - (previous[k] ?? 0) : null
        const deltaText = delta === null || delta === 0 ? null : `${delta > 0 ? '+' : '-'}${fmt(Math.abs(delta))}`
        return (
          <li key={k} className="mvl-row">
            <span className="mvl-name">{muscleLabel(k)}</span>
            <span className="mvl-value">{fmt(v)}</span>
            <span className="mvl-bar" aria-hidden="true">
              <span className="mvl-target" style={{ left: pct(targets.min), width: `calc(${pct(targets.max)} - ${pct(targets.min)})` }} />
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
        Target {targets.min} to {targets.max} sets per muscle per week.
      </li>
    </ul>
  )
}
