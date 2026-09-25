// [REGION: GAMEOVER-SCENE - BEGIN]
import Phaser from 'phaser'
import AudioService from '../audio'
import { returnToStageSelect } from '../core/navigation'
import InputActions from '../input/InputActions'
import bindMenuConfirmCancel from '../input/menuInputBinder'
import { getCampaignStage } from '../content/campaign'
import { IDENTITY } from '../content/identity'
import { totalGameOvers } from '../content/dialogue/storyTriggers'
import type { DialoguePlaybackLine } from '../narrative/DialoguePlayback'
import { Save } from '../systems/Save'
import { addMenuBackdrop, addMenuPanel, MENU_COLORS, styleMenuHeading, PIXEL_FONT, pixelFontSize } from '../ui/menu/menuTheme'
import { GAME_OVER_AUTO_CONTINUE_MS, gameOverChoices, resolveContinueCheckpoint, type GameOverChoice } from './game/gameOverLogic'
import { gameOverLine } from './game/StoryDirector'
import { selectMenuIndex } from './menu/systemMenuSelector'
import { GAME_SIZE } from '../config/renderPolicy'

export type GameOverSceneData = { stageId: string; checkpointId?: string | null }
export type GameOverLineSnapshot = Pick<DialoguePlaybackLine, 'sequenceId' | 'speakerId' | 'text'> & { index: number; bottom: number }

/**
 * Continue from the last checkpoint (stage start on Veteran) with lives reset, or quit. Continue auto-selects after
 * five seconds. With story on, a `game_over` line (rotated by the save's game-over count) sits over the Continue row.
 */
export default class GameOverScene extends Phaser.Scene {
  private index = 0
  private rows: Phaser.GameObjects.Text[] = []
  private countdown!: Phaser.GameObjects.Text
  private remainingMs = 0
  private decided = false
  private entry!: GameOverSceneData
  private line: GameOverLineSnapshot | null = null

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
    const line = gameOverLine(totalGameOvers(Save.load().gameOverCounts), { hero: IDENTITY.HERO_CALLSIGN })
    this.cameras.main.setBackgroundColor('#050913')
    addMenuBackdrop(this, 0.5)
    addMenuPanel(this, width / 2, height / 2, 300, line ? 184 : 150)
    styleMenuHeading(this.add.text(width / 2, line ? 50 : 68, 'GAME OVER', { fontFamily: PIXEL_FONT, fontSize: pixelFontSize(3), color: '#f5f8ff' }).setOrigin(0.5))
    const difficulty = Save.load().difficulty
    const target = resolveContinueCheckpoint(difficulty, data.checkpointId)
    this.add.text(width / 2, line ? 72 : 96, target ? 'CONTINUE FROM THE LAST CHECKPOINT' : `CONTINUE FROM THE STAGE START (${difficulty.toUpperCase()})`, {
      fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#a9c9f2', letterSpacing: 1
    }).setOrigin(0.5)
    this.line = null
    let rowsTop = 122
    if (line) {
      this.add.text(width / 2, 84, line.speakerName.toUpperCase(), { fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#7de8ff', letterSpacing: 1 }).setOrigin(0.5, 0)
      const body = this.add.text(width / 2, 95, line.text, {
        fontFamily: 'monospace', fontSize: '9px', color: '#f4f8ff', align: 'center', lineSpacing: 2, wordWrap: { width: 272, useAdvancedWrap: true }
      }).setOrigin(0.5, 0)
      const bottom = Math.ceil(body.y + body.height)
      this.line = { sequenceId: line.sequenceId, speakerId: line.speakerId, text: line.text, index: line.index, bottom }
      rowsTop = bottom + 14
    }
    this.rows = gameOverChoices().map((choice, idx) =>
      this.add.text(width / 2, rowsTop + idx * 20, choice.label.toUpperCase(), { fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#c8dcf8' }).setOrigin(0.5)
    )
    this.countdown = this.add.text(width / 2, rowsTop + 50, '', { fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#7de8ff' }).setOrigin(0.5)
    this.remainingMs = GAME_OVER_AUTO_CONTINUE_MS
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

  /**
   * Counts down by frame delta. A deadline from `this.time.now` in `create` was stale: Phaser syncs a scene clock at
   * boot and on update, not on start, so the first game over of a session (and any after a long run) continued at once.
   */
  update(_time: number, delta: number): void {
    if (this.decided) return
    this.remainingMs = Math.max(0, this.remainingMs - delta)
    this.countdown.setText(`CONTINUE IN ${Math.ceil(this.remainingMs / 1000)}`)
    if (this.remainingMs <= 0) this.choose('continue')
  }

  getDebugState(): { index: number; remainingMs: number; line: GameOverLineSnapshot | null; continueRowTop: number } {
    const continueRow = this.rows[0]
    return {
      index: this.index,
      remainingMs: this.remainingMs,
      line: this.line,
      continueRowTop: continueRow ? Math.floor(continueRow.y - continueRow.height / 2) : 0
    }
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
