import { useMemo } from 'react'
import './chart.css'

export interface ChartPoint {
  date: string
  value: number
  label?: string // short text for the point (tooltip, and above the dot when pointLabels)
}

export interface ChartTick {
  value: number
  label: string
}

interface ChartProps {
  title: string
  points: ChartPoint[]
  unit?: string
  showAverage?: boolean
  // Custom y ticks (e.g. band labels). The y range becomes [first tick, last tick + 1].
  yTicks?: ChartTick[]
  pointLabels?: boolean // draw each point's label (only when there are 14 points or fewer)
  legend?: string // legend text for the main line (default "Value")
  summary?: string // accessible summary; a default is generated from the data
}

const W = 320
const H = 160
const PAD_L = 40
const PAD_R = 8
const PAD_T = 8
const PAD_B = 24
const DAY_MS = 86400000

function parseDate(d: string): number {
  return new Date(d + 'T00:00:00Z').getTime()
}

// Pick the step from the 1, 2, 5 x 10^n family closest to range/4,
// so the axis lands on about 4 to 5 intervals.
function niceStep(range: number, targetIntervals = 4): number {
  if (range <= 0) return 1
  const raw = range / targetIntervals
  const mag = 10 ** Math.floor(Math.log10(raw))
  const candidates = [1, 2, 5, 10].map((c) => c * mag)
  let best = candidates[0]
  let bestDist = Infinity
  for (const c of candidates) {
    const dist = Math.abs(Math.log10(c) - Math.log10(raw))
    if (dist < bestDist) {
      bestDist = dist
      best = c
    }
  }
  return best
}

// Floor/ceil to a multiple of step, snapping near-integers to avoid
// floating-point drift (e.g. 28.4 / 0.2 = 141.999...).
function floorStep(v: number, step: number): number {
  const q = v / step
  const r = Math.round(q)
  return (Math.abs(q - r) < 1e-9 ? r : Math.floor(q)) * step
}

function ceilStep(v: number, step: number): number {
  const q = v / step
  const r = Math.round(q)
  return (Math.abs(q - r) < 1e-9 ? r : Math.ceil(q)) * step
}

