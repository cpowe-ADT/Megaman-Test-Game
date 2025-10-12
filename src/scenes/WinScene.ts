// [REGION: WIN-SCENE - BEGIN]
import Phaser from 'phaser'
import { Save } from '../systems/Save'

export default class WinScene extends Phaser.Scene {
  constructor() {
    super('WinScene')
  }

  create(data: { stageId: string; weaponId: string }): void {
    Save.addWeapon(data.weaponId)

    const title = this.add
      .bitmapText(160, 90, 'hudFont', `STAGE CLEARED!\nWeapon: ${data.weaponId}`, 8)
      .setOrigin(0.5)
    title.setLetterSpacing(1)

    this.add
      .bitmapText(160, 140, 'hudFont', 'A: Stage Select   B: Replay', 8)
      .setOrigin(0.5)

    this.input.keyboard?.once('keydown-A', () => this.scene.start('StageSelect'))
    this.input.keyboard?.once('keydown-B', () =>
      this.scene.start('Game', { stageId: data.stageId, bossId: data.stageId })
    )
  }
}
// [REGION: WIN-SCENE - END]
