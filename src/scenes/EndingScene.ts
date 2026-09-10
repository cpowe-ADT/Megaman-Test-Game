import Phaser from 'phaser'
import { GAME_WIDTH, GAME_HEIGHT } from '../config/renderPolicy'
import AudioService from '../audio'
import { AUTOMATION } from '../config/automation'
import { getCampaignStage } from '../content/campaign'
import { ASSET_CREDITS } from '../content/credits.generated'
import { DIALOGUE_REGISTRY } from '../content/dialogue/index'
import { IDENTITY } from '../content/identity'
import InputActions from '../input/InputActions'
import type { DialoguePlaybackLine } from '../narrative/DialoguePlayback'
import { Save, type SaveData } from '../systems/Save'
import { addMenuBackdrop, addMenuPanel, MENU_COLORS, MENU_FONT_CODE, MENU_FONT_DISPLAY } from '../ui/menu/menuTheme'
import { resolvePlaybackLines, currentStoryPolicy } from './game/StoryDirector'

export type EndingPhase = 'cards' | 'close' | 'record' | 'credits' | 'done'
export type EndingSnapshot = { phase: EndingPhase; page: number; pageCount: number }

type CardPage = { kind: 'card'; stageId: string; text: string }
type LinePage = { kind: 'line'; line: DialoguePlaybackLine }
type EndingPage = CardPage | LinePage

/** Reserved layout: the district card art occupies the top 120px (prompt 03 fills it); text lives below. */
export const ENDING_CARD_HEIGHT = 120

export function buildCampaignRecord(save: SaveData): string[] {
  const minutes = Math.floor(save.stats.playTimeMs / 60000)
  const capsules = save.upgradeUnlocks.filter((id) => id.startsWith('armor_') || id.startsWith('chip_')).length
  const rank = save.stats.deaths === 0 ? 'FLAWLESS' : save.stats.deaths < 10 ? 'STEADY' : 'RELENTLESS'
  return [
    `PLAY TIME  ${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`,
    `HEARTS  ${save.heartTanks}/8    SUB TANKS  ${save.subTanks}/4    CAPSULES  ${capsules}/8`,
    `DEATHS  ${save.stats.deaths}    DIFFICULTY  ${save.difficulty.toUpperCase()}`,
    `RANK  ${rank}`
  ]
}

/**
 * The epilogue: one card per district, the close, the campaign record, the credits, then Title.
 * With the automation story switch off it opens on the record so smoke can still assert completion.
 */
export class EndingScene extends Phaser.Scene {
  private phase: EndingPhase = 'cards'
  private pages: EndingPage[] = []
  private closeLines: DialoguePlaybackLine[] = []
  private page = 0
  private finished = false
  private cardBox!: Phaser.GameObjects.Rectangle
  private cardLabel!: Phaser.GameObjects.Text
  private speakerText!: Phaser.GameObjects.Text
  private bodyText!: Phaser.GameObjects.Text
  private footer!: Phaser.GameObjects.Text
  private creditsText?: Phaser.GameObjects.Text
  private creditsTween?: Phaser.Tweens.Tween

  constructor() {
    super('EndingScene')
  }

