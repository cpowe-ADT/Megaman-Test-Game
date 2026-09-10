import Phaser from 'phaser'
import { GAMEPLAY_VIEWPORT_TOP } from '../config/gameplayLayout'

export type ToastLaneItem = {
  kind: 'toast' | 'radio'
  text: string
  speaker?: string
  durationMs: number
}

export type ToastLaneSnapshot = {
  active: boolean
  kind: ToastLaneItem['kind'] | null
  speaker: string | null
  text: string | null
  queued: number
}

/**
 * One presentation lane at the bottom of the playfield for stage toasts and radio lines.
 * Items play one at a time in order, so the boss-gate toast and a radio call can never overlap.
 * Gameplay keeps running; the lane is non-blocking.
 */
export class ToastLane {
  private readonly queue: ToastLaneItem[] = []
  private current: ToastLaneItem | null = null
  private remainingMs = 0
  private readonly container: Phaser.GameObjects.Container
  private readonly background: Phaser.GameObjects.Rectangle
  private readonly speakerText: Phaser.GameObjects.Text
  private readonly bodyText: Phaser.GameObjects.Text
  private readonly laneWidth: number

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = scene.scale
    // Leaves the bottom-right 100px to the HUD's RETRY readout.
    this.laneWidth = width - 24 - 100
    const y = height - 15
    this.background = scene.add.rectangle(0, 0, this.laneWidth, 22, 0x07142a, 0.94).setStrokeStyle(1, 0x62b6ff, 0.8)
    this.speakerText = scene.add.text(-this.laneWidth / 2 + 8, -6, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#7de8ff', fontStyle: 'bold'
    }).setOrigin(0, 0.5)
    this.bodyText = scene.add.text(-this.laneWidth / 2 + 8, 4, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#f4f8ff'
    }).setOrigin(0, 0.5)
    this.container = scene.add.container(12 + this.laneWidth / 2, y, [this.background, this.speakerText, this.bodyText])
    this.container.setScrollFactor(0).setDepth(3000).setVisible(false)
    if (y - 11 < GAMEPLAY_VIEWPORT_TOP) throw new Error('ToastLane must sit below the HUD band')
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())
  }

  enqueue(item: ToastLaneItem): void {
    this.queue.push(item)
    if (!this.current) this.next()
  }

  /** Call once per frame; paused scenes stop calling and the lane holds. */
  update(deltaMs: number): void {
    if (!this.current) return
    this.remainingMs -= deltaMs
    if (this.remainingMs <= 0) this.next()
  }

  isActive(): boolean {
    return this.current !== null
  }

  getDebugState(): ToastLaneSnapshot {
    return {
      active: this.current !== null,
      kind: this.current?.kind ?? null,
      speaker: this.current?.speaker ?? null,
      text: this.current?.text ?? null,
      queued: this.queue.length
    }
  }

  destroy(): void {
    this.queue.length = 0
    this.current = null
    this.container.destroy(true)
  }

  private next(): void {
    this.current = this.queue.shift() ?? null
    if (!this.current) {
      this.container.setVisible(false)
      return
    }
    this.remainingMs = this.current.durationMs
    const hasSpeaker = Boolean(this.current.speaker)
    this.speakerText.setText(hasSpeaker ? String(this.current.speaker).toUpperCase() : '').setVisible(hasSpeaker)
    this.bodyText.setText(this.current.text).setY(hasSpeaker ? 4 : 0)
    this.background.setFillStyle(this.current.kind === 'radio' ? 0x07142a : 0x101827, 0.94)
    this.container.setVisible(true)
  }
}
