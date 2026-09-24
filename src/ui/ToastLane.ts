import type Phaser from 'phaser'
import { GAMEPLAY_VIEWPORT_TOP } from '../config/gameplayLayout'
import { GAME_SIZE } from '../config/renderPolicy'

export type ToastLaneItem = {
  /** `hint`: a UI key hint (never dialogue), e.g. the tutorial's `DASH: Z`. */
  kind: 'toast' | 'radio' | 'hint'
  /** Items on one channel replace each other through `supersede` (the tutorial coach). */
  channel?: string
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
  bounds: ReturnType<ToastLane['getBounds']> | null
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
  private readonly bottomY: number

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = GAME_SIZE
    // Full width: the RETRY readout moved into the HUD band. Lines wrap inside the lane and the lane grows
    // upward to fit them; one unwrapped line used to run past the panel and under RETRY (29 of 32 radio lines).
    this.laneWidth = width - 24
    this.bottomY = height - 4
    this.background = scene.add.rectangle(0, 0, this.laneWidth, 22, 0x07142a, 0.94).setStrokeStyle(1, 0x62b6ff, 0.8)
    this.speakerText = scene.add.text(-this.laneWidth / 2 + 8, 0, '', {
      fontFamily: 'monospace', fontSize: '8px', color: '#7de8ff', fontStyle: 'bold'
    }).setOrigin(0, 0)
    this.bodyText = scene.add.text(-this.laneWidth / 2 + 8, 0, '', {
      fontFamily: 'monospace', fontSize: '9px', color: '#f4f8ff', lineSpacing: 1,
      wordWrap: { width: this.laneWidth - 16, useAdvancedWrap: true }
    }).setOrigin(0, 0)
    this.container = scene.add.container(12 + this.laneWidth / 2, this.bottomY - 11, [this.background, this.speakerText, this.bodyText])
    this.container.setScrollFactor(0).setDepth(3000).setVisible(false)
    scene.events.once('shutdown', () => this.destroy()) // Phaser.Scenes.Events.SHUTDOWN; a type-only import keeps the lane testable without Phaser
  }

  /** Lane rectangle in game pixels, for automation: the text must stay inside it and inside the frame. */
  getBounds(): { x: number; y: number; width: number; height: number; textBottom: number; textRight: number } {
    const height = this.background.height
    const top = this.container.y - height / 2
    return {
      x: this.container.x - this.laneWidth / 2,
      y: top,
      width: this.laneWidth,
      height,
      textBottom: this.container.y + this.bodyText.y + this.bodyText.height,
      textRight: this.container.x + this.bodyText.x + this.bodyText.width
    }
  }

  enqueue(item: ToastLaneItem): void {
    this.queue.push(item)
    if (!this.current) this.next()
  }

  /**
   * Replaces a channel: its queued items are dropped, its playing item ends now, and `items` play
   * next, ahead of other channels' queued items. The tutorial coach follows the armed lock this way
   * instead of queueing behind a stale prompt.
   */
  supersede(channel: string, items: ToastLaneItem[]): void {
    for (let index = this.queue.length - 1; index >= 0; index -= 1) {
      if (this.queue[index].channel === channel) this.queue.splice(index, 1)
    }
    this.queue.unshift(...items.map((item) => ({ ...item, channel })))
    if (!this.current || this.current.channel === channel) this.next()
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
      queued: this.queue.length,
      bounds: this.current ? this.getBounds() : null
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
    this.bodyText.setText(this.current.text)
    const padding = 4
    const speakerHeight = hasSpeaker ? 10 : 0
    const laneHeight = Math.max(22, padding * 2 + speakerHeight + Math.ceil(this.bodyText.height))
    this.background.setSize(this.laneWidth, laneHeight)
    this.container.setY(this.bottomY - laneHeight / 2)
    this.speakerText.setY(-laneHeight / 2 + padding)
    this.bodyText.setY(-laneHeight / 2 + padding + speakerHeight)
    this.background.setFillStyle(this.current.kind === 'radio' ? 0x07142a : this.current.kind === 'hint' ? 0x2a2208 : 0x101827, 0.94)
    this.container.setVisible(true)
    if (this.container.y - laneHeight / 2 < GAMEPLAY_VIEWPORT_TOP) throw new Error('ToastLane text is too long for the playfield')
  }
}
