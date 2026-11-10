// Band ladders. Pure (no React, no Dexie).
//
// Band ids used in plan.json exercises and in SetLog.band are a ladder prefix
// plus a ladder label: "T40" = tube ladder label "40", "T30+40" = label
// "30+40" (stacked tubes), "L35-95" = loop ladder label "35-95". The ladders
// in plan.bandLadders hold the labels WITHOUT the prefix.
//
// rank is the index of the step within its own ladder (0 = lightest). Ranks
// are only comparable between bands of the same ladder; tube and loop ranks
// are independent. rankOf returns -1 for unknown bands.

import type { PlanData } from '../data/plan'

export type LadderName = 'tube' | 'loop'

export interface LadderStep {
  id: string // band id with prefix, e.g. "T30+40"
  label: string // ladder label without prefix, e.g. "30+40"
  ladder: LadderName
  rank: number
  bands: string[] // single-band labels composing the step, e.g. ["30", "40"]
  resistanceKg: number | null // from the inventory when known
}

export interface BandItem {
  id: string // e.g. "T40", "L35-95"
  ladder: LadderName
  label: string // e.g. "40", "35-95"
  resistanceKg: number | null // measured by the user, null = unknown
  owned: boolean
  nominal?: number | null // numeric value parsed from the label (tubes), else null
}

export const LADDER_PREFIX: Record<LadderName, 'T' | 'L'> = { tube: 'T', loop: 'L' }

// Split a band id into ladder and label, or null when it has no T/L prefix.
export function parseBandId(id: string): { ladder: LadderName; label: string } | null {
  if (id.length < 2) return null
  if (id[0] === 'T') return { ladder: 'tube', label: id.slice(1) }
  if (id[0] === 'L') return { ladder: 'loop', label: id.slice(1) }
  return null
}

export function bandId(ladder: LadderName, label: string): string {
  return LADDER_PREFIX[ladder] + label
}

// Numeric nominal value from a label when it is obvious: a single number
// ("40" gives 40). Ranges ("5-30") and stacks ("30+40") give null.
export function nominalFromLabel(label: string): number | null {
  return /^\d+(\.\d+)?$/.test(label) ? Number(label) : null
}

// Default inventory: every single band of the plan ladders (labels with no
// "+"), all owned, resistance unknown.
export function defaultBandInventory(plan: PlanData): BandItem[] {
  const items: BandItem[] = []
  for (const ladder of ['tube', 'loop'] as const) {
    for (const label of plan.bandLadders[ladder]) {
      if (label.includes('+')) continue
      items.push({
        id: bandId(ladder, label),
        ladder,
        label,
        resistanceKg: null,
        owned: true,
        nominal: nominalFromLabel(label),
      })
    }
  }
  return items
}

// Two stacked totals closer than this (relative) count as the same step.
export const NEAR_EQUAL_RATIO = 0.03

function combinations<T>(items: T[], size: number): T[][] {
  if (size === 0) return [[]]
  const out: T[][] = []
  items.forEach((item, i) => {
    for (const rest of combinations(items.slice(i + 1), size - 1)) out.push([item, ...rest])
  })
  return out
}

