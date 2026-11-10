import { useEffect, useState } from 'react'
import { loadPlan } from '../data/plan'
import { CONFIG_KEYS, getBandInventory, saveBandInventory } from '../db/config'
import { db, getSetting } from '../db/db'
import { defaultBandInventory, type BandItem, type LadderName } from '../lib/ladder'
import { Toggle } from './Toggle'
import './first-run-bands.css'

const GROUPS: { ladder: LadderName; title: string }[] = [
  { ladder: 'tube', title: 'Tube bands' },
  { ladder: 'loop', title: 'Loop bands' },
]

// Self-managing first-run sheet. Shows only when no band inventory has been
// saved and no session has been completed. Done or Skip saves an inventory,
// which also stops it from showing again.
export function FirstRunBands() {
  const [items, setItems] = useState<BandItem[] | null>(null)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        if ((await getSetting(CONFIG_KEYS.bandInventory)) !== null) return
        const done = await db.sessions.filter((s) => !s.deleted && s.ended_at !== null).count()
        if (done > 0) return
        const inv = await getBandInventory()
        if (!cancelled) {
          setItems(inv)
          setOpen(true)
        }
      } catch {
        /* never block the app */
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  if (!open || !items) return null

  async function close(save: BandItem[]) {
    setOpen(false)
    try {
      await saveBandInventory(save)
    } catch {
      /* ignore */
    }
  }

  async function skip() {
    await close(defaultBandInventory(await loadPlan()))
  }

  function set(id: string, owned: boolean) {
    setItems((cur) => cur && cur.map((i) => (i.id === id ? { ...i, owned } : i)))
  }

  return (
    <div className="first-run-overlay">
      <div className="first-run-sheet" role="dialog" aria-modal="true" aria-labelledby="first-run-title">
        <h2 id="first-run-title" className="first-run-title">
          Which bands do you own?
        </h2>
        <p className="first-run-note">Bands you turn off are left out of the ladder. You can change this in Settings.</p>
        {GROUPS.map((g) => (
          <div key={g.ladder} className="first-run-group">
            <h3 className="first-run-group-title">{g.title}</h3>
            {items
              .filter((i) => i.ladder === g.ladder)
              .map((i) => (
                <div key={i.id} className="first-run-row">
                  <span>{i.label}</span>
                  <Toggle checked={i.owned} onChange={(v) => set(i.id, v)} label={`${i.label} owned`} />
                </div>
              ))}
          </div>
        ))}
        <div className="first-run-actions">
          <button type="button" className="first-run-skip" onClick={() => void skip()}>
            Skip
          </button>
          <button type="button" className="first-run-done" onClick={() => void close(items)}>
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
