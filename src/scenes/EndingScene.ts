import Phaser from 'phaser'
import { GAME_SIZE } from '../config/renderPolicy'
import AudioService from '../audio'
import { AUTOMATION } from '../config/automation'
import { TUTORIAL_STAGE_ID, getCampaignStage } from '../content/campaign'
import { ASSET_CREDITS } from '../content/credits.generated'
import { DIALOGUE_REGISTRY } from '../content/dialogue/index'
import { IDENTITY } from '../content/identity'
import InputActions from '../input/InputActions'
import type { DialoguePlaybackLine } from '../narrative/DialoguePlayback'
import { Save, type SaveData } from '../systems/Save'
import { addMenuBackdrop, MENU_COLORS, PIXEL_FONT, pixelFontSize } from '../ui/menu/menuTheme'
import { resolvePlaybackLines, currentStoryPolicy, epilogueSecret } from './game/StoryDirector'
import { campaignRecordRows, creditsLineOnScreenMs, creditsMsPerPx, TITLE_CARD_MS, type CampaignRecordRow } from '../ui/beats/campaignRecord'
import { StoryPanelLayer } from '../ui/story/StoryPanelLayer'
import { endingCardPanel, endingClosePanel, EPILOGUE_PANEL_IDS } from '../ui/story/storyPanels'

export type EndingPhase = 'cards' | 'close' | 'record' | 'credits' | 'title' | 'done'
/**
 * `card`: the stage whose district card is on screen (cards phase only). `record`: the CAMPAIGN RECORD rows (record
 * phase); `credits`: the scroll pace and how long one line stays whole on screen (credits phase); `title`: the final
 * title card's text (title phase). `panel`: the story panel behind the cards and the close (part 12i), null after them.
 */
export type EndingSnapshot = {
  phase: EndingPhase
  page: number
  pageCount: number
  card: string | null
  record: CampaignRecordRow[] | null
  credits: { msPerPx: number; lineOnScreenMs: number } | null
  title: { title: string; subtitle: string } | null
  panel: string | null
}

/** The credits band: the view less the footer band the scroll passes behind. */
const CREDITS_FOOTER_BAND = 24
/** One credits row: the 8px pixel font and its 6px line spacing. */
const CREDITS_LINE_HEIGHT = 14

type CardPage = { kind: 'card'; stageId: string; text: string }
type LinePage = { kind: 'line'; line: DialoguePlaybackLine }
type EndingPage = CardPage | LinePage

/** Part 12i: the story panel fills the frame; the district plate sits at its top and the caption band starts here. */
export const ENDING_CARD_HEIGHT = 150

/** The record as text lines (the rows and rank rule live in `src/ui/beats/campaignRecord.ts`). */
export function buildCampaignRecord(save: SaveData): string[] {
  return campaignRecordRows(save).map((row) => `${row.label}  ${row.value}`)
}

