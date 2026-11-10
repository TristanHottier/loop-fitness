import { useMemo } from 'react'
import { Chart } from './Chart'
import { exerciseSeries, prsInRange } from '../lib/analytics'
import type { TrainingData } from './useTrainingData'
import './strength-chart.css'

// Best set per session for one exercise, plus the latest PR date.
export function StrengthChart({ slug, data }: { slug: string; data: TrainingData }) {
  const { plan, sessions, logs, inventory } = data
  const name = plan.exercises[slug]?.name ?? slug
  const series = useMemo(
    () => exerciseSeries(logs, sessions, slug, plan, inventory),
    [logs, sessions, slug, plan, inventory]
  )
  const lastPR = useMemo(() => {
    const hits = prsInRange(logs, sessions, plan, '0000-01-01', '9999-12-31', inventory, { slug })
    return hits.length ? hits[hits.length - 1] : null
  }, [logs, sessions, slug, plan, inventory])

  const points = useMemo(
    () => series.points.map((p) => ({ date: p.date, value: p.y, label: p.label })),
    [series]
  )

  if (series.points.length === 0) return <p className="strength-empty">No sets logged yet.</p>

  const kg = series.mode === 'kg'
  const latest = series.points[series.points.length - 1]
  const summary =
    `${series.points.length} ${series.points.length === 1 ? 'session' : 'sessions'}, ` +
    `${series.points[0].date} to ${latest.date}. Best set first ${series.points[0].label}, latest ${latest.label}.` +
    (kg ? ' Plotted as estimated strength in kilograms.' : ' Plotted by band step; reps move the point within a step.')

  return (
    <div className="strength">
      <Chart
        title={kg ? `${name}, estimated strength` : `${name}, best set`}
        points={points}
        unit={kg ? 'kg' : undefined}
        yTicks={kg ? undefined : series.ticks}
        pointLabels
        legend={kg ? 'Best set per session (kg)' : 'Best set per session (reps @ band)'}
        summary={summary}
      />
      <p className="strength-pr">
        {lastPR ? `Last PR: ${lastPR.date}, ${lastPR.log.reps} @ ${lastPR.log.band}` : 'No PR yet.'}
      </p>
    </div>
  )
}
