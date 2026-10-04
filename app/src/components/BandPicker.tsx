import './band-picker.css'

interface BandPickerProps {
  open: boolean
  tube: string[]
  loop: string[]
  current: string
  lastUsed: string | null
  onPick: (band: string) => void
  onClose: () => void
}

export function BandPicker({ open, tube, loop, current, lastUsed, onPick, onClose }: BandPickerProps) {
  if (!open) {
    return null
  }

  function handlePick(band: string) {
    onPick(band)
    onClose()
  }

  function renderGroup(label: string, bands: string[], kind: 'tube' | 'loop') {
    return (
      <div className="band-picker-group">
        <h3 className="band-picker-group-label">{label}</h3>
        <div className="band-picker-steps">
          {bands.map((band) => {
            const isCurrent = band === current
            const isLastUsed = band === lastUsed
            const className = [
              'band-picker-step',
              `band-picker-step-${kind}`,
              isCurrent ? 'is-current' : null,
              isLastUsed ? 'is-last-used' : null,
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
                <span className="band-picker-step-text">{band}</span>
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
        {renderGroup('Tube', tube, 'tube')}
        {renderGroup('Loop', loop, 'loop')}
      </div>
    </div>
  )
}
