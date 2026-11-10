import { useEffect, useRef, useState } from 'react'
import { formatClock } from '../lib/format'
import './rest-timer.css'

interface RestTimerProps {
  seconds: number
  label: string
  onDone: () => void
  // Saves the current rest length (seconds) as the exercise's default.
  onSaveDefault?: (seconds: number) => void | Promise<void>
}

const RING_RADIUS = 32
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

export function RestTimer({ seconds, label, onDone, onSaveDefault }: RestTimerProps) {
  const [remaining, setRemaining] = useState(seconds)
  // Length of this rest including adjustments, for the ring and for saving.
  const [total, setTotal] = useState(seconds)
  const [saved, setSaved] = useState<'idle' | 'saving' | 'saved' | 'failed'>('idle')
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
    chime()
    vibrate()
    onDoneRef.current()
  }

  function adjust(deltaSeconds: number) {
    if (doneRef.current) return
    endTimeRef.current = Math.max(Date.now(), endTimeRef.current + deltaSeconds * 1000)
    setRemaining(Math.max(0, Math.ceil((endTimeRef.current - Date.now()) / 1000)))
    setTotal((t) => Math.max(15, t + deltaSeconds))
    setSaved('idle')
  }

  async function saveDefault() {
    if (!onSaveDefault || saved === 'saving') return
    setSaved('saving')
    try {
      await onSaveDefault(total)
      setSaved('saved')
    } catch {
      setSaved('failed')
    }
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
    <div className="rest-timer" role="timer" aria-live="polite">
      <div className="rest-timer-ring">
        <svg
          className="rest-timer-ring-svg"
          viewBox="0 0 72 72"
          aria-hidden="true"
        >
          <circle
            className="rest-timer-ring-track"
            cx="36"
            cy="36"
            r={RING_RADIUS}
            fill="none"
          />
          <circle
            className="rest-timer-ring-arc"
            cx="36"
            cy="36"
            r={RING_RADIUS}
            fill="none"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            transform="rotate(-90 36 36)"
          />
        </svg>
        <span className="rest-timer-count">{formatClock(remaining)}</span>
      </div>
      <div className="rest-timer-body">
        <span className="rest-timer-label">{label}</span>
        <div className="rest-timer-controls">
          <button type="button" className="rest-timer-btn" aria-label="Shorten rest by 15 seconds" onClick={() => adjust(-15)}>
            -15s
          </button>
          <button type="button" className="rest-timer-btn" aria-label="Lengthen rest by 15 seconds" onClick={() => adjust(15)}>
            +15s
          </button>
          <button type="button" className="rest-timer-btn rest-timer-btn-skip" aria-label="Skip rest" onClick={skip}>
            Skip
          </button>
        </div>
        {onSaveDefault && (
          <button
            type="button"
            className="rest-timer-link"
            onClick={saveDefault}
            disabled={saved === 'saving' || saved === 'saved'}
          >
            {saved === 'saved'
              ? `Saved ${formatClock(total)} as default`
              : saved === 'failed'
                ? 'Could not save. Try again'
                : 'Use as default for this exercise'}
          </button>
        )}
        <p className="rest-timer-note">The timer cannot ring while the screen is locked.</p>
      </div>
    </div>
  )
}
