import Phaser from 'phaser'
import AudioService from '../audio'
import { GAME_SIZE } from '../config/renderPolicy'
import { IDENTITY } from '../content/identity'
import InputActions from '../input/InputActions'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { HUD_ICONS_ATLAS, weaponHudIconFrame } from '../projectiles/weaponArt'
import { PORTRAIT_ATLAS_KEY, portraitForSpeaker } from './dialoguePortraits'
import { ensurePortraitAtlas } from './portraitAtlasLoader'
import { MENU_COLORS, PIXEL_FONT, pixelFontSize, type PixelFontScale } from './menu/menuTheme'
import { RESULTS_HOLD_MS, stageEntrySnapshot, type StageEntrySnapshot, type StageResults } from './beats/stageResults'
import { WEAPON_GET_STING_SFX, type WeaponGetView } from './beats/weaponGet'

export type StageClearCard = 'weapon_get' | 'results'

export type StageClearShowOptions = {
  stageTitle: string
  /** What the boss-clear claim gave; null (a replayed stage) goes straight to the results. */
  reward: WeaponGetView | null
  results: StageResults
  onNext: () => void
}

export type StageClearDebugState = {
  card: StageClearCard | null
  cards: StageClearCard[]
  weaponGet: WeaponGetView | null
  results: StageResults | null
  holdRemainingMs: number | null
  portraitFrame: string | null
  iconFrame: string | null
}

const DEPTH = 18000
const HERO_PORTRAIT = portraitForSpeaker('hero')

/**
 * The victory path after the defeat dialogue (prompt 04 phase 4.2 items 3 and 5, part 12i, EVAL-P8-004; it replaces
 * the old victory modal): the full-frame weapon-get card (Enter continues), then the stage results, which run the
 * victory return on Enter or after RESULTS_HOLD_MS. Built at stage entry so it holds the entry snapshot the results
 * compare against. Presentation only: the claim already granted the reward.
 */
export class StageClearCards {
  readonly entry: StageEntrySnapshot
  private card: StageClearCard | null = null
  private shown: StageClearCard[] = []
  private options?: StageClearShowOptions
  private container?: Phaser.GameObjects.Container
  private unbind?: () => void
  private holdTimer?: Phaser.Time.TimerEvent
  private enteredAtMs = -1
  private portraitFrame: string | null = null
  private iconFrame: string | null = null

  constructor(private readonly scene: Phaser.Scene, entrySave: Parameters<typeof stageEntrySnapshot>[0]) {
    this.entry = stageEntrySnapshot(entrySave)
  }

  isOpen(): boolean {
    return this.card !== null
  }

  show(options: StageClearShowOptions): void {
    this.close()
    this.options = options
    this.shown = []
    this.unbind = bindMenuConfirmCancel(this.scene, { onConfirm: () => this.confirm(), onCancel: () => this.confirm() })
    this.enter(options.reward ? 'weapon_get' : 'results')
  }

  /** Enter, Esc or a click. A second press in the frame a card opened (Esc is pause and cancel) is ignored. */
  confirm(): void {
    if (!this.card || this.scene.time.now === this.enteredAtMs) return
    if (this.card === 'weapon_get') {
      this.enter('results')
      return
    }
    InputActions.flushTransientState(this.scene)
    const next = this.options?.onNext
    this.destroy()
    next?.()
  }

  destroy(): void {
    this.close()
    this.options = undefined
  }

  getDebugState(): StageClearDebugState {
    const hold = this.holdTimer && this.card === 'results' ? Math.max(0, Math.round(this.holdTimer.getRemaining())) : null
    return {
      card: this.card,
      cards: [...this.shown],
      weaponGet: this.options?.reward ?? null,
      results: this.options?.results ?? null,
      holdRemainingMs: hold,
      portraitFrame: this.card === 'weapon_get' ? this.portraitFrame : null,
      iconFrame: this.card === 'weapon_get' ? this.iconFrame : null
    }
  }

  private close(): void {
    this.unbind?.()
    this.unbind = undefined
    this.holdTimer?.remove(false)
    this.holdTimer = undefined
    this.container?.destroy(true)
    this.container = undefined
    this.card = null
  }

  private enter(card: StageClearCard): void {
    const options = this.options
    if (!options) return
    this.holdTimer?.remove(false)
    this.holdTimer = undefined
    this.container?.destroy(true)
    this.card = card
    this.shown.push(card)
    this.enteredAtMs = this.scene.time.now
    const container = this.scene.add.container(0, 0).setDepth(DEPTH).setScrollFactor(0)
    this.container = container
    container.add(this.backdrop())
    if (card === 'weapon_get' && options.reward) {
      this.drawWeaponGet(container, options.reward)
      AudioService.playSfx(WEAPON_GET_STING_SFX)
    } else {
      this.drawResults(container, options.stageTitle, options.results)
      this.holdTimer = this.scene.time.delayedCall(RESULTS_HOLD_MS, () => this.confirm())
    }
  }

