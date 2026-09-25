import { IDENTITY } from '../content/identity'
import { GAME_WIDTH } from '../config/renderPolicy'
import Phaser from 'phaser'
import { getHudLayout } from './hudLayout'
export { formatDistrictLabel } from './hudLayout'
import { BakedGraphics, type BakeBounds } from './BakedGraphics'
import { getRenderScale } from '../config/hdRender'
import { HUD_ICONS_ATLAS, weaponHudIconFrame } from '../projectiles/weaponArt'

export class HUD {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  // Rounded panels and bars are baked into textures (see BakedGraphics): drawn live they cost about 4ms a frame.
  private gChrome: BakedGraphics
  private gPlayer: BakedGraphics
  private gWeapon: BakedGraphics
  private gBoss: BakedGraphics
  /** The boss panel background and its red accent, baked apart from gChrome so the whole panel can hide as one unit. */
  private gBossChrome: BakedGraphics
  private tPlayer: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private tWeapon: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  /** The equipped weapon's `hud_icons_v1` icon at the right end of the WEAPON row (prompt 07 phase 7.3). */
  private weaponIcon?: Phaser.GameObjects.Image
  private tBoss: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private tLives: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private playerSnapshot = { current: 0, max: 1 }
  private weaponSnapshot = { current: 0, max: 1 }
  private bossSnapshot = { current: 0, max: 1 }
  /** Hidden until beginBossCombat calls setBossBarVisible(true): no boss framing before the fight starts. */
  private bossBarVisible = false
  private playerName = 'PLAYER'
  private weaponName = 'BUSTER'
  private bossName = 'BOSS • ???'
  private bossTarget = '???'
  private weaponColor = 0x58d8ff
  /** What each bar last baked (values and render scale); the boss bar was rebuilt every frame with an unchanged value. */
  private drawnBars = new WeakMap<BakedGraphics, string>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setScrollFactor(0)

    this.gChrome = new BakedGraphics(scene, 'hud-baked-chrome')
    this.drawChrome()
    this.root.add(this.gChrome.image)

    this.gBossChrome = new BakedGraphics(scene, 'hud-baked-boss-chrome')
    this.drawBossChrome()
    this.root.add(this.gBossChrome.image)
    this.gBossChrome.image.setVisible(this.bossBarVisible)

    // A lost and restored WebGL context empties every DynamicTexture; bake the panels and bars again.
    const rebake = () => {
      this.drawnBars = new WeakMap()
      this.resize()
    }
    scene.game.renderer?.on?.('restorewebgl', rebake)
    scene.events.once('shutdown', () => scene.game.renderer?.off?.('restorewebgl', rebake))

    const hasBitmap = this.scene.cache.bitmapFont.exists('font')
    const mkText = (
      x: number,
      y: number,
      s: string,
      size = 12,
      originX = 0,
      originY = 0
    ) => {
      const tint = 0xb5e4ff
      const strokeColor = '#091524'
      const shadowColor = '#020a14'
      const shadowColorNumeric = 0x020a14

      if (hasBitmap) {
        const text = this.scene
          .add.bitmapText(x, y, 'font', s, size)
          .setScrollFactor(0)
          .setTint(tint)
        text.setOrigin(originX, originY)
        text.setDepth(1000)
        text.setLetterSpacing(1)
        text.setDropShadow(0, 1, shadowColorNumeric, 0.8)
        return text
      }

      const text = this.scene
        .add.text(x, y, s, {
          fontFamily: 'monospace',
          fontSize: `${size}px`,
          color: '#cfe8ff',
          stroke: strokeColor,
          strokeThickness: 2,
        })
        .setScrollFactor(0)

      text.setOrigin(originX, originY)
      text.setDepth(1000)
      text.setLetterSpacing(1)
      text.setShadow(0, 1, shadowColor, 0, false, true)
      return text
    }

    this.gPlayer = new BakedGraphics(scene, 'hud-baked-player-bar')
    this.root.add(this.gPlayer.image)

    this.gWeapon = new BakedGraphics(scene, 'hud-baked-weapon-bar')
    this.root.add(this.gWeapon.image)

