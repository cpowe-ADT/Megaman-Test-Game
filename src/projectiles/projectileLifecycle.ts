export type ProjectileMotionKind = 'standard' | 'wave' | 'lob' | 'boomerang'

export const PROJECTILE_STALL_SPEED_EPSILON = 4
export const PROJECTILE_STALL_WATCHDOG_MS = 180

export type ProjectileStallInput = {
  kind: ProjectileMotionKind
  now: number
  stalledSince: number | null
  expectedVelocityX: number
  expectedVelocityY: number
  actualVelocityX: number
  actualVelocityY: number
}

export type ProjectileStallResult = {
  stalledSince: number | null
  shouldRecycle: boolean
}

/**
 * Standard and wave shots are authored to remain in motion for their lifetime.
 * If physics unexpectedly zeros one of those shots, quarantine it after a short
 * grace window instead of leaving a frozen sprite in the arena.
 */
export function resolveProjectileStall(input: ProjectileStallInput): ProjectileStallResult {
  if (input.kind !== 'standard' && input.kind !== 'wave') {
    return { stalledSince: null, shouldRecycle: false }
  }

  const expectedSpeed = Math.hypot(input.expectedVelocityX, input.expectedVelocityY)
  const actualSpeed = Math.hypot(input.actualVelocityX, input.actualVelocityY)
  if (expectedSpeed < PROJECTILE_STALL_SPEED_EPSILON || actualSpeed >= PROJECTILE_STALL_SPEED_EPSILON) {
    return { stalledSince: null, shouldRecycle: false }
  }

  const stalledSince = input.stalledSince ?? input.now
  return {
    stalledSince,
    shouldRecycle: input.now - stalledSince >= PROJECTILE_STALL_WATCHDOG_MS
  }
}

/**
 * Centre y for a shot that must start clear of the floor its shooter stands on: the shot's bounds
 * (half height `halfHeight`) end at least `gapPx` above `floorY`. Bosses and grounded enemies stand
 * with their origin on their feet, and a shot spawned overlapping the floor is recycled by the
 * bullet-vs-platform collider on its first step (the "boss bullets do not work" bug, 2026-09-24).
 */
export function liftShotAboveFloor(centerY: number, halfHeight: number, floorY: number, gapPx = 1): number {
  const maxCenter = floorY - Math.max(0, halfHeight) - gapPx
  return centerY > maxCenter ? maxCenter : centerY
}
