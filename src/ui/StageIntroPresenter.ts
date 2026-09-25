import Phaser from 'phaser'
import type { DialogueOverlayController } from './DialogueOverlayController'
import type { DialoguePlaybackLine } from '../narrative/DialoguePlayback'
import { StageIntroSequence, type StageIntroSnapshot } from '../scenes/game/StageIntroSequence'
import { PIXEL_FONT, pixelFontSize } from './menu/menuTheme'
import { GAME_SIZE } from '../config/renderPolicy'

export type StageIntroPresenterOptions = {
  callout: string
  title: string
  card: boolean
  briefingLines: DialoguePlaybackLine[]
  overlay: DialogueOverlayController | undefined
  onDone: () => void
}

/** Draws the stage card over a black cover, hands the briefing to the dialogue overlay, then fades out. */
export class StageIntroPresenter {
  readonly sequence = new StageIntroSequence()
  private readonly cover: Phaser.GameObjects.Container
  private readonly calloutText: Phaser.GameObjects.Text
  private readonly titleText: Phaser.GameObjects.Text
  private options?: StageIntroPresenterOptions
  private finished = false

  constructor(private readonly scene: Phaser.Scene) {
    const { width, height } = GAME_SIZE
    const black = scene.add.rectangle(width / 2, height / 2, width, height, 0x02050c, 1)
    const band = scene.add.rectangle(width / 2, height / 2, width, 44, 0x07142a, 0.98).setStrokeStyle(1, 0x62b6ff, 0.9)
    this.calloutText = scene.add.text(width / 2, height / 2 - 12, '', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#7de8ff', letterSpacing: 2
    }).setOrigin(0.5)
    this.titleText = scene.add.text(width / 2, height / 2 + 6, '', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(2), color: '#f5f8ff'
    }).setOrigin(0.5)
    this.cover = scene.add.container(0, 0, [black, band, this.calloutText, this.titleText])
    this.cover.setScrollFactor(0).setDepth(19000).setVisible(false)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cover.destroy(true))
  }

  start(options: StageIntroPresenterOptions): void {
    this.options = options
    this.finished = false
    this.calloutText.setText(options.callout.toUpperCase())
    this.titleText.setText(options.title.toUpperCase())
    const briefing = options.briefingLines.length > 0 && Boolean(options.overlay)
    this.sequence.start({ card: options.card, briefing })
    this.applyPhase()
  }

  update(deltaMs: number): void {
    if (this.sequence.tick(deltaMs)) this.applyPhase()
  }

  advance(): void {
    if (this.sequence.snapshot().phase === 'briefing') {
      this.options?.overlay?.advance()
      return
    }
    if (this.sequence.advance()) this.applyPhase()
  }

  skip(): void {
    if (this.sequence.snapshot().phase === 'briefing') {
      this.options?.overlay?.skip()
      return
    }
    if (this.sequence.skip()) this.applyPhase()
  }

  isActive(): boolean {
    return this.sequence.isActive()
  }

  snapshot(): StageIntroSnapshot {
    return this.sequence.snapshot()
  }

  private applyPhase(): void {
    const phase = this.sequence.snapshot().phase
    if (phase === 'card') {
      this.cover.setVisible(true)
      return
    }
    if (phase === 'briefing') {
      this.cover.setVisible(false)
      const options = this.options
      if (!options?.overlay) {
        this.sequence.briefingComplete()
        this.applyPhase()
        return
      }
      options.overlay.play(options.briefingLines, () => {
        if (this.sequence.briefingComplete()) this.applyPhase()
      })
      return
    }
    if (phase === 'done') {
      this.cover.setVisible(false)
      if (!this.finished) {
        this.finished = true
        this.options?.onDone()
      }
    }
  }
}
