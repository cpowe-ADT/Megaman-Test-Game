import Phaser from 'phaser'
import AudioService from '../audio'
import { AUTOMATION } from '../config/automation'
import { IDENTITY } from '../content/identity'
import { DIALOGUE_REGISTRY } from '../content/dialogue/index'
import InputActions from '../input/InputActions'
import type { DialoguePlaybackLine } from '../narrative/DialoguePlayback'
import { Save } from '../systems/Save'
import { addMenuBackdrop, MENU_FONT_CODE } from '../ui/menu/menuTheme'
import { resolvePlaybackLines } from './game/StoryDirector'
import { GAME_SIZE } from '../config/renderPolicy'

export type PrologueSceneData = {
  next: { stageId: string; bossId: string; runtimeBossConfigId?: string }
}

export type PrologueSnapshot = { pageIndex: number; pageCount: number; sequenceId: string | null }

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

  constructor() {
    super('Prologue')
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
    addMenuBackdrop(this, 0.55)
    if (this.textures.exists('bg_dock_0')) {
      this.drift = this.add.tileSprite(width / 2, height / 2 + 20, width, height, 'bg_dock_0').setAlpha(0.22)
    }
    this.speakerText = this.add.text(width / 2, 74, '', {
      fontFamily: MENU_FONT_CODE, fontSize: '9px', color: '#7de8ff', letterSpacing: 2
    }).setOrigin(0.5)
    this.bodyText = this.add.text(width / 2, 118, '', {
      fontFamily: 'monospace', fontSize: '12px', color: '#f4f8ff', align: 'center', lineSpacing: 4,
      wordWrap: { width: width - 96, useAdvancedWrap: true }
    }).setOrigin(0.5)
    this.counterText = this.add.text(width / 2, height - 22, '', {
      fontFamily: MENU_FONT_CODE, fontSize: '8px', color: '#8faed8', letterSpacing: 1
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
    return { pageIndex: this.pageIndex, pageCount: this.pages.length, sequenceId: this.pages[0]?.sequenceId ?? null }
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
