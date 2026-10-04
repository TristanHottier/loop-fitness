import './muscle-map.css'

export interface MuscleMapProps {
  primary: string[]
  secondary: string[]
}

interface MuscleShape {
  key: string
  cx: number
  cy: number
  rx: number
  ry: number
}

// Front figure muscle groups, positioned on a 100 x 200 viewBox.
const FRONT_MUSCLES: MuscleShape[] = [
  { key: 'chest', cx: 42, cy: 44, rx: 9, ry: 8 },
  { key: 'chest', cx: 58, cy: 44, rx: 9, ry: 8 },
  { key: 'front_delts', cx: 32, cy: 34, rx: 6, ry: 5 },
  { key: 'front_delts', cx: 68, cy: 34, rx: 6, ry: 5 },
  { key: 'side_delts', cx: 26, cy: 37, rx: 4, ry: 6 },
  { key: 'side_delts', cx: 74, cy: 37, rx: 4, ry: 6 },
  { key: 'biceps', cx: 22, cy: 52, rx: 4.5, ry: 10 },
  { key: 'biceps', cx: 78, cy: 52, rx: 4.5, ry: 10 },
  { key: 'brachialis', cx: 22, cy: 68, rx: 4, ry: 8 },
  { key: 'brachialis', cx: 78, cy: 68, rx: 4, ry: 8 },
  { key: 'triceps', cx: 18, cy: 52, rx: 3, ry: 9 },
  { key: 'triceps', cx: 82, cy: 52, rx: 3, ry: 9 },
]

// Back figure muscle groups, positioned on a 100 x 200 viewBox.
const BACK_MUSCLES: MuscleShape[] = [
  { key: 'lats', cx: 40, cy: 72, rx: 9, ry: 14 },
  { key: 'lats', cx: 60, cy: 72, rx: 9, ry: 14 },
  { key: 'mid_back', cx: 50, cy: 58, rx: 12, ry: 13 },
  { key: 'upper_back', cx: 50, cy: 40, rx: 14, ry: 8 },
  { key: 'rear_delts', cx: 32, cy: 34, rx: 6, ry: 5 },
  { key: 'rear_delts', cx: 68, cy: 34, rx: 6, ry: 5 },
  { key: 'side_delts', cx: 26, cy: 37, rx: 4, ry: 6 },
  { key: 'side_delts', cx: 74, cy: 37, rx: 4, ry: 6 },
  { key: 'triceps', cx: 22, cy: 52, rx: 4.5, ry: 10 },
  { key: 'triceps', cx: 78, cy: 52, rx: 4.5, ry: 10 },
]

// Per-muscle-group color tokens. Each muscle key maps to its group color so
// the map reads as a diagram of distinct groups, not a single accent.
const MUSCLE_TOKENS: Record<string, string> = {
  chest: 'var(--muscle-chest)',
  front_delts: 'var(--muscle-front-delts)',
  side_delts: 'var(--muscle-side-delts)',
  rear_delts: 'var(--muscle-rear-delts)',
  biceps: 'var(--muscle-biceps)',
  brachialis: 'var(--muscle-brachialis)',
  triceps: 'var(--muscle-triceps)',
  lats: 'var(--muscle-lats)',
  mid_back: 'var(--muscle-mid-back)',
  upper_back: 'var(--muscle-upper-back)',
}

// Primary muscles fill with their group color at full opacity. Secondary
// muscles fill with the group color at about 0.45 opacity. Idle muscles
// (in neither list) fill with the border color. The fill is set inline so
// the 1px stroke in var(--color-bg) stays solid.
function fillFor(key: string, isPrimary: boolean, isSecondary: boolean): string {
  const token = MUSCLE_TOKENS[key] ?? 'var(--color-border)'
  if (isPrimary) return token
  if (isSecondary) return `color-mix(in srgb, ${token} 45%, transparent)`
  return 'var(--color-border)'
}

function Figure({
  label,
  muscles,
  primary,
  secondary,
}: {
  label: string
  muscles: MuscleShape[]
  primary: string[]
  secondary: string[]
}) {
  return (
    <div className="muscle-figure">
      <svg className="muscle-svg" viewBox="0 0 100 200" role="img" aria-label={`${label} view`}>
        <g className="muscle-body">
          <circle cx="50" cy="15" r="11" />
          <rect x="44" y="24" width="12" height="8" rx="2" />
          <path d="M 30 32 Q 30 28 34 28 L 66 28 Q 70 28 70 32 L 68 100 Q 68 106 62 106 L 38 106 Q 32 106 32 100 Z" />
          <rect x="16" y="32" width="12" height="70" rx="6" />
          <rect x="72" y="32" width="12" height="70" rx="6" />
          <rect x="34" y="104" width="14" height="86" rx="7" />
          <rect x="52" y="104" width="14" height="86" rx="7" />
        </g>
        {muscles.map((m, i) => (
          <ellipse
            key={i}
            className="muscle"
            style={{ fill: fillFor(m.key, primary.includes(m.key), secondary.includes(m.key)) }}
            cx={m.cx}
            cy={m.cy}
            rx={m.rx}
            ry={m.ry}
          />
        ))}
      </svg>
      <span className="muscle-figure-label">{label}</span>
    </div>
  )
}

export function MuscleMap({ primary, secondary }: MuscleMapProps) {
  return (
    <div className="muscle-map">
      <div className="muscle-figures">
        <Figure label="Front" muscles={FRONT_MUSCLES} primary={primary} secondary={secondary} />
        <Figure label="Back" muscles={BACK_MUSCLES} primary={primary} secondary={secondary} />
      </div>
      <div className="muscle-legend">
        <span className="muscle-legend-item">
          <span className="muscle-legend-swatch muscle-legend-swatch-primary" />
          Primary
        </span>
        <span className="muscle-legend-item">
          <span className="muscle-legend-swatch muscle-legend-swatch-secondary" />
          Secondary
        </span>
      </div>
    </div>
  )
}
