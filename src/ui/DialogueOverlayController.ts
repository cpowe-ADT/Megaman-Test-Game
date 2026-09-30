import Phaser from 'phaser'
import { PIXEL_FONT, pixelFontSize } from './pixelFont'
import InputActions from '../input/InputActions'
import {
  DialoguePlayback,
  type DialoguePlaybackLine,
  type DialoguePlaybackSnapshot
} from '../narrative/DialoguePlayback'
import { GAME_SIZE } from '../config/renderPolicy'
import { dialoguePanelLayout, type DialoguePlacement } from './overlayLayout'
import { PORTRAIT_ATLAS_KEY, PORTRAIT_FRAME_SIZE, portraitForSpeaker } from './dialoguePortraits'
import { ensurePortraitAtlas } from './portraitAtlasLoader'
import { typewriterBlipTicked, typewriterConfirmAction, typewriterVisibleChars } from './dialogueTypewriter'
import AudioService from '../audio'
import { Settings } from '../systems/Settings'

/** An existing, quiet, short UI tick (already used for menu cursor moves): the typewriter's blip. */
const TYPEWRITER_BLIP_SFX = 'ui_move'

/** Left margin shared by the portrait slot and the text column (matches the panel's accent bar). */
const TEXT_LEFT = 27
/** Gap between the 48x48 portrait slot and the text column it pushes right. */
const PORTRAIT_GAP = 8
const TEXT_LEFT_WITH_PORTRAIT = TEXT_LEFT + PORTRAIT_FRAME_SIZE + PORTRAIT_GAP

export class DialogueOverlayController {
  private readonly playback = new DialoguePlayback()
  private readonly container: Phaser.GameObjects.Container
  private readonly portraitImage: Phaser.GameObjects.Image
  private portraitSpeakerId: string | null = null
  private readonly speakerText: Phaser.GameObjects.Text
  private readonly bodyText: Phaser.GameObjects.Text
  private readonly progressText: Phaser.GameObjects.Text
  private onComplete: (() => void) | null = null
  private completing = false
  private nextAdvanceAtMs = 0
  private readonly panelRows: { top: number; bottom: number }
  /** The current line's full text and how much of it the typewriter has revealed (`dialogueTypewriter.ts`). */
  private currentText = ''
  private visibleChars = 0
  private lineStartedAtMs = 0

  /** `top` in play (the floor row, where the hero and the boss stand, stays visible); `bottom` on Stage Select. */
  constructor(private readonly scene: Phaser.Scene, placement: DialoguePlacement = 'top') {
    const { width, height } = GAME_SIZE
    const layout = dialoguePanelLayout(placement)
    this.panelRows = { top: layout.top, bottom: layout.bottom }
    const dim = scene.add.rectangle(width / 2, height / 2, width, height, 0x02050c, 0.22)
    const panel = scene.add
      .rectangle(layout.centerX, layout.centerY, layout.width, layout.height, 0x07142a, 0.97)
      .setStrokeStyle(2, 0x62b6ff, 0.9)
    const accent = scene.add.rectangle(16, layout.centerY, 4, layout.height - 12, 0x7de8ff, 0.9)
    this.portraitImage = scene.add
      .image(TEXT_LEFT + PORTRAIT_FRAME_SIZE / 2, layout.centerY, PORTRAIT_ATLAS_KEY)
      .setVisible(false)
    this.speakerText = scene.add.text(TEXT_LEFT_WITH_PORTRAIT, layout.speakerY, '', {
      fontFamily: PIXEL_FONT,
      fontSize: pixelFontSize(1),
      color: '#7de8ff'
    })
    this.bodyText = scene.add.text(TEXT_LEFT_WITH_PORTRAIT, layout.bodyY, '', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#f4f8ff',
      lineSpacing: 2,
      wordWrap: { width: width - TEXT_LEFT_WITH_PORTRAIT - TEXT_LEFT, useAdvancedWrap: true },
      fixedHeight: layout.bodyHeight
    })
    this.progressText = scene.add
      .text(width - 27, layout.progressY, '', {
        fontFamily: PIXEL_FONT,
        fontSize: pixelFontSize(1),
        color: '#9ec2ff'
      })
      .setOrigin(1, layout.progressOriginY)

