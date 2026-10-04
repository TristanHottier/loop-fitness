import './chart.css'

export interface ChartPoint {
  date: string
  value: number
}

interface ChartProps {
  title: string
  points: ChartPoint[]
  unit?: string
  showAverage?: boolean
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

export function Chart({ title, points, unit, showAverage }: ChartProps) {
  const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date))

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
  let dataMin = Math.min(...values)
  let dataMax = Math.max(...values)
  if (dataMin === dataMax) {
    dataMin -= 1
    dataMax += 1
  }
  const step = niceStep(dataMax - dataMin)
  const min = floorStep(dataMin, step)
  const max = ceilStep(dataMax, step)

  const n = sorted.length
  const xFor = (i: number) =>
    n === 1 ? PAD_L + innerW / 2 : PAD_L + (i * innerW) / (n - 1)
  const yFor = (v: number) => PAD_T + innerH * (1 - (v - min) / (max - min))

  // Trailing 7-day moving average (calendar days).
  const average = sorted.map((p, i) => {
    const t = parseDate(p.date)
    const windowStart = t - 6 * DAY_MS
    let sum = 0
    let count = 0
    for (const q of sorted) {
      const qt = parseDate(q.date)
      if (qt <= t && qt >= windowStart) {
        sum += q.value
        count += 1
      }
    }
    return { x: xFor(i), y: yFor(count ? sum / count : p.value) }
  })

  const linePath = sorted
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xFor(i).toFixed(1)} ${yFor(p.value).toFixed(1)}`)
    .join(' ')

  // Area under the value line: follow the line, drop to the plot bottom, and close.
  const plotBottom = PAD_T + innerH
  const areaPath = `${linePath} L ${xFor(n - 1).toFixed(1)} ${plotBottom.toFixed(1)} L ${xFor(0).toFixed(1)} ${plotBottom.toFixed(1)} Z`

  const avgPath = average
    .map((a, i) => `${i === 0 ? 'M' : 'L'} ${a.x.toFixed(1)} ${a.y.toFixed(1)}`)
    .join(' ')

  // Direct label on the latest point.
  const last = sorted[n - 1]
  const lastX = xFor(n - 1)
  const lastY = yFor(last.value)
  const latestLabel = `${Number(last.value.toFixed(1))}${unit ? ' ' + unit : ''}`
  // Keep the label inside the plot: above the dot, or below it if the dot is near the top.
  const labelAbove = lastY - 8 >= 12
  const labelY = labelAbove ? lastY - 8 : lastY + 14

  const gridCount = Math.max(1, Math.round((max - min) / step))
  const gridLines = Array.from({ length: gridCount + 1 }, (_, g) => {
    const v = min + g * step
    const label = `${Number(v.toFixed(1))}${unit ? ' ' + unit : ''}`
    return { y: yFor(v), label }
  })

  const tickCount = Math.min(4, n)
  const tickIdx: number[] = []
  for (let t = 0; t < tickCount; t++) {
    tickIdx.push(Math.round((t * (n - 1)) / Math.max(1, tickCount - 1)))
  }
  const uniqueTicks = Array.from(new Set(tickIdx))

  return (
    <div className="chart">
      <h3 className="chart-title">{title}</h3>
      <svg className="chart-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={title}>
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
        {sorted.map((p, i) =>
          i === n - 1 ? (
            <circle key={i} className="chart-dot chart-dot-latest" cx={xFor(i)} cy={yFor(p.value)} r={4} />
          ) : (
            <circle key={i} className="chart-dot" cx={xFor(i)} cy={yFor(p.value)} r={2.5} />
          ),
        )}
        <text
          className="chart-latest-label"
          x={lastX}
          y={labelY}
          textAnchor={lastX > W - PAD_R - 24 ? 'end' : 'middle'}
        >
          {latestLabel}
        </text>
        {uniqueTicks.map((idx) => (
          <text
            key={idx}
            className="chart-label"
            x={xFor(idx)}
            y={H - 6}
            textAnchor={idx === 0 ? 'start' : idx === n - 1 ? 'end' : 'middle'}
          >
            {sorted[idx].date.slice(5)}
          </text>
        ))}
      </svg>
      <div className="chart-legend">
        <span className="chart-legend-item">
          <span className="chart-legend-swatch" />
          Value
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