  create(): void {
    this.finished = false
    this.page = 0
    const values = { hero: IDENTITY.HERO_CALLSIGN }
    const epilogue = DIALOGUE_REGISTRY.getGlobalSequence('epilogue')
    const cards: EndingPage[] = []
    this.closeLines = []
    if (epilogue) {
      const resolved = resolvePlaybackLines(epilogue.id, epilogue.lines, values)
      epilogue.lines.forEach((line, index) => {
        if (line.card) cards.push({ kind: 'card', stageId: line.card, text: resolved[index].text })
        else this.closeLines.push(resolved[index])
      })
    }
    this.pages = cards
    Save.markStorySeen('epilogue', 'credits')
    AudioService.playMusic(this, 'completion')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))

    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#050913')
    addMenuBackdrop(this, 0.6)
    this.cardBox = this.add.rectangle(width / 2, ENDING_CARD_HEIGHT / 2 + 6, width - 24, ENDING_CARD_HEIGHT - 4, MENU_COLORS.panel, 0.9)
      .setStrokeStyle(1, MENU_COLORS.cyan, 0.7)
    this.cardLabel = this.add.text(width / 2, ENDING_CARD_HEIGHT / 2 + 6, '', {
      fontFamily: MENU_FONT_DISPLAY, fontSize: '14px', color: '#f5f8ff'
    }).setOrigin(0.5)
    this.speakerText = this.add.text(width / 2, ENDING_CARD_HEIGHT + 14, '', {
      fontFamily: MENU_FONT_CODE, fontSize: '9px', color: '#7de8ff', letterSpacing: 2
    }).setOrigin(0.5)
    this.bodyText = this.add.text(width / 2, ENDING_CARD_HEIGHT + 48, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f4f8ff', align: 'center', lineSpacing: 3,
      wordWrap: { width: width - 72, useAdvancedWrap: true }
    }).setOrigin(0.5)
    this.footer = this.add.text(width / 2, height - 14, '', {
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

    this.phase = currentStoryPolicy().enabled && this.pages.length > 0 ? 'cards' : 'record'
    this.render()
  }

  getDebugState(): EndingSnapshot {
    const pageCount = this.phase === 'cards' ? this.pages.length : this.phase === 'close' ? this.closeLines.length : 1
    return { phase: this.phase, page: this.page, pageCount }
  }

  advance(): void {
    if (this.finished) return
    AudioService.playSfx('ui_move')
    if (this.phase === 'cards') {
      this.page += 1
      if (this.page >= this.pages.length) { this.page = 0; this.phase = this.closeLines.length > 0 ? 'close' : 'record' }
    } else if (this.phase === 'close') {
      this.page += 1
      if (this.page >= this.closeLines.length) { this.page = 0; this.phase = 'record' }
    } else if (this.phase === 'record') {
      this.phase = 'credits'
    } else if (this.phase === 'credits') {
      this.phase = 'done'
    }
    this.render()
  }

  /** Esc jumps to the credits; a second Esc during the credits ends them. */
  skip(): void {
    if (this.finished) return
    this.page = 0
    this.phase = this.phase === 'credits' ? 'done' : 'credits'
    this.render()
  }

  private render(): void {
    const { width, height } = this.scale
    this.creditsTween?.stop()
    this.creditsText?.destroy()
    this.creditsText = undefined
    const showCard = this.phase === 'cards'
    this.cardBox.setVisible(showCard)
    this.cardLabel.setVisible(showCard)
    if (this.phase === 'cards') {
      const card = this.pages[this.page] as CardPage
      const stage = getCampaignStage(card.stageId)
      this.cardBox.setFillStyle(Phaser.Display.Color.HexStringToColor(stage.arena.background.baseColor ?? '#0a2345').color, 0.95)
      this.cardLabel.setText(stage.district.toUpperCase())
      this.speakerText.setText('')
      this.bodyText.setText(card.text)
      this.footer.setText(`${this.page + 1} / ${this.pages.length}   ENTER NEXT   ESC CREDITS`)
      return
    }
    if (this.phase === 'close') {
      const line = this.closeLines[this.page]
      this.speakerText.setText(line.speakerName.toUpperCase())
      this.bodyText.setText(line.text)
      this.footer.setText('ENTER NEXT   ESC CREDITS')
      return
    }
    if (this.phase === 'record') {
      this.speakerText.setText('CAMPAIGN RECORD')
      this.bodyText.setText(buildCampaignRecord(Save.load()).join('\n'))
      this.footer.setText('ENTER CREDITS')
      return
    }
    if (this.phase === 'credits') {
      this.speakerText.setText('')
      this.bodyText.setText('')
      this.footer.setText('ENTER FINISH   ESC FINISH')
      const authored = DIALOGUE_REGISTRY.getGlobalSequence('credits')?.lines.map((line) => line.text) ?? []
      const lines = [...authored, '', ...ASSET_CREDITS, '', IDENTITY.GAME_TITLE, IDENTITY.GAME_SUBTITLE]
      this.creditsText = this.add.text(width / 2, height + 8, lines.join('\n'), {
        fontFamily: 'monospace', fontSize: '9px', color: '#dbeafe', align: 'center', lineSpacing: 6,
        wordWrap: { width: width - 60, useAdvancedWrap: true }
      }).setOrigin(0.5, 0)
      // The shortest line stays readable for at least 2.5s at this speed (prompt 04 tunes it against real credits).
      const distance = this.creditsText.height + height + 20
      this.creditsTween = this.tweens.add({
        targets: this.creditsText, y: -this.creditsText.height - 12, duration: distance * 28, ease: 'Linear',
        onComplete: () => { if (this.phase === 'credits') { this.phase = 'done'; this.render() } }
      })
      return
    }
    this.finish()
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true
    this.speakerText.setText('')
    this.bodyText.setText(`${IDENTITY.ANTAGONIST_NAME} DEFEATED\n\nThe districts choose their future.`)
    this.footer.setText('')
    addMenuPanel(this, GAME_WIDTH / 2, GAME_HEIGHT / 2, 260, 70, 0.0)
    this.cameras.main.fadeOut(420, 5, 9, 19)
    this.time.delayedCall(440, () => this.scene.start('Title'))
  }
}

export default EndingScene
