// [REGION: PAUSE - BEGIN]
import Phaser from 'phaser'
import AudioService from '../audio'
import { returnToStageSelect } from '../core/navigation'
import bindMenuConfirmCancel from '../input/menuInputBinder'

export default class PauseScene extends Phaser.Scene {
  constructor() {
    super('Pause')
  }

  create(): void {
    AudioService.playSfx('pause_open')
    const { width, height } = this.scale
    this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6)
    this.add.rectangle(width / 2, height / 2, 220, 92, 0x09142a, 0.96).setStrokeStyle(2, 0x4a8cff, 0.75)
    this.add.text(width / 2, height / 2 - 18, 'PAUSED', {
      fontFamily: 'monospace',
      fontSize: '20px',
      color: '#f5f8ff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.add.text(width / 2, height / 2 + 14, 'Enter: Resume   Esc: Stage Select', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#cfe8ff'
    }).setOrigin(0.5)

    const resume = () => {
      AudioService.playSfx('pause_resume')
      this.scene.stop()
      this.scene.resume('Game')
    }
    bindMenuConfirmCancel(this, {
      onConfirm: resume,
      onCancel: () => {
        AudioService.playSfx('ui_cancel')
        this.scene.stop()
        returnToStageSelect(this, { reason: 'pause-menu' })
      }
    })
  }
}
// [REGION: PAUSE - END]
