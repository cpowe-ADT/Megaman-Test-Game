import Phaser from 'phaser'
import type { MovementTuningConfig, DashConfig } from './config'
import type { PlayerIntent, MotorSnapshot } from './types'

export class PlayerMotor {
  private facing: 1 | -1 = 1
  private coyoteRemainingMs = 0
  private jumpBufferRemainingMs = 0
  private dashRemainingMs = 0
  private dashCooldownRemainingMs = 0
  private airDashConsumed = false
  private isAirDashing = false
  private wasGrounded = false

  constructor(
    private readonly player: Phaser.Physics.Arcade.Sprite,
    private readonly movement: MovementTuningConfig,
    private readonly dash: DashConfig
  ) {}

  update(intent: PlayerIntent, deltaMs: number, allowAirDash: boolean): MotorSnapshot {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const dt = Math.max(0, deltaMs)
    const dtSeconds = dt / 1000

    const grounded = body.onFloor() || body.blocked.down

    this.coyoteRemainingMs = grounded
      ? this.movement.coyoteTimeMs
      : Math.max(0, this.coyoteRemainingMs - dt)
    this.jumpBufferRemainingMs = intent.jumpPressed
      ? this.movement.jumpBufferMs
      : Math.max(0, this.jumpBufferRemainingMs - dt)

    this.dashRemainingMs = Math.max(0, this.dashRemainingMs - dt)
    this.dashCooldownRemainingMs = Math.max(0, this.dashCooldownRemainingMs - dt)

    const dashing = this.dashRemainingMs > 0

    if (grounded) {
      this.airDashConsumed = false
      this.isAirDashing = false
    }

    const canUseJump = grounded || this.coyoteRemainingMs > 0
    const justJumped = this.jumpBufferRemainingMs > 0 && canUseJump && !dashing
    if (justJumped) {
      body.setVelocityY(this.movement.jumpVelocity)
      this.jumpBufferRemainingMs = 0
      this.coyoteRemainingMs = 0
    }

    const wantsDash = intent.dashPressed && this.dashCooldownRemainingMs === 0 && !dashing
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

    if (this.dashRemainingMs > 0) {
      body.setVelocityX(this.dash.dashSpeed * this.facing)
      body.setAccelerationX(0)
    } else {
      const targetSpeed = intent.moveAxis * this.movement.runSpeed
      const speedDiff = targetSpeed - body.velocity.x
      const accel = grounded
        ? intent.moveAxis === 0
          ? this.movement.decel
          : this.movement.accel
        : this.movement.airAccel
      const step = Phaser.Math.Clamp(speedDiff, -accel * dtSeconds, accel * dtSeconds)
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
      nowGrounded && intent.moveAxis !== 0 && Math.sign(body.velocity.x) !== 0 && Math.sign(body.velocity.x) !== intent.moveAxis

    this.wasGrounded = nowGrounded

    return {
      grounded: nowGrounded,
      justLanded,
      justJumped,
      dashing: this.dashRemainingMs > 0,
      airDashing: this.dashRemainingMs > 0 && this.isAirDashing,
      facing: this.facing,
      turnRequested,
      velocityX: body.velocity.x,
      velocityY: body.velocity.y,
      coyoteRemainingMs: this.coyoteRemainingMs,
      jumpBufferRemainingMs: this.jumpBufferRemainingMs,
      dashRemainingMs: this.dashRemainingMs,
      dashCooldownRemainingMs: this.dashCooldownRemainingMs
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
}
