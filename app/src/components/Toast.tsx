import { useEffect, useRef } from 'react'
import './toast.css'

// A calm, short-lived message at the bottom of the screen. Re-keying (a new
// `id`) restarts the timer. `aboveTimer` lifts it over the rest timer bar.
export function Toast({
  id,
  message,
  onClose,
  durationMs = 2500,
  aboveTimer = false,
}: {
  id: number
  message: string
  onClose: () => void
  durationMs?: number
  aboveTimer?: boolean
}) {
  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const t = window.setTimeout(() => closeRef.current(), durationMs)
    return () => window.clearTimeout(t)
  }, [id, durationMs])
  return (
    <div
      className={'toast' + (aboveTimer ? ' toast-above-timer' : '')}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
