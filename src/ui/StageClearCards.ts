import Phaser from 'phaser'
import AudioService from '../audio'
import { GAME_SIZE } from '../config/renderPolicy'
import { IDENTITY } from '../content/identity'
import { getWeaponConfig } from '../content/weapons'
import InputActions from '../input/InputActions'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { HUD_ICONS_ATLAS, weaponArtFrame, weaponArtTextureKey, weaponHudIconFrame } from '../projectiles/weaponArt'
import { typewriterVisibleChars } from './dialogueTypewriter'
import { PORTRAIT_ATLAS_KEY, portraitForSpeaker } from './dialoguePortraits'
import { ensurePortraitAtlas } from './portraitAtlasLoader'
import { MENU_COLORS, PIXEL_FONT, pixelFontSize, type PixelFontScale } from './menu/menuTheme'
import { RESULTS_HOLD_MS, stageEntrySnapshot, type StageEntrySnapshot, type StageResults } from './beats/stageResults'
import { WEAPON_GET_STING_SFX, type WeaponGetView } from './beats/weaponGet'
import { buildWeaponDemoView, WEAPON_DEMO_BEAT_MS, WEAPON_DEMO_TOTAL_MS, weaponDemoPhaseAt, type WeaponDemoView } from './beats/weaponDemo'

