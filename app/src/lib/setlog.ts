// Pure helpers for the optional set log fields (RIR and set type). No Dexie or
// React imports, so they are usable from sync, backup and tests.
import type { SetLog } from '../db/db'

export const SET_TYPES = ['normal', 'warmup', 'drop', 'failure'] as const
export type SetType = (typeof SET_TYPES)[number]

// Reps in reserve: an integer 0-3 (3 means "3+"), or null when not logged.
// Anything else (undefined, NaN, strings) becomes null; numbers are rounded
// and clamped into 0-3.
export function normalizeRir(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) return null
  return Math.min(3, Math.max(0, Math.round(value)))
}

// Unknown or missing set types (old clients, old server rows) are 'normal'.
export function normalizeSetType(value: unknown): SetType {
  return (SET_TYPES as readonly unknown[]).includes(value) ? (value as SetType) : 'normal'
}

// Fill defaults on a raw set log row (pulled from the server, restored from a
// backup, or created before db v5). Other fields pass through unchanged.
export function normalizeSetLog<T extends Record<string, unknown>>(raw: T): T & Pick<SetLog, 'rir' | 'set_type'> {
  return { ...raw, rir: normalizeRir(raw.rir), set_type: normalizeSetType(raw.set_type) }
}
