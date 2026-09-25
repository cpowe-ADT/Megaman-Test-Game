import Phaser from 'phaser'
import { GAMEPLAY_VIEWPORT_TOP } from '../../config/gameplayLayout'
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import { getCampaignStage } from '../../content/campaign'
import { stageVerticalTop } from '../../stage/stageGeometry'
import { hazardStripPattern } from '../../mechanics/mechanicsVisuals'

const PIT_SLAG_COLOR = 0xff5a1f
const PIT_SLAG_SURFACE_COLOR = 0xffe08a
/** The pattern's teeth: dark enough to read against the orange in greyscale. */
const PIT_SLAG_PATTERN_COLOR = 0x6a1606
const PIT_SLAG_DEPTH_PX = 10

/**
 * The stage backdrop (base fill, accent bands, parallax layers) and the slag at the bottom of each
 * pit; moved out of `Game.ts` (EVAL-P6-009). It covers the stage's whole vertical extent: a stage
 * with a two-screen room (Heat Works' climb, the tutorial shaft) gets backdrop and layers above the
 * first screen too, where the climb used to show a blank band; the first screen draws as before. Game pixels throughout, not
 * `scene.scale` (canvas pixels: the parallax canvases were 252*scale tall, 32MB at scale 6).
 *
 * Each parallax layer is a TileSprite one view wide, not one world wide: a Phaser TileSprite keeps a
 * texture the size of its display, so a world-wide layer cost width x height x 4 bytes (Heat Works,
 * 5824px: four layers, 18.7MB, the stage texture budget 10.5MB). Before each render the sprite moves to
 * `scrollX * factor` (on screen that is the view's left edge) and its tile offset follows, which draws
 * exactly what the world-wide sprite drew; memory no longer grows with the stage.
 */
/** Width of a parallax strip: the view plus a margin for sub-pixel scroll. */
export const PARALLAX_STRIP_WIDTH = GAME_WIDTH + 8

/** Where a view-wide strip sits for a camera scroll: world x `scrollX * factor` shows on screen at 0. */
export function parallaxStripX(scrollX: number, scrollFactorX: number): number {
  return scrollX * scrollFactorX
}

export class StageBackdrop {
  private layers: Phaser.GameObjects.TileSprite[] = []
  private strips: Array<{ sprite: Phaser.GameObjects.TileSprite; factor: number }> = []
  private followingCamera = false
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
    this.strips = []
    if (this.followingCamera) {
      this.scene.events.off(Phaser.Scenes.Events.PRE_RENDER, this.followCamera, this)
      this.scene.events.off(Phaser.Scenes.Events.SHUTDOWN, this.clear, this)
      this.followingCamera = false
    }
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
          .tileSprite(0, span.y, Math.min(worldWidth, PARALLAX_STRIP_WIDTH), span.height, layer.key)
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
        this.strips.push({ sprite: tileSprite, factor: layer.scrollFactorX })
      }
    })
    if (this.strips.length > 0) {
      this.followCamera()
      scene.events.on(Phaser.Scenes.Events.PRE_RENDER, this.followCamera, this)
      scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.clear, this)
      this.followingCamera = true
    }
    this.renderPitSlag(stage.arena.floorGaps ?? [], height)
  }

  /** Keeps each view-wide strip under the camera and its texture in phase with the world-wide layer it replaces. */
  private followCamera(): void {
    const scrollX = this.scene.cameras.main.scrollX
    for (const { sprite, factor } of this.strips) {
      const x = parallaxStripX(scrollX, factor)
      sprite.x = x
      sprite.tilePositionX = x
    }
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
      const top = height - PIT_SLAG_DEPTH_PX
      slag.fillStyle(PIT_SLAG_COLOR, 0.9).fillRect(gap.x, top, gap.width, PIT_SLAG_DEPTH_PX)
      slag.fillStyle(PIT_SLAG_SURFACE_COLOR, 1).fillRect(gap.x, top, gap.width, 2)
      // A pattern as well as a colour (prompt 04 §4.3 colour-blind check): dark teeth and a bright crust.
      const pattern = hazardStripPattern(gap.x, gap.width, top, PIT_SLAG_DEPTH_PX)
      slag.fillStyle(PIT_SLAG_PATTERN_COLOR, 1)
      pattern.teeth.forEach(([x1, y1, x2, y2, x3, y3]) => slag.fillTriangle(x1, y1, x2, y2, x3, y3))
      slag.fillStyle(PIT_SLAG_SURFACE_COLOR, 1)
      pattern.dots.forEach((dot) => slag.fillRect(dot.x, dot.y, dot.width, dot.height))
    }
    this.slag = slag
  }
}
