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
 * A shot's age (13b.3, `EVAL-P13-004`): true once `ageMs` reaches its lifetime. `ageMs` accumulates by
 * `deltaMs` only on a frame `ProjectileSystem.update` actually runs, so hit-stop (which skips that call
 * outright) pauses the clock instead of the shot losing lifetime to frames it was frozen for. `0` or
 * less means the shot does not expire on a timer (a straight shot instead leaves on camera exit).
 */
export function isProjectileExpired(ageMs: number, lifetimeMs: number): boolean {
  return lifetimeMs > 0 && ageMs >= lifetimeMs
}

/**
 * A straight player shot leaves once it is fully outside the camera's current view, plus `margin` so it
 * visibly exits rather than popping right at the edge (13b.3, `EVAL-P13-004`: "shots live until they
 * leave the screen", not a fixed lifetime that can end a third of the way across it). Lobs and
 * boomerangs keep their own `lifetimeMs`/return arcs; this is only for `behavior.kind === 'standard'`.
 */
export function isOutsideCameraView(
  x: number,
  y: number,
  view: { left: number; top: number; width: number; height: number },
  margin = 24
): boolean {
  return x < view.left - margin || x > view.left + view.width + margin || y < view.top - margin || y > view.top + view.height + margin
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
