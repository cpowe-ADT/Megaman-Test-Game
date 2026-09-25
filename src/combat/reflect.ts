import { resolveSwordHitboxOrigin, swordHitboxIntersectsTarget } from '../player/swordCollision'
import type { ResolvedHitbox } from '../player/types'

/** Reflected shots fly straight back this much faster. */
export const REFLECT_SPEED_MULTIPLIER = 1.25
/** A reflected shot deals at least this much. */
export const REFLECT_MIN_DAMAGE = 2
/** Below this speed (px/s) a projectile has no velocity to send back (mines at rest, beams held in place). */
export const REFLECT_MIN_SPEED = 1

export type ReflectCandidate = {
  x: number
  y: number
  width: number
  height: number
  vx: number
  vy: number
  damage: number
  /** From the projectile definition: orbs, pellets and missiles yes; beams, lasers, flames no. */
  reflectable: boolean
  owner: 'player' | 'enemy'
}

export type SwordReflectInput = {
  /** Only active frames reflect. */
  phase: 'startup' | 'active' | 'recovery' | undefined
  hitbox: ResolvedHitbox | null | undefined
  playerX: number
  playerY: number
  facing: 1 | -1
}

export type ReflectResult =
  | { reflected: false; reason: 'not_active' | 'not_reflectable' | 'not_enemy' | 'no_velocity' | 'outgoing' | 'miss' }
  | { reflected: true; velocity: { x: number; y: number }; owner: 'player'; damage: number }

/**
 * Whether the active sword box turns an enemy shot around, and how. A reflected shot goes straight back
 * along its path at 1.25x speed, now owned by the player, dealing max(2, its damage). A shot already
 * moving away from the hero is left alone, so a swing never pulls a passing shot back through him.
 */
export function resolveSwordReflect(sword: SwordReflectInput, projectile: ReflectCandidate): ReflectResult {
  if (sword.phase !== 'active' || !sword.hitbox) {
    return { reflected: false, reason: 'not_active' }
  }
  if (projectile.owner !== 'enemy') {
    return { reflected: false, reason: 'not_enemy' }
  }
  if (!projectile.reflectable) {
    return { reflected: false, reason: 'not_reflectable' }
  }
  if (Math.hypot(projectile.vx, projectile.vy) < REFLECT_MIN_SPEED) {
    return { reflected: false, reason: 'no_velocity' }
  }
  const towardHero = (sword.playerX - projectile.x) * projectile.vx + (sword.playerY - projectile.y) * projectile.vy
  if (towardHero < 0) {
    return { reflected: false, reason: 'outgoing' }
  }
  const origin = resolveSwordHitboxOrigin(sword.playerX, sword.playerY, sword.facing, sword.hitbox)
  const inside = swordHitboxIntersectsTarget(origin, sword.hitbox, {
    x: projectile.x,
    y: projectile.y,
    width: projectile.width,
    height: projectile.height
  })
  if (!inside) {
    return { reflected: false, reason: 'miss' }
  }
  return {
    reflected: true,
    velocity: { x: -projectile.vx * REFLECT_SPEED_MULTIPLIER, y: -projectile.vy * REFLECT_SPEED_MULTIPLIER },
    owner: 'player',
    damage: Math.max(REFLECT_MIN_DAMAGE, projectile.damage)
  }
}
