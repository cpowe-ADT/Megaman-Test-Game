/** Sub tank fill rules. Fill is 0 to 1 per owned tank; tanks fill from health collected at full HP. */
export function normalizeSubTankFill(fills: unknown, tankCount: number): number[] {
  const source = Array.isArray(fills) ? fills : []
  return Array.from({ length: Math.max(0, tankCount) }, (_, index) => {
    const value = Number(source[index])
    return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0
  })
}

/** Adds `ratio` of a tank to the first tank that is not full; returns the new fills and whether anything was stored. */
export function fillSubTankFromPickup(fills: readonly number[], ratio: number): { fills: number[]; stored: boolean } {
  const next = [...fills]
  const index = next.findIndex((fill) => fill < 1)
  if (index < 0 || ratio <= 0) return { fills: next, stored: false }
  next[index] = Math.min(1, next[index] + ratio)
  return { fills: next, stored: true }
}

/** Empties tank `index`; returns the HP ratio it restores (its fill) or 0 when empty. */
export function drinkSubTank(fills: readonly number[], index: number): { fills: number[]; restoredRatio: number } {
  const next = [...fills]
  const fill = next[index] ?? 0
  if (fill <= 0) return { fills: next, restoredRatio: 0 }
  next[index] = 0
  return { fills: next, restoredRatio: fill }
}
