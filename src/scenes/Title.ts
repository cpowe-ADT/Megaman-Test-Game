import { IDENTITY } from '../content/identity'
import { openNewCampaign, profileScreensEnabled, startWithFirstRunControls } from './NewCampaignScene'
import Phaser from 'phaser'
import AudioService from '../audio'
import InputActions from '../input/InputActions'
import { countClearedRobotMasters, getCampaignStage, TUTORIAL_STAGE_ID } from '../content/campaign'
import { STAGE_BACKGROUND_ASSETS } from '../content/stageBackgroundCatalog'
import { AUTOMATION } from '../config/automation'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { Profiles, Save } from '../systems/Save'
import { Settings } from '../systems/Settings'
import { MENU_COLORS, styleMenuHeading, PIXEL_FONT, pixelFontSize } from '../ui/menu/menuTheme'
import { LOGO_PATH, LOGO_TEXTURE_KEY } from '../ui/loading/LoadingScreen'
import { TitleBackdrop, type TitleBackdropState } from '../ui/title/TitleBackdrop'
import { districtLayerKeys, pressStartAlpha } from '../ui/title/titleAttract'
import { GAME_SIZE } from '../config/renderPolicy'

/** Automation's `?startScene=StageSelect` skips the Title before it draws anything. */
function redirectsToStageSelect(): boolean {
  if (!AUTOMATION.enabled || typeof window === 'undefined') return false
  return new URLSearchParams(window.location.search).get('startScene') === 'StageSelect'
}

export type TitleSnapshot = { logo: boolean; pressStartAlpha: number; attract: TitleBackdropState | null }

/**
 * Part 12i (EVAL-P8-003): the drawn logo over the hero on a relay rooftop, the relay district's parallax behind, a
 * 20 s attract cycle through three districts (`src/ui/title/`), and PRESS START blinking. Enter still deploys at once.
 * Loading: the relay layers load here and the attract districts load one beat ahead; the backdrop drops them all at
 * shutdown. The logo is resident from `Preload`. The old key art (`title_keyart.png`) is retired: its sources stay
 * under `assets/ui/source/`.
 */
export class Title extends Phaser.Scene {
  /** Set by the ESC restart so the backdrop's layers survive it (a reload raced the next Enter: smoke 33 lost the old key art). */
  private keepArt = false
  private backdrop?: TitleBackdrop
  private pressStart?: Phaser.GameObjects.Text
  private elapsedMs = 0

  constructor() {
    super('Title')
  }

  preload(): void {
    if (redirectsToStageSelect()) return
    if (!this.textures.exists(LOGO_TEXTURE_KEY)) this.load.image(LOGO_TEXTURE_KEY, LOGO_PATH)
    districtLayerKeys(TUTORIAL_STAGE_ID).forEach((key) => {
      const asset = STAGE_BACKGROUND_ASSETS.find((entry) => entry.key === key)
      if (asset && !this.textures.exists(key)) this.load.image(key, asset.path)
    })
  }