// Ordered steps per ladder.
// - No inventory: exactly the plan.bandLadders order.
// - Inventory: steps whose component bands are not all owned are excluded
//   (a band missing from the inventory counts as owned). When every owned
//   single band of a ladder has a measured resistanceKg, the ladder is
//   regenerated: the owned singles plus all 2- and 3-band stacks, sorted by
//   total resistance, near-equal totals (within 3%) deduped. Among near-equal
//   totals the single band wins, then a stack the plan already defines, then
//   the stack with fewer bands. Without full measurements the plan order is
//   kept (filtered by owned).
// resistanceKg is the sum of the parts, null if any part is unknown.
export function buildLadder(
  plan: PlanData,
  inventory?: BandItem[]
): Record<LadderName, LadderStep[]> {
  const kgById = new Map<string, number>()
  const notOwned = new Set<string>()
  for (const item of inventory ?? []) {
    if (item.resistanceKg !== null) kgById.set(item.id, item.resistanceKg)
    if (!item.owned) notOwned.add(item.id)
  }
  const kgOf = (ladder: LadderName, bands: string[]): number | null => {
    const parts = bands.map((b) => kgById.get(bandId(ladder, b)))
    return parts.every((p) => p !== undefined) ? (parts as number[]).reduce((a, b) => a + b, 0) : null
  }
  const ownedBands = (ladder: LadderName, bands: string[]) =>
    bands.every((b) => !notOwned.has(bandId(ladder, b)))

  const fromPlan = (ladder: LadderName): LadderStep[] =>
    plan.bandLadders[ladder]
      .filter((label) => ownedBands(ladder, label.split('+')))
      .map((label, rank) => {
        const bands = label.split('+')
        return { id: bandId(ladder, label), label, ladder, rank, bands, resistanceKg: kgOf(ladder, bands) }
      })

  const generated = (ladder: LadderName): LadderStep[] | null => {
    if (!inventory) return null
    const singles = plan.bandLadders[ladder].filter((l) => !l.includes('+'))
    const owned = singles.filter((l) => ownedBands(ladder, [l]))
    if (owned.length === 0 || owned.some((l) => kgOf(ladder, [l]) === null)) return null
    const inPlan = new Set(plan.bandLadders[ladder])
    const pref = (c: { bands: string[]; label: string }) =>
      c.bands.length * 10 + (inPlan.has(c.label) ? 0 : 5)
    const cands = [1, 2, 3]
      .flatMap((n) => combinations(owned, n))
      .map((bands) => ({ bands, label: bands.join('+'), kg: kgOf(ladder, bands) as number }))
      .sort((a, b) => a.kg - b.kg)
    const kept: typeof cands = []
    for (const c of cands) {
      const near = kept.findIndex((k) => Math.abs(k.kg - c.kg) <= NEAR_EQUAL_RATIO * Math.max(k.kg, c.kg))
      if (near === -1) kept.push(c)
      else if (pref(c) < pref(kept[near])) kept[near] = c
    }
    kept.sort((a, b) => a.kg - b.kg)
    return kept.map((c, i) => ({
      id: bandId(ladder, c.label),
      label: c.label,
      ladder,
      rank: i,
      bands: c.bands,
      resistanceKg: c.kg,
    }))
  }

  const build = (ladder: LadderName) => generated(ladder) ?? fromPlan(ladder)
  return { tube: build('tube'), loop: build('loop') }
}

// The step for a band id, or null when it is not on the ladder.
export function stepOf(bandIdStr: string, plan: PlanData, inventory?: BandItem[]): LadderStep | null {
  const parsed = parseBandId(bandIdStr)
  if (!parsed) return null
  return buildLadder(plan, inventory)[parsed.ladder].find((s) => s.label === parsed.label) ?? null
}

// Rank of a band id within its ladder (0 = lightest), or -1 if unknown.
export function rankOf(bandIdStr: string, plan: PlanData, inventory?: BandItem[]): number {
  return stepOf(bandIdStr, plan, inventory)?.rank ?? -1
}

// The next heavier band id on the same ladder, or null at the top / unknown.
export function nextStep(bandIdStr: string, plan: PlanData, inventory?: BandItem[]): LadderStep | null {
  const parsed = parseBandId(bandIdStr)
  const step = stepOf(bandIdStr, plan, inventory)
  if (!parsed || !step) return null
  return buildLadder(plan, inventory)[parsed.ladder][step.rank + 1] ?? null
}

// The next lighter step on the same ladder, or null at the bottom / unknown.
export function prevStep(bandIdStr: string, plan: PlanData, inventory?: BandItem[]): LadderStep | null {
  const parsed = parseBandId(bandIdStr)
  const step = stepOf(bandIdStr, plan, inventory)
  if (!parsed || !step || step.rank === 0) return null
  return buildLadder(plan, inventory)[parsed.ladder][step.rank - 1] ?? null
}