/**
 * The epilogue: one card per district, the close, the CAMPAIGN RECORD card, the credits, the OMEGA RELAY title card,
 * then Title.
 * With all eight capsule caches collected, the secret adds a Drill Hangar card after the eighth and Iona's
 * line opens the close. With the automation story switch off it opens on the record so smoke can still
 * assert completion.
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
  /** The record card and the title card: built when their phase renders, destroyed when it ends. */
  private phaseCard?: Phaser.GameObjects.Container
  private creditsPace: EndingSnapshot['credits'] = null
  private titleTimer?: Phaser.Time.TimerEvent
  private panels?: StoryPanelLayer

  constructor() {
    super('EndingScene')
  }

  /** The four epilogue panels load with this scene and are evicted at its shutdown (StoryPanelLayer). */
  preload(): void {
    StoryPanelLayer.queue(this, EPILOGUE_PANEL_IDS)
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
    const secret = epilogueSecret(Save.load().collectedChecks ?? [], values)
    if (secret) {
      cards.push({ kind: 'card', stageId: TUTORIAL_STAGE_ID, text: secret.card })
      this.closeLines.unshift(secret.line)
    }
    this.pages = cards
    Save.markStorySeen('epilogue', 'credits')
    AudioService.playMusic(this, 'completion')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))

    const { width, height } = GAME_SIZE
    this.cameras.main.setBackgroundColor('#050913')
    addMenuBackdrop(this, 0.6).setDepth(-20)
    this.panels = new StoryPanelLayer(this, EPILOGUE_PANEL_IDS, ENDING_CARD_HEIGHT)
    // The district's name plate over the panel (it was a 120px box that the panel art now fills).
    this.cardBox = this.add.rectangle(width / 2, 20, 200, 22, MENU_COLORS.panel, 0.9)
      .setStrokeStyle(1, MENU_COLORS.cyan, 0.7)
    this.cardLabel = this.add.text(width / 2, 20, '', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(2), color: '#f5f8ff'
    }).setOrigin(0.5)
    this.speakerText = this.add.text(width / 2, ENDING_CARD_HEIGHT + 12, '', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#7de8ff', letterSpacing: 2
    }).setOrigin(0.5)
    this.bodyText = this.add.text(width / 2, ENDING_CARD_HEIGHT + 46, '', {
      fontFamily: 'monospace', fontSize: '11px', color: '#f4f8ff', align: 'center', lineSpacing: 3,
      wordWrap: { width: width - 72, useAdvancedWrap: true }
    }).setOrigin(0.5)
    this.footer = this.add.text(width / 2, height - 14, '', {
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

    this.phase = currentStoryPolicy().enabled && this.pages.length > 0 ? 'cards' : 'record'
    this.render()
  }

  getDebugState(): EndingSnapshot {
    const pageCount = this.phase === 'cards' ? this.pages.length : this.phase === 'close' ? this.closeLines.length : 1
    const card = this.phase === 'cards' ? (this.pages[this.page] as CardPage | undefined)?.stageId ?? null : null
    const record = this.phase === 'record' ? campaignRecordRows(Save.load()) : null
    const credits = this.phase === 'credits' ? this.creditsPace : null
    const title = this.phase === 'title' ? { title: IDENTITY.GAME_TITLE, subtitle: IDENTITY.GAME_SUBTITLE } : null
    return { phase: this.phase, page: this.page, pageCount, card, record, credits, title, panel: this.panels?.current ?? null }
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
      this.phase = 'title'
    } else if (this.phase === 'title') {
      this.phase = 'done'
    }
    this.render()
  }

  /** Esc jumps to the credits; Esc during the credits ends them on the title card; Esc there finishes. */
  skip(): void {
    if (this.finished) return
    this.page = 0
    this.phase = this.phase === 'credits' ? 'title' : this.phase === 'title' ? 'done' : 'credits'
    this.render()
  }

  private render(): void {
    const { width, height } = GAME_SIZE
    this.creditsTween?.stop()
    this.creditsText?.destroy()
    this.creditsText = undefined
    this.phaseCard?.destroy(true)
    this.phaseCard = undefined
    this.titleTimer?.remove(false)
    this.titleTimer = undefined
    this.creditsPace = null
    const showCard = this.phase === 'cards'
    this.cardBox.setVisible(showCard)
    this.cardLabel.setVisible(showCard)
    if (this.phase === 'cards') {
      const card = this.pages[this.page] as CardPage
      const stage = getCampaignStage(card.stageId)
      this.cardBox.setFillStyle(Phaser.Display.Color.HexStringToColor(stage.arena.background.baseColor ?? '#0a2345').color, 0.95)
      this.cardLabel.setText(stage.district.toUpperCase())
      this.cardBox.setSize(this.cardLabel.width + 28, 22)
      this.panels?.show(endingCardPanel(card.stageId))
      this.speakerText.setText('')
      this.bodyText.setText(card.text)
      this.footer.setText(`${this.page + 1} / ${this.pages.length}   ENTER NEXT   ESC CREDITS`)
      return
    }
    if (this.phase === 'close') {
      const line = this.closeLines[this.page]
      this.panels?.show(endingClosePanel(this.page, this.closeLines.length))
      this.speakerText.setText(line.speakerName.toUpperCase())
      this.bodyText.setText(line.text)
      this.footer.setText('ENTER NEXT   ESC CREDITS')
      return
    }
    this.panels?.show(null)
    if (this.phase === 'record') {
      this.speakerText.setText('')
      this.bodyText.setText('')
      this.phaseCard = this.drawRecordCard(campaignRecordRows(Save.load()))
      this.footer.setText('ENTER CREDITS')
      return
    }
    if (this.phase === 'credits') {
      this.speakerText.setText('')
      this.bodyText.setText('')
      this.footer.setText('ENTER / ESC FINISH').setDepth(11)
      // The credits scroll behind a band so they never run through the footer text.
      this.add.rectangle(width / 2, height - 12, width, 24, 0x050913, 0.96).setDepth(10)
      const authored = DIALOGUE_REGISTRY.getGlobalSequence('credits')?.lines.map((line) => line.text) ?? []
      // The title and subtitle close on their own card after the scroll, not in it.
      const lines = [...authored, '', ...ASSET_CREDITS]
      this.creditsText = this.add.text(width / 2, height + 8, lines.join('\n'), {
        fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#dbeafe', align: 'center', lineSpacing: 6,
        wordWrap: { width: width - 60, useAdvancedWrap: true }
      }).setOrigin(0.5, 0)
      // Every line stays whole on screen at least 2.5 s at this pace (creditsMsPerPx, part 12i).
      const span = height - CREDITS_FOOTER_BAND
      const msPerPx = creditsMsPerPx(span, CREDITS_LINE_HEIGHT)
      this.creditsPace = { msPerPx, lineOnScreenMs: creditsLineOnScreenMs(span, CREDITS_LINE_HEIGHT, msPerPx) }
      const distance = this.creditsText.height + height + 20
      this.creditsTween = this.tweens.add({
        targets: this.creditsText, y: -this.creditsText.height - 12, duration: distance * msPerPx, ease: 'Linear',
        onComplete: () => { if (this.phase === 'credits') { this.phase = 'title'; this.render() } }
      })
      return
    }
    if (this.phase === 'title') {
      this.speakerText.setText('')
      this.bodyText.setText('')
      this.footer.setText('ENTER FINISH')
      this.phaseCard = this.drawTitleCard()
      this.titleTimer = this.time.delayedCall(TITLE_CARD_MS, () => { if (this.phase === 'title') { this.phase = 'done'; this.render() } })
      return
    }
    this.finish()
  }

  /** CAMPAIGN RECORD: one panel, a row per figure, the rank last and in gold. */
  private drawRecordCard(rows: CampaignRecordRow[]): Phaser.GameObjects.Container {
    const { width } = GAME_SIZE
    const style = (color: string) => ({ fontFamily: PIXEL_FONT, fontSize: pixelFontSize(2), color })
    const panel = this.add.rectangle(width / 2, 116, width - 48, 196, MENU_COLORS.panel, 0.94).setStrokeStyle(1, MENU_COLORS.cyan, 0.7)
    const heading = this.add.text(width / 2, 34, 'CAMPAIGN RECORD', style('#7de8ff')).setOrigin(0.5)
    const items: Phaser.GameObjects.GameObject[] = [panel, heading]
    rows.forEach((row, index) => {
      const y = 62 + index * 22
      items.push(this.add.text(56, y, row.label, style('#f5f8ff')).setOrigin(0, 0.5))
      items.push(this.add.text(width - 56, y, row.value, style(row.label === 'RANK' ? '#ffc857' : '#7de8ff')).setOrigin(1, 0.5))
    })
    return this.add.container(0, 0, items)
  }

  /** The last card: the game's title and subtitle (`src/content/identity.ts`). */
  private drawTitleCard(): Phaser.GameObjects.Container {
    const { width, height } = GAME_SIZE
    const title = this.add.text(width / 2, height / 2 - 14, IDENTITY.GAME_TITLE, {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(4), color: '#f5f8ff', stroke: '#0a2345', strokeThickness: 4, letterSpacing: 2
    }).setOrigin(0.5)
    const rule = this.add.rectangle(width / 2, height / 2 + 12, 240, 1, MENU_COLORS.cyan, 0.8)
    const subtitle = this.add.text(width / 2, height / 2 + 28, IDENTITY.GAME_SUBTITLE, {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#7de8ff', letterSpacing: 1
    }).setOrigin(0.5)
    return this.add.container(0, 0, [title, rule, subtitle])
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true
    // The title card stays up through the fade (part 12i: the final beat is the OMEGA RELAY card).
    this.speakerText.setText('')
    this.bodyText.setText('')
    this.footer.setText('')
    if (!this.phaseCard) this.phaseCard = this.drawTitleCard()
    this.cameras.main.fadeOut(420, 5, 9, 19)
    this.time.delayedCall(440, () => this.scene.start('Title'))
  }
}

export default EndingScene
