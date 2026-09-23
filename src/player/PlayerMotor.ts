import type Phaser from 'phaser'
import { normalizeMovementSpeedMultiplier, type MovementTuningConfig, type DashConfig } from './config'
import type { PlayerIntent, MotorSnapshot } from './types'

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

  constructor(
    private readonly player: Phaser.Physics.Arcade.Sprite,
    private readonly movement: MovementTuningConfig,
    private readonly dash: DashConfig,
    movementSpeedMultiplier = 1
  ) {
    this.setMovementSpeedMultiplier(movementSpeedMultiplier)
  }

  update(intent: PlayerIntent, deltaMs: number, allowAirDash: boolean): MotorSnapshot {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const dt = Math.max(0, deltaMs)
    const dtSeconds = dt / 1000
    const previousDashRemainingMs = this.dashRemainingMs

    const grounded = body.onFloor() || body.blocked.down
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

    const dashing = this.dashRemainingMs > 0

    if (grounded) {
      this.airDashConsumed = false
      this.isAirDashing = false
    }

    let wallSide: -1 | 0 | 1 = 0
    if (!grounded && body.velocity.y >= 0) {
      if (touchingLeftWall && intent.moveAxis < 0) {
        wallSide = -1
      } else if (touchingRightWall && intent.moveAxis > 0) {
        wallSide = 1
      }
    }

    if (wallSide !== 0 && dashing) {
      this.dashRemainingMs = 0
      this.isAirDashing = false
    }

    const wallSliding = wallSide !== 0
    if (wallSliding) {
      if (body.velocity.y > this.movement.wallSlideFallSpeed) {
        body.setVelocityY(this.movement.wallSlideFallSpeed)
      }
      this.facing = wallSide === -1 ? 1 : -1
    }

    let justJumped = false
    let jumpSource: MotorSnapshot['jumpSource'] = 'none'
    if (intent.jumpPressed && wallSliding) {
      const boostMultiplier = intent.dashHeld ? this.movement.wallJumpBoostMultiplier : 1
      const horizontal =
        this.movement.wallJumpVelocityX *
        boostMultiplier *
        this.wallJumpSpeedMultiplier *
        (wallSide === -1 ? 1 : -1)
      body.setVelocityX(horizontal)
      body.setVelocityY(this.movement.wallJumpVelocityY)
      this.wallJumpRemainingMs = this.movement.wallJumpLockMs
      this.dashRemainingMs = 0
      this.isAirDashing = false
      this.jumpBufferRemainingMs = 0
      this.coyoteRemainingMs = 0
      justJumped = true
      jumpSource = 'wall'
      this.facing = wallSide === -1 ? 1 : -1
    }

    const canUseJump = grounded || this.coyoteRemainingMs > 0
    if (!justJumped && this.jumpBufferRemainingMs > 0 && canUseJump && !dashing) {
      body.setVelocityY(this.movement.jumpVelocity)
      this.jumpBufferRemainingMs = 0
      this.coyoteRemainingMs = 0
      justJumped = true
      jumpSource = grounded ? 'ground' : 'coyote'
    }

    const wantsDash = intent.dashPressed && this.dashCooldownRemainingMs === 0 && this.dashRemainingMs === 0
    if (wantsDash) {
      const canDash = grounded || (allowAirDash && !this.airDashConsumed)
      if (canDash) {
        const dashDir = intent.moveAxis !== 0 ? intent.moveAxis : this.facing
        this.facing = dashDir === -1 ? -1 : 1
        this.dashRemainingMs = this.dash.dashDurationMs
        this.dashCooldownRemainingMs = this.dash.dashCooldownMs
        this.isAirDashing = !grounded
        if (!grounded) {
          this.airDashConsumed = true
        }
      }
    }

    if (grounded && this.dashRemainingMs > 0 && intent.dashReleased && !body.blocked.up) {
      this.dashRemainingMs = 0
      this.isAirDashing = false
    }

    if (this.wallJumpRemainingMs > 0) {
      body.setAccelerationX(0)
    } else if (this.dashRemainingMs > 0) {
      body.setVelocityX(this.dash.dashSpeed * this.movementSpeedMultiplier * this.facing)
      body.setAccelerationX(0)
    } else {
      const targetSpeed = intent.moveAxis * this.movement.runSpeed * this.movementSpeedMultiplier
      const speedDiff = targetSpeed - body.velocity.x
      const accel = grounded
        ? intent.moveAxis === 0
          ? this.movement.decel
          : this.movement.accel
        : this.movement.airAccel
      const step = clamp(speedDiff, -accel * dtSeconds, accel * dtSeconds)
      body.setVelocityX(body.velocity.x + step)

      if (intent.moveAxis !== 0) {
        this.facing = intent.moveAxis
      }
    }

    if (body.velocity.y < 0 && intent.jumpHeld) {
      const correction = this.movement.gravity * (1 - this.movement.jumpHoldGravityScale) * dtSeconds
      body.setVelocityY(body.velocity.y - correction)
    }

    if (body.velocity.y > this.movement.terminalVelocity) {
      body.setVelocityY(this.movement.terminalVelocity)
    }

    const nowGrounded = body.onFloor() || body.blocked.down
    const justLanded = nowGrounded && !this.wasGrounded
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
      isGravityInverted: false
    }
  }

  applyKnockback(x: number, y: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(x, y)
  }

  resetForRespawn(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setVelocity(0, 0)
    body.setAcceleration(0, 0)
    this.coyoteRemainingMs = 0
    this.jumpBufferRemainingMs = 0
    this.dashRemainingMs = 0
    this.dashCooldownRemainingMs = 0
    this.wallJumpRemainingMs = 0
    this.airDashConsumed = false
    this.isAirDashing = false
    this.wasGrounded = false
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
}
