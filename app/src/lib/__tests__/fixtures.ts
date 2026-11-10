import planJson from '../../../public/plan.json'
import type { PlanData } from '../../data/plan'
import type { SetLog } from '../../db/db'

export const plan = planJson as unknown as PlanData

let n = 0
export function log(over: Partial<SetLog> = {}): SetLog {
  n += 1
  return {
    id: `l${n}`,
    session_id: 's1',
    exercise_slug: 'pull-down',
    set_index: 0,
    side: null,
    reps: 10,
    band: 'T40',
    note: null,
    rir: null,
    set_type: 'normal',
    updated_at: '2026-01-01T00:00:00.000Z',
    deleted: false,
    ...over,
  }
}
