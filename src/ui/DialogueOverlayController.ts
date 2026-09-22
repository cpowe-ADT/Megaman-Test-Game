import Phaser from 'phaser'
import InputActions from '../input/InputActions'
import {
  DialoguePlayback,
  type DialoguePlaybackLine,
  type DialoguePlaybackSnapshot
} from '../narrative/DialoguePlayback'
import { GAME_SIZE } from '../config/renderPolicy'

export class DialogueOverlayController {
  private readonly playback = new DialoguePlayback()
  private readonly container: Phaser.GameObjects.Container
  private readonly speakerText: Phaser.GameObjects.Text
  private readonly bodyText: Phaser.GameObjects.Text
  private readonly progressText: Phaser.GameObjects.Text
  private onComplete: (() => void) | null = null
  private completing = false
  private nextAdvanceAtMs = 0

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = GAME_SIZE
    const panelHeight = 112
    const panelY = height - panelHeight / 2 - 7
    const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0x02050c, 0.22)
    const panel = scene.add
      .rectangle(width / 2, panelY, width - 18, panelHeight, 0x07142a, 0.97)
      .setStrokeStyle(2, 0x62b6ff, 0.9)
    const accent = scene.add.rectangle(16, panelY, 4, panelHeight - 12, 0x7de8ff, 0.9)
    this.speakerText = scene.add.text(27, panelY - 45, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#7de8ff',
      fontStyle: 'bold'
    })
    this.bodyText = scene.add.text(27, panelY - 25, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f4f8ff',
      lineSpacing: 2,
      wordWrap: { width: width - 54, useAdvancedWrap: true },
      fixedHeight: 62
    })
    this.progressText = scene.add
      .text(width - 27, panelY + 47, '', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#9ec2ff'
      })
      .setOrigin(1, 1)

    this.container = scene.add.container(0, 0, [dim, panel, accent, this.speakerText, this.bodyText, this.progressText])
    this.container.setScrollFactor(0).setDepth(20000).setVisible(false)

    const advanceHandler = () => {
      if (!this.isActive() || this.scene.time.now < this.nextAdvanceAtMs) return
      this.advance()
    }
    const pointerHandler = () => {
      if (this.isActive() && this.scene.time.now >= this.nextAdvanceAtMs) this.advance()
    }
    const unbindAdvance = InputActions.forScene(scene).onPressed('confirm', advanceHandler)
    panel.setInteractive({ useHandCursor: true })
    panel.on('pointerdown', pointerHandler)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unbindAdvance()
      panel.off('pointerdown', pointerHandler)
      this.destroy()
    })
  }

  play(lines: DialoguePlaybackLine[], onComplete: () => void): void {
    if (lines.length === 0) {
      onComplete()
      return
    }
    this.completing = false
    this.onComplete = onComplete
    this.playback.start(lines)
    this.nextAdvanceAtMs = this.scene.time.now + 160
    this.container.setVisible(true)
    this.render()
  }

  isActive(): boolean {
    return this.playback.snapshot().active
  }

  advance(): void {
    if (!this.isActive() || this.scene.time.now < this.nextAdvanceAtMs) return
    this.playback.advance()
    this.nextAdvanceAtMs = this.scene.time.now + 130
    this.renderOrComplete()
  }

  skip(): void {
    if (!this.isActive()) return
    this.playback.skip()
    this.renderOrComplete()
  }

  getDebugState(): DialoguePlaybackSnapshot {
    return this.playback.snapshot()
  }

  destroy(): void {
    this.onComplete = null
    this.container.destroy(true)
  }

  private renderOrComplete(): void {
    if (this.isActive()) {
      this.render()
      return
    }
    this.container.setVisible(false)
    if (this.completing) return
    this.completing = true
    const complete = this.onComplete
    this.onComplete = null
    complete?.()
  }

  private render(): void {
    const state = this.playback.snapshot()
    this.speakerText.setText(state.speakerName ?? '')
    this.bodyText.setText(state.text ?? '')
    this.progressText.setText(`${state.lineIndex + 1}/${state.lineCount}  ENTER / CLICK • ESC SKIP`)
  }
}