export type StageClearCard = 'weapon_get' | 'weapon_demo' | 'results'

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
  /** 13d, EVAL-P13-013: `render_game_to_text().victory.weaponDemo` (and `.weaponDemo` at the top level, main.ts). */
  weaponDemo: { weaponId: string; name: string; phase: string; elapsedMs: number; chargedMoveName: string | null } | null
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
  private demoView: WeaponDemoView | null = null
  private demoElapsedMs = 0
  private demoNameText?: Phaser.GameObjects.Text
  private demoUseLineText?: Phaser.GameObjects.Text
  private demoPlainShot?: Phaser.GameObjects.Sprite
  private demoChargedShot?: Phaser.GameObjects.Sprite
  private demoChargeAura?: Phaser.GameObjects.Rectangle

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
      // A weapon (not an item or upgrade) demos its new move before the results (13d, EVAL-P13-013).
      this.enter(this.options?.reward?.kind === 'weapon' ? 'weapon_demo' : 'results')
      return
    }
    if (this.card === 'weapon_demo') {
      this.enter('results')
      return
    }
    InputActions.flushTransientState(this.scene)
    const next = this.options?.onNext
    this.destroy()
    next?.()
  }

  /** Per frame while the demo card is open (13d): the typewriter reveal and the scripted shots. A no-op otherwise. */
  update(deltaMs: number): void {
    if (this.card !== 'weapon_demo' || !this.demoView) return
    this.demoElapsedMs += Math.max(0, deltaMs)
    const phase = weaponDemoPhaseAt(this.demoElapsedMs)
    if (this.demoNameText) {
      const full = this.demoView.name
      this.demoNameText.setText(full.slice(0, typewriterVisibleChars(full.length, this.demoElapsedMs - WEAPON_DEMO_BEAT_MS.name)))
    }
    if ((phase === 'plain' || phase === 'charge' || phase === 'charged' || phase === 'useLine' || phase === 'done') && this.demoPlainShot && !this.demoPlainShot.getData('fired')) {
      this.demoPlainShot.setData('fired', true).setVisible(true)
      this.scene.tweens.add({ targets: this.demoPlainShot, x: this.demoPlainShot.x + 288, duration: 480, ease: 'Linear' })
    }
    this.demoChargeAura?.setVisible(phase === 'charge')
    if ((phase === 'charged' || phase === 'useLine' || phase === 'done') && this.demoChargedShot && !this.demoChargedShot.getData('fired')) {
      this.demoChargedShot.setData('fired', true).setVisible(true)
      this.scene.tweens.add({ targets: this.demoChargedShot, x: this.demoChargedShot.x + 288, duration: 480, ease: 'Linear' })
    }
    if (this.demoUseLineText && (phase === 'useLine' || phase === 'done')) {
      const full = this.demoView.useLine
      this.demoUseLineText.setText(full.slice(0, typewriterVisibleChars(full.length, this.demoElapsedMs - WEAPON_DEMO_BEAT_MS.useLine)))
    }
  }

  destroy(): void {
    this.close()
    this.options = undefined
  }

  getDebugState(): StageClearDebugState {
    const hold = this.holdTimer && (this.card === 'results' || this.card === 'weapon_demo') ? Math.max(0, Math.round(this.holdTimer.getRemaining())) : null
    return {
      card: this.card,
      cards: [...this.shown],
      weaponGet: this.options?.reward ?? null,
      results: this.options?.results ?? null,
      holdRemainingMs: hold,
      portraitFrame: this.card === 'weapon_get' ? this.portraitFrame : null,
      iconFrame: this.card === 'weapon_get' ? this.iconFrame : null,
      weaponDemo:
        this.card === 'weapon_demo' && this.demoView
          ? {
              weaponId: this.demoView.weaponId,
              name: this.demoView.name,
              phase: weaponDemoPhaseAt(this.demoElapsedMs),
              elapsedMs: Math.round(this.demoElapsedMs),
              chargedMoveName: this.demoView.charged?.moveName ?? null
            }
          : null
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
    this.demoView = null
    this.demoElapsedMs = 0
    this.demoNameText = undefined
    this.demoUseLineText = undefined
    this.demoPlainShot = undefined
    this.demoChargedShot = undefined
    this.demoChargeAura = undefined
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
    } else if (card === 'weapon_demo' && options.reward) {
      this.drawWeaponDemo(container, options.reward)
      this.holdTimer = this.scene.time.delayedCall(WEAPON_DEMO_TOTAL_MS, () => this.confirm())
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

  /**
   * A plain band (13d, EVAL-P13-013): the hero fires the weapon at a target dummy, then its charged form,
   * while the name and a one-line use type out (`update`, driven by the real `resolvePlayerShot` script in
   * `weaponDemo.ts`). Grants nothing (rule 8): these are decorative sprites in this card's own container,
   * never the live ProjectileSystem or player energy.
   */
  private drawWeaponDemo(container: Phaser.GameObjects.Container, reward: WeaponGetView): void {
    const { width, height } = GAME_SIZE
    const demo = buildWeaponDemoView(reward.itemId)
    this.demoView = demo
    this.demoElapsedMs = 0
    const title = this.text(width / 2, 22, 'WEAPON DEMO', 2, '#7de8ff').setOrigin(0.5)
    const laneY = height / 2 + 6
    const heroX = 72
    const dummyX = width - 72
    const band = this.scene.add.rectangle(width / 2, laneY, width - 32, 64, MENU_COLORS.panel, 1).setStrokeStyle(1, MENU_COLORS.cyan, 0.6)
    const hero = this.scene.add.rectangle(heroX, laneY, 14, 28, 0xdbeafe, 1)
    const dummy = this.scene.add.rectangle(dummyX, laneY, 18, 28, 0x3a4a68, 1).setStrokeStyle(1, 0xff6677, 0.9)
    const dummyLabel = this.text(dummyX, laneY + 24, 'DUMMY', 1, '#ff98a0').setOrigin(0.5)
    this.demoNameText = this.text(width / 2, 48, '', 2, '#f5f8ff').setOrigin(0.5)
    this.demoUseLineText = this.text(width / 2, laneY + 46, '', 1, '#dbeafe', width - 64).setOrigin(0.5, 0)
    container.add([title, band, hero, dummy, dummyLabel, this.demoNameText, this.demoUseLineText])

    const tint = getWeaponConfig(demo.weaponId).tint
    this.demoChargeAura = this.scene.add.rectangle(heroX, laneY, 30, 36, tint ?? 0x9fe8ff, 0.35).setVisible(false)
    container.add(this.demoChargeAura)

    const atlasHasFrame = (group: string) => {
      const key = weaponArtTextureKey(group)
      return this.scene.textures.exists(key) && this.scene.textures.get(key).has(weaponArtFrame(group, 0))
    }
    if (atlasHasFrame(demo.plain.artGroup)) {
      this.demoPlainShot = this.scene.add
        .sprite(heroX + 18, laneY, weaponArtTextureKey(demo.plain.artGroup), weaponArtFrame(demo.plain.artGroup, 0))
        .setVisible(false)
      container.add(this.demoPlainShot)
    }
    if (demo.charged && atlasHasFrame(demo.charged.artGroup)) {
      this.demoChargedShot = this.scene.add
        .sprite(heroX + 18, laneY, weaponArtTextureKey(demo.charged.artGroup), weaponArtFrame(demo.charged.artGroup, 0))
        .setScale(1.15)
        .setVisible(false)
      container.add(this.demoChargedShot)
    }
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
