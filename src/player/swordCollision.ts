import { resolveHurtbox } from '../combat/Hitbox'
import type { ResolvedHitbox } from './types'

export type SwordHitTarget = {
  x: number
  y: number
  width: number
  height: number
}

export function resolveSwordHitboxOrigin(
  playerX: number,
  playerY: number,
  _facing: 1 | -1,
  hitbox: ResolvedHitbox
): { x: number; y: number } {
  return {
    x: playerX + hitbox.shape.offsetX,
    y: playerY + hitbox.shape.offsetY
  }
}

// The sword's hit test now runs through `resolveHurtbox` (prompt 06 phase 6.0, `EVAL-P6-015`: one hit
// test for sword, shots and the debug overlay), instead of its own copy of the same rect/circle math.
export function swordHitboxIntersectsTarget(
  origin: { x: number; y: number },
  hitbox: ResolvedHitbox,
  target: SwordHitTarget
): boolean {
  return resolveHurtbox(origin, hitbox.shape, target)
}
