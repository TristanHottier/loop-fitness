import './toggle.css'

interface Props {
  checked: boolean
  onChange: (next: boolean) => void
  label: string
  disabled?: boolean
}

// Accessible switch: role=switch, aria-checked. The visible text lives in the
// row; `label` is the accessible name.
export function Toggle({ checked, onChange, label, disabled }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      className={'toggle' + (checked ? ' toggle-on' : '')}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" aria-hidden="true" />
    </button>
  )
}
