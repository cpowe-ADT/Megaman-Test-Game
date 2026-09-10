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
