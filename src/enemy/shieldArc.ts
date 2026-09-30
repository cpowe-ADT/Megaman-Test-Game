/**
 * A shield arc (12c; `shield_drone`'s fixed front shield, the Tide relay nest's rotating one): a shot
 * from the shielded side clashes and never lands, unless it is a charged punch-through. The charge rule
 * mirrors the buster's own clash rule (`resolveProjectileClashResult`: `chargeLevel >= 2` beats an enemy
 * shot in flight): the same tier deals at least `PUNCH_THROUGH_DAMAGE` on the way the catalog tunes it
 * (`player/config.ts` CHARGE_TIERS, tier 2 onward), so a shot's own damage stands in for its charge level
 * here (only a bullet's damage reaches this check; nothing else carries a tier).
 */
export const SHIELD_PUNCH_THROUGH_DAMAGE = 2

export interface ShieldShot {
  /** The side the shot arrived from: the shooter's side, opposite the shot's own direction of travel. */
  side: 1 | -1
  /** The hit's damage amount; `SHIELD_PUNCH_THROUGH_DAMAGE` or more always gets through. */
  amount: number
}

/** True when the shield (its open gap facing `gapSide`) stops `shot`. */
export function shieldBlocksShot(gapSide: 1 | -1, shot: ShieldShot): boolean {
  if (shot.amount >= SHIELD_PUNCH_THROUGH_DAMAGE) {
    return false
  }
  return shot.side !== gapSide
}

/** `shield_drone`: a fixed shield over its front, so the gap is always behind its current facing. */
export function frontShieldGapSide(facing: 1 | -1): 1 | -1 {
  return facing === 1 ? -1 : 1
}
