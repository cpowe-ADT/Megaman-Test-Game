import Phaser from 'phaser'
import AudioService from '../audio'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { Save } from '../systems/Save'

export class CompletionScene extends Phaser.Scene {
  constructor() {
    super('CompletionScene')
  }

  create(): void {
    Save.markGameCompleted()
    AudioService.playMusic(this, 'completion')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))

    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#050913')

    this.add.text(width / 2, 74, 'OMEGA CORE DEFEATED', {
      fontFamily: 'monospace',
      fontSize: '24px',
      color: '#f5f8ff',
      fontStyle: 'bold',
      align: 'center'
    }).setOrigin(0.5)

    this.add.text(width / 2, 124, 'The final route is clear.\nAll robot masters neutralized.\nCampaign complete.', {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#cfe8ff',
      align: 'center'
    }).setOrigin(0.5)

    this.add.text(width / 2, 198, 'Press Enter or click to return to Mission Select', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#9ec2ff',
      align: 'center'
    }).setOrigin(0.5)

    const goBack = () => this.scene.start('StageSelect')
    bindMenuConfirmCancel(this, {
      onConfirm: goBack,
      onCancel: goBack
    })
    this.input.once('pointerdown', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      goBack()
    })
  }
}

export default CompletionScene
