/**
 * Pure rules for the warden weapons' behaviours and on-hit tags (prompt 07 phase 7.3, EVAL-P7-004). No Phaser here:
 * `playerShot.ts` (aim, fan), `ProjectileSystem` (burn puddles, quakes, bounces, the magnet) and
 * `ProjectileCollisionRouter` (chain, corrode, freeze) call these, and `tests/weapon-identities.test.ts` covers them.
 */
import { WEAPON_TUNING, type WeaponOnHitTag } from '../content/weapons'

export type Vec = { x: number; y: number }

/** Follow-up projectiles an impact leaves behind (registered in `definitions/coreProjectiles.ts`). */
export const BURN_PUDDLE_PROJECTILE_ID = 'player_weapon_FlameSerpent_burn'
export const QUAKE_WAVE_PROJECTILE_ID = 'player_weapon_QuakeKnuckle_quake'

/** HydroLance: `aim` is -1 with up held, 1 with down held, 0 level. */
export function resolveAimVelocity(speed: number, facing: 1 | -1, aim: -1 | 0 | 1, angleDeg = WEAPON_TUNING.hydroAim.angleDeg): Vec {
  if (aim === 0) return { x: speed * facing, y: 0 }
  const radians = (angleDeg * Math.PI) / 180
  return { x: Math.round(Math.cos(radians) * speed) * facing, y: Math.round(Math.sin(radians) * speed) * aim }
}

/** AeroDarts: one velocity per spread angle (degrees, negative is up), all travelling the facing way. */
export function resolveFanVelocities(speed: number, facing: 1 | -1, spreadDeg: readonly number[] = WEAPON_TUNING.fan.spreadDeg): Vec[] {
  return spreadDeg.map((deg) => {
    const radians = (deg * Math.PI) / 180
    return { x: Math.round(Math.cos(radians) * speed) * facing, y: Math.round(Math.sin(radians) * speed) }
  })
}

/** The drawing's tilt for a shot flying at `velocity` (art travels right; flipped art mirrors the angle). */
export function shotAngleDeg(velocity: Vec, direction: 1 | -1): number {
  if (velocity.y === 0) return 0
  return Math.round(((Math.atan2(velocity.y, Math.abs(velocity.x)) * 180) / Math.PI) * direction)
}

/** ThunderSpike: a tap does not chain; each charge level adds one jump, up to the cap. */
export function chainJumpsForCharge(chargeLevel: number, maxJumps: number = WEAPON_TUNING.chain.maxJumps): number {
  return Math.max(0, Math.min(maxJumps, Math.floor(chargeLevel)))
}

/** The enemies a chain jumps to: nearest first, within the radius of the enemy it just hit, never that one twice. */
export function resolveChainTargets<T extends Vec>(origin: T, candidates: readonly T[], jumps: number, radiusPx: number = WEAPON_TUNING.chain.radiusPx): T[] {
  const chosen: T[] = []
  let from: Vec = origin
  const pool = candidates.filter((candidate) => candidate !== origin)
  while (chosen.length < jumps) {
    let best: T | undefined
    let bestDistance = Infinity
    for (const candidate of pool) {
      if (chosen.includes(candidate)) continue
      const distance = Math.hypot(candidate.x - from.x, candidate.y - from.y)
      if (distance <= radiusPx && distance < bestDistance) {
        best = candidate
        bestDistance = distance
      }
    }
    if (!best) break
    chosen.push(best)
    from = best
  }
  return chosen
}

export type ProjectileImpact = 'target' | 'floor' | 'wall' | 'ceiling' | 'none'

/** Why a projectile is being recycled: the router marks target hits; a platform contact reads from the body. */
export function classifyImpact(hitTarget: unknown, contact: { up?: boolean; down?: boolean; left?: boolean; right?: boolean } | undefined): ProjectileImpact {
  if (hitTarget === 'enemy' || hitTarget === 'boss') return 'target'
  if (contact?.down) return 'floor'
  if (contact?.left || contact?.right) return 'wall'
  if (contact?.up) return 'ceiling'
  return 'none'
}

export type ImpactFollowUp = { kind: 'burn_puddle'; projectileId: string } | { kind: 'quake'; projectileId: string } | { kind: 'bounce' } | null

/**
 * What an impact leaves: a flame leaves a burn puddle where it hits an enemy or the floor; a knuckle that lands
 * quakes; a dart with a bounce left bounces off a floor, wall or ceiling. Everything else just ends.
 */
export function resolveImpactFollowUp(tag: WeaponOnHitTag | string | undefined, impact: ProjectileImpact, bouncesLeft = 0): ImpactFollowUp {
  if (tag === 'burn' && (impact === 'target' || impact === 'floor')) return { kind: 'burn_puddle', projectileId: BURN_PUDDLE_PROJECTILE_ID }
  if (tag === 'quake' && impact === 'floor') return { kind: 'quake', projectileId: QUAKE_WAVE_PROJECTILE_ID }
  if (tag === 'bounce' && bouncesLeft > 0 && (impact === 'floor' || impact === 'wall' || impact === 'ceiling')) return { kind: 'bounce' }
  return null
}

/** One bounce: the velocity component into the surface flips. */
export function bounceVelocity(velocity: Vec, impact: ProjectileImpact): Vec {
  if (impact === 'floor' || impact === 'ceiling') return { x: velocity.x, y: -velocity.y }
  if (impact === 'wall') return { x: -velocity.x, y: velocity.y }
  return { ...velocity }
}

/** MagcutDisc: the velocity that drifts a drop toward the disc, or null when it is out of reach. */
export function magnetPullVelocity(drop: Vec, disc: Vec, radiusPx: number = WEAPON_TUNING.magnet.radiusPx, pullSpeed: number = WEAPON_TUNING.magnet.pullSpeed): Vec | null {
  const dx = disc.x - drop.x
  const dy = disc.y - drop.y
  const distance = Math.hypot(dx, dy)
  if (distance > radiusPx || distance < 1) return null
  return { x: Math.round((dx / distance) * pullSpeed), y: Math.round((dy / distance) * pullSpeed) }
}

/** AcidGlob: the delays (ms after the hit) of each corrosion tick. */
export function corrodeTickDelays(ticks: number = WEAPON_TUNING.corrode.ticks, intervalMs: number = WEAPON_TUNING.corrode.intervalMs): number[] {
  return Array.from({ length: Math.max(0, ticks) }, (_, index) => (index + 1) * intervalMs)
}

/** FrostShatter: the ice block around a frozen enemy (its body grown by `pad` on each side). */
export function freezeBlockRect(body: { x: number; y: number; width: number; height: number }, pad = 2): { x: number; y: number; width: number; height: number } {
  return { x: body.x - pad, y: body.y - pad, width: body.width + pad * 2, height: body.height + pad * 2 }
}

/** A one-way ice block: the player lands on it only while falling with their feet at or above its top. */
export function landsOnFreezeBlock(playerBottom: number, playerVelocityY: number, blockTop: number, tolerancePx = 6): boolean {
  return playerVelocityY >= 0 && playerBottom <= blockTop + tolerancePx
}

/** FlameSerpent: whether the trigger, held `heldFrames` frames since the first flame, fires the next one. */
export function streamShouldFire(options: { held: boolean; anchored: boolean; heldFrames: number; startFrames?: number; intervalFrames?: number }): boolean {
  const start = options.startFrames ?? WEAPON_TUNING.flameStream.startFrames
  const interval = Math.max(1, options.intervalFrames ?? WEAPON_TUNING.flameStream.intervalFrames)
  return options.held && options.anchored && options.heldFrames >= start && (options.heldFrames - start) % interval === 0
}
