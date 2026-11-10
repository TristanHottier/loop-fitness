import { useEffect, useState } from 'react'
import { db, getSessions, type Session, type SetLog } from '../db/db'
import { getBandInventory } from '../db/config'
import { loadPlan, type PlanData } from '../data/plan'
import type { BandItem } from '../lib/ladder'

export interface TrainingData {
  plan: PlanData
  sessions: Session[] // not deleted, newest first
  logs: SetLog[] // not deleted
  inventory: BandItem[]
}

// Loads everything the analytics need. `deps` re-triggers the load. Returns
// null while loading (or if the plan cannot be loaded).
export function useTrainingData(deps: unknown[] = []): TrainingData | null {
  const [data, setData] = useState<TrainingData | null>(null)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const [plan, sessions, logs, inventory] = await Promise.all([
        loadPlan(),
        getSessions(),
        db.set_logs.filter((l) => !l.deleted).toArray(),
        getBandInventory(),
      ])
      if (!cancelled) setData({ plan, sessions, logs, inventory })
    })().catch(() => {})
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  return data
}
