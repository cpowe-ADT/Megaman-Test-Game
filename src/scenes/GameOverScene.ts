// [REGION: GAMEOVER-SCENE - BEGIN]
import Phaser from 'phaser'
import AudioService from '../audio'
import { returnToStageSelect } from '../core/navigation'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { getCampaignStage } from '../content/campaign'
import { Save } from '../systems/Save'

export default class GameOverScene extends Phaser.Scene {
  constructor() {
    super('GameOver')
  }

  create(data: { stageId: string }): void {
    Save.addGameOver(data.stageId)
    AudioService.playMusic(this, 'title')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))

    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#050913')
    this.add.rectangle(width / 2, height / 2, width - 40, height - 50, 0x09142a, 0.96).setStrokeStyle(2, 0x4a8cff, 0.7)
    this.add.text(width / 2, 92, 'GAME OVER', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f5f8ff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.add.text(width / 2, 132, 'Enter: Retry stage   Esc: Mission Select', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#cfe8ff'
    }).setOrigin(0.5)

    const retry = () => {
      const stage = getCampaignStage(data.stageId)
      this.scene.start('Game', {
        stageId: stage.id,
        bossId: stage.bossId,
        runtimeBossConfigId: stage.runtimeBossConfigId
      })
    }
    bindMenuConfirmCancel(this, {
      onConfirm: retry,
      onCancel: () => returnToStageSelect(this, { reason: 'gameover-esc' })
    })

    this.input.once('pointerdown', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      retry()
    })
  }
}
// [REGION: GAMEOVER-SCENE - END]
