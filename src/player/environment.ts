/**
 * The motor's environment input (prompt 12 part 12b): what the stage mechanics under and around the hero
 * do to its movement. The stage mechanics adapter sets it once per frame through
 * `NewPlayerRuntime.setEnvironment`; `PlayerMotor` reads it on its next update. Neutral (plain ground, no
 * carry, no force) leaves every motor rule exactly as it was. Pure: no Phaser.
 */
export type PlayerSurface = 'ground' | 'ice'

export type PlayerEnvironment = {
  /** What the feet stand on: ice lowers ground friction and stretches a grounded dash. */
  surface: PlayerSurface
  /** A belt's surface speed under the feet, px/s (positive carries right); it applies only while grounded. */
  carryVelocityX: number
  /** Area force (wind, water current, magnet), px/s^2; y grows down, so a lift is negative. */
  forceX: number
  forceY: number
  /** The largest speed the forces build, px/s (default `ENVIRONMENT_PUSH_CAP`). */
  pushCap?: number
  /** How high a jump or wall kick rises here, as a share of its normal rise (12d: 0.8 in a water current; default 1). */
  jumpRiseScale?: number
}

export const NEUTRAL_PLAYER_ENVIRONMENT: Readonly<PlayerEnvironment> = Object.freeze({
  surface: 'ground',
  carryVelocityX: 0,
  forceX: 0,
  forceY: 0
})

/** Ground friction on ice (02 §2.2: x0.35): starting, turning and stopping all take about three times longer. */
export const ICE_FRICTION_SCALE = 0.35
/** A grounded dash started on ice lasts 40% longer at the same speed: +40% distance. */
export const ICE_DASH_DISTANCE_SCALE = 1.4
/** Default cap of the push the forces build, px/s. */
export const ENVIRONMENT_PUSH_CAP = 140
/** With no force the push fades at this rate, px/s^2 (a zone lets go within about 0.15s). */
export const ENVIRONMENT_PUSH_RELEASE = 900
/** Grounded, the hero feels this share of a sideways push (02 §2.2: airborne is affected more). */
export const GROUNDED_PUSH_SCALE = 0.5

function finite(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Unknown surfaces read as ground, missing or non-finite numbers as 0, a missing cap as the default. */
export function normalizePlayerEnvironment(input?: Partial<PlayerEnvironment> | null): Required<PlayerEnvironment> {
  const cap = finite(input?.pushCap)
  const rise = finite(input?.jumpRiseScale)
  return {
    surface: input?.surface === 'ice' ? 'ice' : 'ground',
    carryVelocityX: finite(input?.carryVelocityX),
    forceX: finite(input?.forceX),
    forceY: finite(input?.forceY),
    pushCap: cap > 0 ? cap : ENVIRONMENT_PUSH_CAP,
    jumpRiseScale: rise > 0 ? Math.min(rise, 2) : 1
  }
}

/**
 * The launch speed for a jump that rises `riseScale` of its normal height: the rise grows with the
 * square of the launch speed, so the speed scales by the square root. A scale of 1 keeps it exact.
 */
export function jumpLaunchVelocity(velocityY: number, riseScale: number): number {
  return riseScale === 1 ? velocityY : velocityY * Math.sqrt(Math.max(0, riseScale))
}

/** One frame of the sideways push: a force builds it toward its cap; with no force it fades to 0. */
export function stepPushVelocity(push: number, force: number, cap: number, dtSeconds: number): number {
  const limit = Math.max(0, cap)
  if (force !== 0) return Math.min(limit, Math.max(-limit, push + force * dtSeconds))
  const fade = ENVIRONMENT_PUSH_RELEASE * Math.max(0, dtSeconds)
  return Math.abs(push) <= fade ? 0 : push - Math.sign(push) * fade
}

/**
 * One frame of a vertical force on vy: it adds while vy is short of the cap in the force's direction and
 * never slows a faster move (a jump launched in a lift keeps its speed).
 */
export function applyVerticalForce(velocityY: number, forceY: number, cap: number, dtSeconds: number): number {
  if (forceY === 0) return velocityY
  const limit = Math.max(0, cap)
  const next = velocityY + forceY * Math.max(0, dtSeconds)
  if (forceY < 0) return velocityY <= -limit ? velocityY : Math.max(next, -limit)
  return velocityY >= limit ? velocityY : Math.min(next, limit)
}

/**
 * The velocity the hero's own movement is measured against this frame: the belt's carry (grounded only)
 * plus the push, which counts half on the ground.
 */
export function environmentDriftX(environment: PlayerEnvironment, pushVelocityX: number, grounded: boolean): number {
  return grounded ? environment.carryVelocityX + pushVelocityX * GROUNDED_PUSH_SCALE : pushVelocityX
}
