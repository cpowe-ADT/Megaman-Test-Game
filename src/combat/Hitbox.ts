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
