import { useEffect, useState } from 'react'
import { loadPlan } from '../data/plan'
import { getBandInventory, saveBandInventory } from '../db/config'
import { defaultBandInventory, type BandItem, type LadderName } from '../lib/ladder'
import './band-inventory.css'

const GROUPS: { ladder: LadderName; title: string }[] = [
  { ladder: 'tube', title: 'Tube bands' },
  { ladder: 'loop', title: 'Loop bands' },
]

export function BandInventory() {
  const [items, setItems] = useState<BandItem[] | null>(null)
  const [drafts, setDrafts] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    Promise.all([loadPlan(), getBandInventory()])
      .then(([plan, saved]) => {
        if (cancelled) return
        // Saved items win; any single band of the plan that is missing is added.
        const byId = new Map(saved.map((i) => [i.id, i]))
        const merged = defaultBandInventory(plan).map((d) => byId.get(d.id) ?? d)
        setItems(merged)
        setDrafts(Object.fromEntries(merged.map((i) => [i.id, i.resistanceKg === null ? '' : String(i.resistanceKg)])))
      })
      .catch(() => {
        if (!cancelled) setError('Could not load your bands.')
      })
    return () => {
      cancelled = true
    }
  }, [])

  async function persist(next: BandItem[]) {
    setItems(next)
    setError('')
    try {
      await saveBandInventory(next)
    } catch {
      setError('Could not save. Try again.')
    }
  }

  function toggleOwned(id: string) {
    if (!items) return
    void persist(items.map((i) => (i.id === id ? { ...i, owned: !i.owned } : i)))
  }

  function commitKg(id: string) {
    if (!items) return
    const raw = (drafts[id] ?? '').trim().replace(',', '.')
    const current = items.find((i) => i.id === id)
    if (!current) return
    if (raw === '') {
      if (current.resistanceKg !== null) void persist(items.map((i) => (i.id === id ? { ...i, resistanceKg: null } : i)))
      return
    }
    const n = Number(raw)
    if (!Number.isFinite(n) || n <= 0) {
      setDrafts({ ...drafts, [id]: current.resistanceKg === null ? '' : String(current.resistanceKg) })
      setError('Resistance must be a number above 0.')
      return
    }
    const kg = Math.round(n * 10) / 10
    setDrafts({ ...drafts, [id]: String(kg) })
    if (kg !== current.resistanceKg) void persist(items.map((i) => (i.id === id ? { ...i, resistanceKg: kg } : i)))
    else setError('')
  }

  if (!items) {
    return <p className="settings-note">{error || 'Loading bands'}</p>
  }

  return (
    <div className="settings-sync-card band-inventory">
      <p className="settings-note">
        Turn off bands you do not own so they are left out of the ladder. Measured resistance is optional. Enter it
        in kg to enable strength scores and to build stacks from your own bands.
      </p>
      {GROUPS.map((g) => (
        <div key={g.ladder} className="band-inventory-group">
          <h3 className="band-inventory-title">{g.title}</h3>
          {items
            .filter((i) => i.ladder === g.ladder)
            .map((i) => (
              <div key={i.id} className="settings-row band-inventory-row">
                <span className={'settings-label' + (i.owned ? '' : ' band-inventory-off')}>{i.label}</span>
                <div className="band-inventory-controls">
                  <input
                    className="settings-time-input band-inventory-kg"
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.5"
                    placeholder="kg"
                    aria-label={`Measured resistance of ${i.label} in kg`}
                    value={drafts[i.id] ?? ''}
                    disabled={!i.owned}
                    onChange={(e) => setDrafts({ ...drafts, [i.id]: e.target.value })}
                    onBlur={() => commitKg(i.id)}
                  />
                  <button
                    type="button"
                    className={'settings-theme-toggle ' + (i.owned ? 'settings-toggle-on' : '')}
                    aria-pressed={i.owned}
                    aria-label={`${i.label} owned`}
                    onClick={() => toggleOwned(i.id)}
                  >
                    {i.owned ? 'Owned' : 'Not owned'}
                  </button>
                </div>
              </div>
            ))}
        </div>
      ))}
      {error && <p className="settings-note settings-status-error">{error}</p>}
    </div>
  )
}
