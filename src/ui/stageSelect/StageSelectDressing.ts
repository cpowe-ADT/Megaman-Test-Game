import Phaser from 'phaser'
import AudioService from '../../audio'
import { AUTOMATION } from '../../config/automation'
import { GAME_SIZE } from '../../config/renderPolicy'
import { STAGE_BACKGROUND_ASSETS } from '../../content/stageBackgroundCatalog'
import { PIXEL_FONT, pixelFontSize } from '../menu/menuTheme'
import { districtPreviewPlan, liftTint, previewKeysToEvict, TILE_FLIP_MS } from './districtPreview'
import { loadBackgroundImageOnce } from '../../scenes/game/stageBackgroundLoading'

const DISTRICT_DEPTH = -40
const TINT_LIFT = 0.4
const FADE_MS = 220

export type DistrictBackdropState = { stageId: string | null; ready: boolean; loadedByPreview: string[] }

/**
 * Part 12i (EVAL-P8-003): the selected warden's district behind Stage Select, composed from that stage's own
 * parallax layers (`districtPreview.ts`), drifting slowly and cross-fading when the cursor moves.
 * Loading and eviction: a district's layers load when it is selected; once the next district is up, every layer the
 * preview loaded that it no longer draws is removed; at shutdown all of them go except the stage being launched
 * (`keep`), which the Game scene would load next anyway.
 */
export class DistrictBackdrop {
  private shown?: { stageId: string; container: Phaser.GameObjects.Container; strips: { sprite: Phaser.GameObjects.TileSprite; drift: number }[] }
  private outgoing?: Phaser.GameObjects.Container
  private wanted: string | null = null
  private keepStageId: string | null = null
  private readonly loadedByPreview = new Set<string>()
  private destroyed = false

  constructor(private readonly scene: Phaser.Scene) {
    scene.events.on(Phaser.Scenes.Events.UPDATE, this.tick, this)
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy())
  }

  show(stageId: string): void {
    if (this.destroyed || this.wanted === stageId) return
    this.wanted = stageId
    const missing = districtPreviewPlan(stageId).layers.filter((layer) => !this.scene.textures.exists(layer.key))
    if (missing.length === 0) {
      this.build(stageId)
      return
    }
    missing.forEach((layer) => {
      const asset = STAGE_BACKGROUND_ASSETS.find((entry) => entry.key === layer.key)
      if (!asset) return
      this.loadedByPreview.add(layer.key)
      // Shared with Game's own stage-background loader (stageBackgroundLoading.ts): a revisit can have this
      // preview and the Game scene it is about to hand off to both see the same key "missing" while the
      // other's fetch is still in flight; the guard skips the duplicate queue instead of racing to add it twice.
      loadBackgroundImageOnce(this.scene, layer.key, asset.path)
    })
    this.scene.load.once(Phaser.Loader.Events.COMPLETE, () => {
      if (!this.destroyed && this.wanted === stageId) this.build(stageId)
    })
    if (!this.scene.load.isLoading()) this.scene.load.start()
  }

  /** The stage about to launch: its layers survive the shutdown eviction. */
  keep(stageId: string | null): void {
    this.keepStageId = stageId
  }

  getDebugState(): DistrictBackdropState {
    return { stageId: this.shown?.stageId ?? null, ready: this.shown?.stageId === this.wanted, loadedByPreview: [...this.loadedByPreview] }
  }

  private build(stageId: string): void {
    const plan = districtPreviewPlan(stageId)
    if (plan.layers.some((layer) => !this.scene.textures.exists(layer.key))) return
    const { width, height } = GAME_SIZE
    const base = this.scene.add.rectangle(0, 0, width, height, Phaser.Display.Color.HexStringToColor(plan.baseColor).color).setOrigin(0, 0)
    const strips = plan.layers.map((layer) => {
      const sprite = this.scene.add.tileSprite(0, layer.y, width, Math.max(16, height - layer.y), layer.key).setOrigin(0, 0)
      sprite.setTint(liftTint(layer.tint, TINT_LIFT)).setAlpha(layer.alpha)
      return { sprite, drift: layer.driftPxPerS }
    })
    const container = this.scene.add.container(0, 0, [base, ...strips.map((strip) => strip.sprite)]).setDepth(DISTRICT_DEPTH).setName('district-preview')
    this.outgoing?.destroy(true)
    this.outgoing = this.shown?.container
    this.shown = { stageId, container, strips }
    if (this.outgoing) {
      container.setAlpha(0).setDepth(DISTRICT_DEPTH + 1)
      const outgoing = this.outgoing
      this.scene.tweens.add({
        targets: container, alpha: 1, duration: FADE_MS,
        onComplete: () => {
          container.setDepth(DISTRICT_DEPTH)
          outgoing.destroy(true)
          if (this.outgoing === outgoing) this.outgoing = undefined
          this.evict([stageId])
        }
      })
      return
    }
    this.evict([stageId])
  }

  private evict(keepStageIds: readonly (string | null)[]): void {
    previewKeysToEvict([...this.loadedByPreview], keepStageIds).forEach((key) => {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
      this.loadedByPreview.delete(key)
    })
  }

  private tick(_time: number, delta: number): void {
    this.shown?.strips.forEach((strip) => { strip.sprite.tilePositionX += (strip.drift * delta) / 1000 })
  }

  private destroy(): void {
    this.destroyed = true
    this.scene.events.off(Phaser.Scenes.Events.UPDATE, this.tick, this)
    this.outgoing?.destroy(true)
    this.shown?.container.destroy(true)
    this.outgoing = undefined
    this.shown = undefined
    this.evict([this.keepStageId])
  }
}

