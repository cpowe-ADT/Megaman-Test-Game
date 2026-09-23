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

export function swordHitboxIntersectsTarget(
  origin: { x: number; y: number },
  hitbox: ResolvedHitbox,
  target: SwordHitTarget
): boolean {
  if (hitbox.shape.kind === 'circle') {
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const radius = hitbox.shape.radius + Math.max(target.width, target.height) * 0.25
    return dx * dx + dy * dy <= radius * radius
  }

  const halfW = target.width * 0.5
  const halfH = target.height * 0.5
  const left = origin.x - hitbox.shape.width * 0.5
  const right = left + hitbox.shape.width
  const top = origin.y - hitbox.shape.height * 0.5
  const bottom = top + hitbox.shape.height
  return !(
    target.x + halfW < left ||
    target.x - halfW > right ||
    target.y + halfH < top ||
    target.y - halfH > bottom
  )
}