    this.gBoss = new BakedGraphics(scene, 'hud-baked-boss-bar')
    this.root.add(this.gBoss.image)
    this.gBoss.image.setVisible(this.bossBarVisible)

    const layout = getHudLayout(GAME_WIDTH)
    this.tPlayer = mkText(layout.playerLabel.x, layout.playerLabel.y, IDENTITY.HERO_CALLSIGN, 9)
    this.root.add(this.tPlayer)

    this.tWeapon = mkText(layout.weaponLabel.x, layout.weaponLabel.y, 'WEAPON • BUSTER', 9)
    this.root.add(this.tWeapon)
    if (scene.textures.exists(HUD_ICONS_ATLAS.key)) {
      const icon = hudWeaponIconPlacement(layout)
      this.weaponIcon = scene.add.image(icon.x, icon.y, HUD_ICONS_ATLAS.key, weaponHudIconFrame('Buster')).setDisplaySize(icon.size, icon.size)
      this.root.add(this.weaponIcon)
    }

    this.tBoss = mkText(layout.bossLabel.x, layout.bossLabel.y, 'BOSS • ???', 9, 1, 0)
    this.tBoss.setVisible(this.bossBarVisible)
    this.root.add(this.tBoss)

    // In the HUD band under the boss panel: on the floor it covered the boss spawn point in most rooms.
    this.tLives = mkText(layout.livesLabel.x, layout.livesLabel.y, 'RETRY ×03', 10, 1, 0)
    this.root.add(this.tLives)
  }

  setNames(playerName: string, bossName: string): void {
    this.playerName = this.truncateLabel(playerName.toUpperCase(), 16)
    this.bossTarget = this.truncateLabel(bossName.toUpperCase(), 16)
    this.bossName = this.bossLabelText()
    this.tPlayer.setText(this.playerName)
    this.tBoss.setText(this.bossName)
  }

  setWeaponName(weaponName: string): void {
    this.weaponName = `WEAPON • ${this.truncateLabel(weaponName.toUpperCase(), 16)}`
    this.tWeapon.setText(this.weaponName)
  }

  /** Shows the weapon's HUD icon (the Buster's for an unknown id). */
  setWeaponIcon(weaponId: string): void {
    const frame = weaponHudIconFrame(weaponId)
    if (this.weaponIcon && this.scene.textures.get(HUD_ICONS_ATLAS.key).has(frame)) this.weaponIcon.setFrame(frame)
  }

  /** Where the weapon icon is and which frame it draws (smoke 12 reads it). */
  getWeaponIconState(): { frame: string; x: number; y: number; size: number; labelRight: number } | null {
    if (!this.weaponIcon) return null
    return {
      frame: String(this.weaponIcon.frame?.name ?? ''),
      x: this.weaponIcon.x,
      y: this.weaponIcon.y,
      size: Math.round(this.weaponIcon.displayWidth),
      labelRight: Math.round(this.tWeapon.x + this.tWeapon.width)
    }
  }

  setWeaponColor(color?: number): void {
    this.weaponColor = typeof color === 'number' ? color : 0x58d8ff
    this.drawChrome()
    this.updateWeapon(this.weaponSnapshot.current, this.weaponSnapshot.max)
  }

  setLives(n: number): void {
    const count = Math.max(0, n)
    this.tLives.setText(`RETRY ×${count.toString().padStart(2, '0')}`)
  }

  drawBar(
    layer: BakedGraphics,
    x: number,
    y: number,
    w: number,
    h: number,
    pct: number,
    fillColor: number
  ): void {
    const clamped = Phaser.Math.Clamp(pct, 0, 1)
    const signature = `${x},${y},${w},${h},${clamped},${fillColor},${getRenderScale().scale}`
    if (this.drawnBars.get(layer) === signature) {
      return
    }
    this.drawnBars.set(layer, signature)
    const g = layer.graphics
    g.clear()
    const inset = 3
    const innerX = x + inset
    const innerY = y + 2
    const innerWidth = w - inset * 2
    const innerHeight = Math.max(2, h - 4)
    const cellCount = 14
    const cellGap = 1
    const cellWidth = (innerWidth - cellGap * (cellCount - 1)) / cellCount
    g.fillStyle(0x020915, 0.98).fillRoundedRect(x, y, w, h, Math.floor(h / 2))
    g.lineStyle(1, 0x4c7da8, 0.96).strokeRoundedRect(x, y, w, h, Math.floor(h / 2))
    g.fillStyle(0x102846, 1).fillRoundedRect(innerX, innerY, innerWidth, innerHeight, Math.floor(innerHeight / 2))
    g.fillStyle(0x173554, 0.9)
    for (let index = 0; index < cellCount; index += 1) {
      const cellX = innerX + index * (cellWidth + cellGap)
      g.fillRoundedRect(cellX, innerY, cellWidth, innerHeight, Math.min(2, innerHeight / 2))
      const filledFraction = Phaser.Math.Clamp(clamped * cellCount - index, 0, 1)
      if (filledFraction > 0) {
        const filledWidth = cellWidth * filledFraction
        g.fillStyle(fillColor, 1)
        g.fillRoundedRect(cellX, innerY, filledWidth, innerHeight, Math.min(2, filledWidth / 2, innerHeight / 2))
        if (filledWidth > 2) {
          g.fillStyle(0xffffff, 0.42).fillRect(cellX + 1, innerY, filledWidth - 2, 1)
        }
        g.fillStyle(0x173554, 0.9)
      }
    }
    g.fillStyle(0x315a83, 1).fillRect(x - 2, y + 2, 2, h - 4)
    g.fillRect(x + w, y + 2, 2, h - 4)
    // The side accents reach 2px past the bar and strokes half a pixel past its edge.
    layer.bake({ x: x - 3, y: y - 1, width: w + 6, height: h + 2 })
  }

  updatePlayerHp(cur: number, max: number): void {
    this.playerSnapshot = { current: cur, max }
    const bar = getHudLayout(GAME_WIDTH).playerBar
    this.drawBar(this.gPlayer, bar.x, bar.y, bar.width, bar.height, max > 0 ? cur / max : 0, 0x63ff88)
  }

  updateWeapon(cur: number, max: number): void {
    this.weaponSnapshot = { current: cur, max }
    const bar = getHudLayout(GAME_WIDTH).weaponBar
    this.drawBar(this.gWeapon, bar.x, bar.y, bar.width, bar.height, max > 0 ? cur / max : 0, this.weaponColor)
  }

  updateBossHp(cur: number, max: number): void {
    this.bossSnapshot = { current: cur, max }
    const bar = getHudLayout(GAME_WIDTH).bossBar
    const ratio = max > 0 ? cur / max : 0
    this.drawBar(this.gBoss, bar.x, bar.y, bar.width, bar.height, this.bossBarFill === null ? ratio : Math.min(ratio, this.bossBarFill), 0xff6677)
    this.gBoss.image.setVisible(this.bossBarVisible)
    this.tBoss.setVisible(this.bossBarVisible)
  }

  /** The intro's bar fill (prompt 07 phase 7.2 item 4): a fraction caps the drawn bar; null draws the HP. `bossSnapshot` stays the HP. */
  private bossBarFill: number | null = null

  setBossBarFill(fraction: number | null): void {
    this.bossBarFill = fraction === null ? null : Math.max(0, Math.min(1, fraction))
    this.updateBossHp(this.bossSnapshot.current, this.bossSnapshot.max)
  }

  /** The whole boss panel (background, red accent, bar and name) hides as one unit until the fight starts. */
  setBossBarVisible(visible: boolean): void {
    this.bossBarVisible = visible
    this.gBossChrome.image.setVisible(visible)
    this.gBoss.image.setVisible(visible)
    this.bossName = this.bossLabelText()
    this.tBoss.setText(this.bossName)
    this.tBoss.setVisible(visible)
  }

  private bossLabelText(): string {
    return `BOSS • ${this.bossTarget}`
  }

  resize(): void {
    this.drawChrome()
    this.drawBossChrome()
    this.gBossChrome.image.setVisible(this.bossBarVisible)
    const layout = getHudLayout(GAME_WIDTH)
    this.tBoss.setPosition(layout.bossLabel.x, layout.bossLabel.y)
    this.tLives.setPosition(layout.livesLabel.x, layout.livesLabel.y)
    this.tPlayer.setPosition(layout.playerLabel.x, layout.playerLabel.y)
    this.tWeapon.setPosition(layout.weaponLabel.x, layout.weaponLabel.y)
    const icon = hudWeaponIconPlacement(layout)
    this.weaponIcon?.setPosition(icon.x, icon.y)
    this.tPlayer.setText(this.playerName)
    this.tWeapon.setText(this.weaponName)
    this.tBoss.setText(this.bossName)
    this.updatePlayerHp(this.playerSnapshot.current, this.playerSnapshot.max)
    this.updateWeapon(this.weaponSnapshot.current, this.weaponSnapshot.max)
    this.updateBossHp(this.bossSnapshot.current, this.bossSnapshot.max)
  }

  private truncateLabel(text: string, maxChars: number): string {
    if (text.length <= maxChars) {
      return text
    }
    return `${text.slice(0, Math.max(1, maxChars - 1))}…`
  }

  private drawChrome(): void {
    const width = GAME_WIDTH
    const layout = getHudLayout(width)
    const chrome = this.gChrome.graphics
    chrome.clear()
    chrome.fillStyle(0x030913, 0.96)
    chrome.fillRect(0, 0, width, layout.height)
    chrome.fillStyle(0x050d18, 0.88)
    chrome.fillRoundedRect(layout.playerPanel.x, layout.playerPanel.y, layout.playerPanel.width, layout.playerPanel.height, 3)
    chrome.fillRoundedRect(layout.centerPanel.x, layout.centerPanel.y, layout.centerPanel.width, layout.centerPanel.height, 3)
    chrome.lineStyle(1, 0x2b5c88, 0.72)
    chrome.strokeRoundedRect(layout.playerPanel.x, layout.playerPanel.y, layout.playerPanel.width, layout.playerPanel.height, 3)
    chrome.strokeRoundedRect(layout.centerPanel.x, layout.centerPanel.y, layout.centerPanel.width, layout.centerPanel.height, 3)
    chrome.fillStyle(0x63ff88, 0.9)
    chrome.fillRect(layout.playerPanel.x, 10, 3, 19)
    chrome.fillStyle(this.weaponColor, 0.9)
    chrome.fillRect(layout.playerPanel.x, 34, 3, 17)
    const bounds: BakeBounds = { x: 0, y: 0, width, height: layout.height }
    this.gChrome.bake(bounds)
  }

  /** The boss panel background and its red accent: baked apart from drawChrome so setBossBarVisible can hide it as one unit. */
  private drawBossChrome(): void {
    const layout = getHudLayout(GAME_WIDTH)
    const chrome = this.gBossChrome.graphics
    chrome.clear()
    chrome.fillStyle(0x050d18, 0.88)
    chrome.fillRoundedRect(layout.bossPanel.x, layout.bossPanel.y, layout.bossPanel.width, layout.bossPanel.height, 3)
    chrome.lineStyle(1, 0x2b5c88, 0.72)
    chrome.strokeRoundedRect(layout.bossPanel.x, layout.bossPanel.y, layout.bossPanel.width, layout.bossPanel.height, 3)
    chrome.fillStyle(0xff6677, 0.9)
    chrome.fillRect(layout.bossPanel.x + layout.bossPanel.width - 3, 10, 3, 19)
    const bounds: BakeBounds = {
      x: layout.bossPanel.x - 2,
      y: layout.bossPanel.y - 2,
      width: layout.bossPanel.width + 4,
      height: layout.bossPanel.height + 4
    }
    this.gBossChrome.bake(bounds)
  }
}

/** The weapon icon: 12 game px (an 18px cell), right-aligned to the weapon bar, between the WEAPON label row and the bar. */
export function hudWeaponIconPlacement(layout: Pick<ReturnType<typeof getHudLayout>, 'weaponBar' | 'weaponLabel'>): { x: number; y: number; size: number } {
  const size = 12
  return { x: layout.weaponBar.x + layout.weaponBar.width - size / 2, y: layout.weaponBar.y - size / 2 - 0.5, size }
}