    this.container = scene.add.container(0, 0, [dim, panel, accent, this.portraitImage, this.speakerText, this.bodyText, this.progressText])
    // The portrait atlas loads on first use (src/ui/portraitAtlasLoader.ts); a line shown before it
    // arrives gets its portrait when it does.
    ensurePortraitAtlas(scene, () => {
      if (this.portraitImage.active) this.renderPortrait(this.portraitSpeakerId)
    })
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
    // The typewriter's own clock: it must keep ticking even while Game.update() early-returns for a
    // blocking dialogue (the same self-hook OmegaActs uses), so it is never a call Game.ts has to make.
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      unbindAdvance()
      panel.off('pointerdown', pointerHandler)
      scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this)
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

  /** Confirm: while the line is still typing this completes it; a second confirm advances (prompt 07 7.5). */
  advance(): void {
    if (!this.isActive() || this.scene.time.now < this.nextAdvanceAtMs) return
    this.nextAdvanceAtMs = this.scene.time.now + 130
    if (typewriterConfirmAction(this.visibleChars, this.currentText.length) === 'complete') {
      this.completeTyping()
      return
    }
    this.playback.advance()
    this.renderOrComplete()
  }

  skip(): void {
    if (!this.isActive()) return
    this.playback.skip()
    this.renderOrComplete()
  }

  /**
   * Playback plus the panel's rows in game pixels (automation: smoke 49 checks the hero stays visible
   * under it) and the typewriter's reveal (`text` is always the full line; `typewriter.visibleChars`
   * is how much of it is drawn so a smoke can catch a genuine mid-line capture).
   */
  getDebugState(): DialoguePlaybackSnapshot & {
    panel: { top: number; bottom: number }
    typewriter: { visibleChars: number; length: number; complete: boolean }
  } {
    return {
      ...this.playback.snapshot(),
      panel: { top: this.panelRows.top, bottom: this.panelRows.bottom },
      typewriter: { visibleChars: this.visibleChars, length: this.currentText.length, complete: this.visibleChars >= this.currentText.length }
    }
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

  /** A new current line: the speaker and portrait show at once; the body starts its typewriter reveal
   * (instantly complete under Reduced Flashing, the Options flag prompt 07 7.5 asks it to honour). */
  private render(): void {
    const state = this.playback.snapshot()
    this.speakerText.setText(state.speakerName ?? '')
    this.currentText = state.text ?? ''
    this.lineStartedAtMs = this.scene.time.now
    this.visibleChars = Settings.get().reducedFlashing ? this.currentText.length : 0
    this.bodyText.setText(this.currentText.slice(0, this.visibleChars))
    this.progressText.setText(`${state.lineIndex + 1}/${state.lineCount}  ENTER / CLICK • ESC SKIP`)
    this.renderPortrait(state.speakerId)
  }

  /** Every frame a line is typing: advances the reveal on the typewriter's clock and blips on its ticks. */
  private tick(time: number): void {
    if (!this.isActive() || this.visibleChars >= this.currentText.length) return
    const next = typewriterVisibleChars(this.currentText.length, time - this.lineStartedAtMs)
    if (next === this.visibleChars) return
    if (typewriterBlipTicked(this.visibleChars, next)) AudioService.playSfx(TYPEWRITER_BLIP_SFX)
    this.visibleChars = next
    this.bodyText.setText(this.currentText.slice(0, this.visibleChars))
  }

  /** Confirm mid-line: reveal the rest of the current line now, without advancing to the next. */
  private completeTyping(): void {
    this.visibleChars = this.currentText.length
    this.bodyText.setText(this.currentText)
  }

  private renderPortrait(speakerId: string | null): void {
    this.portraitSpeakerId = speakerId
    const frame = portraitForSpeaker(speakerId)
    const atlasReady = frame !== null && this.scene.textures.exists(PORTRAIT_ATLAS_KEY) && this.scene.textures.get(PORTRAIT_ATLAS_KEY).has(frame)
    if (!atlasReady) {
      this.portraitImage.setVisible(false)
      return
    }
    this.portraitImage.setTexture(PORTRAIT_ATLAS_KEY, frame as string).setVisible(true)
  }
}
