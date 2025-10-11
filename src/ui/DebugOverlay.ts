import Phaser from 'phaser'
import { DEBUG_UI } from '../config/debug'

export type DebugOverlaySnapshot = {
  scene: string
  lastKey: string | null
  transition?: string | null
  confirmHint: string
  jumpHint: string
  paused: boolean
}

export class DebugOverlay {
  private readonly text: Phaser.GameObjects.Text
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
  }

  toggle(): void {
    if (!DEBUG_UI) {
      return
    }

    this.visible = !this.visible
    this.text.setVisible(this.visible)
  }

  update(snapshot: DebugOverlaySnapshot): void {
    if (!this.visible || !DEBUG_UI) {
      return
    }

    const lines = [
      `Scene: ${snapshot.scene}`,
      `LastKey: ${snapshot.lastKey ?? '--'}`,
      snapshot.transition ? `Transition: ${snapshot.transition}` : 'Transition: none',
      `Confirm: ${snapshot.confirmHint}`,
      `Jump: ${snapshot.jumpHint}`,
      `Paused: ${snapshot.paused ? 'yes' : 'no'}`
    ]
    this.text.setText(lines.join('\n'))
  }

  destroy(): void {
    this.text.destroy()
  }
}
