import { useId, useRef, useState } from 'react'
import './collapsible.css'

const PREFIX = 'lf.collapsible.'

function readStored(id: string): boolean | null {
  try {
    const v = window.localStorage.getItem(PREFIX + id)
    return v === '1' ? true : v === '0' ? false : null
  } catch {
    return null
  }
}

function writeStored(id: string, open: boolean) {
  try {
    window.localStorage.setItem(PREFIX + id, open ? '1' : '0')
  } catch {
    // Storage unavailable; the section still toggles for this visit.
  }
}

// Notion-style toggle: the whole header is a button (chevron, title, optional
// summary on the right) and the content sits below. The open state is kept per
// `id` in localStorage. Content mounts on first open and then stays mounted,
// so charts and inputs keep their state while the section is closed.
export function Collapsible({
  id,
  title,
  summary,
  defaultOpen = false,
  children,
}: {
  id: string
  title: string
  summary?: React.ReactNode
  defaultOpen?: boolean
  children: React.ReactNode
}) {
  const uid = useId()
  const headId = `${uid}-head`
  const bodyId = `${uid}-body`
  const [open, setOpen] = useState<boolean>(() => readStored(id) ?? defaultOpen)
  const mounted = useRef(open)
  if (open) mounted.current = true

  function toggle() {
    const next = !open
    setOpen(next)
    writeStored(id, next)
  }

  return (
    <section className={`collapsible${open ? ' is-open' : ''}`}>
      <button
        type="button"
        id={headId}
        className="collapsible-head"
        aria-expanded={open}
        aria-controls={bodyId}
        onClick={toggle}
      >
        <svg className="collapsible-chevron" width="16" height="16" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M6 3.5 10.5 8 6 12.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <span className="section-head collapsible-title">{title}</span>
        {summary !== undefined && summary !== null && summary !== '' ? (
          <span className="collapsible-summary">{summary}</span>
        ) : null}
      </button>
      <div id={bodyId} role="region" aria-labelledby={headId} className="collapsible-body" hidden={!open}>
        {mounted.current ? children : null}
      </div>
    </section>
  )
}
