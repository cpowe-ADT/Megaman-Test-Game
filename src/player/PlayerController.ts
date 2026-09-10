import Phaser from 'phaser'
import type { DigitalButtonPad } from '../input/DigitalButtonPad'
import type { PlayerIntent } from './types'

type ActionKeys = {
  dash: Phaser.Input.Keyboard.Key
  shoot: Phaser.Input.Keyboard.Key
  saber: Phaser.Input.Keyboard.Key
}

export class PlayerController {
  private readonly jumpKey?: Phaser.Input.Keyboard.Key
  private previousJumpHeldRaw = false
  private previousShootHeld = false
  private jumpSuppressedUntilMs = 0

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    private readonly actionKeys: ActionKeys,
    private readonly virtualButtons?: DigitalButtonPad
  ) {
    this.jumpKey = this.scene.input.keyboard?.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  }

  sampleIntent(facing: 1 | -1): PlayerIntent {
    const virtual = this.virtualButtons?.sample()
    const left = Boolean(this.cursors.left?.isDown || virtual?.left.held)
    const right = Boolean(this.cursors.right?.isDown || virtual?.right.held)
    const up = Boolean(this.cursors.up?.isDown || virtual?.up.held)
    const down = Boolean(this.cursors.down?.isDown || virtual?.down.held)

    const moveAxis: -1 | 0 | 1 = left && !right ? -1 : right && !left ? 1 : 0

    const now = this.scene.time.now
    const jumpSuppressed = now < this.jumpSuppressedUntilMs
    const rawJumpHeld = Boolean(this.jumpKey?.isDown || virtual?.jump.held)
    const jumpHeld = rawJumpHeld && !jumpSuppressed
    const shootHeld = Boolean(this.actionKeys.shoot?.isDown || virtual?.shoot.held)
    const dashHeld = Boolean(this.actionKeys.dash?.isDown || virtual?.dash.held)

    const rawJumpPressed = rawJumpHeld && !this.previousJumpHeldRaw
    const rawJumpReleased = !rawJumpHeld && this.previousJumpHeldRaw
    const jumpPressed = rawJumpPressed && !jumpSuppressed
    const jumpReleased = rawJumpReleased
    const shootPressed = (shootHeld && !this.previousShootHeld) || Boolean(virtual?.shoot.pressed)
    const shootReleased = (!shootHeld && this.previousShootHeld) || Boolean(virtual?.shoot.released)

    this.previousJumpHeldRaw = rawJumpHeld
    this.previousShootHeld = shootHeld

    const aimY = up && !down ? -1 : down && !up ? 1 : 0
    const aimX = moveAxis !== 0 ? moveAxis : aimY !== 0 ? 0 : facing

    return {
      moveAxis,
      jumpPressed,
      jumpHeld,
      jumpReleased,
      dashPressed: Phaser.Input.Keyboard.JustDown(this.actionKeys.dash) || Boolean(virtual?.dash.pressed),
      dashHeld,
      dashReleased:
        Phaser.Input.Keyboard.JustUp(this.actionKeys.dash) || Boolean(virtual?.dash.released),
      shootPressed,
      shootHeld,
      shootReleased,
      slashPressed: Phaser.Input.Keyboard.JustDown(this.actionKeys.saber) || Boolean(virtual?.saber.pressed),
      crouchHeld: down,
      aim: { x: aimX, y: aimY }
    }
  }

  reset(): void {
    this.previousJumpHeldRaw = false
    this.previousShootHeld = false
    this.jumpSuppressedUntilMs = 0
  }

  suppressJumpFor(ms: number): void {
    this.jumpSuppressedUntilMs = Math.max(this.jumpSuppressedUntilMs, this.scene.time.now + Math.max(0, ms))
  }
}
