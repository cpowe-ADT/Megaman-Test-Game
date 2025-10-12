import Phaser from 'phaser'
import { DEBUG_UI } from '../config/debug'

export type DebugOverlaySnapshot = {
  sceneName: string
  managerName?: string
  confirmHint: string
  jumpHint: string
  pauseHint?: string
  transitionRequestedAt?: number
}

export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text
  private readonly warningText: Phaser.GameObjects.Text
  private visible = false

  constructor(scene: Phaser.Scene) {
    this.text = scene.add
      .text(6, 6, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#e0f2ff',
        backgroundColor: 'rgba(8, 12, 20, 0.65)',
        padding: { x: 6, y: 4 }
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false)
    this.text.setShadow(1, 1, '#000000', 2, true, true)

    this.warningText = scene.add
      .text(8, 60, '', {
        fontFamily: 'monospace',
        fontSize: '12px',
        color: '#ffcb6b',
        backgroundColor: 'rgba(32, 16, 0, 0.75)',
        padding: { x: 6, y: 4 }
      })
      .setScrollFactor(0)
      .setDepth(1000)
      .setVisible(false)
    this.warningText.setShadow(1, 1, '#000000', 2, true, true)
  }

  toggle(): void {
    if (!DEBUG_UI) {
      return
    }

    this.visible = !this.visible
    this.text.setVisible(this.visible)
    this.warningText.setVisible(false)
  }

  update(snapshot: DebugOverlaySnapshot): void {
    if (!this.visible || !DEBUG_UI) {
      return
    }

    const sceneLine = snapshot.managerName ? `Scene: ${snapshot.managerName}` : `Scene: ${snapshot.sceneName}`
    const lines = [
      sceneLine,
      `Confirm: ${snapshot.confirmHint}`,
      `Jump: ${snapshot.jumpHint}`
    ]

    if (snapshot.pauseHint) {
      lines.push(`Pause: ${snapshot.pauseHint}`)
    }

    this.text.setText(lines.join('\n'))

    if (snapshot.transitionRequestedAt) {
      const elapsed = performance.now() - snapshot.transitionRequestedAt
      if (elapsed > 500) {
        this.warningText.setText('⚠ transition stalled >500ms')
        this.warningText.setVisible(true)
      } else {
        this.warningText.setVisible(false)
      }
    } else {
      this.warningText.setVisible(false)
    }
  }

  destroy(): void {
    this.text.destroy()
    this.warningText.destroy()
  }
}
