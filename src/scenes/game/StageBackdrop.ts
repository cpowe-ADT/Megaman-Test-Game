import Phaser from 'phaser'
import { GAMEPLAY_VIEWPORT_TOP } from '../../config/gameplayLayout'
import { GAME_HEIGHT } from '../../config/renderPolicy'
import { getCampaignStage } from '../../content/campaign'
import { stageVerticalTop } from '../../stage/stageGeometry'

const PIT_SLAG_COLOR = 0xff5a1f
const PIT_SLAG_SURFACE_COLOR = 0xffe08a
const PIT_SLAG_DEPTH_PX = 10

/**
 * The stage backdrop (base fill, accent bands, parallax layers) and the slag at the bottom of each
 * pit; moved out of `Game.ts` (EVAL-P6-009). It covers the stage's whole vertical extent: a stage
 * with a two-screen room (Heat Works' climb, the tutorial shaft) gets backdrop and layers above the
 * first screen too, where the climb used to show a blank band; the first screen draws as before. Game pixels throughout, not
 * `scene.scale` (canvas pixels: the parallax canvases were 252*scale tall, 32MB at scale 6).
 */
export class StageBackdrop {
  private layers: Phaser.GameObjects.TileSprite[] = []
  private graphics?: Phaser.GameObjects.Graphics
  private slag?: Phaser.GameObjects.Graphics

  constructor(private readonly scene: Phaser.Scene) {}

  /** Parallax layer sprites drawn, the upward copies included (`render_game_to_text().visuals.backgroundLayerCount`). */
  get layerCount(): number {
    return this.layers.length
  }

  clear(): void {
    this.layers.forEach((layer) => layer.destroy())
    this.layers = []
    this.graphics?.destroy()
    this.graphics = undefined
    this.slag?.destroy()
    this.slag = undefined
  }

  render(stageId: string, worldWidth: number): void {
    this.clear()
    const { scene } = this
    const stage = getCampaignStage(stageId)
    const height = GAME_HEIGHT
    const top = stageVerticalTop(stage.arena, height)
    const layers = stage.arena.background?.layers ?? []
    const baseColor = Phaser.Display.Color.HexStringToColor(stage.arena.background.baseColor).color
    const accentColor = layers.find((layer) => typeof layer.tint === 'number')?.tint ?? 0x4a8cff
    const backdrop = scene.add.graphics().setDepth(-50)
    backdrop.fillStyle(baseColor, 1).fillRect(0, top, worldWidth, height - top)
    // The first screen keeps its look exactly (under the HUD band it is the opaque base colour only, so
    // the 1x and 2x renders match there); a tall stage repeats the band above the first screen.
    this.drawBand(backdrop, accentColor, worldWidth, GAMEPLAY_VIEWPORT_TOP, height)
    if (top < 0) this.drawBand(backdrop, accentColor, worldWidth, top, 0)
    backdrop.fillStyle(accentColor, 0.45).fillRect(0, GAMEPLAY_VIEWPORT_TOP, worldWidth, 2)
    this.graphics = backdrop
    layers.forEach((layer, index) => {
      if (!scene.textures.exists(layer.key)) {
        return
      }
      const spans = [{ y: layer.y, height: Math.max(16, height - layer.y), tileY: 0 }]
      // Above the first screen the layer tiles upward, in phase with its first-screen copy.
      if (top < 0) spans.push({ y: top, height: -top, tileY: top - layer.y })
      for (const span of spans) {
        const tileSprite = scene.add
          .tileSprite(0, span.y, worldWidth, span.height, layer.key)
          .setOrigin(0, 0)
          .setScrollFactor(layer.scrollFactorX, 1)
          .setDepth(-40 + index)
        tileSprite.tilePositionY = span.tileY
        if (typeof layer.alpha === 'number') {
          tileSprite.setAlpha(layer.alpha)
        }
        if (typeof layer.tint === 'number') {
          tileSprite.setTint(layer.tint)
        }
        this.layers.push(tileSprite)
      }
    })
    this.renderPitSlag(stage.arena.floorGaps ?? [], height)
  }

  /** The accent band between `from` and `to`: a faint fill, horizontal rules getting stronger downward, diagonals. */
  private drawBand(backdrop: Phaser.GameObjects.Graphics, accentColor: number, worldWidth: number, from: number, to: number): void {
    backdrop.fillStyle(accentColor, 0.1).fillRect(0, from, worldWidth, to - from)
    for (let y = from; y < to; y += 14) {
      const depthAlpha = 0.08 + ((y - from) / Math.max(1, to - from)) * 0.1
      backdrop.fillStyle(accentColor, depthAlpha).fillRect(0, y, worldWidth, 1)
    }
    backdrop.lineStyle(1, accentColor, 0.1)
    for (let x = 0; x < worldWidth; x += 64) {
      backdrop.lineBetween(x, from, x + 32, to)
    }
  }

  /** Slag glows at the bottom of every pit so a gap reads as deadly before the hero reaches it. */
  private renderPitSlag(gaps: readonly { x: number; width: number }[], height: number): void {
    if (gaps.length === 0) return
    const slag = this.scene.add.graphics().setDepth(3)
    for (const gap of gaps) {
      slag.fillStyle(PIT_SLAG_COLOR, 0.9).fillRect(gap.x, height - PIT_SLAG_DEPTH_PX, gap.width, PIT_SLAG_DEPTH_PX)
      slag.fillStyle(PIT_SLAG_SURFACE_COLOR, 1).fillRect(gap.x, height - PIT_SLAG_DEPTH_PX, gap.width, 2)
    }
    this.slag = slag
  }
}
