import { useEffect, useState } from 'react'
import { loadPlan } from '../data/plan'
import { getBandInventory } from '../db/config'
import { buildLadder, type LadderName } from '../lib/ladder'
import './band-picker.css'

interface PickerStep {
  id: string
  label: string // display, e.g. "30 + 40"
  stack: boolean
  kg: number | null
}

const display = (label: string) => label.split('+').join(' + ')

function fromIds(ids: string[]): PickerStep[] {
  return ids.map((id) => ({ id, label: display(id), stack: id.includes('+'), kg: null }))
}

interface BandPickerProps {
  open: boolean
  tube: string[]
  loop: string[]
  current: string
  lastUsed: string | null
  onPick: (band: string) => void
  onClose: () => void
}

const formatKg = (kg: number) => String(Math.round(kg * 10) / 10)

export function BandPicker({ open, tube, loop, current, lastUsed, onPick, onClose }: BandPickerProps) {
  // The owned, inventory-aware ladder. Until it loads (or if it fails) the
  // plain lists from the props are shown.
  const [owned, setOwned] = useState<Record<LadderName, PickerStep[]> | null>(null)
  useEffect(() => {
    if (!open) return
    let cancelled = false
    Promise.all([loadPlan(), getBandInventory()])
      .then(([plan, inventory]) => {
        if (cancelled) return
        const ladder = buildLadder(plan, inventory)
        const conv = (name: LadderName): PickerStep[] =>
          ladder[name].map((st) => ({
            id: st.id,
            label: display(st.label),
            stack: st.bands.length > 1,
            kg: st.resistanceKg,
          }))
        setOwned({ tube: conv('tube'), loop: conv('loop') })
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [open])

  if (!open) {
    return null
  }

  function handlePick(band: string) {
    onPick(band)
    onClose()
  }

  function renderGroup(label: string, listed: PickerStep[], kind: 'tube' | 'loop') {
    // Keep the current and last used bands visible even when no longer owned.
    const bands = [...listed]
    const prefix = kind === 'tube' ? 'T' : 'L'
    for (const extra of [current, lastUsed]) {
      if (extra && extra.startsWith(prefix) && !bands.some((b) => b.id === extra)) {
        bands.push(...fromIds([extra]))
      }
    }
    return (
      <div className="band-picker-group">
        <h3 className="band-picker-group-label">{label}</h3>
        <div className="band-picker-steps">
          {bands.map((step) => {
            const band = step.id
            const isCurrent = band === current
            const isLastUsed = band === lastUsed
            const className = [
              'band-picker-step',
              `band-picker-step-${kind}`,
              isCurrent ? 'is-current' : null,
              isLastUsed ? 'is-last-used' : null,
              step.stack ? 'is-stack' : null,
            ]
              .filter((part): part is string => part !== null)
              .join(' ')
            return (
              <button
                key={band}
                type="button"
                className={className}
                aria-pressed={isCurrent}
                onClick={() => handlePick(band)}
              >
                <span className="band-picker-step-text">{step.label}</span>
                {step.stack && <span className="band-picker-stack-tag">stack</span>}
                {step.kg !== null && <span className="band-picker-kg">{formatKg(step.kg)} kg</span>}
                {isLastUsed && <span className="band-picker-sr-only">last used</span>}
              </button>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="band-picker-overlay" onClick={onClose}>
      <div
        className="band-picker-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Pick a band"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="band-picker-title">Pick a band</h2>
        {renderGroup('Tube', owned?.tube ?? fromIds(tube), 'tube')}
        {renderGroup('Loop', owned?.loop ?? fromIds(loop), 'loop')}
      </div>
    </div>
  )
}
