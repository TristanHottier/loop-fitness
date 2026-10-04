import './muscle-map.css'
import maleFront from '../assets/musclemap/male-front.json'
import maleBack from '../assets/musclemap/male-back.json'
import femaleFront from '../assets/musclemap/female-front.json'
import femaleBack from '../assets/musclemap/female-back.json'

export interface MuscleMapProps {
  primary: string[]
  secondary: string[]
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

function Figure({
  label,
  data,
  primary,
  secondary,
}: {
  label: string
  data: MuscleFigureData
  primary: string[]
  secondary: string[]
}) {
  const { primaryRegions, secondaryRegions } = litRegions(data.side, primary, secondary)
  const parts = [...data.parts].sort((a, b) => a.order - b.order)
  const viewBox = `${data.viewBox.x} ${data.viewBox.y} ${data.viewBox.width} ${data.viewBox.height}`
  return (
    <div className="muscle-figure">
      <svg className="muscle-svg" viewBox={viewBox} role="img" aria-label={`${label} view`}>
        {parts.map((part) => {
          const level = partLevel(part, primaryRegions, secondaryRegions)
          const fill = fillFor(part, level)
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

export function MuscleMap({ primary, secondary }: MuscleMapProps) {
  const body = BODIES[GENDER]
  const targets = [...primary, ...secondary]
  const label = targets.length
    ? `Muscles targeted: ${targets.map((key) => key.replace(/_/g, ' ')).join(', ')}`
    : 'Muscle map'
  return (
    <div className="muscle-map" role="group" aria-label={label}>
      <div className="muscle-figures">
        <Figure label="front" data={body.front} primary={primary} secondary={secondary} />
        <Figure label="back" data={body.back} primary={primary} secondary={secondary} />
      </div>
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
    </div>
  )
}
