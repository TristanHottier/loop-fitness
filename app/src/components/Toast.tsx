import { useEffect, useRef } from 'react'
import './toast.css'

// A calm, short-lived message. Re-keying (a new `id`) restarts the timer.
export function Toast({
  id,
  message,
  onClose,
  durationMs = 3000,
}: {
  id: number
  message: string
  onClose: () => void
  durationMs?: number
}) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const t = window.setTimeout(() => closeRef.current(), durationMs)
    return () => window.clearTimeout(t)
  }, [id, durationMs])
  return (
    <div className="toast" role="status" aria-live="polite">
      {message}
    </div>
  )
}
