/**
 * Part 13e (EVAL-P13-010), the part's Decision: extra lives exist, one per warden stage on a detour, plus a
 * rare enemy drop (`rollEnemyDrop` in `pickupArt.ts`). Collecting one adds a life, capped at the existing
 * maximum, if there is one: `playerLives` carries no cap anywhere in this codebase today, so `max` stays
 * undefined and the grant is unbounded; the parameter exists so a future cap (if Craig adds one) is honoured
 * by this same function instead of a second copy of the clamp. Pure: no Phaser, unit tested without a scene.
 */
export function applyExtraLifePickup(current: number, max?: number): number {
  const next = current + 1
  return max == null ? next : Math.min(next, max)
}
