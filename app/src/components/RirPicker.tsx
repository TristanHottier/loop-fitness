import './rir-picker.css'

const OPTIONS = [
  { value: 0, text: '0', spoken: '0' },
  { value: 1, text: '1', spoken: '1' },
  { value: 2, text: '2', spoken: '2' },
  { value: 3, text: '3+', spoken: '3 or more' },
]

// Compact reps-in-reserve picker. One tap sets the value; tapping the chosen
// value again clears it (RIR is optional).
export function RirPicker({
  value,
  onChange,
  name,
}: {
  value: number | null
  onChange: (value: number | null) => void
  name?: string
}) {
  return (
    <div
      className="rir"
      role="radiogroup"
      aria-label={name ? `Reps in reserve, ${name}` : 'Reps in reserve'}
    >
      <span className="rir-caption" aria-hidden="true">
        RIR
      </span>
      {OPTIONS.map((o) => (
        <button
          key={o.value}
          type="button"
          role="radio"
          aria-checked={value === o.value}
          aria-label={`Reps in reserve: ${o.spoken}`}
          className={'rir-option' + (value === o.value ? ' rir-option-on' : '')}
          onClick={() => onChange(value === o.value ? null : o.value)}
        >
          {o.text}
        </button>
      ))}
    </div>
  )
}
