import { IDENTITY } from '../content/identity'
import Phaser from 'phaser'
import { getHudLayout } from './hudLayout'

export class HUD {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private gChrome: Phaser.GameObjects.Graphics
  private gPlayer: Phaser.GameObjects.Graphics
  private gWeapon: Phaser.GameObjects.Graphics
  private gBoss: Phaser.GameObjects.Graphics
  private tPlayer: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private tWeapon: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private tBoss: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private tLives: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private playerSnapshot = { current: 0, max: 1 }
  private weaponSnapshot = { current: 0, max: 1 }
  private bossSnapshot = { current: 0, max: 1 }
  private bossBarVisible = true
  private playerName = 'PLAYER'
  private weaponName = 'BUSTER'
  private bossName = 'BOSS • ???'
  private weaponColor = 0x58d8ff

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setScrollFactor(0)

    this.gChrome = scene.add.graphics().setScrollFactor(0)
    this.drawChrome()
    this.root.add(this.gChrome)

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

    this.gPlayer = scene.add.graphics().setScrollFactor(0)
    this.root.add(this.gPlayer)

    this.gWeapon = scene.add.graphics().setScrollFactor(0)
    this.root.add(this.gWeapon)

    this.gBoss = scene.add.graphics().setScrollFactor(0)
    this.root.add(this.gBoss)

    const layout = getHudLayout(scene.scale.width)
    this.tPlayer = mkText(layout.playerLabel.x, layout.playerLabel.y, IDENTITY.DEV_SKIN.enabled ? IDENTITY.DEV_SKIN.heroLabel : IDENTITY.HERO_CALLSIGN, 9)
    this.root.add(this.tPlayer)

    this.tWeapon = mkText(layout.weaponLabel.x, layout.weaponLabel.y, 'WEAPON • BUSTER', 9)
    this.root.add(this.tWeapon)

    this.tBoss = mkText(layout.bossLabel.x, layout.bossLabel.y, 'BOSS • ???', 9, 1, 0)
    this.root.add(this.tBoss)

    this.tLives = mkText(
      scene.scale.width - 20,
      scene.scale.height - 12,
      'RETRY ×03',
      10,
      1,
      1
    )
    this.root.add(this.tLives)
  }

  setNames(playerName: string, bossName: string): void {
    this.playerName = this.truncateLabel(playerName.toUpperCase(), 16)
    this.bossName = `BOSS • ${this.truncateLabel(bossName.toUpperCase(), 16)}`
    this.tPlayer.setText(this.playerName)
    this.tBoss.setText(this.bossName)
  }

  setWeaponName(weaponName: string): void {
    this.weaponName = `WEAPON • ${this.truncateLabel(weaponName.toUpperCase(), 16)}`
    this.tWeapon.setText(this.weaponName)
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
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    pct: number,
    fillColor: number
  ): void {
    g.clear()
    const clamped = Phaser.Math.Clamp(pct, 0, 1)
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
  }

  updatePlayerHp(cur: number, max: number): void {
    this.playerSnapshot = { current: cur, max }
    const bar = getHudLayout(this.scene.scale.width).playerBar
    this.drawBar(this.gPlayer, bar.x, bar.y, bar.width, bar.height, max > 0 ? cur / max : 0, 0x63ff88)
  }

  updateWeapon(cur: number, max: number): void {
    this.weaponSnapshot = { current: cur, max }
    const bar = getHudLayout(this.scene.scale.width).weaponBar
    this.drawBar(this.gWeapon, bar.x, bar.y, bar.width, bar.height, max > 0 ? cur / max : 0, this.weaponColor)
  }

  updateBossHp(cur: number, max: number): void {
    this.bossSnapshot = { current: cur, max }
    const bar = getHudLayout(this.scene.scale.width).bossBar
    this.drawBar(this.gBoss, bar.x, bar.y, bar.width, bar.height, max > 0 ? cur / max : 0, 0xff6677)
    this.gBoss.setVisible(this.bossBarVisible)
    this.tBoss.setVisible(true)
  }

  setBossBarVisible(visible: boolean): void {
    this.bossBarVisible = visible
    this.gBoss.setVisible(visible)
    // Keep the mission target named before the arena seals; an empty HUD panel
    // reads like missing UI and makes the stage goal less clear.
    this.tBoss.setVisible(true)
  }

  resize(): void {
    this.drawChrome()
    const layout = getHudLayout(this.scene.scale.width)
    this.tBoss.setPosition(layout.bossLabel.x, layout.bossLabel.y)
    this.tLives.setPosition(this.scene.scale.width - 20, this.scene.scale.height - 12)
    this.tPlayer.setPosition(layout.playerLabel.x, layout.playerLabel.y)
    this.tWeapon.setPosition(layout.weaponLabel.x, layout.weaponLabel.y)
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
    const width = this.scene.scale.width
    const layout = getHudLayout(width)
    this.gChrome.clear()
    this.gChrome.fillStyle(0x030913, 0.96)
    this.gChrome.fillRect(0, 0, width, layout.height)
    this.gChrome.fillStyle(0x050d18, 0.88)
    this.gChrome.fillRoundedRect(layout.playerPanel.x, layout.playerPanel.y, layout.playerPanel.width, layout.playerPanel.height, 3)
    this.gChrome.fillRoundedRect(layout.centerPanel.x, layout.centerPanel.y, layout.centerPanel.width, layout.centerPanel.height, 3)
    this.gChrome.fillRoundedRect(layout.bossPanel.x, layout.bossPanel.y, layout.bossPanel.width, layout.bossPanel.height, 3)
    this.gChrome.lineStyle(1, 0x2b5c88, 0.72)
    this.gChrome.strokeRoundedRect(layout.playerPanel.x, layout.playerPanel.y, layout.playerPanel.width, layout.playerPanel.height, 3)
    this.gChrome.strokeRoundedRect(layout.centerPanel.x, layout.centerPanel.y, layout.centerPanel.width, layout.centerPanel.height, 3)
    this.gChrome.strokeRoundedRect(layout.bossPanel.x, layout.bossPanel.y, layout.bossPanel.width, layout.bossPanel.height, 3)
    this.gChrome.fillStyle(0x63ff88, 0.9)
    this.gChrome.fillRect(layout.playerPanel.x, 10, 3, 19)
    this.gChrome.fillStyle(this.weaponColor, 0.9)
    this.gChrome.fillRect(layout.playerPanel.x, 34, 3, 17)
    this.gChrome.fillStyle(0xff6677, 0.9)
    this.gChrome.fillRect(layout.bossPanel.x + layout.bossPanel.width - 3, 10, 3, 19)
  }
}
