import type { EnemyAttackConfig, EnemyAttackType, EnemyBoxConfig } from './types'

export type EnemyAttackPhase = 'none' | 'windup' | 'active' | 'recover'

/**
 * The attack's timed phase from how long it has run (pure; `EnemyCombat.getAttackPhase` wraps it with the
 * clock). `-1` (no attack started) is `'none'`.
 */
export function resolveAttackPhase(
  attack: Pick<EnemyAttackConfig, 'windupMs' | 'activeMs' | 'recoveryMs'>,
  elapsedMs: number
): EnemyAttackPhase {
  if (elapsedMs < 0) {
    return 'none'
  }
  if (elapsedMs < attack.windupMs) {
    return 'windup'
  }
  if (elapsedMs < attack.windupMs + attack.activeMs) {
    return 'active'
  }
  if (elapsedMs < attack.windupMs + attack.activeMs + attack.recoveryMs) {
    return 'recover'
  }
  return 'none'
}

/**
 * The named hitbox a type's active phase hits with: `beam` (laser_eye's timed line, its own 48x6 box) for
 * a `beam` attack when the family defines one, `melee` for everything else (a charge's contact box, a
 * true melee swing, or a beam family with no dedicated box yet).
 */
export function resolveHitboxKey(attackType: EnemyAttackType, hitboxes: Record<string, EnemyBoxConfig>): string {
  if (attackType === 'beam' && hitboxes.beam) {
    return 'beam'
  }
  return 'melee'
}

export interface HitboxRect {
  x: number
  y: number
  width: number
  height: number
}

/** The box's world rect from the shooter's centre, its facing and its offset (mirrored when facing left). */
export function computeHitboxRect(originX: number, originY: number, facing: 1 | -1, box: EnemyBoxConfig): HitboxRect {
  const x = originX + (facing < 0 ? -box.offsetX - box.width : box.offsetX)
  const y = originY + box.offsetY - box.height * 0.5
  return { x, y, width: box.width, height: box.height }
}
