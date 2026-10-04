import './muscle-map.css'
import maleFront from '../assets/musclemap/male-front.json'
import maleBack from '../assets/musclemap/male-back.json'
import femaleFront from '../assets/musclemap/female-front.json'
import femaleBack from '../assets/musclemap/female-back.json'

export interface MuscleMapProps {
  primary: string[]
  secondary: string[]
  // Optional per-muscle set counts. When provided, the map renders in
  // heatmap mode: each region is filled by a 6-step volume scale instead of
  // the primary/secondary accent. Keys are plan.json muscle keys.
  volume?: Record<string, number>
}

interface MusclePart {
  slug: string
  parent: string | null
  alwaysVisible: boolean
  isMuscle: boolean
  order: number
  common: string[]
  left: string[]
  right: string[]
}

interface MuscleFigureData {
  gender: string
  side: string
  viewBox: { x: number; y: number; width: number; height: number }
  parts: MusclePart[]
}

// plan.json muscle key to SDK region and the view(s) where it lights up.
// side_delts and rear_delts both light the back deltoids; lats, mid_back, and
// upper_back all light the back upperBack; brachialis has no SDK region, so it
// lights the front biceps.
const KEY_TO_REGION: Record<string, { region: string; views: string[] }> = {
  chest: { region: 'chest', views: ['front'] },
  front_delts: { region: 'frontDeltoid', views: ['front'] },
  side_delts: { region: 'deltoids', views: ['back'] },
  rear_delts: { region: 'deltoids', views: ['back'] },
  biceps: { region: 'biceps', views: ['front'] },
  brachialis: { region: 'biceps', views: ['front'] },
  triceps: { region: 'triceps', views: ['front', 'back'] },
  lats: { region: 'upperBack', views: ['back'] },
  mid_back: { region: 'upperBack', views: ['back'] },
  upper_back: { region: 'upperBack', views: ['back'] },
  quads: { region: 'quadriceps', views: ['front'] },
  glutes: { region: 'gluteal', views: ['back'] },
  hamstrings: { region: 'hamstring', views: ['back'] },
  calves: { region: 'calves', views: ['front', 'back'] },
  forearms: { region: 'forearm', views: ['front', 'back'] },
}

const BODIES: Record<'male' | 'female', { front: MuscleFigureData; back: MuscleFigureData }> = {
  male: { front: maleFront, back: maleBack },
  female: { front: femaleFront, back: femaleBack },
}

// The app has no gender selection yet; male is the default.
const GENDER: 'male' | 'female' = 'male'

// For a given view, the set of regions lit as primary and as secondary.
function litRegions(view: string, primary: string[], secondary: string[]) {
  const primaryRegions = new Set<string>()
  const secondaryRegions = new Set<string>()
  for (const key of primary) {
    const entry = KEY_TO_REGION[key]
    if (entry && entry.views.includes(view)) primaryRegions.add(entry.region)
  }
  for (const key of secondary) {
    const entry = KEY_TO_REGION[key]
    if (entry && entry.views.includes(view)) secondaryRegions.add(entry.region)
  }
  return { primaryRegions, secondaryRegions }
}

// A part is lit if its slug or its parent slug is in the lit set (sub-group
// inheritance). Primary wins when a part matches both.
function partLevel(
  part: MusclePart,
  primaryRegions: Set<string>,
  secondaryRegions: Set<string>,
): 'primary' | 'secondary' | null {
  const slugs = part.parent ? [part.slug, part.parent] : [part.slug]
  for (const slug of slugs) if (primaryRegions.has(slug)) return 'primary'
  for (const slug of slugs) if (secondaryRegions.has(slug)) return 'secondary'
  return null
}

// Lit primary fills with the accent; lit secondary with the accent at 45%;
// idle muscles with the neutral surface. Cosmetic parts (head, hair) stay
// neutral so the body reads as a silhouette.
function fillFor(part: MusclePart, level: 'primary' | 'secondary' | null): string {
  if (!part.isMuscle) {
    return part.slug === 'hair'
      ? 'color-mix(in srgb, var(--color-text-secondary) 60%, black)'
      : 'var(--color-text-secondary)'
  }
  if (level === 'primary') return 'var(--color-accent)'
  if (level === 'secondary') return 'color-mix(in srgb, var(--color-accent) 45%, transparent)'
  return 'var(--color-surface)'
}