export function Chart({ title, points, unit, showAverage, yTicks, pointLabels, legend, summary }: ChartProps) {
  const sorted = useMemo(() => [...points].sort((a, b) => a.date.localeCompare(b.date)), [points])
  const times = useMemo(() => sorted.map((p) => parseDate(p.date)), [sorted])

  // Trailing 7-day moving average (calendar days), O(n) with a sliding window.
  const averages = useMemo(() => {
    const out: number[] = []
    let l = 0
    let r = 0
    let sum = 0
    for (let i = 0; i < sorted.length; i++) {
      const t = times[i]
      while (r < sorted.length && times[r] <= t) sum += sorted[r++].value
      while (l < r && times[l] < t - 6 * DAY_MS) sum -= sorted[l++].value
      out.push(r > l ? sum / (r - l) : sorted[i].value)
    }
    return out
  }, [sorted, times])

  if (sorted.length === 0) {
    return (
      <div className="chart">
        <h3 className="chart-title">{title}</h3>
        <p className="chart-empty">No entries yet.</p>
      </div>
    )
  }

  const innerW = W - PAD_L - PAD_R
  const innerH = H - PAD_T - PAD_B

  const values = sorted.map((p) => p.value)
  let min: number
  let max: number
  let step = 1
  if (yTicks && yTicks.length > 0) {
    min = yTicks[0].value
    max = yTicks[yTicks.length - 1].value + 1
  } else {
    let dataMin = Math.min(...values)
    let dataMax = Math.max(...values)
    if (dataMin === dataMax) {
      dataMin -= 1
      dataMax += 1
    }
    step = niceStep(dataMax - dataMin)
    min = floorStep(dataMin, step)
    max = ceilStep(dataMax, step)
  }

  const n = sorted.length
  const t0 = times[0]
  const t1 = times[n - 1]
  // Date-proportional x; a single day centres everything.
  const xFor = (i: number) =>
    t1 === t0 ? PAD_L + innerW / 2 : PAD_L + ((times[i] - t0) / (t1 - t0)) * innerW
  const yFor = (v: number) => PAD_T + innerH * (1 - (v - min) / (max - min))

  const linePath = sorted
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
    .join(' ')

  // Area under the value line: follow the line, drop to the plot bottom, and close.
  const plotBottom = PAD_T + innerH
  const areaPath = `${linePath} L ${xFor(n - 1).toFixed(1)} ${plotBottom.toFixed(1)} L ${xFor(0).toFixed(1)} ${plotBottom.toFixed(1)} Z`

  const avgPath = averages
    .map((a, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(a).toFixed(1)}`)
    .join(' ')

  const fmt = (v: number) => `${Number(v.toFixed(1))}${unit ? ' ' + unit : ''}`

  // Direct label on the latest point.
  const last = sorted[n - 1]
  const lastX = xFor(n - 1)
  const lastY = yFor(last.value)
  const latestLabel = last.label ?? fmt(last.value)
  // Keep the label inside the plot: above the dot, or below it if the dot is near the top.
  const labelAbove = lastY - 8 >= 12
  const labelY = labelAbove ? lastY - 8 : lastY + 14
  const showAll = pointLabels && n <= 14

  const gridLines = yTicks
    ? yTicks.map((t) => ({ y: yFor(t.value), label: t.label }))
    : Array.from({ length: Math.max(1, Math.round((max - min) / step)) + 1 }, (_, g) => {
        const v = min + g * step
        return { y: yFor(v), label: fmt(v) }
      })

  // X ticks evenly spaced in time (labels are the calendar date of that time).
  const tickCount = t1 === t0 ? 1 : Math.min(4, Math.floor((t1 - t0) / DAY_MS) + 1)
  const ticks = Array.from({ length: tickCount }, (_, k) => {
    const frac = tickCount === 1 ? 0 : k / (tickCount - 1)
    const t = t0 + frac * (t1 - t0)
    return {
      x: t1 === t0 ? PAD_L + innerW / 2 : PAD_L + frac * innerW,
      label: new Date(Math.round(t / DAY_MS) * DAY_MS).toISOString().slice(5, 10),
      anchor: (k === 0 && tickCount > 1 ? 'start' : k === tickCount - 1 && tickCount > 1 ? 'end' : 'middle') as
        | 'start'
        | 'middle'
        | 'end',
    }
  })

  const a11y =
    summary ??
    `${n} ${n === 1 ? 'entry' : 'entries'} from ${sorted[0].date} to ${last.date}. Latest ${
      last.label ?? fmt(last.value)
    } on ${last.date}.` +
      (yTicks ? '' : ` Lowest ${fmt(Math.min(...values))}, highest ${fmt(Math.max(...values))}.`)

  return (
    <div className="chart">
      <h3 className="chart-title">{title}</h3>
      <svg
        className="chart-svg"
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`${title}. ${a11y}`}
      >
        {gridLines.map((g, i) => (
          <g key={i}>
            <line className="chart-axis" x1={PAD_L} y1={g.y} x2={W - PAD_R} y2={g.y} />
            <text className="chart-label" x={PAD_L - 6} y={g.y + 3} textAnchor="end">
              {g.label}
            </text>
          </g>
        ))}
        <path className="chart-area" d={areaPath} />
        {showAverage && <path className="chart-line-average" d={avgPath} />}
        <path className="chart-line" d={linePath} />
        {sorted.map((p, i) => (
          <g key={i}>
            <circle
              className={i === n - 1 ? 'chart-dot chart-dot-latest' : 'chart-dot'}
              cx={xFor(i)}
              cy={yFor(p.value)}
              r={i === n - 1 ? 4 : 2.5}
            >
              <title>{`${p.date}: ${p.label ?? fmt(p.value)}`}</title>
            </circle>
            {showAll && i !== n - 1 && p.label ? (
              <text className="chart-point-label" x={xFor(i)} y={yFor(p.value) - 6} textAnchor="middle">
                {p.label}
              </text>
            ) : null}
          </g>
        ))}
        <text
          className="chart-latest-label"
          x={lastX}
          y={labelY}
          textAnchor={lastX > W - PAD_R - 40 ? 'end' : 'middle'}
        >
          {latestLabel}
        </text>
        {ticks.map((t, i) => (
          <text key={i} className="chart-label" x={t.x} y={H - 6} textAnchor={t.anchor}>
            {t.label}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        <span className="chart-legend-item">
          <span className="chart-legend-swatch" />
          {legend ?? 'Value'}
        </span>
        {showAverage && (
          <span className="chart-legend-item">
            <span className="chart-legend-swatch chart-legend-swatch-average" />
            7-day average
          </span>
        )}
      </div>
    </div>
  )
}
