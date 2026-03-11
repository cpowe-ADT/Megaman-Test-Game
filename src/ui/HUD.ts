import Phaser from 'phaser'

export class HUD {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
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

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setScrollFactor(0)

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

    this.tPlayer = mkText(20, 10, 'SENTINEL ROOK', 10)
    this.root.add(this.tPlayer)

    this.tWeapon = mkText(20, 34, 'WEAPON • BUSTER', 9)
    this.root.add(this.tWeapon)

    this.tBoss = mkText(scene.scale.width - 20, 10, 'BOSS • ???', 10, 1, 0)
    this.root.add(this.tBoss)

    this.tLives = mkText(
      scene.scale.width - 20,
      scene.scale.height - 12,
      'LIVES ×03',
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

  setLives(n: number): void {
    const count = Math.max(0, n)
    this.tLives.setText(`LIVES ×${count.toString().padStart(2, '0')}`)
  }

  drawBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    pct: number
  ): void {
    g.clear()
    const clamped = Phaser.Math.Clamp(pct, 0, 1)
    g.fillStyle(0x041326).fillRect(x, y, w, h)
    g.fillStyle(0x1d3f68).fillRect(x + 1, y + 1, w - 2, h - 2)
    g.fillStyle(0x4dd3ff).fillRect(x + 1, y + 1, Math.max(0, (w - 2) * clamped), h - 2)
  }

  updatePlayerHp(cur: number, max: number): void {
    this.playerSnapshot = { current: cur, max }
    this.drawBar(this.gPlayer, 20, 22, 156, 9, max > 0 ? cur / max : 0)
  }

  updateWeapon(cur: number, max: number): void {
    this.weaponSnapshot = { current: cur, max }
    this.drawBar(this.gWeapon, 20, 46, 156, 7, max > 0 ? cur / max : 0)
  }

  updateBossHp(cur: number, max: number): void {
    this.bossSnapshot = { current: cur, max }
    const w = 176
    const x = this.scene.scale.width - (w + 20)
    this.drawBar(this.gBoss, x, 22, w, 9, max > 0 ? cur / max : 0)
    this.gBoss.setVisible(this.bossBarVisible)
    this.tBoss.setVisible(this.bossBarVisible)
  }

  setBossBarVisible(visible: boolean): void {
    this.bossBarVisible = visible
    this.gBoss.setVisible(visible)
    this.tBoss.setVisible(visible)
  }

  resize(): void {
    this.tBoss.setPosition(this.scene.scale.width - 20, 10)
    this.tLives.setPosition(this.scene.scale.width - 20, this.scene.scale.height - 12)
    this.tPlayer.setPosition(20, 10)
    this.tWeapon.setPosition(20, 34)
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
}
