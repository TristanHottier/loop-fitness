import { useEffect, useState } from 'react'
import { getStoredTheme, setTheme, type Theme } from '../theme'
import {
  getToken,
  authenticate,
  syncNow,
  pendingCount,
  type SyncStatus,
} from '../sync/sync'
import {
  enablePush,
  disablePush,
  saveReminderSettings,
  loadReminderSettings,
} from '../push/push'
import { exportToCsv } from '../lib/export'
import { resetSessionHistory } from '../db/db'
import './settings.css'

export function Settings() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme())
  const [passphrase, setPassphrase] = useState('')
  const [connected, setConnected] = useState<boolean>(getToken() !== null)
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' })
  const [pending, setPending] = useState(0)

  const [weighInEnabled, setWeighInEnabled] = useState(false)
  const [weighInTime, setWeighInTime] = useState('08:00')
  const [reminderNote, setReminderNote] = useState('')

  const [resetConfirmOpen, setResetConfirmOpen] = useState(false)
  const [resetBusy, setResetBusy] = useState(false)
  const [resetNote, setResetNote] = useState('')

  useEffect(() => {
    let cancelled = false
    pendingCount().then((n) => {
      if (!cancelled) setPending(n)
    })
    loadReminderSettings().then((s) => {
      if (cancelled) return
      setWeighInEnabled(s.enabled)
      setWeighInTime(s.time)
    })
    return () => {
      cancelled = true
    }
  }, [status])

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    setThemeState(next)
  }

  async function connect() {
    if (passphrase.trim() === '') return
    const ok = await authenticate(passphrase)
    setConnected(ok)
    if (ok) {
      setPassphrase('')
      setStatus({ state: 'idle' })
    } else {
      setStatus({ state: 'error', message: 'Invalid passphrase' })
    }
  }

  async function doSync() {
    setStatus({ state: 'syncing' })
    const result = await syncNow()
    setStatus(result)
    setPending(await pendingCount())
  }

  async function toggleWeighIn() {
    const next = !weighInEnabled
    setWeighInEnabled(next)
    setReminderNote('')
    if (next) {
      let result
      try {
        result = await enablePush()
      } catch {
        setWeighInEnabled(false)
        setReminderNote('Could not register for reminders. Check your connection and sign-in, then try again.')
        return
      }
      if (result.status === 'denied') {
        setWeighInEnabled(false)
        setReminderNote('Notification permission was denied. Allow notifications in the browser.')
        return
      }
      if (result.status === 'unsupported') {
        setWeighInEnabled(false)
        setReminderNote('Push notifications are not supported in this browser.')
        return
      }
    } else {
      try {
        await disablePush()
      } catch {
        setReminderNote('Could not unregister this device on the server; reminders may still arrive.')
      }
    }
    await saveReminderSettings(next, weighInTime)
  }

  async function changeWeighInTime(time: string) {
    setWeighInTime(time)
    if (weighInEnabled) {
      await saveReminderSettings(true, time)
    }
  }

  async function confirmReset() {
    setResetBusy(true)
    setResetNote('')
    try {
      await resetSessionHistory()
      let syncFailed = false
      if (getToken() !== null) {
        const result = await syncNow()
        setStatus(result)
        setPending(await pendingCount())
        syncFailed = result.state === 'error'
      }
      setResetNote(
        syncFailed
          ? 'Session history reset on this device. Sync failed; it will retry automatically.'
          : 'Session history reset.'
      )
      setResetConfirmOpen(false)
    } catch {
      setResetNote('Reset failed. Try again.')
    } finally {
      setResetBusy(false)
    }
  }

  function statusText(): string {
    switch (status.state) {
      case 'not-configured':
        return 'Sync is not configured on this build.'
      case 'syncing':
        return 'Syncing'
      case 'synced':
        return `Synced at ${new Date(status.at).toLocaleTimeString()}`
      case 'error':
        return status.message
      case 'idle':
        return connected ? 'Ready' : 'Not connected'
    }
  }

  return (
    <div className="screen settings">
      <h1>Settings</h1>

      <section className="settings-section">
        <h2 className="settings-section-title">Appearance</h2>
        <div className="settings-row">
          <span className="settings-label">Theme</span>
          <button type="button" className="settings-theme-toggle" onClick={toggleTheme}>
            {theme === 'dark' ? 'Light' : 'Dark'}
          </button>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Reminders</h2>
        <div className="settings-sync-card">
          <div className="settings-row">
            <span className="settings-label">Weigh-in reminder</span>
            <button
              type="button"
              className={
                'settings-theme-toggle ' + (weighInEnabled ? 'settings-toggle-on' : '')
              }
              onClick={toggleWeighIn}
            >
              {weighInEnabled ? 'On' : 'Off'}
            </button>
          </div>
          <div className="settings-row">
            <label className="settings-label" htmlFor="weighin-time">
              Time
            </label>
            <input
              id="weighin-time"
              className="settings-time-input"
              type="time"
              value={weighInTime}
              onChange={(e) => changeWeighInTime(e.target.value)}
            />
          </div>
          {reminderNote && <p className="settings-note settings-status-error">{reminderNote}</p>}
          <p className="settings-note">
            Sent as a push notification. The app must be installed and online.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Sync</h2>
        <div className="settings-sync-card">
          <input
            className="settings-passphrase"
            type="password"
            placeholder="Passphrase"
            value={passphrase}
            onChange={(e) => setPassphrase(e.target.value)}
          />
          <div className="settings-sync-actions">
            <button type="button" className="settings-connect" onClick={connect}>
              Connect
            </button>
            <button
              type="button"
              className="settings-sync-now"
              onClick={doSync}
              disabled={!connected || status.state === 'syncing'}
            >
              Sync now
            </button>
          </div>
          <button type="button" className="settings-export" onClick={() => { void exportToCsv() }}>
            Export CSV
          </button>
          <p className={`settings-status ${status.state === 'error' ? 'settings-status-error' : ''}`}>
            {statusText()}
            {pending > 0 ? `, ${pending} pending` : ''}
          </p>
          <p className="settings-note">
            Changes are saved on this device and sync when connected.
          </p>
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Data</h2>
        <div className="settings-sync-card">
          <button
            type="button"
            className="settings-reset"
            onClick={() => {
              setResetNote('')
              setResetConfirmOpen(true)
            }}
            disabled={resetBusy}
          >
            Reset session history
          </button>
          {resetConfirmOpen && (
            <div className="settings-reset-confirm">
              <p className="settings-reset-note">
                This deletes all past sessions and their sets. This cannot be undone.
              </p>
              <div className="settings-sync-actions">
                <button
                  type="button"
                  className="settings-sync-now"
                  onClick={confirmReset}
                  disabled={resetBusy}
                >
                  Confirm reset
                </button>
                <button
                  type="button"
                  className="settings-connect"
                  onClick={() => setResetConfirmOpen(false)}
                  disabled={resetBusy}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
          {resetNote && (
            <p
              className={`settings-status ${resetNote === 'Session history reset.' ? '' : 'settings-status-error'}`}
            >
              {resetNote}
            </p>
          )}
        </div>
      </section>

      <section className="settings-section">
        <h2 className="settings-section-title">Credits</h2>
        <p className="settings-note">Body artwork from MuscleMap by Melih Colpan, MIT license.</p>
      </section>
    </div>
  )
}
