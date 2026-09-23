import type Phaser from 'phaser'
import {
  HARD_LANDING_LAG_MS,
  HARD_LANDING_SPEED,
  JUMP_MIN_HOLD_MS,
  WORLD_GRAVITY_Y,
  normalizeMovementSpeedMultiplier,
  type MovementTuningConfig,
  type DashConfig
} from './config'
import type { PlayerIntent, MotorSnapshot } from './types'

/**
 * Solid-terrain query for ledge forgiveness (ceiling corner nudge, lip step-up, dash headroom).
 * Rects are in world pixels; edge contact is not overlap.
 */
export type MotorTerrainProbe = {
  isSolid(x: number, y: number, width: number, height: number): boolean
}

type WallSide = -1 | 0 | 1

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export class PlayerMotor {
  private facing: 1 | -1 = 1
  private coyoteRemainingMs = 0
  private jumpBufferRemainingMs = 0
  private dashRemainingMs = 0
  private dashCooldownRemainingMs = 0
  private wallJumpRemainingMs = 0
  private airDashConsumed = false
  private isAirDashing = false
  private wasGrounded = false
  private movementSpeedMultiplier = 1
  private wallJumpSpeedMultiplier = 1
  /** Dash-jump: |vx| holds at dash speed until landing, wall contact or opposite input. */
  private dashJumpCarry = false
  private dashJumpDirection: 1 | -1 = 1
  /** Armed by a motor jump; releasing jump while rising faster than the cut caps the rise. */
  private jumpCutArmed = false
  private lastWallSide: WallSide = 0
  private wallKickGraceRemainingMs = 0
  private wallStickRemainingMs = 0
  private gravitySuspended = false
  /**
   * Set by a motor jump until the body is seen off the floor or falling. Above 60fps the motor runs
   * on render frames without a physics step, where Arcade's floor flags are stale from before the jump.
   */
  private launchPending = false
  /** Release is ignored while this runs (a tap and a 50ms hold give the same minimum hop). */
  private jumpMinHoldRemainingMs = 0
  /** Control lag after a hard landing: no run, jump or dash; the jump buffer still fills. */
  private landingLagRemainingMs = 0
  private lastAirborneVelocityY = 0
  private terrainProbe?: MotorTerrainProbe
  private standBodyHeight = 0

  constructor(
    private readonly player: Phaser.Physics.Arcade.Sprite,
    private readonly movement: MovementTuningConfig,
    private readonly dash: DashConfig,
    movementSpeedMultiplier = 1
  ) {
    this.setMovementSpeedMultiplier(movementSpeedMultiplier)
  }

  /** Terrain for ledge forgiveness; `standBodyHeight` is the stand body a dash returns to. */
  setTerrainProbe(probe: MotorTerrainProbe | undefined, standBodyHeight: number): void {
    this.terrainProbe = probe
    this.standBodyHeight = Math.max(0, standBodyHeight)
  }

  /**
   * `hitstunRemainingMs` above 0 is the hurt lock: run, jump and dash are skipped and the knockback
   * velocity is held against any input. A hard landing's lag skips them too but lets vx settle.
   */
  update(rawIntent: PlayerIntent, deltaMs: number, allowAirDash: boolean, hitstunRemainingMs = 0): MotorSnapshot {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    this.claimBody(body)
    const dt = Math.max(0, deltaMs)
    const stunned = hitstunRemainingMs > 0
    const controlLocked = stunned || this.landingLagRemainingMs > 0
    this.landingLagRemainingMs = Math.max(0, this.landingLagRemainingMs - dt)
    const intent: PlayerIntent = controlLocked
      ? {
          ...rawIntent,
          moveAxis: 0,
          jumpHeld: stunned ? false : rawIntent.jumpHeld,
          dashPressed: false,
          dashHeld: false,
          dashReleased: false,
          crouchHeld: false
        }
      : rawIntent
    let minHoldActive = this.jumpMinHoldRemainingMs > 0.5
    this.jumpMinHoldRemainingMs = Math.max(0, this.jumpMinHoldRemainingMs - dt)
    const dtSeconds = dt / 1000
    const previousDashRemainingMs = this.dashRemainingMs

    const rawGrounded = body.onFloor() || body.blocked.down
    if (this.launchPending && (!rawGrounded || body.velocity.y >= 0)) {
      this.launchPending = false
    }
    const grounded = rawGrounded && !this.launchPending
    const touchingLeftWall = Boolean(body.blocked.left || body.touching.left)
    const touchingRightWall = Boolean(body.blocked.right || body.touching.right)

    this.coyoteRemainingMs = grounded
      ? this.movement.coyoteTimeMs
      : Math.max(0, this.coyoteRemainingMs - dt)
    this.jumpBufferRemainingMs = intent.jumpPressed
      ? this.movement.jumpBufferMs
      : Math.max(0, this.jumpBufferRemainingMs - dt)

    this.dashRemainingMs = Math.max(0, this.dashRemainingMs - dt)
    this.dashCooldownRemainingMs = Math.max(0, this.dashCooldownRemainingMs - dt)
    this.wallJumpRemainingMs = grounded ? 0 : Math.max(0, this.wallJumpRemainingMs - dt)

    // A grounded dash that would end under a low ceiling keeps going until the stand body fits.
    let dashHeldByCeiling = false
    if (
      grounded &&
      previousDashRemainingMs > 0 &&
      this.dashRemainingMs === 0 &&
      !this.isAirDashing &&
      !this.hasStandHeadroom(body)
    ) {
      this.dashRemainingMs = Math.max(1, dt)
      dashHeldByCeiling = true
    }

    if (grounded) {
      this.airDashConsumed = false
      this.isAirDashing = false
      this.dashJumpCarry = false
      this.jumpCutArmed = false
      this.jumpMinHoldRemainingMs = 0
      minHoldActive = false
      this.lastWallSide = 0
      this.wallKickGraceRemainingMs = 0
      this.wallStickRemainingMs = 0
    }

    if (this.jumpCutArmed) {
      if (body.velocity.y >= 0) {
        this.jumpCutArmed = false
      } else if (!intent.jumpHeld && !minHoldActive && body.velocity.y < this.movement.jumpCutVelocity) {
        body.setVelocityY(this.movement.jumpCutVelocity)
        this.jumpCutArmed = false
      }
    }

    const wallContact: WallSide = grounded ? 0 : touchingLeftWall ? -1 : touchingRightWall ? 1 : 0
    if (wallContact !== 0) {
      this.lastWallSide = wallContact
      this.wallKickGraceRemainingMs = this.movement.wallKickGraceMs
      this.dashJumpCarry = false
    } else {
      this.wallKickGraceRemainingMs = Math.max(0, this.wallKickGraceRemainingMs - dt)
    }

    let wallSide: WallSide = 0
    if (!grounded && body.velocity.y >= 0) {
      if (touchingLeftWall && intent.moveAxis < 0) {
        wallSide = -1
      } else if (touchingRightWall && intent.moveAxis > 0) {
        wallSide = 1
      }
    }

    if (wallSide !== 0 && this.dashRemainingMs > 0) {
      this.dashRemainingMs = 0
      this.isAirDashing = false
    }

    const wallSliding = wallSide !== 0
    if (wallSliding) {
      if (body.velocity.y > this.movement.wallSlideFallSpeed) {
        body.setVelocityY(this.movement.wallSlideFallSpeed)
      }
      this.facing = wallSide === -1 ? 1 : -1
      this.wallStickRemainingMs = this.movement.wallStickMs
    }

    let justJumped = false
    let jumpSource: MotorSnapshot['jumpSource'] = 'none'
    // Wall kicks read the jump buffer, not the raw press, and forgive a short loss of contact.
    const kickSide: WallSide =
      wallContact !== 0 ? wallContact : this.wallKickGraceRemainingMs > 0 ? this.lastWallSide : 0
    if (!controlLocked && this.jumpBufferRemainingMs > 0 && kickSide !== 0) {
      const away: 1 | -1 = kickSide === -1 ? 1 : -1
      const boostMultiplier = intent.dashHeld ? this.movement.wallJumpBoostMultiplier : 1
      body.setVelocityX(this.movement.wallJumpVelocityX * boostMultiplier * this.wallJumpSpeedMultiplier * away)
      body.setVelocityY(this.movement.wallJumpVelocityY)
      this.wallJumpRemainingMs = this.movement.wallJumpLockMs
      this.dashRemainingMs = 0
      this.isAirDashing = false
      this.jumpBufferRemainingMs = 0
      this.coyoteRemainingMs = 0
      this.lastWallSide = 0
      this.wallKickGraceRemainingMs = 0
      this.wallStickRemainingMs = 0
      this.dashJumpCarry = false
      this.jumpCutArmed = true
      this.jumpMinHoldRemainingMs = JUMP_MIN_HOLD_MS
      minHoldActive = true
      this.launchPending = true
      justJumped = true
      jumpSource = 'wall'
      this.facing = away
    }

    const canUseJump = grounded || this.coyoteRemainingMs > 0
    const groundDashing = this.dashRemainingMs > 0 && !this.isAirDashing
    const dashBlocksJump = this.dashRemainingMs > 0 && (this.isAirDashing || !this.hasStandHeadroom(body))
    if (!controlLocked && !justJumped && this.jumpBufferRemainingMs > 0 && canUseJump && !dashBlocksJump) {
      if (groundDashing) {
        this.startDashJumpCarry(this.facing)
      }
      body.setVelocityY(this.movement.jumpVelocity)
      this.jumpBufferRemainingMs = 0
      this.coyoteRemainingMs = 0
      this.jumpCutArmed = true
      this.jumpMinHoldRemainingMs = JUMP_MIN_HOLD_MS
      minHoldActive = true
      this.launchPending = true
      justJumped = true
      jumpSource = grounded ? 'ground' : 'coyote'
    }

    const wantsDash = intent.dashPressed && this.dashCooldownRemainingMs === 0 && this.dashRemainingMs === 0
    if (wantsDash) {
      const dashDir: 1 | -1 = intent.moveAxis === -1 ? -1 : intent.moveAxis === 1 ? 1 : this.facing
      if (justJumped && jumpSource !== 'wall') {
        // Jump and dash on the same frame is a dash-jump from its first frame.
        this.startDashJumpCarry(dashDir)
        this.dashCooldownRemainingMs = this.dash.dashCooldownMs
      } else if (grounded || (allowAirDash && !this.airDashConsumed)) {
        this.facing = dashDir
        this.dashRemainingMs = this.dash.dashDurationMs
        this.isAirDashing = !grounded
        if (!grounded) {
          this.airDashConsumed = true
          this.dashJumpCarry = false
          this.jumpCutArmed = false
        }
      }
    }

    if (
      grounded &&
      this.dashRemainingMs > 0 &&
      intent.dashReleased &&
      !body.blocked.up &&
      this.hasStandHeadroom(body)
    ) {
      this.dashRemainingMs = 0
      this.isAirDashing = false
    }

    // The air dash is flat: vy is zeroed and gravity suspended for its window.
    const airDashActive = this.dashRemainingMs > 0 && this.isAirDashing
    if (airDashActive) {
      body.setVelocityY(0)
    }
    this.setGravitySuspended(body, airDashActive)

    if (this.dashJumpCarry && intent.moveAxis === -this.dashJumpDirection) {
      this.dashJumpCarry = false
    }

    const pressingAwayFromWall = this.lastWallSide !== 0 && intent.moveAxis === -this.lastWallSide
    if (stunned || this.wallJumpRemainingMs > 0) {
      // Hurt lock and wall-kick lock: vx is held (knockback or kick), not steered.
      body.setAccelerationX(0)
    } else if (this.dashRemainingMs > 0) {
      if (dashHeldByCeiling && intent.moveAxis !== 0) {
        this.facing = intent.moveAxis
      }
      body.setVelocityX(this.dash.dashSpeed * this.movementSpeedMultiplier * this.facing)
      body.setAccelerationX(0)
    } else if (this.dashJumpCarry) {
      body.setVelocityX(this.dash.dashSpeed * this.movementSpeedMultiplier * this.dashJumpDirection)
      body.setAccelerationX(0)
    } else if (!grounded && !wallSliding && pressingAwayFromWall && this.wallStickRemainingMs > 0) {
      // Wall stick: pressing away holds the hero on the wall briefly so a kick can still land.
      this.wallStickRemainingMs = Math.max(0, this.wallStickRemainingMs - dt)
      body.setVelocityX(0)
      body.setAccelerationX(0)
    } else {
      const moveAxis = grounded && intent.crouchHeld ? 0 : intent.moveAxis
      const targetSpeed = moveAxis * this.movement.runSpeed * this.movementSpeedMultiplier
      const speedDiff = targetSpeed - body.velocity.x
      const accel = grounded
        ? moveAxis === 0
          ? this.movement.decel
          : this.movement.accel
        : this.movement.airAccel
      const step = clamp(speedDiff, -accel * dtSeconds, accel * dtSeconds)
      body.setVelocityX(body.velocity.x + step)

      if (intent.moveAxis !== 0) {
        this.facing = intent.moveAxis
      }
    }

    // Held rise (and the minimum hold after launch) falls at the lighter gravity; the launch frame keeps jumpVelocity exact.
    if (!justJumped && body.velocity.y < 0 && (intent.jumpHeld || minHoldActive)) {
      const correction = this.movement.gravity * (1 - this.movement.jumpHoldGravityScale) * dtSeconds
      body.setVelocityY(body.velocity.y - correction)
    }

    if (body.velocity.y > this.movement.terminalVelocity) {
      body.setVelocityY(this.movement.terminalVelocity)
    }

    if (this.terrainProbe) {
      if (body.velocity.y < 0) {
        this.nudgeAroundCeilingCorner(body, this.terrainProbe, dtSeconds, intent.moveAxis)
      } else if (grounded) {
        this.stepUpLip(body, this.terrainProbe, dtSeconds, intent.moveAxis)
      }
    }

    if (previousDashRemainingMs > 0 && this.dashRemainingMs === 0) {
      this.dashCooldownRemainingMs = this.dash.dashCooldownMs
    }

    const nowGrounded = (body.onFloor() || body.blocked.down) && !this.launchPending
    const justLanded = nowGrounded && !this.wasGrounded
    const landingSpeed = justLanded ? Math.max(0, Math.round(this.lastAirborneVelocityY)) : 0
    const hardLanding = justLanded && landingSpeed > HARD_LANDING_SPEED
    if (hardLanding) {
      this.landingLagRemainingMs = HARD_LANDING_LAG_MS
    }
    this.lastAirborneVelocityY = nowGrounded ? 0 : body.velocity.y
    const turnRequested =
      nowGrounded &&
      !wallSliding &&
      intent.moveAxis !== 0 &&
      Math.sign(body.velocity.x) !== 0 &&
      Math.sign(body.velocity.x) !== intent.moveAxis

    this.wasGrounded = nowGrounded
    const isDashingNow = this.dashRemainingMs > 0

    return {
      grounded: nowGrounded,
      justLanded,
      justJumped,
      jumpSource,
      dashing: isDashingNow,
      dashStarted: previousDashRemainingMs <= 0 && isDashingNow,
      dashEnded: previousDashRemainingMs > 0 && !isDashingNow,
      airDashing: isDashingNow && this.isAirDashing,
      wallSliding,
      wallSide,
      wallJumping: this.wallJumpRemainingMs > 0,
      facing: this.facing,
      turnRequested,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      coyoteRemainingMs: this.coyoteRemainingMs,
      jumpBufferRemainingMs: this.jumpBufferRemainingMs,
      dashRemainingMs: this.dashRemainingMs,
      dashCooldownRemainingMs: this.dashCooldownRemainingMs,
      isGravityInverted: false,
      landingSpeed,
      hardLanding
    }
  }

  /** Knockback replaces any dash, carry or jump cut; the stale floor flag is not trusted after an upward hit. */
  applyKnockback(x: number, y: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(x, y)
    this.dashRemainingMs = 0
    this.isAirDashing = false
    this.dashJumpCarry = false
    this.jumpCutArmed = false
    this.jumpMinHoldRemainingMs = 0
    this.landingLagRemainingMs = 0
    this.launchPending = y < 0
    this.setGravitySuspended(body, false)
  }

  resetForRespawn(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0, 0)
    body.setAcceleration(0, 0)
    this.setGravitySuspended(body, false)
    this.coyoteRemainingMs = 0
    this.jumpBufferRemainingMs = 0
    this.dashRemainingMs = 0
    this.dashCooldownRemainingMs = 0
    this.wallJumpRemainingMs = 0
    this.airDashConsumed = false
    this.isAirDashing = false
    this.wasGrounded = false
    this.dashJumpCarry = false
    this.jumpCutArmed = false
    this.lastWallSide = 0
    this.wallKickGraceRemainingMs = 0
    this.wallStickRemainingMs = 0
    this.launchPending = false
    this.jumpMinHoldRemainingMs = 0
    this.landingLagRemainingMs = 0
    this.lastAirborneVelocityY = 0
  }

  setFacing(facing: 1 | -1): void {
    this.facing = facing
  }

  getFacing(): 1 | -1 {
    return this.facing
  }

  setMovementSpeedMultiplier(multiplier: number, wallJumpMultiplier = multiplier): void {
    this.wallJumpSpeedMultiplier = normalizeMovementSpeedMultiplier(wallJumpMultiplier)
    this.movementSpeedMultiplier = normalizeMovementSpeedMultiplier(multiplier)
  }

  /** The motor owns X (no Arcade drag) and the hero's gravity (world plus body equals movement.gravity). */
  private claimBody(body: Phaser.Physics.Arcade.Body): void {
    if (body.allowDrag) {
      body.setAllowDrag(false)
    }
    // Optional chaining keeps partial test bodies (velocity and flags only) working.
    const worldGravityY = body.world?.gravity?.y ?? WORLD_GRAVITY_Y
    const bodyGravityY = this.movement.gravity - worldGravityY
    if (body.gravity && body.gravity.y !== bodyGravityY) {
      body.setGravityY(bodyGravityY)
    }
  }

  private setGravitySuspended(body: Phaser.Physics.Arcade.Body, suspended: boolean): void {
    if (suspended === this.gravitySuspended) {
      return
    }
    this.gravitySuspended = suspended
    body.setAllowGravity?.(!suspended)
  }

  private startDashJumpCarry(direction: 1 | -1): void {
    this.dashJumpCarry = true
    this.dashJumpDirection = direction
    this.facing = direction
    this.dashRemainingMs = 0
    this.isAirDashing = false
  }

  private hasStandHeadroom(body: Phaser.Physics.Arcade.Body): boolean {
    const extra = this.standBodyHeight - body.height
    if (!this.terrainProbe || extra <= 0) {
      return true
    }
    return !this.terrainProbe.isSolid(body.x, body.y - extra, body.width, extra)
  }

  /** Rising into a ceiling edge that overlaps the head by up to `cornerNudgePx` slides the hero clear. */
  private nudgeAroundCeilingCorner(
    body: Phaser.Physics.Arcade.Body,
    probe: MotorTerrainProbe,
    dtSeconds: number,
    moveAxis: number
  ): void {
    const rise = Math.max(1, -body.velocity.y * dtSeconds)
    if (!probe.isSolid(body.x, body.y - rise, body.width, rise)) {
      return
    }
    const order: Array<1 | -1> = moveAxis < 0 ? [-1, 1] : [1, -1]
    for (let shift = 1; shift <= this.movement.cornerNudgePx; shift += 1) {
      for (const direction of order) {
        const x = body.x + direction * shift
        if (!probe.isSolid(x, body.y - rise, body.width, rise + body.height)) {
          body.x = x
          return
        }
      }
    }
  }

  /** Running into a lip of up to `stepUpPx` lifts the hero onto it instead of stopping. */
  private stepUpLip(
    body: Phaser.Physics.Arcade.Body,
    probe: MotorTerrainProbe,
    dtSeconds: number,
    moveAxis: number
  ): void {
    const direction = Math.sign(body.velocity.x) || Math.sign(moveAxis)
    if (direction === 0) {
      return
    }
    const ahead = Math.max(1, Math.abs(body.velocity.x) * dtSeconds)
    const probeX = direction > 0 ? body.x + body.width : body.x - ahead
    if (!probe.isSolid(probeX, body.y, ahead, body.height)) {
      return
    }
    for (let lift = 1; lift <= this.movement.stepUpPx; lift += 1) {
      if (
        !probe.isSolid(probeX, body.y - lift, ahead, body.height) &&
        !probe.isSolid(body.x, body.y - lift, body.width, lift)
      ) {
        body.y -= lift
        return
      }
    }
  }
}
