export type Vec2 = { x: number; y: number }

export type MovementTuningConfig = {
  runSpeed: number
  accel: number
  decel: number
  airAccel: number
  gravity: number
  terminalVelocity: number
  jumpVelocity: number
  /** Releasing jump while rising faster than this (negative, px/s) sets vy to it. */
  jumpCutVelocity: number
  jumpHoldGravityScale: number
  coyoteTimeMs: number
  jumpBufferMs: number
  wallSlideFallSpeed: number
  wallJumpVelocityX: number
  wallJumpVelocityY: number
  wallJumpBoostMultiplier: number
  wallJumpLockMs: number
  /** A wall kick stays available this long after wall contact is lost. */
  wallKickGraceMs: number
  /** Pressing away from a wall holds the hero on it this long before letting go. */
  wallStickMs: number
  /** A ceiling edge overlapping the head by up to this many px nudges the hero aside. */
  cornerNudgePx: number
  /** Grounded runs step up lips of up to this many px. */
  stepUpPx: number
}

export type DashConfig = {
  dashSpeed: number
  dashDurationMs: number
  dashCooldownMs: number
  dashCancelRules: {
    canShootDuringDash: boolean
    canSlashDuringDash: boolean
  }
}

export type ChargeProjectileConfig = {
  size: number
  speed: number
  damage: number
  pierce: number
  impactFxKey: string
}

export type BlasterConfig = {
  fireRateMs: number
  pelletSpeed: number
  pelletDamage: number
  chargeThresholdsMs: [number, number, number, number]
  perLevelProjectile: Record<1 | 2 | 3 | 4, ChargeProjectileConfig>
  chargeCancelOnHit: boolean
  chargeCancelOnSlash: boolean
}

export type Direction8 = 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w' | 'nw'

export type HitboxShape =
  | {
      kind: 'rect'
      offsetX: number
      offsetY: number
      width: number
      height: number
    }
  | {
      kind: 'circle'
      offsetX: number
      offsetY: number
      radius: number
    }

export type SwordWindowConfig = {
  startupFrames: number
  activeFrames: number
  recoveryFrames: number
  hitbox: HitboxShape
  hitstopFrames: number
}

export type SwordConfig = {
  comboEnabled: boolean
  aimDeadzone: number
  windows: {
    ground: Record<Direction8, SwordWindowConfig>
    air: Record<Direction8, SwordWindowConfig>
  }
}

export type DamageConfig = {
  maxHp: number
  iFramesMs: number
  hitstunMs: {
    light: number
    heavy: number
  }
  knockback: {
    ground: Vec2
    air: Vec2
  }
  elementalStatesEnabled: boolean
}

export type PlayerGameplayConfig = {
  movement: MovementTuningConfig
  dash: DashConfig
  blaster: BlasterConfig
  sword: SwordConfig
  damage: DamageConfig
}

export type PlayerPhysicsLimits = {
  maxVelocityX: number
  maxVelocityY: number
}

/** Feel constants authored per 60Hz frame (hit-stop frames, follow lerp) are converted by real time. */
export const FEEL_FRAME_MS = 1000 / 60

/**
 * Arcade world gravity (px/s^2) set in `src/main.ts`. The hero's body gravity is `movement.gravity`
 * minus this; enemies read it too (`src/enemy/EnemyMotor.ts`), so there is one number to change.
 */
export const WORLD_GRAVITY_Y = 800

/** Release is ignored for the first 3 physics frames of a jump, so a tap and a 50ms hold give the same minimum hop. */
export const JUMP_MIN_HOLD_MS = 3 * FEEL_FRAME_MS

/** A landing faster than this (px/s) is hard: squash, dust and a short control lag. */
export const HARD_LANDING_SPEED = 400
export const HARD_LANDING_LAG_MS = 80
export const LANDING_SQUASH_FRAMES = 6

/** Counts a hit-stop authored in 60Hz frames down by elapsed time; returns 0 once spent. */
export function tickHitstopFrames(remainingFrames: number, deltaMs: number): number {
  const next = remainingFrames - Math.max(0, deltaMs) / FEEL_FRAME_MS
  return next <= 0.1 ? 0 : next
}

/** The lerp factor for a frame of `deltaMs` that converges like `lerpPerFrame` does at 60Hz. */
export function timeScaledLerp(lerpPerFrame: number, deltaMs: number): number {
  const factor = Math.min(1, Math.max(0, lerpPerFrame))
  if (factor >= 1) {
    return 1
  }
  return 1 - Math.pow(1 - factor, Math.max(0, deltaMs) / FEEL_FRAME_MS)
}

export function normalizeMovementSpeedMultiplier(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 1
}

export function resolvePlayerPhysicsLimits(
  config: Pick<PlayerGameplayConfig, 'movement' | 'dash'>,
  movementSpeedMultiplier = 1
): PlayerPhysicsLimits {
  const multiplier = normalizeMovementSpeedMultiplier(movementSpeedMultiplier)
  const maximumAuthoredHorizontalSpeed = Math.max(
    config.movement.runSpeed,
    config.dash.dashSpeed,
    config.movement.wallJumpVelocityX * config.movement.wallJumpBoostMultiplier
  )
  const maximumAuthoredVerticalSpeed = Math.max(
    config.movement.terminalVelocity,
    Math.abs(config.movement.jumpVelocity),
    Math.abs(config.movement.wallJumpVelocityY)
  )

  return {
    maxVelocityX: maximumAuthoredHorizontalSpeed * multiplier,
    maxVelocityY: maximumAuthoredVerticalSpeed
  }
}