  private backdrop(): Phaser.GameObjects.GameObject[] {
    const { width, height } = GAME_SIZE
    const back = this.scene.add.rectangle(width / 2, height / 2, width, height, MENU_COLORS.ink, 1).setInteractive()
    back.on('pointerdown', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      this.confirm()
    })
    const band = this.scene.add.rectangle(width / 2, 22, width, 28, MENU_COLORS.navy, 1).setStrokeStyle(1, MENU_COLORS.cyan, 0.55)
    const footer = this.text(width / 2, height - 14, 'ENTER CONTINUE', 1, '#8faed8').setOrigin(0.5)
    return [back, band, footer]
  }

  private text(x: number, y: number, value: string, scale: PixelFontScale, color: string, wrapWidth?: number): Phaser.GameObjects.Text {
    return this.scene.add.text(x, y, value, {
      fontFamily: PIXEL_FONT,
      fontSize: pixelFontSize(scale),
      color,
      lineSpacing: 4,
      ...(wrapWidth ? { wordWrap: { width: wrapWidth, useAdvancedWrap: true } } : {})
    })
  }

  private drawWeaponGet(container: Phaser.GameObjects.Container, view: WeaponGetView): void {
    const { width } = GAME_SIZE
    const title = this.text(width / 2, 22, view.title, 2, '#7de8ff').setOrigin(0.5)
    const frame = this.scene.add.rectangle(64, 90, 76, 76, MENU_COLORS.panel, 1).setStrokeStyle(1, MENU_COLORS.cyan, 0.8)
    const callsign = this.text(64, 140, IDENTITY.HERO_CALLSIGN.toUpperCase(), 1, '#8faed8').setOrigin(0.5)
    container.add([title, frame, callsign])
    this.addPortrait(container)
    this.iconFrame = null
    let nameX = 112
    if (view.kind === 'weapon' && this.scene.textures.exists(HUD_ICONS_ATLAS.key)) {
      const iconFrame = weaponHudIconFrame(view.itemId)
      if (this.scene.textures.get(HUD_ICONS_ATLAS.key).has(iconFrame)) {
        container.add(this.scene.add.image(124, 62, HUD_ICONS_ATLAS.key, iconFrame).setDisplaySize(24, 24))
        this.iconFrame = iconFrame
        nameX = 144
      }
    }
    container.add(this.text(nameX, 62, view.name, 2, '#f5f8ff').setOrigin(0, 0.5))
    if (view.energy !== null) container.add(this.text(112, 88, `ENERGY ${view.energy}`, 1, '#f5f8ff').setOrigin(0, 0.5))
    if (view.switchHint) container.add(this.text(width - 24, 88, view.switchHint, 1, '#ffc857').setOrigin(1, 0.5))
    if (view.effect) container.add(this.text(112, 88, view.effect.toUpperCase(), 1, '#ffc857').setOrigin(0, 0.5))
    if (view.tutorial) container.add(this.text(112, 102, view.tutorial, 1, '#dbeafe', width - 136))
    if (view.registry) {
      const panel = this.scene.add.rectangle(width / 2, 186, width - 32, 50, MENU_COLORS.navy, 0.95).setStrokeStyle(1, MENU_COLORS.blue, 0.7)
      const speaker = this.text(24, 168, view.registry.speakerName.toUpperCase(), 1, '#7de8ff')
      const line = this.text(24, 182, view.registry.text, 1, '#f5f8ff', width - 48)
      container.add([panel, speaker, line])
    }
  }

  /** WREN's portrait from the dialogue atlas (loaded on first use; a card shown before it arrives gets it when it does). */
  private addPortrait(container: Phaser.GameObjects.Container): void {
    this.portraitFrame = null
    if (!HERO_PORTRAIT) return
    const place = () => {
      if (this.container !== container || this.card !== 'weapon_get') return
      container.add(this.scene.add.image(64, 90, PORTRAIT_ATLAS_KEY, HERO_PORTRAIT).setDisplaySize(72, 72))
      this.portraitFrame = HERO_PORTRAIT
    }
    if (this.scene.textures.exists(PORTRAIT_ATLAS_KEY)) place()
    else ensurePortraitAtlas(this.scene, place)
  }

  private drawResults(container: Phaser.GameObjects.Container, stageTitle: string, results: StageResults): void {
    const { width } = GAME_SIZE
    const title = this.text(width / 2, 22, 'STAGE CLEAR', 2, '#7de8ff').setOrigin(0.5)
    const stage = this.text(width / 2, 50, stageTitle.toUpperCase(), 1, '#8faed8').setOrigin(0.5)
    container.add([title, stage])
    const rows: Array<[string, string]> = [
      ['TIME', results.timeLabel],
      ['SECRETS FOUND', String(results.secretsFound)],
      ['LIVES USED', String(results.livesUsed)],
      ['DIFFICULTY', results.difficulty]
    ]
    rows.forEach(([label, value], index) => {
      const y = 86 + index * 28
      container.add(this.text(64, y, label, 2, '#f5f8ff').setOrigin(0, 0.5))
      container.add(this.text(width - 64, y, value, 2, index === 0 ? '#ffc857' : '#7de8ff').setOrigin(1, 0.5))
    })
  }
}
