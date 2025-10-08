import Phaser from 'phaser'

type Palette = {
  primary: number
  accent: number
  danger: number
  bg: number
}

export class Boot extends Phaser.Scene {
  constructor() {
    super('Boot')
  }

  create(): void {
    const palette: Palette = {
      primary: 0x30c0ff,
      accent: 0xffe66d,
      danger: 0xff4d6d,
      bg: 0x0b0d12
    }

    this.registry.set('palette', palette)
    this.scene.start('Preload')
  }
}
