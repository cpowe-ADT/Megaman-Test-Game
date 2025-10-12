// [REGION: PAUSE - BEGIN]
import Phaser from 'phaser'

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause')
  }

  create(): void {
    this.add.rectangle(160, 120, 320, 240, 0x000000, 0.6)
    this.add.bitmapText(160, 90, 'hudFont', 'PAUSED', 8).setOrigin(0.5)
    this.add
      .bitmapText(160, 140, 'hudFont', 'A: Resume   B: Stage Select', 8)
      .setOrigin(0.5)

    this.input.keyboard?.once('keydown-A', () => {
      this.scene.stop()
      this.scene.resume('Game')
    })
    this.input.keyboard?.once('keydown-B', () => {
      this.scene.stop()
      this.scene.start('StageSelect')
    })
  }
}
// [REGION: PAUSE - END]