// Heatmap mode. A region's total set count maps to one of six discrete
// steps (0 to 5). The steps are the --muscle-0 to --muscle-5 tokens.
function volumeStep(sets: number): number {
  if (sets <= 0) return 0
  if (sets < 4) return 1
  if (sets < 7) return 2
  if (sets < 10) return 3
  if (sets < 20) return 4
  return 5
}

// Total volume per SDK region. A region may receive volume from several
// plan.json keys (for example lats, mid_back, and upper_back all map to
// upperBack), so the counts are summed per region.
function regionVolume(
  view: string,
  volume: Record<string, number>,
): Map<string, number> {
  const totals = new Map<string, number>()
  for (const [key, sets] of Object.entries(volume)) {
    const entry = KEY_TO_REGION[key]
    if (!entry || !entry.views.includes(view)) continue
    totals.set(entry.region, (totals.get(entry.region) ?? 0) + sets)
  }
  return totals
}

// A part's volume is read from its own slug, falling back to its parent
// slug (sub-group inheritance), mirroring partLevel.
function partVolume(part: MusclePart, totals: Map<string, number>): number {
  const slugs = part.parent ? [part.slug, part.parent] : [part.slug]
  for (const slug of slugs) {
    const value = totals.get(slug)
    if (value !== undefined) return value
  }
  return 0
}

function heatFillFor(part: MusclePart, totals: Map<string, number>): string {
  if (!part.isMuscle) {
    return part.slug === 'hair'
      ? 'color-mix(in srgb, var(--color-text-secondary) 60%, black)'
      : 'var(--color-text-secondary)'
  }
  const step = volumeStep(partVolume(part, totals))
  return `var(--muscle-${step})`
}

function Figure({
  label,
  data,
  primary,
  secondary,
  volume,
}: {
  label: string
  data: MuscleFigureData
  primary: string[]
  secondary: string[]
  volume?: Record<string, number>
}) {
  const heat = volume !== undefined
  const { primaryRegions, secondaryRegions } = litRegions(data.side, primary, secondary)
  const totals = volume !== undefined ? regionVolume(data.side, volume) : new Map<string, number>()
  const parts = [...data.parts].sort((a, b) => a.order - b.order)
  const viewBox = `${data.viewBox.x} ${data.viewBox.y} ${data.viewBox.width} ${data.viewBox.height}`
  return (
    <div className="muscle-figure">
      <svg className="muscle-svg" viewBox={viewBox} role="img" aria-label={`${label} view`}>
        {parts.map((part) => {
          const fill = heat
            ? heatFillFor(part, totals)
            : fillFor(part, partLevel(part, primaryRegions, secondaryRegions))
          const paths = [...part.common, ...part.left, ...part.right]
          return (
            <g key={part.slug}>
              {paths.map((d, i) => (
                <path
                  key={i}
                  d={d}
                  className="muscle-part"
                  style={{ fill }}
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </g>
          )
        })}
      </svg>
      <span className="muscle-figure-label">{label}</span>
    </div>
  )
}

export function MuscleMap({ primary, secondary, volume }: MuscleMapProps) {
  const body = BODIES[GENDER]
  const heat = volume !== undefined
  const targets = [...primary, ...secondary]
  const label = heat
    ? 'Muscle map, volume by sets'
    : targets.length
      ? `Muscles targeted: ${targets.map((key) => key.replace(/_/g, ' ')).join(', ')}`
      : 'Muscle map'
  return (
    <div className="muscle-map" role="group" aria-label={label}>
      <div className="muscle-figures">
        <Figure label="front" data={body.front} primary={primary} secondary={secondary} volume={volume} />
        <Figure label="back" data={body.back} primary={primary} secondary={secondary} volume={volume} />
      </div>
      {heat ? (
        <div className="muscle-heat-legend">
          <div className="muscle-heat-bar">
            {[0, 1, 2, 3, 4, 5].map((step) => (
              <span
                key={step}
                className="muscle-heat-block"
                style={{ backgroundColor: `var(--muscle-${step})` }}
              />
            ))}
          </div>
          <div className="muscle-heat-ticks">
            <span>0</span>
            <span>10</span>
            <span>20</span>
          </div>
          <div className="muscle-heat-target">
            <span className="muscle-heat-bracket" />
            <span className="muscle-heat-target-label">target range</span>
          </div>
        </div>
      ) : (
        <div className="muscle-legend">
          <span className="muscle-legend-item">
            <span className="muscle-legend-swatch muscle-legend-swatch-primary" />
            primary
          </span>
          <span className="muscle-legend-item">
            <span className="muscle-legend-swatch muscle-legend-swatch-secondary" />
            secondary
          </span>
        </div>
      )}
    </div>
  )
}
