// "What I used last time" for an exercise: the sets of recent sessions in a
// compact one-line form. Pure (no React, no Dexie).
//
//   "12, 12, 10 @ 40"            planned sets, runs of the same band joined
//   "Warm-up 10 @ 20; 12, 10 @ 40; Drop 8 @ 30"
//   "12L/12R, 10L/10R @ 30 + 40" unilateral sets, one L/R pair per set

import type { Session, SetLog } from '../db/db'
import { parseDayKey } from './dates'
import { formatBand, kindOf, orderOf, type RowKind } from './setRows'
import { normalizeSetType } from './setlog'

export interface LastUsed {
  sessionId: string
  date: string // YYYY-MM-DD
  dayLabel: string // "Mon 3 Nov"
  shortDate: string // "3 Nov"
  text: string // sets, e.g. "12, 12, 10 @ 40"
  rir: string | null // "RIR 2" or "RIR 2, 1, 1" (counting sets only), null when not logged
}

const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function shortDate(date: string): string {
  const d = parseDayKey(date)
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

export function dayLabel(date: string): string {
  const d = parseDayKey(date)
  return `${WEEKDAYS[d.getDay()]} ${d.getDate()} ${MONTHS[d.getMonth()]}`
}

function kindOfLog(l: SetLog): RowKind {
  if (normalizeSetType(l.set_type) === 'warmup') return 'warmup'
  const k = kindOf(l.set_index)
  if (k !== 'planned') return k
  return normalizeSetType(l.set_type) === 'drop' ? 'drop' : 'planned'
}

interface Unit {
  kind: RowKind
  band: string
  rep: string
  rir: number | null
}

// One display unit per set index; L and R logs of the same set are one unit.
function unitsOf(logs: SetLog[]): Unit[] {
  const sorted = [...logs].sort(
    (a, b) => orderOf(a.set_index) - orderOf(b.set_index) || (a.side ?? '').localeCompare(b.side ?? '')
  )
  const units: Unit[] = []
  let lastIndex: number | null = null
  for (const l of sorted) {
    const sided = l.side === 'L' || l.side === 'R'
    const rep = `${l.reps}${sided ? l.side : ''}`
    const prev = units[units.length - 1]
    if (sided && prev && lastIndex === l.set_index) {
      prev.rep += `/${rep}`
      const b = formatBand(l.band)
      if (b !== prev.band) prev.band = `${prev.band} / ${b}`
      if (prev.rir === null) prev.rir = l.rir
      else if (l.rir !== null) prev.rir = Math.min(prev.rir, l.rir)
    } else {
      units.push({ kind: kindOfLog(l), band: formatBand(l.band), rep, rir: l.rir })
    }
    lastIndex = l.set_index
  }
  return units
}

function formatUnits(units: Unit[]): string {
  const groups: { kind: RowKind; band: string; reps: string[] }[] = []
  for (const u of units) {
    const g = groups[groups.length - 1]
    if (g && g.kind === u.kind && g.band === u.band) g.reps.push(u.rep)
    else groups.push({ kind: u.kind, band: u.band, reps: [u.rep] })
  }
  return groups
    .map((g) => {
      const prefix = g.kind === 'warmup' ? 'Warm-up ' : g.kind === 'drop' ? 'Drop ' : ''
      return `${prefix}${g.reps.join(', ')} @ ${g.band}`
    })
    .join('; ')
}

function rirText(units: Unit[]): string | null {
  const vals = units.filter((u) => u.kind === 'planned' && u.rir !== null).map((u) => u.rir as number)
  if (vals.length === 0) return null
  return vals.every((v) => v === vals[0]) ? `RIR ${vals[0]}` : `RIR ${vals.join(', ')}`
}

const bySessionDesc = (a: Session, b: Session) =>
  b.date.localeCompare(a.date) || b.started_at.localeCompare(a.started_at)

// Recent sessions (newest first, at most `limit` per exercise) for every
// exercise that has logs. Deleted logs and sessions are ignored. Pass
// `excludeSessionId` to leave out the session in progress.
export function lastUsedBySlug(
  logs: SetLog[],
  sessions: Session[],
  limit = 5,
  excludeSessionId?: string
): Map<string, LastUsed[]> {
  const sessById = new Map<string, Session>()
  for (const s of sessions) if (!s.deleted && s.id !== excludeSessionId) sessById.set(s.id, s)
  const bySlug = new Map<string, Map<string, SetLog[]>>()
  for (const l of logs) {
    if (l.deleted || !sessById.has(l.session_id)) continue
    let perSession = bySlug.get(l.exercise_slug)
    if (!perSession) bySlug.set(l.exercise_slug, (perSession = new Map()))
    const arr = perSession.get(l.session_id)
    if (arr) arr.push(l)
    else perSession.set(l.session_id, [l])
  }
  const out = new Map<string, LastUsed[]>()
  for (const [slug, perSession] of bySlug) {
    const entries = [...perSession.keys()]
      .map((id) => sessById.get(id)!)
      .sort(bySessionDesc)
      .slice(0, limit)
      .map((s): LastUsed => {
        const units = unitsOf(perSession.get(s.id)!)
        return {
          sessionId: s.id,
          date: s.date,
          dayLabel: dayLabel(s.date),
          shortDate: shortDate(s.date),
          text: formatUnits(units),
          rir: rirText(units),
        }
      })
    out.set(slug, entries)
  }
  return out
}

export function lastUsed(
  logs: SetLog[],
  sessions: Session[],
  slug: string,
  limit = 5,
  excludeSessionId?: string
): LastUsed[] {
  return lastUsedBySlug(
    logs.filter((l) => l.exercise_slug === slug),
    sessions,
    limit,
    excludeSessionId
  ).get(slug) ?? []
}
