import Phaser from 'phaser'
import AudioService from '../audio'
import { BOSS_ROSTER } from '../bosses/roster'
import type { BossId } from '../bosses/types'
import { getCampaignStage } from '../content/campaign'
import { GAME_SIZE } from '../config/renderPolicy'
import InputActions from '../input/InputActions'
import { PIXEL_FONT, pixelFontSize } from '../ui/menu/menuTheme'
import { typewriterBlipTicked } from '../ui/dialogueTypewriter'
import { BossIntroSequence, resolveBossIntroFrames, type BossIntroSnapshot } from './bossIntro/BossIntroLogic'

export type BossIntroSceneData = Record<string, unknown> & { stageId: string; bossId: string }

const BAND_HEIGHT = 48
const SPRITE_SCALE = 2
const ANIM_FRAME_RATE = 4

function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`
}

/**
 * The pre-stage boss card (part 13g, `EVAL-P13-012`): after Stage Select confirms a warden and before the
 * stage loads, a band across the middle carries the boss's 4-frame `intro` pose at 2x, its name typed in
 * with the `ui_move` blip, and the district and element beneath. About 3 s; Enter ends it early.
 *
 * Loads only this boss's atlas (`atlas_<bossId>`, the same key `stageBackgroundLoading.ts` uses); it never
 * evicts it here because the very next scene is always that boss's own stage, which keeps it loaded through
 * `queueStageScopedAtlases` (skips the reload when the texture already exists).
 */
export class BossIntroScene extends Phaser.Scene {
  private readonly sequence = new BossIntroSequence()
  private sceneData!: BossIntroSceneData
  private atlasKey = ''
  private codename = ''
  private nameText!: Phaser.GameObjects.Text
  private previousVisibleChars = 0
  private finished = false

  constructor() {
    super('BossIntro')
  }

  init(data: BossIntroSceneData): void {
    this.sceneData = data
    this.atlasKey = `atlas_${data.bossId}`
    this.finished = false
    this.previousVisibleChars = 0
  }

  preload(): void {
    if (this.sceneData?.bossId && !this.textures.exists(this.atlasKey)) {
      this.load.atlas(this.atlasKey, `/assets/sprites/bosses/${this.sceneData.bossId}.png`, `/assets/sprites/bosses/${this.sceneData.bossId}.json`)
    }
  }

  create(): void {
    if (!this.sceneData?.bossId || !this.sceneData?.stageId) {
      this.finish()
      return
    }
    const blueprint = BOSS_ROSTER[this.sceneData.bossId as BossId]
    const stage = getCampaignStage(this.sceneData.stageId)
    this.codename = String(blueprint?.codename ?? this.sceneData.bossId).toUpperCase()
    const accent = blueprint?.theme.accent ?? 0xffffff
    const primary = blueprint?.theme.primary ?? 0x62b6ff

    const { width, height } = GAME_SIZE
    const y = Math.round(height / 2)
    this.cameras.main.setBackgroundColor('#02050c')
    this.add.rectangle(width / 2, y, width, BAND_HEIGHT, 0x07142a, 0.98).setStrokeStyle(1, primary, 0.9)
    this.buildSprite(width / 2, y - BAND_HEIGHT)

    this.nameText = this.add
      .text(width / 2, y - 9, '', { fontFamily: PIXEL_FONT, fontSize: pixelFontSize(2), color: hexColor(accent), letterSpacing: 2 })
      .setOrigin(0.5)
    this.add
      .text(width / 2, y + 13, `${stage.district} · ${String(blueprint?.element ?? 'NORMAL').toUpperCase()} TYPE`, {
        fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#a9c9f2', letterSpacing: 1
      })
      .setOrigin(0.5)

    AudioService.playSfx('boss_intro_sting')
    this.sequence.start(this.codename.length)
    this.applySnapshot(this.sequence.snapshot())

    const offConfirm = InputActions.forScene(this).onPressed('confirm', () => this.finish())
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => offConfirm())
  }

  update(_time: number, delta: number): void {
    if (this.finished) return
    if (this.sequence.tick(delta)) this.finish()
    else this.applySnapshot(this.sequence.snapshot())
  }

  /** `render_game_to_text().bossIntro` while this scene is active (AGENTS.md rule 9; see TESTING.md). */
  getDebugState(): { phase: string; name: string; visibleCharacters: number; charactersTotal: number } {
    const snapshot = this.sequence.snapshot()
    return { phase: snapshot.phase, name: this.codename, visibleCharacters: snapshot.visibleChars, charactersTotal: this.codename.length }
  }

  private buildSprite(x: number, y: number): void {
    if (!this.textures.exists(this.atlasKey)) return
    const frameNames = this.textures.get(this.atlasKey).getFrameNames()
    const introFrames = resolveBossIntroFrames(frameNames, this.sceneData.bossId)
    const firstFrame = introFrames[0] ?? frameNames[0]
    if (!firstFrame) return
    const sprite = this.add.sprite(x, y, this.atlasKey, firstFrame).setScale(SPRITE_SCALE)
    this.tweens.add({ targets: sprite, alpha: { from: 0, to: 1 }, duration: 160 })
    if (introFrames.length > 1) {
      const animKey = `${this.sceneData.bossId}_boss_intro_card`
      if (!this.anims.exists(animKey)) {
        this.anims.create({ key: animKey, frames: introFrames.map((frame) => ({ key: this.atlasKey, frame })), frameRate: ANIM_FRAME_RATE, repeat: -1 })
      }
      sprite.play(animKey)
    }
  }

  private applySnapshot(snapshot: BossIntroSnapshot): void {
    if (typewriterBlipTicked(this.previousVisibleChars, snapshot.visibleChars)) AudioService.playSfx('ui_move')
    this.previousVisibleChars = snapshot.visibleChars
    this.nameText?.setText(this.codename.slice(0, snapshot.visibleChars))
  }

  private finish(): void {
    if (this.finished) return
    this.finished = true
    this.sequence.skip()
    this.scene.start('Game', this.sceneData)
  }
}
