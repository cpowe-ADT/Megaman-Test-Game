import { IDENTITY } from '../content/identity'
import { openNewCampaign, profileScreensEnabled, startWithFirstRunControls } from './NewCampaignScene'
import Phaser from 'phaser'
import AudioService from '../audio'
import InputActions from '../input/InputActions'
import { countClearedRobotMasters, getCampaignStage, TUTORIAL_STAGE_ID } from '../content/campaign'
import { AUTOMATION } from '../config/automation'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { Profiles, Save } from '../systems/Save'
import {
  addMenuBackdrop,
  addMenuPanel,
  MENU_COLORS,
  MENU_FONT_BODY,
  MENU_FONT_CODE,
  MENU_FONT_DISPLAY,
  styleMenuHeading
} from '../ui/menu/menuTheme'
import { GAME_SIZE } from '../config/renderPolicy'

const TITLE_KEYART_KEY = 'title_keyart'
const TITLE_KEYART_PATH = 'assets/ui/title/title_keyart.png'

export class Title extends Phaser.Scene {
  /** Set by the ESC restart so the key art survives it (a reload raced the next Enter: smoke 33 lost it). */
  private keepKeyArt = false

  constructor() {
    super('Title')
  }

  /** The key art is only drawn here, so it loads and evicts with this scene, not `Preload`. */
  preload(): void {
    if (!this.textures.exists(TITLE_KEYART_KEY)) {
      this.load.image(TITLE_KEYART_KEY, TITLE_KEYART_PATH)
    }
  }

  create(): void {
    const { width, height } = GAME_SIZE
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
    this.keepKeyArt = false
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => { if (!this.keepKeyArt) this.textures.remove(TITLE_KEYART_KEY) })

    this.cameras.main.setBackgroundColor('#030711')
    if (this.textures.exists(TITLE_KEYART_KEY)) {
      this.add.image(width / 2, height / 2, TITLE_KEYART_KEY)
    }
    // Dimmed so the key art reads behind the menu rather than under a flat backdrop or an opaque panel.
    addMenuBackdrop(this, 0.35)
    addMenuPanel(this, width / 2, height / 2, width - 20, height - 18, 0.8)
    this.add.rectangle(width / 2, 34, width - 42, 48, MENU_COLORS.panelBright, 0.72)
      .setStrokeStyle(1, MENU_COLORS.blue, 0.45)
    this.add.rectangle(width / 2 - 174, 34, 4, 38, MENU_COLORS.cyan, 0.95)
    this.add.rectangle(width / 2 + 174, 34, 4, 38, MENU_COLORS.cyan, 0.95)

    styleMenuHeading(this.add.text(width / 2, 30, IDENTITY.GAME_TITLE, {
      fontFamily: MENU_FONT_DISPLAY,
      fontSize: '30px',
      color: '#f5f8ff',
      stroke: '#06132a',
      strokeThickness: 3
    }).setOrigin(0.5).setName('identity-title'))

    this.add.rectangle(width / 2, 68, 360, 17, 0x06142a, 0.98)
      .setStrokeStyle(1, MENU_COLORS.cyan, 0.55)
    this.add.rectangle(width / 2 - 180, 68, 3, 11, MENU_COLORS.cyan, 0.95)
    this.add.rectangle(width / 2 + 180, 68, 3, 11, MENU_COLORS.cyan, 0.95)
    this.add.text(width / 2, 68, IDENTITY.GAME_SUBTITLE, {
      fontFamily: MENU_FONT_CODE,
      fontSize: '9px',
      color: '#ccecff',
      letterSpacing: 0.5
    }).setOrigin(0.5).setName('identity-subtitle')

    const minutes = Math.floor((saveData.stats?.playTimeMs ?? 0) / 60000)
    const playTime = `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`
    // New-versus-continue reads the profile's `campaignStarted`, not `Save.exists()`: an Options visit writes a save.
    const pilot = Profiles.active()
    const started = Boolean(pilot?.campaignStarted)
    const primaryLabel = !started
      ? 'Begin a new campaign'
      : `Continue  ${IDENTITY.WARDEN_TERM_PLURAL} ${countClearedRobotMasters(saveData)}/8  ${playTime}`

    this.add.rectangle(width / 2, 116, width - 92, 51, 0x081a34, 0.96)
      .setStrokeStyle(1, MENU_COLORS.cyan, 0.75)
    this.add.rectangle(width / 2, 92, width - 96, 3, MENU_COLORS.blue, 0.7)

    this.add.text(width / 2, 103, started && pilot ? `MISSION CONTROL  ·  PILOT ${pilot.pilotName}  ·  SLOT ${pilot.slot}` : 'MISSION CONTROL', {
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
    }).setOrigin(0.5).setName('title-primary')
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

    this.add.text(width / 2, 193, 'ENTER  DEPLOY     C  CONTROLS     O  OPTIONS     N  NEW CAMPAIGN     ESC  CLEAR RUN', {
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
      `TUTORIAL  ${saveData.tutorialCleared ? 'CLEARED' : 'PENDING'}    ${IDENTITY.WARDEN_TERM_PLURAL}  ${countClearedRobotMasters(saveData)}/8    FINAL  ${
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
        this.keepKeyArt = true
        this.scene.restart()
      }
    })

    const newCampaignHandler = () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      this.startNewGame()
    }
    const controlsHandler = () => this.openControls()
    InputActions.forScene(this).onPressed('newCampaign', newCampaignHandler)
    InputActions.forScene(this).onPressed('controls', controlsHandler)
    InputActions.forScene(this).onPressed('options', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      this.scene.launch('Options', { returnSceneKey: 'Title' })
      this.scene.pause()
    })
  }

  private openControls(): void {
    AudioService.unlock()
    AudioService.playSfx('ui_confirm')
    this.scene.launch('Controls', { returnSceneKey: 'Title' })
    this.scene.pause()
  }

  private handlePrimaryAction(): void {
    if (!Profiles.active()?.campaignStarted) { this.startNewGame(); return }
    resumeActiveSlot(this)
  }

  /** NEW GAME: the slot picker and name entry (always in play; `?profiles=on` under automation), then NEW CAMPAIGN. */
  private startNewGame(): void {
    if (profileScreensEnabled()) this.scene.start('Profiles')
    else openNewCampaign(this)
  }
}

/** CONTINUE for the active slot: the saved mission, else the tutorial (first-run page once), else Stage Select. */
export function resumeActiveSlot(scene: Phaser.Scene): void {
  Profiles.touch()
  const run = Save.hasActiveRun() ? Save.loadActiveRun() : null
  if (run) {
    scene.scene.start('Game', { stageId: run.stageId, bossId: run.bossId, loadFromSave: true })
    return
  }
  if (!Save.load().tutorialCleared) {
    const stage = getCampaignStage(TUTORIAL_STAGE_ID)
    startWithFirstRunControls(scene, 'Game', { stageId: stage.id, bossId: stage.bossId, runtimeBossConfigId: stage.runtimeBossConfigId })
    return
  }
  scene.scene.start('StageSelect')
}

export default Title
