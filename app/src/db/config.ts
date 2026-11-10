// Settings-backed configuration. Each value is a JSON string in the synced
// `settings` table (getSetting / setSetting), so it syncs with no new tables.
// Read-modify-write is fine: single user. Malformed or invalid stored values
// fall back to defaults. The parse* functions are pure (exported for tests).

import { loadPlan } from '../data/plan'
import { getSetting, setSetting } from './db'
import {
  defaultBandInventory,
  nominalFromLabel,
  parseBandId,
  type BandItem,
} from '../lib/ladder'

export type { BandItem } from '../lib/ladder'

export const CONFIG_KEYS = {
  bandInventory: 'cfg_band_inventory',
  exerciseOverrides: 'cfg_exercise_overrides',
  volumeTargets: 'cfg_volume_targets',
  lastDeload: 'cfg_last_deload_date',
} as const

function parseJson(raw: string | null): unknown {
  if (raw === null) return undefined
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v)

// --- Band inventory ---------------------------------------------------------

// Valid items are kept (resistanceKg must be a positive number or null, nominal
// is recomputed from the label); invalid entries are dropped. Returns null when
// the value is not a usable array, so the caller uses the default.
export function parseBandInventory(raw: string | null): BandItem[] | null {
  const data = parseJson(raw)
  if (!Array.isArray(data)) return null
  const items: BandItem[] = []
  for (const it of data) {
    if (!isObj(it) || typeof it.id !== 'string') continue
    const parsed = parseBandId(it.id)
    if (!parsed) continue
    const kg = it.resistanceKg
    items.push({
      id: it.id,
      ladder: parsed.ladder,
      label: parsed.label,
      resistanceKg: typeof kg === 'number' && Number.isFinite(kg) && kg > 0 ? kg : null,
      owned: it.owned !== false,
      nominal: nominalFromLabel(parsed.label),
    })
  }
  return items
}

// The saved inventory, or the default derived from plan.json (single bands,
// all owned, resistance null).
export async function getBandInventory(): Promise<BandItem[]> {
  const saved = parseBandInventory(await getSetting(CONFIG_KEYS.bandInventory))
  if (saved) return saved
  return defaultBandInventory(await loadPlan())
}

export async function saveBandInventory(items: BandItem[]): Promise<void> {
  await setSetting(CONFIG_KEYS.bandInventory, JSON.stringify(items))
}

// --- Per-exercise overrides -------------------------------------------------

export type ProgressionRule = 'all-sets-max' | 'total-reps' | 'two-of-three'

export interface ExerciseOverride {
  rule?: ProgressionRule
  totalRepsTarget?: number
  restSeconds?: number
}

const RULES: readonly string[] = ['all-sets-max', 'total-reps', 'two-of-three']

function cleanOverride(v: unknown): ExerciseOverride {
  const out: ExerciseOverride = {}
  if (!isObj(v)) return out
  if (typeof v.rule === 'string' && RULES.includes(v.rule)) out.rule = v.rule as ProgressionRule
  if (typeof v.totalRepsTarget === 'number' && Number.isFinite(v.totalRepsTarget) && v.totalRepsTarget > 0)
    out.totalRepsTarget = Math.round(v.totalRepsTarget)
  if (typeof v.restSeconds === 'number' && Number.isFinite(v.restSeconds) && v.restSeconds > 0)
    out.restSeconds = Math.round(v.restSeconds)
  return out
}

export function parseExerciseOverrides(raw: string | null): Record<string, ExerciseOverride> {
  const data = parseJson(raw)
  const out: Record<string, ExerciseOverride> = {}
  if (!isObj(data)) return out
  for (const [slug, v] of Object.entries(data)) {
    const o = cleanOverride(v)
    if (Object.keys(o).length > 0) out[slug] = o
  }
  return out
}

export async function getExerciseOverrides(): Promise<Record<string, ExerciseOverride>> {
  return parseExerciseOverrides(await getSetting(CONFIG_KEYS.exerciseOverrides))
}

// Merge `partial` into the exercise's override. A key set to undefined is
// removed; an override left empty is removed entirely.
export async function setExerciseOverride(slug: string, partial: Partial<ExerciseOverride>): Promise<void> {
  const all = await getExerciseOverrides()
  const merged: Record<string, unknown> = { ...all[slug], ...partial }
  for (const k of Object.keys(merged)) if (merged[k] === undefined) delete merged[k]
  const cleaned = cleanOverride(merged)
  if (Object.keys(cleaned).length > 0) all[slug] = cleaned
  else delete all[slug]
  await setSetting(CONFIG_KEYS.exerciseOverrides, JSON.stringify(all))
}

// --- Volume targets ---------------------------------------------------------

export interface VolumeTargets {
  min: number // weekly sets per muscle
  max: number
}

export const DEFAULT_VOLUME_TARGETS: VolumeTargets = { min: 10, max: 20 }

export function parseVolumeTargets(raw: string | null): VolumeTargets {
  const d = parseJson(raw)
  if (
    isObj(d) &&
    typeof d.min === 'number' &&
    typeof d.max === 'number' &&
    Number.isFinite(d.min) &&
    Number.isFinite(d.max) &&
    d.min >= 0 &&
    d.max >= d.min
  ) {
    return { min: d.min, max: d.max }
  }
  return { ...DEFAULT_VOLUME_TARGETS }
}

export async function getVolumeTargets(): Promise<VolumeTargets> {
  return parseVolumeTargets(await getSetting(CONFIG_KEYS.volumeTargets))
}

export async function setVolumeTargets(targets: VolumeTargets): Promise<void> {
  const t = parseVolumeTargets(JSON.stringify(targets))
  if (t.min !== targets.min || t.max !== targets.max) throw new Error('invalid volume targets')
  await setSetting(CONFIG_KEYS.volumeTargets, JSON.stringify(t))
}

// --- Deload log -------------------------------------------------------------

// The date (YYYY-MM-DD or full ISO string, as stored) of the last deload week,
// or null if never logged / unparseable.
export async function getLastDeloadDate(): Promise<string | null> {
  const raw = await getSetting(CONFIG_KEYS.lastDeload)
  if (raw === null || Number.isNaN(Date.parse(raw))) return null
  return raw
}

export async function setLastDeloadDate(iso: string): Promise<void> {
  if (Number.isNaN(Date.parse(iso))) throw new Error('invalid date')
  await setSetting(CONFIG_KEYS.lastDeload, iso)
}
