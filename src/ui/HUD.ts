import Phaser from 'phaser'

export class HUD {
  private scene: Phaser.Scene
  private root: Phaser.GameObjects.Container
  private gPlayer: Phaser.GameObjects.Graphics
  private gWeapon: Phaser.GameObjects.Graphics
  private gBoss: Phaser.GameObjects.Graphics
  private tPlayer: Phaser.GameObjects.BitmapText
  private tBoss: Phaser.GameObjects.BitmapText
  private tLives: Phaser.GameObjects.BitmapText

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.root = scene.add.container(0, 0).setScrollFactor(0)

    this.gPlayer = scene.add.graphics()
    this.root.add(this.gPlayer)

    this.gWeapon = scene.add.graphics()
    this.root.add(this.gWeapon)

    this.gBoss = scene.add.graphics()
    this.root.add(this.gBoss)

    this.tPlayer = scene.add.bitmapText(16, 16, 'font', 'Sentinel ROOK', 16)
    this.root.add(this.tPlayer)

    this.tBoss = scene.add.bitmapText(scene.scale.width - 240, 16, 'font', 'Boss: ???', 16)
    this.root.add(this.tBoss)

    this.tLives = scene
      .add.bitmapText(scene.scale.width - 160, scene.scale.height - 28, 'font', 'Lives: 3', 16)
      .setOrigin(0, 1)
    this.root.add(this.tLives)
  }

  setNames(playerName: string, bossName: string): void {
    this.tPlayer.setText(playerName)
    this.tBoss.setText(`Boss: ${bossName}`)
  }

  setLives(n: number): void {
    this.tLives.setText(`Lives: ${n}`)
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
    g.fillStyle(0x0a1a2a).fillRect(x, y, w, h)
    g.fillStyle(0x4ec3ff).fillRect(x + 1, y + 1, Math.max(0, (w - 2) * Phaser.Math.Clamp(pct, 0, 1)), h - 2)
  }

  updatePlayerHp(cur: number, max: number): void {
    this.drawBar(this.gPlayer, 16, 42, 180, 12, max > 0 ? cur / max : 0)
  }

  updateWeapon(cur: number, max: number): void {
    this.drawBar(this.gWeapon, 16, 60, 180, 8, max > 0 ? cur / max : 0)
  }

  updateBossHp(cur: number, max: number): void {
    const w = 220
    const x = this.scene.scale.width - (w + 20)
    this.drawBar(this.gBoss, x, 42, w, 12, max > 0 ? cur / max : 0)
  }

  resize(): void {
    this.tBoss.setX(this.scene.scale.width - 240)
    this.tLives.setPosition(this.scene.scale.width - 160, this.scene.scale.height - 8)
  }
}
