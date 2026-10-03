import { useEffect, useState } from 'react'
import { getStoredTheme, setTheme, type Theme } from '../theme'
import {
  getToken,
  authenticate,
  syncNow,
  pendingCount,
  type SyncStatus,
} from '../sync/sync'
import './settings.css'

export function Settings() {
  const [theme, setThemeState] = useState<Theme>(getStoredTheme())
  const [passphrase, setPassphrase] = useState('')
  const [connected, setConnected] = useState<boolean>(getToken() !== null)
  const [status, setStatus] = useState<SyncStatus>({ state: 'idle' })
  const [pending, setPending] = useState(0)

  useEffect(() => {
    let cancelled = false
    pendingCount().then((n) => {
      if (!cancelled) setPending(n)
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
      <p className="screen-subtitle">Theme, sync and data.</p>

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
          <p className={`settings-status ${status.state === 'error' ? 'settings-status-error' : ''}`}>
            {statusText()}
            {pending > 0 ? `, ${pending} pending` : ''}
          </p>
          <p className="settings-note">
            Changes are saved on this device and sync when connected.
          </p>
        </div>
      </section>
    </div>
  )
}
