import Phaser from 'phaser'
import AudioService from '../audio'
import { countClearedRobotMasters, getCampaignStage, TUTORIAL_STAGE_ID } from '../content/campaign'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { Save } from '../systems/Save'

export class Title extends Phaser.Scene {
  constructor() {
    super('Title')
  }

  create(): void {
    const { width, height } = this.scale
    const saveData = Save.load()
    const params =
      typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams()
    const startScene = params.get('startScene')
    if (startScene === 'StageSelect') {
      this.scene.start('StageSelect')
      return
    }
    AudioService.playMusic(this, 'title')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))

    this.cameras.main.setBackgroundColor('#050913')
    this.add.rectangle(width / 2, height / 2, width - 24, height - 24, 0x09142a, 0.96).setStrokeStyle(2, 0x4a8cff, 0.75)
    this.add.text(width / 2, 48, 'MEGA CORE X', {
      fontFamily: 'monospace',
      fontSize: '34px',
      color: '#f5f8ff',
      fontStyle: 'bold'
    }).setOrigin(0.5)
    this.add.text(width / 2, 86, 'Hybrid boss-run campaign', {
      fontFamily: 'monospace',
      fontSize: '12px',
      color: '#9ec2ff'
    }).setOrigin(0.5)

    const primaryLabel = Save.hasActiveRun()
      ? 'Press Enter to continue your run'
      : saveData.tutorialCleared
        ? 'Press Enter to open Robot Master Select'
        : 'Press Enter to begin the Sentinel tutorial'

    this.add.text(width / 2, 132, primaryLabel, {
      fontFamily: 'monospace',
      fontSize: '14px',
      color: '#f5f8ff',
      align: 'center'
    }).setOrigin(0.5)

    this.add.text(width / 2, 176, 'Enter: Start/Continue   N: New campaign   Esc: Clear active run', {
      fontFamily: 'monospace',
      fontSize: '11px',
      color: '#9ec2ff',
      align: 'center'
    }).setOrigin(0.5)

    this.add.text(
      width / 2,
      210,
      `Tutorial: ${saveData.tutorialCleared ? 'CLEARED' : 'PENDING'}   Robot Masters: ${countClearedRobotMasters(saveData)}/8   Final Route: ${
        saveData.gameCompleted ? 'COMPLETED' : Save.isFinalRouteUnlocked() ? 'READY' : 'LOCKED'
      }`,
      {
        fontFamily: 'monospace',
        fontSize: '11px',
        color: '#d6e8ff',
        align: 'center'
      }
    ).setOrigin(0.5)

    bindMenuConfirmCancel(this, {
      onConfirm: () => this.handlePrimaryAction(),
      onCancel: () => {
        Save.clearActiveRun()
        this.scene.restart()
      }
    })

    const newCampaignHandler = () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      Save.clearAll()
      this.startTutorial()
    }
    this.input.keyboard?.on('keydown-N', newCampaignHandler)
    this.input.once('pointerdown', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      this.handlePrimaryAction()
    })
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-N', newCampaignHandler)
    })
  }

  private handlePrimaryAction(): void {
    if (Save.hasActiveRun()) {
      const run = Save.loadActiveRun()
      if (run) {
        this.scene.start('Game', {
          stageId: run.stageId,
          bossId: run.bossId,
          loadFromSave: true
        })
        return
      }
    }

    const saveData = Save.load()
    if (!saveData.tutorialCleared) {
      this.startTutorial()
      return
    }

    this.scene.start('StageSelect')
  }

  private startTutorial(): void {
    const stage = getCampaignStage(TUTORIAL_STAGE_ID)
    this.scene.start('Game', {
      stageId: stage.id,
      bossId: stage.bossId,
      runtimeBossConfigId: stage.runtimeBossConfigId
    })
  }
}

export default Title
