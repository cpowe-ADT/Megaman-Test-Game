// [REGION: GAMEOVER-SCENE - BEGIN]
import Phaser from 'phaser'
import AudioService from '../audio'
import { returnToStageSelect } from '../core/navigation'
import InputActions from '../input/InputActions'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { getCampaignStage } from '../content/campaign'
import { IDENTITY } from '../content/identity'
import { Save } from '../systems/Save'
import { addMenuBackdrop, addMenuPanel, MENU_COLORS, MENU_FONT_BODY, MENU_FONT_CODE, MENU_FONT_DISPLAY, styleMenuHeading } from '../ui/menu/menuTheme'
import { GAME_OVER_AUTO_CONTINUE_MS, gameOverChoices, resolveContinueCheckpoint, type GameOverChoice } from './game/gameOverLogic'
import { selectMenuIndex } from './menu/systemMenuSelector'
import { GAME_SIZE } from '../config/renderPolicy'

export type GameOverSceneData = { stageId: string; checkpointId?: string | null }

/** Continue from the last checkpoint (stage start on Veteran) with lives reset, or quit. Continue auto-selects after five seconds. */
export default class GameOverScene extends Phaser.Scene {
  private index = 0
  private rows: Phaser.GameObjects.Text[] = []
  private countdown!: Phaser.GameObjects.Text
  private deadline = 0
  private decided = false
  private entry!: GameOverSceneData

  constructor() {
    super('GameOver')
  }

  create(data: GameOverSceneData): void {
    this.entry = data
    this.index = 0
    this.decided = false
    Save.addGameOver(data.stageId)
    AudioService.playMusic(this, 'title')
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => AudioService.onSceneShutdown(this))

    const { width, height } = GAME_SIZE
    this.cameras.main.setBackgroundColor('#050913')
    addMenuBackdrop(this, 0.5)
    addMenuPanel(this, width / 2, height / 2, 300, 150)
    styleMenuHeading(this.add.text(width / 2, 68, 'GAME OVER', { fontFamily: MENU_FONT_DISPLAY, fontSize: '22px', color: '#f5f8ff' }).setOrigin(0.5))
    const difficulty = Save.load().difficulty
    const target = resolveContinueCheckpoint(difficulty, data.checkpointId)
    this.add.text(width / 2, 96, target ? 'CONTINUE FROM THE LAST CHECKPOINT' : `CONTINUE FROM THE STAGE START (${difficulty.toUpperCase()})`, {
      fontFamily: MENU_FONT_CODE, fontSize: '8px', color: '#a9c9f2', letterSpacing: 1
    }).setOrigin(0.5)
    this.rows = gameOverChoices().map((choice, idx) =>
      this.add.text(width / 2, 122 + idx * 20, choice.label.toUpperCase(), { fontFamily: MENU_FONT_BODY, fontSize: '11px', fontStyle: 'bold', color: '#c8dcf8' }).setOrigin(0.5)
    )
    this.countdown = this.add.text(width / 2, 172, '', { fontFamily: MENU_FONT_CODE, fontSize: '8px', color: '#7de8ff' }).setOrigin(0.5)
    this.deadline = this.time.now + GAME_OVER_AUTO_CONTINUE_MS
    this.render()

    const actions = InputActions.forScene(this)
    actions.onPressed('aimUp', () => this.move(-1))
    actions.onPressed('aimDown', () => this.move(1))
    bindMenuConfirmCancel(this, {
      onConfirm: () => this.choose(gameOverChoices()[this.index].id),
      onCancel: () => this.choose('quit')
    })
    this.input.once('pointerdown', () => { AudioService.unlock(); this.choose('continue') })
  }

  update(): void {
    if (this.decided) return
    const remaining = Math.max(0, this.deadline - this.time.now)
    this.countdown.setText(`CONTINUE IN ${Math.ceil(remaining / 1000)}`)
    if (remaining <= 0) this.choose('continue')
  }

  getDebugState(): { index: number; remainingMs: number } {
    return { index: this.index, remainingMs: Math.max(0, this.deadline - this.time.now) }
  }

  private move(delta: number): void {
    AudioService.playSfx('ui_move')
    this.index = selectMenuIndex(this.index, delta, this.rows.length)
    this.render()
  }

  private render(): void {
    this.rows.forEach((row, idx) => row.setColor(idx === this.index ? '#ffffff' : '#8da0bc'))
  }

  private choose(choice: GameOverChoice): void {
    if (this.decided) return
    this.decided = true
    if (choice === 'quit') {
      returnToStageSelect(this, { reason: 'gameover-quit' })
      return
    }
    const stage = getCampaignStage(this.entry.stageId)
    const checkpointId = resolveContinueCheckpoint(Save.load().difficulty, this.entry.checkpointId)
    this.scene.start('Game', {
      stageId: stage.id,
      bossId: stage.bossId,
      runtimeBossConfigId: stage.runtimeBossConfigId,
      checkpointId
    })
  }
}
// [REGION: GAMEOVER-SCENE - END]
export const GAME_OVER_TITLE = IDENTITY.GAME_TITLE
