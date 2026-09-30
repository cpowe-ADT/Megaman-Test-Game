export type HitboxShape =
  | { kind: 'rect'; x: number; y: number; width: number; height: number }
  | { kind: 'circle'; x: number; y: number; radius: number }

export type Hitbox = {
  id: string
  ownerId: string
  shape: HitboxShape
  damage: number
  kind: string
}

/** An attacker's hitbox shape, centred on an already-resolved world origin (offsets folded in). */
export type OriginHitboxShape =
  | { kind: 'rect'; width: number; height: number }
  | { kind: 'circle'; radius: number }

/** A target's hurtbox: an axis-aligned box centred on `x, y`. */
export type HurtboxTarget = { x: number; y: number; width: number; height: number }

/**
 * The one hit test every attack shares (prompt 06 phase 6.0, `EVAL-P6-015`): does an attacker's hitbox,
 * already placed at `origin`, touch a target's box? A circle attacker gets a small forgiving pad the
 * width of the sword's build once already relied on (a target's own half-size, scaled down), so a
 * thrust that lands square on a small target does not get the exact same reach as one on a tall boss.
 * The player's sword (`swordCollision.ts`) is the first caller through this function; shots stay on
 * Arcade's own AABB overlap for their broad-phase hit test (`HitWires.ts`), which is already exact for
 * an axis-aligned body, so the geometry below is not on that path.
 */
export function resolveHurtbox(origin: { x: number; y: number }, hitbox: OriginHitboxShape, target: HurtboxTarget): boolean {
  if (hitbox.kind === 'circle') {
    const dx = target.x - origin.x
    const dy = target.y - origin.y
    const radius = hitbox.radius + Math.max(target.width, target.height) * 0.25
    return dx * dx + dy * dy <= radius * radius
  }

  const halfW = target.width * 0.5
  const halfH = target.height * 0.5
  const left = origin.x - hitbox.width * 0.5
  const right = left + hitbox.width
  const top = origin.y - hitbox.height * 0.5
  const bottom = top + hitbox.height
  return !(target.x + halfW < left || target.x - halfW > right || target.y + halfH < top || target.y - halfH > bottom)
}

export function hitboxOverlaps(a: HitboxShape, b: HitboxShape): boolean {
  if (a.kind === 'rect' && b.kind === 'rect') {
    return !(a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y)
  }

  const circleRectOverlap = (circle: { x: number; y: number; radius: number }, rect: { x: number; y: number; width: number; height: number }) => {
    const cx = Math.max(rect.x, Math.min(circle.x, rect.x + rect.width))
    const cy = Math.max(rect.y, Math.min(circle.y, rect.y + rect.height))
    const dx = circle.x - cx
    const dy = circle.y - cy
    return dx * dx + dy * dy <= circle.radius * circle.radius
  }

  if (a.kind === 'circle' && b.kind === 'rect') {
    return circleRectOverlap(a, b)
  }
  if (a.kind === 'rect' && b.kind === 'circle') {
    return circleRectOverlap(b, a)
  }

  if (a.kind !== 'circle' || b.kind !== 'circle') {
    return false
  }

  const dx = a.x - b.x
  const dy = a.y - b.y
  const r = a.radius + b.radius
  return dx * dx + dy * dy <= r * r
}
