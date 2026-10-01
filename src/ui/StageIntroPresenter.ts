import Phaser from 'phaser'
import AudioService from '../audio'
import InputActions from '../input/InputActions'
import type { DialogueOverlayController } from './DialogueOverlayController'
import type { DialoguePlaybackLine } from '../narrative/DialoguePlayback'
import { ReadyBlink, StageIntroSequence, type StageIntroSnapshot } from '../scenes/game/StageIntroSequence'
import { PIXEL_FONT, pixelFontSize } from './menu/menuTheme'
import { GAME_SIZE } from '../config/renderPolicy'

/** No `stage_intro` sfx exists yet: READY plays this existing key (listed in TESTING.md). */
export const READY_STING_SFX = 'ui_confirm'

export type StageIntroPresenterOptions = {
  callout: string
  title: string
  card: boolean
  briefingLines: DialoguePlaybackLine[]
  overlay: DialogueOverlayController | undefined
  onDone: () => void
}

/** The intro's state plus a respawn READY in progress (`respawnReadyMs` left; `readyVisible` covers both). */
export type StageIntroPresenterSnapshot = StageIntroSnapshot & { respawnReadyMs: number }

/**
 * Draws the stage card over a black cover, hands the briefing to the dialogue overlay, blinks READY, then gives
 * control. Confirm during the card ends it early (the pause key skips the intro through `StoryDirector.skipIntro`).
 * A checkpoint respawn's READY (`playReady`) blinks the same word without the card and without holding control.
 */
export class StageIntroPresenter {
  readonly sequence = new StageIntroSequence()
  private readonly respawnReady = new ReadyBlink()
  private readonly cover: Phaser.GameObjects.Container
  private readonly calloutText: Phaser.GameObjects.Text
  private readonly titleText: Phaser.GameObjects.Text
  private readonly readyText: Phaser.GameObjects.Text
  private options?: StageIntroPresenterOptions
  private finished = false
  private respawnTicking = false

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
    this.readyText = scene.add.text(width / 2, height / 2, 'READY', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(3), color: '#f5f8ff', stroke: '#02050c', strokeThickness: 4, letterSpacing: 4
    }).setOrigin(0.5).setScrollFactor(0).setDepth(19001).setVisible(false)
    const offConfirm = InputActions.forScene(scene).onPressed('confirm', () => {
      if (this.sequence.snapshot().phase === 'card') this.advance()
    })
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      offConfirm()
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tickRespawnReady, this)
      this.cover.destroy(true)
      this.readyText.destroy()
    })
  }

  start(options: StageIntroPresenterOptions): void {
    this.options = options
    this.finished = false
    this.calloutText.setText(options.callout.toUpperCase())
    this.titleText.setText(options.title.toUpperCase())
    const briefing = options.briefingLines.length > 0 && Boolean(options.overlay)
    this.sequence.start({ card: options.card, briefing, ready: true })
    this.applyPhase()
  }

  update(deltaMs: number): void {
    if (this.sequence.tick(deltaMs)) this.applyPhase()
    this.syncReady()
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

  /** A checkpoint respawn: after `delayMs`, READY blinks for `durationMs` over the playfield; control is not held. */
  playReady(durationMs: number, delayMs = 0): boolean {
    this.respawnReady.start(durationMs, delayMs)
    if (!this.respawnTicking) {
      this.respawnTicking = true
      this.scene.events.on(Phaser.Scenes.Events.UPDATE, this.tickRespawnReady, this)
    }
    this.syncReady()
    return true
  }

  isActive(): boolean {
    return this.sequence.isActive()
  }

  snapshot(): StageIntroPresenterSnapshot {
    const intro = this.sequence.snapshot()
    const respawnLit = this.respawnReady.isActive() && this.respawnReady.lit()
    return { ...intro, readyVisible: intro.readyVisible || respawnLit, respawnReadyMs: this.respawnReady.remainingMs() }
  }

  private tickRespawnReady(_time: number, deltaMs: number): void {
    this.respawnReady.tick(deltaMs)
    if (!this.respawnReady.isActive()) {
      this.respawnTicking = false
      this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tickRespawnReady, this)
    }
    this.syncReady()
  }

  private syncReady(): void {
    if (this.readyText.active) this.readyText.setVisible(this.snapshot().readyVisible)
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
    if (phase === 'ready') {
      this.cover.setVisible(false)
      AudioService.playSfx(READY_STING_SFX)
      this.syncReady()
      return
    }
    if (phase === 'done') {
      this.cover.setVisible(false)
      this.syncReady()
      if (!this.finished) {
        this.finished = true
        this.options?.onDone()
      }
    }
  }
}