  create(): void {
    const { width } = GAME_SIZE
    const saveData = Save.load()
    if (redirectsToStageSelect()) {
      this.scene.start('StageSelect')
      return
    }
    AudioService.playMusic(this, 'title')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))
    this.keepArt = false
    this.elapsedMs = 0
    this.cameras.main.setBackgroundColor('#0E1622')
    this.backdrop = new TitleBackdrop(this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.backdrop?.destroy(this.keepArt)
      this.backdrop = undefined
    })

    // The logo replaces the text title; smoke reads it by name, and its label is the title for anything that needs text.
    if (this.textures.exists(LOGO_TEXTURE_KEY)) {
      this.add.image(width / 2, 42, LOGO_TEXTURE_KEY).setName('identity-title').setData('label', IDENTITY.GAME_TITLE)
    } else {
      styleMenuHeading(this.add.text(width / 2, 42, IDENTITY.GAME_TITLE, {
        fontFamily: PIXEL_FONT, fontSize: pixelFontSize(4), color: '#f5f8ff', stroke: '#06132a', strokeThickness: 3
      }).setOrigin(0.5).setName('identity-title'))
    }
    this.add.rectangle(width / 2, 88, 360, 15, 0x06142a, 0.86).setStrokeStyle(1, MENU_COLORS.cyan, 0.5)
    this.add.text(width / 2, 88, IDENTITY.GAME_SUBTITLE, {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#ccecff', letterSpacing: 0.5
    }).setOrigin(0.5).setName('identity-subtitle')

    this.pressStart = this.add.text(width / 2, 122, 'PRESS START', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(2), color: '#f2a93b', stroke: '#141a26', strokeThickness: 3, letterSpacing: 2
    }).setOrigin(0.5).setName('title-press-start')

    const minutes = Math.floor((saveData.stats?.playTimeMs ?? 0) / 60000)
    const playTime = `${Math.floor(minutes / 60)}H ${String(minutes % 60).padStart(2, '0')}M`
    // New-versus-continue reads the profile's `campaignStarted`, not `Save.exists()`: an Options visit writes a save.
    const pilot = Profiles.active()
    const started = Boolean(pilot?.campaignStarted)
    const primaryLabel = !started
      ? 'Begin a new campaign'
      : `Continue  ${IDENTITY.WARDEN_TERM_PLURAL} ${countClearedRobotMasters(saveData)}/8  ${playTime}`

    this.add.rectangle(width / 2, 158, 268, 40, MENU_COLORS.navy, 0.8).setStrokeStyle(1, MENU_COLORS.blue, 0.7)
    const startButton = this.add.text(width / 2, 151, primaryLabel.toUpperCase(), {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#f5f8ff', align: 'center', wordWrap: { width: 256 }
    }).setOrigin(0.5).setName('title-primary')
    startButton.setShadow(0, 1, '#000000', 2)
    startButton.setInteractive({ useHandCursor: true })
    startButton.on('pointerdown', () => {
      AudioService.unlock()
      AudioService.playSfx('ui_confirm')
      this.handlePrimaryAction()
    })
    this.add.text(width / 2, 166, started && pilot ? `MISSION CONTROL  ·  PILOT ${pilot.pilotName}  ·  SLOT ${pilot.slot}` : 'MISSION CONTROL', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#5de1ff', letterSpacing: 1
    }).setOrigin(0.5)

    const controlsButton = this.add.text(width / 2, 194, 'VIEW CONTROL MAP', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#f5f8ff', backgroundColor: '#164b7c', padding: { x: 12, y: 4 }
    }).setOrigin(0.5)
    controlsButton.setInteractive({ useHandCursor: true })
    controlsButton.on('pointerdown', () => this.openControls())

    this.add.rectangle(width / 2, 233, width, 38, MENU_COLORS.ink, 0.8)
    this.add.text(width / 2, 225, 'ENTER  DEPLOY     C  CONTROLS     O  OPTIONS     N  NEW CAMPAIGN     ESC  CLEAR RUN', {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#a9c9f2', align: 'center'
    }).setOrigin(0.5)
    this.add.text(
      width / 2,
      240,
      `TUTORIAL  ${saveData.tutorialCleared ? 'CLEARED' : 'PENDING'}    ${IDENTITY.WARDEN_TERM_PLURAL}  ${countClearedRobotMasters(saveData)}/8    FINAL  ${
        saveData.gameCompleted ? 'COMPLETED' : Save.isFinalRouteUnlocked() ? 'READY' : 'LOCKED'
      }`,
      { fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#d9edff', align: 'center' }
    ).setOrigin(0.5)

    bindMenuConfirmCancel(this, {
      onConfirm: () => this.handlePrimaryAction(),
      onCancel: () => {
        Save.clearActiveRun()
        this.keepArt = true
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

  update(_time: number, delta: number): void {
    this.elapsedMs += delta
    this.backdrop?.update(delta)
    this.pressStart?.setAlpha(pressStartAlpha(this.elapsedMs, Settings.get().reducedFlashing))
  }

  /** Automation and captures: the attract beat on screen and the blink. `seekAttract` jumps the cycle. */
  getDebugState(): TitleSnapshot {
    return { logo: this.textures.exists(LOGO_TEXTURE_KEY), pressStartAlpha: this.pressStart?.alpha ?? 0, attract: this.backdrop?.getDebugState() ?? null }
  }

  seekAttract(elapsedMs: number): void {
    this.backdrop?.seek(elapsedMs)
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
