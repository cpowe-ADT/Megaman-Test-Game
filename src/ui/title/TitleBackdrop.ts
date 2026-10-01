import Phaser from 'phaser'
import { GAME_SIZE } from '../../config/renderPolicy'
import { STAGE_BACKGROUND_ASSETS } from '../../content/stageBackgroundCatalog'
import { shouldFlipPlayerSpriteForFacing } from '../../player/config'
import { districtPreviewPlan, liftTint } from '../stageSelect/districtPreview'
import { ATTRACT_STAGE_IDS, attractFrame, attractKeysToEvict, districtLayerKeys } from './titleAttract'

const HERO_ATLAS_KEY = 'atlas_player_main'
/** Relay rooftop (style sheet relay row): shadow body, base band, edge on the walkable top. */
const ROOF = { top: 206, right: 112, mast: 12, shadow: 0x1c2e47, base: 0x304a6d, edge: 0x5c7fa8, amber: 0xf2a93b }
/** The Title shows the districts brighter than a stage does (a stage darkens them behind its tiles). */
const TINT_LIFT = 0.35

export type TitleBackdropState = { beat: number; stageId: string; fade: number; built: string[]; elapsedMs: number }

/**
 * Part 12i (EVAL-P8-003): the Title backdrop. The hero stands on a relay rooftop over the relay district's own
 * parallax; every 5 s the district behind cross-fades to the next of the attract cycle (`titleAttract.ts`).
 * Loading and eviction: the relay layers load in `Title.preload`; each other district loads 2 s before its beat and
 * is dropped once its beat has faded out; `destroy()` (Title shutdown) drops every attract layer that is loaded,
 * unless the Title is only restarting (ESC clears the run and restarts it).
 */
export class TitleBackdrop {
  private readonly districts = new Map<string, { container: Phaser.GameObjects.Container; strips: { sprite: Phaser.GameObjects.TileSprite; drift: number }[] }>()
  private readonly requested = new Set<string>()
  private elapsedMs = 0
  private destroyed = false

  constructor(private readonly scene: Phaser.Scene) {
    this.buildRooftop()
    this.update(0)
  }

  /** Jumps the cycle (automation and captures). */
  seek(elapsedMs: number): void {
    this.elapsedMs = Math.max(0, elapsedMs)
    this.update(0)
  }

  update(deltaMs: number): void {
    if (this.destroyed) return
    this.elapsedMs += Math.max(0, deltaMs)
    const frame = attractFrame(this.elapsedMs)
    frame.resident.forEach((stageId) => this.ensureDistrict(stageId))
    this.districts.forEach((district, stageId) => {
      if (!frame.resident.includes(stageId)) {
        district.container.destroy(true)
        this.districts.delete(stageId)
        return
      }
      const onScreen = stageId === frame.stageId
      const under = stageId === ATTRACT_STAGE_IDS[frame.previous] && !onScreen
      district.container.setVisible(onScreen || under).setAlpha(onScreen ? frame.fade : 1).setDepth(onScreen ? -19 : -20)
      district.strips.forEach((strip) => { strip.sprite.tilePositionX += (strip.drift * deltaMs) / 1000 })
    })
    const keys = this.scene.textures.getTextureKeys()
    attractKeysToEvict(keys, this.elapsedMs).forEach((key) => {
      this.scene.textures.remove(key)
      this.requested.delete(key)
    })
  }

  getDebugState(): TitleBackdropState {
    const frame = attractFrame(this.elapsedMs)
    return { beat: frame.beat, stageId: frame.stageId, fade: Math.round(frame.fade * 100) / 100, built: [...this.districts.keys()], elapsedMs: Math.round(this.elapsedMs) }
  }

  destroy(keepTextures: boolean): void {
    this.destroyed = true
    this.districts.forEach((district) => district.container.destroy(true))
    this.districts.clear()
    if (keepTextures) return
    ATTRACT_STAGE_IDS.flatMap(districtLayerKeys).forEach((key) => {
      if (this.scene.textures.exists(key)) this.scene.textures.remove(key)
    })
  }

  /** Builds the district once its layers exist; queues the missing ones otherwise. */
  private ensureDistrict(stageId: string): void {
    if (this.districts.has(stageId)) return
    const plan = districtPreviewPlan(stageId)
    const missing = plan.layers.filter((layer) => !this.scene.textures.exists(layer.key))
    if (missing.length > 0) {
      missing.forEach((layer) => {
        const asset = STAGE_BACKGROUND_ASSETS.find((entry) => entry.key === layer.key)
        if (!asset || this.requested.has(layer.key)) return
        this.requested.add(layer.key)
        this.scene.load.image(layer.key, asset.path)
      })
      if (!this.scene.load.isLoading()) this.scene.load.start()
      return
    }
    const { width, height } = GAME_SIZE
    const base = this.scene.add.rectangle(0, 0, width, height, Phaser.Display.Color.HexStringToColor(plan.baseColor).color).setOrigin(0, 0)
    const strips = plan.layers.map((layer) => {
      const sprite = this.scene.add.tileSprite(0, layer.y, width, Math.max(16, height - layer.y), layer.key).setOrigin(0, 0)
      sprite.setTint(liftTint(layer.tint, TINT_LIFT)).setAlpha(layer.alpha)
      return { sprite, drift: layer.driftPxPerS }
    })
    const container = this.scene.add.container(0, 0, [base, ...strips.map((strip) => strip.sprite)]).setDepth(-20).setVisible(false)
    this.districts.set(stageId, { container, strips })
  }

  /** The hero on a relay rooftop at the lower left, facing into the city, beside a mast with a slow amber beacon. */
  private buildRooftop(): void {
    const { height } = GAME_SIZE
    const roof = this.scene.add.graphics().setDepth(-6)
    roof.fillStyle(ROOF.shadow, 1).fillRect(0, ROOF.top, ROOF.right, height - ROOF.top)
    roof.fillStyle(ROOF.base, 1).fillRect(0, ROOF.top + 1, ROOF.right, 6)
    roof.fillStyle(ROOF.edge, 1).fillRect(0, ROOF.top, ROOF.right, 1)
    roof.fillStyle(ROOF.edge, 1).fillRect(ROOF.mast, ROOF.top - 58, 2, 58)
    const beacon = this.scene.add.rectangle(ROOF.mast + 1, ROOF.top - 60, 4, 3, ROOF.amber, 1).setDepth(-5)
    this.scene.tweens.add({ targets: beacon, alpha: 0.35, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.InOut' })
    if (!this.scene.textures.exists(HERO_ATLAS_KEY)) return
    const hero = this.scene.add.sprite(48, ROOF.top, HERO_ATLAS_KEY).setOrigin(0.5, 46 / 48).setDepth(-4)
    hero.setFlipX(shouldFlipPlayerSpriteForFacing(1))
    if (this.scene.anims.exists('player-idle')) hero.play('player-idle')
  }
}
