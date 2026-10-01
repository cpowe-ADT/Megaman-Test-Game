import Phaser from 'phaser'
import AudioService from '../audio'
import { AUTOMATION } from '../config/automation'
import { IDENTITY } from '../content/identity'
import { DIALOGUE_REGISTRY } from '../content/dialogue/index'
import InputActions from '../input/InputActions'
import type { DialoguePlaybackLine } from '../narrative/DialoguePlayback'
import { Save } from '../systems/Save'
import { addMenuBackdrop, PIXEL_FONT, pixelFontSize } from '../ui/menu/menuTheme'
import { resolvePlaybackLines } from './game/StoryDirector'
import { GAME_SIZE } from '../config/renderPolicy'
import { StoryPanelLayer } from '../ui/story/StoryPanelLayer'
import { PROLOGUE_PANEL_IDS, prologuePanel } from '../ui/story/storyPanels'

export type PrologueSceneData = {
  next: { stageId: string; bossId: string; runtimeBossConfigId?: string }
}

/** `panel`: the story panel behind the page (part 12i, `src/ui/story/storyPanels.ts`). */
export type PrologueSnapshot = { pageIndex: number; pageCount: number; sequenceId: string | null; panel: string | null }

/** The opening pages. Enter advances, Esc skips; both mark the prologue seen and start the tutorial. */
export class PrologueScene extends Phaser.Scene {
  private pages: DialoguePlaybackLine[] = []
  private pageIndex = 0
  private finished = false
  private speakerText!: Phaser.GameObjects.Text
  private bodyText!: Phaser.GameObjects.Text
  private counterText!: Phaser.GameObjects.Text
  private drift?: Phaser.GameObjects.TileSprite
  private entry!: PrologueSceneData
  private panels?: StoryPanelLayer

  constructor() {
    super('Prologue')
  }

  /** The four prologue panels load with this scene and are evicted at its shutdown (StoryPanelLayer). */
  preload(): void {
    StoryPanelLayer.queue(this, PROLOGUE_PANEL_IDS)
  }

  create(data: PrologueSceneData): void {
    this.entry = data
    this.finished = false
    this.pageIndex = 0
    const sequence = DIALOGUE_REGISTRY.getGlobalSequence('prologue')
    this.pages = sequence ? resolvePlaybackLines(sequence.id, sequence.lines, { hero: IDENTITY.HERO_CALLSIGN }) : []
    Save.markStorySeen('prologue')
    AudioService.playMusic(this, 'title')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))

    const { width, height } = GAME_SIZE
    this.cameras.main.setBackgroundColor('#02050c')
    // Under the panels: the backdrop and the dock drift only show if a panel failed to load.
    addMenuBackdrop(this, 0.55).setDepth(-20)
    if (this.textures.exists('bg_dock_0')) {
      this.drift = this.add.tileSprite(width / 2, height / 2 + 20, width, height, 'bg_dock_0').setAlpha(0.22).setDepth(-15)
    }
    this.panels = new StoryPanelLayer(this, PROLOGUE_PANEL_IDS, 158)
    this.speakerText = this.add.text(width / 2, 170, '', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#7de8ff', letterSpacing: 2
    }).setOrigin(0.5)
    this.bodyText = this.add.text(width / 2, 203, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#f4f8ff', align: 'center', lineSpacing: 4,
      wordWrap: { width: width - 56, useAdvancedWrap: true }
    }).setOrigin(0.5)
    this.counterText = this.add.text(width / 2, height - 11, '', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#8faed8', letterSpacing: 1
    }).setOrigin(0.5)

    const actions = InputActions.forScene(this)
    actions.onPressed('confirm', () => this.advance())
    actions.onPressed('cancel', () => this.skip())
    this.input.on('pointerdown', () => { AudioService.unlock(); this.advance() })

    if (AUTOMATION.enabled) {
      ;(window as any).narrativeDebug = { advance: () => this.advance(), skip: () => this.skip(), state: () => this.getDebugState() }
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { delete (window as any).narrativeDebug })
    }
    if (this.pages.length === 0) {
      this.finish()
      return
    }
    this.render()
  }

  update(_time: number, delta: number): void {
    if (this.drift) this.drift.tilePositionX += delta * 0.004
  }

  getDebugState(): PrologueSnapshot {
    return { pageIndex: this.pageIndex, pageCount: this.pages.length, sequenceId: this.pages[0]?.sequenceId ?? null, panel: this.panels?.current ?? null }
  }

  advance(): void {
    if (this.finished) return
    AudioService.playSfx('ui_move')
    this.pageIndex += 1
    if (this.pageIndex >= this.pages.length) {
      this.finish()
      return
    }
    this.render()
  }

  skip(): void {
    if (this.finished) return
    this.pageIndex = this.pages.length
    this.finish()
  }

  private render(): void {
    const page = this.pages[this.pageIndex]
    this.panels?.show(prologuePanel(this.pageIndex, page?.speakerId))
    this.speakerText.setText(page?.speakerName ? page.speakerName.toUpperCase() : '')
    this.bodyText.setText(page?.text ?? '')
    this.counterText.setText(`${this.pageIndex + 1} / ${this.pages.length}   ENTER NEXT   ESC SKIP`)
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true
    AudioService.playSfx('ui_confirm')
    this.cameras.main.fadeOut(160, 2, 5, 12)
    this.time.delayedCall(170, () => this.scene.start('Game', this.entry.next))
  }
}

export default PrologueScene
