import Phaser from 'phaser'
import AudioService from '../audio'
import { countClearedRobotMasters, getCampaignStage, TUTORIAL_STAGE_ID } from '../content/campaign'
import { AUTOMATION } from '../config/automation'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { Save } from '../systems/Save'
import {
  addMenuBackdrop,
  addMenuPanel,
  MENU_COLORS,
  MENU_FONT_BODY,
  MENU_FONT_CODE,
  MENU_FONT_DISPLAY,
  styleMenuHeading
} from '../ui/menu/menuTheme'

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
    if (AUTOMATION.enabled && startScene === 'StageSelect') {
      this.scene.start('StageSelect')
      return
    }
    AudioService.playMusic(this, 'title')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))

    this.cameras.main.setBackgroundColor('#030711')
    addMenuBackdrop(this)
    addMenuPanel(this, width / 2, height / 2, width - 20, height - 18)
    this.add.rectangle(width / 2, 34, width - 42, 48, MENU_COLORS.panelBright, 0.72)
      .setStrokeStyle(1, MENU_COLORS.blue, 0.45)
    this.add.rectangle(width / 2 - 174, 34, 4, 38, MENU_COLORS.cyan, 0.95)
    this.add.rectangle(width / 2 + 174, 34, 4, 38, MENU_COLORS.cyan, 0.95)

    styleMenuHeading(this.add.text(width / 2 - 7, 30, 'MEGA CORE', {
      fontFamily: MENU_FONT_DISPLAY,
      fontSize: '30px',
      color: '#f5f8ff',
      stroke: '#06132a',
      strokeThickness: 3
    }).setOrigin(0.5))
    styleMenuHeading(this.add.text(width / 2 + 119, 30, 'X', {
      fontFamily: MENU_FONT_DISPLAY,
      fontSize: '30px',
      color: '#5de1ff',
      stroke: '#173f72',
      strokeThickness: 3
    }).setOrigin(0.5))

    this.add.rectangle(width / 2, 68, 216, 17, 0x06142a, 0.98)
      .setStrokeStyle(1, MENU_COLORS.cyan, 0.55)
    this.add.rectangle(width / 2 - 108, 68, 3, 11, MENU_COLORS.cyan, 0.95)
    this.add.rectangle(width / 2 + 108, 68, 3, 11, MENU_COLORS.cyan, 0.95)
    this.add.text(width / 2, 68, 'THE ROBOT MASTER PROTOCOL', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '9px',
      color: '#ccecff',
      letterSpacing: 1.5
    }).setOrigin(0.5)

    const primaryLabel = Save.hasActiveRun()
      ? 'Continue active mission'
      : saveData.tutorialCleared
        ? 'Open Robot Master Select'
        : 'Begin the Sentinel tutorial'

    this.add.rectangle(width / 2, 116, width - 92, 51, 0x081a34, 0.96)
      .setStrokeStyle(1, MENU_COLORS.cyan, 0.75)
    this.add.rectangle(width / 2, 92, width - 96, 3, MENU_COLORS.blue, 0.7)

    this.add.text(width / 2, 103, 'MISSION CONTROL', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '7px',
      color: '#5de1ff',
      letterSpacing: 2
    }).setOrigin(0.5)

    const startButton = this.add.text(width / 2, 118, primaryLabel.toUpperCase(), {
      fontFamily: MENU_FONT_BODY,
      fontSize: '12px',
      color: '#f5f8ff',
      fontStyle: 'bold',
      align: 'center',
      wordWrap: { width: width - 118 }
    }).setOrigin(0.5)
    startButton.setShadow(0, 1, '#000000', 2)
    startButton.setInteractive({ useHandCursor: true })
    startButton.on('pointerdown', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      this.handlePrimaryAction()
    })
    this.add.text(width / 2, 136, '[ ENTER ]  CONFIRM', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '7px',
      color: '#78dfff',
      letterSpacing: 1
    }).setOrigin(0.5)

    this.add.text(width / 2, 193, 'ENTER  DEPLOY     C  CONTROLS     N  NEW CAMPAIGN     ESC  CLEAR RUN', {
      fontFamily: MENU_FONT_CODE,
      fontSize: '8px',
      color: '#a9c9f2',
      align: 'center'
    }).setOrigin(0.5)

    const controlsButton = this.add.text(width / 2, 162, 'VIEW CONTROL MAP', {
      fontFamily: MENU_FONT_BODY,
      fontSize: '10px',
      color: '#f5f8ff',
      fontStyle: 'bold',
      backgroundColor: '#164b7c',
      padding: { x: 15, y: 5 }
    }).setOrigin(0.5)
    controlsButton.setInteractive({ useHandCursor: true })
    controlsButton.on('pointerdown', () => this.openControls())

    this.add.text(
      width / 2,
      222,
      `TUTORIAL  ${saveData.tutorialCleared ? 'CLEARED' : 'PENDING'}    MASTERS  ${countClearedRobotMasters(saveData)}/8    FINAL  ${
        saveData.gameCompleted ? 'COMPLETED' : Save.isFinalRouteUnlocked() ? 'READY' : 'LOCKED'
      }`,
      {
        fontFamily: MENU_FONT_CODE,
        fontSize: '9px',
        color: '#d9edff',
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
    const controlsHandler = () => this.openControls()
    this.input.keyboard?.on('keydown-N', newCampaignHandler)
    this.input.keyboard?.on('keydown-C', controlsHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-N', newCampaignHandler)
      this.input.keyboard?.off('keydown-C', controlsHandler)
    })
  }

  private openControls(): void {
    AudioService.unlock()
    AudioService.playSfx('ui_confirm')
    this.scene.launch('Controls', { returnSceneKey: 'Title' })
    this.scene.pause()
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
