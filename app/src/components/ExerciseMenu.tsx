import { useEffect, useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import './exercise-menu.css'

export interface ExerciseMenuItem {
  label: string
  onSelect: () => void
  disabled?: boolean
}

// A small "more" (three dots) menu. Closes on selection, outside tap or Escape.
export function ExerciseMenu({ name, items }: { name: string; items: ExerciseMenuItem[] }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onDown(e: Event) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className="exmenu" ref={ref}>
      <button
        type="button"
        className="exmenu-button"
        aria-label={`More actions for ${name}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <Ellipsis size={18} strokeWidth={1.75} aria-hidden="true" />
      </button>
      {open && (
        <div className="exmenu-list" role="menu">
          {items.map((it) => (
            <button
              key={it.label}
              type="button"
              role="menuitem"
              className="exmenu-item"
              disabled={it.disabled}
              onClick={() => {
                setOpen(false)
                it.onSelect()
              }}
            >
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
