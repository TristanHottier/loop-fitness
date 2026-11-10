import { useEffect, useRef, useState } from 'react'
import { formatClock } from '../lib/format'
import './rest-timer.css'

interface RestTimerProps {
  seconds: number
  label: string
  onDone: () => void
  // Reports the current rest length (seconds) whenever it is adjusted.
  onTotalChange?: (seconds: number) => void
}

const NOTE_FLAG = 'loopfit.restNoteDismissed'

function noteDismissed(): boolean {
  try {
    return window.localStorage.getItem(NOTE_FLAG) === '1'
  } catch {
    return false
  }
}

function storeNoteDismissed() {
  try {
    window.localStorage.setItem(NOTE_FLAG, '1')
  } catch {
    // Storage unavailable; the note may show again.
  }
}

const RING_RADIUS = 15
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function RestTimer({ seconds, label, onDone, onTotalChange }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  // Length of this rest including adjustments, for the ring and for saving.
  const [total, setTotal] = useState(seconds)
  const [showNote, setShowNote] = useState(() => !noteDismissed())
  const onTotalChangeRef = useRef(onTotalChange)
  onTotalChangeRef.current = onTotalChange
  const endTimeRef = useRef(Date.now() + seconds * 1000)
  const doneRef = useRef(false)
  const audioRef = useRef<AudioContext | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

  function chime() {
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
      if (!Ctor) return
      if (!audioRef.current) {
        audioRef.current = new Ctor()
      }
      const ctx = audioRef.current
      if (ctx.state === 'suspended') {
        void ctx.resume()
      }
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = 880
      osc.connect(gain)
      gain.connect(ctx.destination)
      const now = ctx.currentTime
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.linearRampToValueAtTime(0.3, now + 0.02)
      gain.gain.linearRampToValueAtTime(0.0001, now + 0.5)
      osc.start(now)
      osc.stop(now + 0.5)
    } catch {
      // AudioContext unavailable; ignore.
    }
  }

  function vibrate() {
    if (typeof navigator.vibrate === 'function') {
      navigator.vibrate([200, 100, 200])
    }
  }

  function finish() {
    if (doneRef.current) return
    doneRef.current = true
    storeNoteDismissed()
    chime()
    vibrate()
    onDoneRef.current()
  }

  function adjust(deltaSeconds: number) {
    if (doneRef.current) return
    endTimeRef.current = Math.max(Date.now(), endTimeRef.current + deltaSeconds * 1000)
    setRemaining(Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000)))
    const next = Math.max(15, total + deltaSeconds)
    setTotal(next)
    onTotalChangeRef.current?.(next)
  }

  function dismissNote() {
    storeNoteDismissed()
    setShowNote(false)
  }

  function skip() {
    if (doneRef.current) return
    endTimeRef.current = Date.now()
    setRemaining(0)
    finish()
  }

  useEffect(() => {
    let sentinel: { release(): Promise<void> } | null = null

    async function requestWakeLock() {
      const wakeLock = (
        navigator as unknown as {
          wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> }
        }
      ).wakeLock
      if (!wakeLock) return
      try {
        sentinel = await wakeLock.request('screen')
      } catch {
        // Wake Lock unavailable; ignore.
      }
    }

    void requestWakeLock()

    function onVisibilityChange() {
      if (document.visibilityState === 'visible') {
        void requestWakeLock()
        const rem = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
        setRemaining(rem)
        if (rem <= 0) finish()
      }
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
      if (sentinel) {
        void sentinel.release()
      }
      if (audioRef.current) {
        void audioRef.current.close()
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const id = window.setInterval(() => {
      const rem = Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000))
      setRemaining(rem)
      if (rem <= 0) finish()
    }, 250)
    return () => {
      window.clearInterval(id)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const fraction = total > 0 ? Math.min(1, remaining / total) : 0
  const dashOffset = RING_CIRCUMFERENCE * (1 - fraction)

  return (
    <div className="rest-timer" role="timer" aria-label={`Rest, ${label}`}>
      {showNote && (
        <div className="rest-timer-note">
          <span>The timer cannot ring while the screen is locked.</span>
          <button type="button" className="rest-timer-note-close" onClick={dismissNote}>
            Got it
          </button>
        </div>
      )}
      <svg className="rest-timer-ring-svg" viewBox="0 0 36 36" aria-hidden="true">
        <circle className="rest-timer-ring-track" cx="18" cy="18" r={RING_RADIUS} fill="none" />
        <circle
          className="rest-timer-ring-arc"
          cx="18"
          cy="18"
          r={RING_RADIUS}
          fill="none"
          strokeDasharray={RING_CIRCUMFERENCE}
          strokeDashoffset={dashOffset}
          transform="rotate(-90 18 18)"
        />
      </svg>
      <div className="rest-timer-main">
        <span className="rest-timer-count" aria-live="off">
          {formatClock(remaining)}
        </span>
        <span className="rest-timer-label">{label}</span>
      </div>
      <div className="rest-timer-controls">
        <button type="button" className="rest-timer-btn" aria-label="Shorten rest by 15 seconds" onClick={() => adjust(-15)}>
          -15
        </button>
        <button type="button" className="rest-timer-btn" aria-label="Lengthen rest by 15 seconds" onClick={() => adjust(15)}>
          +15
        </button>
        <button type="button" className="rest-timer-btn rest-timer-btn-skip" aria-label="Skip rest" onClick={skip}>
          Skip
        </button>
      </div>
    </div>
  )
}
