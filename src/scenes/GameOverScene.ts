// [REGION: GAMEOVER-SCENE - BEGIN]
import Phaser from 'phaser'
import { Save } from '../systems/Save'

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver')
  }

  create(data: { stageId: string }): void {
    Save.addGameOver(data.stageId)

    this.add.bitmapText(160, 90, 'hudFont', 'GAME OVER', 8).setOrigin(0.5)
    this.add
      .bitmapText(160, 140, 'hudFont', 'A: Reload   B: Stage Select', 8)
      .setOrigin(0.5)

    this.input.keyboard?.once('keydown-A', () =>
      this.scene.start('Game', { stageId: data.stageId, bossId: data.stageId, fresh: true })
    )
    this.input.keyboard?.once('keydown-B', () => this.scene.start('StageSelect'))
  }
}
// [REGION: GAMEOVER-SCENE - END]
