import Phaser from 'phaser'

export class HUD {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private gPlayer: Phaser.GameObjects.Graphics
  private gWeapon: Phaser.GameObjects.Graphics
  private gBoss: Phaser.GameObjects.Graphics
  private tPlayer: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private tBoss: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private tLives: Phaser.GameObjects.BitmapText | Phaser.GameObjects.Text
  private playerSnapshot = { current: 0, max: 1 }
  private weaponSnapshot = { current: 0, max: 1 }
  private bossSnapshot = { current: 0, max: 1 }

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

    this.tPlayer = mkText(20, 12, 'SENTINEL ROOK', 12)
    this.root.add(this.tPlayer)

    this.tBoss = mkText(scene.scale.width - 20, 12, 'BOSS • ???', 12, 1, 0)
    this.root.add(this.tBoss)

    this.tLives = mkText(
      scene.scale.width - 20,
      scene.scale.height - 12,
      'LIVES ×03',
      12,
      1,
      1
    )
    this.root.add(this.tLives)
  }

  setNames(playerName: string, bossName: string): void {
    this.tPlayer.setText(playerName.toUpperCase())
    this.tBoss.setText(`BOSS • ${bossName.toUpperCase()}`)
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
    this.drawBar(this.gPlayer, 20, 26, 168, 10, max > 0 ? cur / max : 0)
  }

  updateWeapon(cur: number, max: number): void {
    this.weaponSnapshot = { current: cur, max }
    this.drawBar(this.gWeapon, 20, 40, 168, 8, max > 0 ? cur / max : 0)
  }

  updateBossHp(cur: number, max: number): void {
    this.bossSnapshot = { current: cur, max }
    const w = 190
    const x = this.scene.scale.width - (w + 20)
    this.drawBar(this.gBoss, x, 26, w, 10, max > 0 ? cur / max : 0)
  }

  resize(): void {
    this.tBoss.setPosition(this.scene.scale.width - 20, 12)
    this.tLives.setPosition(this.scene.scale.width - 20, this.scene.scale.height - 12)
    this.updatePlayerHp(this.playerSnapshot.current, this.playerSnapshot.max)
    this.updateWeapon(this.weaponSnapshot.current, this.weaponSnapshot.max)
    this.updateBossHp(this.bossSnapshot.current, this.bossSnapshot.max)
  }
}
