import Phaser from 'phaser'

type Palette = {
  primary: number
  accent: number
}

export class Preload extends Phaser.Scene {
  constructor() {
    super('Preload')
  }

  preload(): void {
    const palette = this.registry.get('palette') as Palette | undefined

    const primary = palette?.primary ?? 0xffffff
    const accent = palette?.accent ?? 0xfff6a0

    const graphics = this.make.graphics({ x: 0, y: 0, add: false })

    graphics.fillStyle(primary)
    graphics.fillRect(0, 0, 12, 14)
    graphics.generateTexture('player_idle', 12, 14)

    graphics.clear()
    graphics.fillStyle(accent)
    graphics.fillRect(0, 0, 12, 14)
    graphics.generateTexture('player_run', 12, 14)

    graphics.clear()
    graphics.fillStyle(0xffffff)
    graphics.fillRect(0, 0, 2, 2)
    graphics.generateTexture('pixel', 2, 2)
  }

  create(): void {
    this.scene.start('StageSelect')
  }
}
