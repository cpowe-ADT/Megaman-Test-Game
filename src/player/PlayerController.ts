import type { SceneInputActions } from '../input/InputActions'
import type { PlayerIntent } from './types'

export class PlayerController {
  private jumpSuppressedUntilMs = 0
  constructor(private readonly clock: { time: { now: number } }, private readonly actions: Pick<SceneInputActions, 'snapshot'>) {}
  sampleIntent(facing: 1 | -1): PlayerIntent {
    const input = this.actions.snapshot()
    const left = input.moveLeft.held, right = input.moveRight.held
    const up = input.aimUp.held, down = input.aimDown.held
    const moveAxis: -1 | 0 | 1 = left && !right ? -1 : right && !left ? 1 : 0
    const aimY = up && !down ? -1 : down && !up ? 1 : 0
    const suppressed = this.clock.time.now < this.jumpSuppressedUntilMs
    return {
      moveAxis, jumpPressed: input.jump.pressed && !suppressed, jumpHeld: input.jump.held && !suppressed,
      jumpReleased: input.jump.released, dashPressed: input.dash.pressed, dashHeld: input.dash.held,
      dashReleased: input.dash.released, shootPressed: input.shoot.pressed, shootHeld: input.shoot.held,
      shootReleased: input.shoot.released, slashPressed: input.saber.pressed, slashReleased: input.saber.released, crouchHeld: down,
      aim: { x: moveAxis !== 0 ? moveAxis : aimY !== 0 ? 0 : facing, y: aimY }
    }
  }
  reset(): void { this.jumpSuppressedUntilMs = 0 }
  suppressJumpFor(ms: number): void {
    this.jumpSuppressedUntilMs = Math.max(this.jumpSuppressedUntilMs, this.clock.time.now + Math.max(0, ms))
  }
}
