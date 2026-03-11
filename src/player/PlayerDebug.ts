import Phaser from 'phaser'
import type { CombatSnapshot, MotorSnapshot, ResolvedHitbox } from './types'

export class PlayerDebug {
  private readonly text: Phaser.GameObjects.Text
  private readonly gfx: Phaser.GameObjects.Graphics
  private visible = false

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Arcade.Sprite
  ) {
    this.text = this.scene.add
      .text(8, 58, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#d2f3ff'
      })
      .setScrollFactor(0)
      .setDepth(2001)
      .setVisible(false)

    this.gfx = this.scene.add.graphics().setDepth(2000)
    this.gfx.setVisible(false)
  }

  toggle(force?: boolean): void {
    this.visible = force ?? !this.visible
    this.text.setVisible(this.visible)
    this.gfx.setVisible(this.visible)
    if (!this.visible) {
      this.gfx.clear()
      this.text.setText('')
    }
  }

  draw(motor: MotorSnapshot, combat: CombatSnapshot, activeHitbox?: ResolvedHitbox): void {
    if (!this.visible) {
      return
    }

    this.text.setText([
      `locomotion grounded=${motor.grounded} dash=${motor.dashing} airDash=${motor.airDashing}`,
      `timers coyote=${Math.round(motor.coyoteRemainingMs)} buffer=${Math.round(motor.jumpBufferRemainingMs)} dashCd=${Math.round(motor.dashCooldownRemainingMs)}`,
      `combat charge=${combat.chargeLevel} charging=${combat.charging} slash=${combat.slashPhase ?? '-'} dir=${combat.slashDirection ?? '-'} iframes=${Math.round(combat.iFramesRemainingMs)}`
    ])

    this.gfx.clear()
    if (!activeHitbox) {
      return
    }

    this.gfx.lineStyle(1, 0x00ff88, 1)
    if (activeHitbox.shape.kind === 'rect') {
      const { offsetX, offsetY, width, height } = activeHitbox.shape
      const originX = this.player.x + offsetX
      const originY = this.player.y + offsetY
      this.gfx.strokeRect(originX - width * 0.5, originY - height * 0.5, width, height)
      return
    }

    this.gfx.strokeCircle(
      this.player.x + activeHitbox.shape.offsetX,
      this.player.y + activeHitbox.shape.offsetY,
      activeHitbox.shape.radius
    )
  }

  destroy(): void {
    this.text.destroy()
    this.gfx.destroy()
  }
}