// WREN's sheets (5.5, design C2) are authored facing left, as the C2 side view is: flip when facing right.
export function shouldFlipPlayerSpriteForFacing(facing: 1 | -1): boolean {
  return facing === 1
}

/**
 * West-facing saber poses mirror east-authored atlas frames. Horizontal attacks
 * therefore need to drive the sprite flip from the locked attack direction,
 * rather than from locomotion which may change during the slash window.
 */
export function resolveSwordVisualFacing(direction: Direction8 | undefined, locomotionFacing: 1 | -1): 1 | -1 {
  if (direction === 'w' || direction === 'nw' || direction === 'sw') {
    return -1
  }
  if (direction === 'e' || direction === 'ne' || direction === 'se') {
    return 1
  }
  return locomotionFacing
}

const baseSwordWindow = (hitbox: HitboxShape): SwordWindowConfig => ({
  startupFrames: 6,
  activeFrames: 4,
  recoveryFrames: 4,
  hitbox,
  hitstopFrames: 5
})

const baseSwordWindowAir = (hitbox: HitboxShape): SwordWindowConfig => ({
  startupFrames: 5,
  activeFrames: 4,
  recoveryFrames: 4,
  hitbox,
  hitstopFrames: 4
})

export const PLAYER_GAMEPLAY_CONFIG: PlayerGameplayConfig = {
  movement: {
    runSpeed: 220,
    accel: 1700,
    decel: 2100,
    airAccel: 1050,
    gravity: 1050,
    terminalVelocity: 550,
    jumpVelocity: -400,
    jumpCutVelocity: -140,
    jumpHoldGravityScale: 0.55,
    coyoteTimeMs: 100,
    jumpBufferMs: 100,
    wallSlideFallSpeed: 95,
    wallJumpVelocityX: 240,
    wallJumpVelocityY: -355,
    wallJumpBoostMultiplier: 1.28,
    wallJumpLockMs: 140,
    wallKickGraceMs: 80,
    wallStickMs: 60,
    cornerNudgePx: 3,
    stepUpPx: 3
  },
  dash: {
    dashSpeed: 320,
    dashDurationMs: 280,
    dashCooldownMs: 60,
    dashCancelRules: {
      canShootDuringDash: true,
      canSlashDuringDash: false
    }
  },
  blaster: {
    fireRateMs: 120,
    pelletSpeed: 260,
    pelletDamage: 1,
    chargeThresholdsMs: [190, 390, 710, 1020],
    perLevelProjectile: {
      1: { size: 1.05, speed: 300, damage: 1, pierce: 0, impactFxKey: 'fx_impact_charge_lv1' },
      2: { size: 1.2, speed: 330, damage: 2, pierce: 0, impactFxKey: 'fx_impact_charge_lv2' },
      3: { size: 1.45, speed: 360, damage: 3, pierce: 1, impactFxKey: 'fx_impact_charge_lv3' },
      4: { size: 1.8, speed: 390, damage: 4, pierce: 1, impactFxKey: 'fx_impact_charge_lv4' }
    },
    chargeCancelOnHit: true,
    chargeCancelOnSlash: true
  },
  sword: {
    comboEnabled: false,
    aimDeadzone: 0.2,
    windows: {
      ground: {
        n: baseSwordWindow({ kind: 'rect', offsetX: 0, offsetY: -26, width: 18, height: 22 }),
        ne: baseSwordWindow({ kind: 'rect', offsetX: 16, offsetY: -18, width: 22, height: 20 }),
        e: baseSwordWindow({ kind: 'rect', offsetX: 20, offsetY: -6, width: 28, height: 18 }),
        se: baseSwordWindow({ kind: 'rect', offsetX: 18, offsetY: 10, width: 24, height: 18 }),
        s: baseSwordWindow({ kind: 'rect', offsetX: 0, offsetY: 18, width: 18, height: 18 }),
        sw: baseSwordWindow({ kind: 'rect', offsetX: -18, offsetY: 10, width: 24, height: 18 }),
        w: baseSwordWindow({ kind: 'rect', offsetX: -20, offsetY: -6, width: 28, height: 18 }),
        nw: baseSwordWindow({ kind: 'rect', offsetX: -16, offsetY: -18, width: 22, height: 20 })
      },
      air: {
        n: baseSwordWindowAir({ kind: 'rect', offsetX: 0, offsetY: -24, width: 16, height: 20 }),
        ne: baseSwordWindowAir({ kind: 'rect', offsetX: 14, offsetY: -16, width: 20, height: 18 }),
        e: baseSwordWindowAir({ kind: 'rect', offsetX: 18, offsetY: -6, width: 24, height: 16 }),
        se: baseSwordWindowAir({ kind: 'rect', offsetX: 14, offsetY: 8, width: 20, height: 16 }),
        s: baseSwordWindowAir({ kind: 'rect', offsetX: 0, offsetY: 16, width: 16, height: 16 }),
        sw: baseSwordWindowAir({ kind: 'rect', offsetX: -14, offsetY: 8, width: 20, height: 16 }),
        w: baseSwordWindowAir({ kind: 'rect', offsetX: -18, offsetY: -6, width: 24, height: 16 }),
        nw: baseSwordWindowAir({ kind: 'rect', offsetX: -14, offsetY: -16, width: 20, height: 18 })
      }
    }
  },
  damage: {
    maxHp: 8,
    iFramesMs: 650,
    hitstunMs: {
      light: 170,
      heavy: 280
    },
    knockback: {
      ground: { x: 165, y: -170 },
      air: { x: 135, y: -130 }
    },
    elementalStatesEnabled: false
  }
}