/** Corner brackets that glide to the selected tile. */
export class SelectCursor {
  private readonly graphics: Phaser.GameObjects.Graphics
  private move?: Phaser.Tweens.Tween
  private placed = false

  constructor(private readonly scene: Phaser.Scene, width: number, height: number) {
    const arm = 7
    const left = -width / 2 - 2
    const top = -height / 2 - 2
    const right = width / 2 + 1
    const bottom = height / 2 + 1
    this.graphics = scene.add.graphics().setDepth(30).setName('stage-select-cursor')
    this.graphics.fillStyle(0xf2a93b, 1)
    for (const [x, y, dx, dy] of [[left, top, 1, 1], [right, top, -1, 1], [left, bottom, 1, -1], [right, bottom, -1, -1]]) {
      this.graphics.fillRect(dx > 0 ? x : x - arm + 1, y + (dy > 0 ? 0 : -1), arm, 2)
      this.graphics.fillRect(x + (dx > 0 ? 0 : -1), dy > 0 ? y : y - arm + 1, 2, arm)
    }
    scene.tweens.add({ targets: this.graphics, alpha: 0.6, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
  }

  moveTo(x: number, y: number): void {
    this.move?.stop()
    this.move = undefined
    if (!this.placed) {
      this.graphics.setPosition(x, y)
      this.placed = true
      return
    }
    this.move = this.scene.tweens.add({ targets: this.graphics, x, y, duration: 90, ease: 'Quad.Out' })
  }

  get position(): { x: number; y: number } {
    return { x: this.graphics.x, y: this.graphics.y }
  }
}

/**
 * The portraits slide into their tiles, one after another, when Stage Select opens. Under automation they are placed
 * at once, so every capture and bounds read sees the finished tiles (as `storyIntro=off` does for the story beats).
 */
export function revealPortraits(scene: Phaser.Scene, sprites: readonly Phaser.GameObjects.Image[]): void {
  if (AUTOMATION.enabled) return
  sprites.filter((sprite) => sprite.visible).forEach((sprite, index) => {
    const x = sprite.x
    sprite.setX(x - 18).setAlpha(0)
    scene.tweens.add({ targets: sprite, x, alpha: 1, delay: 60 + index * 45, duration: 240, ease: 'Cubic.Out' })
  })
}

/**
 * The district-restored flip on a cleared warden's tile: a card over the tile folds shut, turns to the restored
 * colour with the sting, opens with DISTRICT RESTORED, holds, and fades to the cleared tile beneath. No white flash.
 */
export function playRestoredFlip(scene: Phaser.Scene, tile: Phaser.GameObjects.Rectangle, fromColor: number, toColor: number): void {
  const card = scene.add.rectangle(tile.x, tile.y, tile.width, tile.height, fromColor, 0.96).setStrokeStyle(2, 0xf2a93b, 1).setDepth(40)
  const label = scene.add.text(tile.x, tile.y, 'DISTRICT RESTORED', { fontFamily: PIXEL_FONT, fontSize: pixelFontSize(1), color: '#f5f8ff' })
    .setOrigin(0.5).setDepth(41).setAlpha(0).setName('district-restored-flip')
  const half = TILE_FLIP_MS / 2
  scene.tweens.add({
    targets: card, scaleX: 0, duration: half, ease: 'Sine.In',
    onComplete: () => {
      card.setFillStyle(toColor, 0.96)
      label.setAlpha(1)
      AudioService.playSfx('pickup_bonus')
      scene.tweens.add({
        targets: card, scaleX: 1, duration: half, ease: 'Sine.Out',
        onComplete: () => scene.tweens.add({
          targets: [card, label], alpha: 0, delay: 700, duration: 320, onComplete: () => { card.destroy(); label.destroy() }
        })
      })
    }
  })
}
