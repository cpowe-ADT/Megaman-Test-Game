import type Phaser from 'phaser'
import AudioService from '../../audio'
import { HERO_EFFECTS_ATLAS, HERO_HIT_FX } from '../../combat/heroCombatVisuals'
import type { SfxAssetKey } from '../../audio/sfxLibrary'
import { MECHANICS_ATLAS, MECHANICS_V2_ATLAS, mechanicsFrame, type FrameIndex, type MechanicsGroup } from '../mechanicsVisuals'
import { mechanicsV2Frame, type MechanicsV2Group } from '../mechanicsV2Visuals'

/** Shared Phaser helpers for the mechanics adapters: the atlas check, frame keys and the counted-hit tell. */
export function mechanicsArtReady(scene: Phaser.Scene): boolean {
  return scene.textures.exists(MECHANICS_ATLAS.key)
}

/** The 12b mechanics art (`mechanics_v2`); without it the 12b adapters draw plain shapes. */
export function mechanicsV2ArtReady(scene: Phaser.Scene): boolean {
  return scene.textures.exists(MECHANICS_V2_ATLAS.key)
}

type FramedObject = { frame: Phaser.Textures.Frame; texture: Phaser.Textures.Texture | Phaser.Textures.CanvasTexture; setFrame(frame: string): unknown }

/** The drawn frame: a TileSprite draws `displayFrame` (its own `frame` is the canvas it tiles into). */
function drawnFrame(object: FramedObject): { texture: string; name: string } {
  const tile = object as FramedObject & { displayFrame?: Phaser.Textures.Frame; displayTexture?: Phaser.Textures.Texture }
  return { texture: String((tile.displayTexture ?? object.texture)?.key ?? ''), name: String((tile.displayFrame ?? object.frame)?.name ?? '') }
}

export function setMechanicsFrame(object: FramedObject, group: MechanicsGroup, index: FrameIndex): void {
  const name = mechanicsFrame(group, index)
  if (drawnFrame(object).name !== name) object.setFrame(name)
}

export function setMechanicsV2Frame(object: FramedObject, group: MechanicsV2Group, index: FrameIndex): void {
  const name = mechanicsV2Frame(group, index)
  if (drawnFrame(object).name !== name) object.setFrame(name)
}

/** The mechanics frame an Image or TileSprite shows, or null when it is hidden or draws something else. */
export function mechanicsFrameName(object: Phaser.GameObjects.GameObject | undefined): string | null {
  const drawn = object as (Phaser.GameObjects.GameObject & FramedObject & { visible?: boolean }) | undefined
  if (!drawn?.visible || !drawn.frame) return null
  const frame = drawnFrame(drawn)
  return frame.texture === MECHANICS_ATLAS.key || frame.texture === MECHANICS_V2_ATLAS.key ? frame.name : null
}

/**
 * A counted hit on a wall or scrap gate: the hero's `hit_spark` strip (effects_hero) at the contact
 * point and an existing SFX. The spark steps its frames on a counter tween and removes itself.
 */
export function playMechanicHit(scene: Phaser.Scene, x: number, y: number, sfx: SfxAssetKey): void {
  AudioService.playSfx(sfx)
  const strip = HERO_HIT_FX.fx_hit_spark
  if (!scene.textures.exists(HERO_EFFECTS_ATLAS.key)) return
  const spark = scene.add.image(x, y, HERO_EFFECTS_ATLAS.key, strip.frames[0]).setDepth(6)
  scene.tweens.addCounter({
    from: 0,
    to: strip.frames.length,
    duration: (strip.frames.length * 1000) / strip.frameRate,
    onUpdate: (tween) => {
      const index = Math.min(strip.frames.length - 1, Math.floor(tween.getValue() ?? 0))
      if (spark.active) spark.setFrame(strip.frames[index])
    },
    onComplete: () => spark.destroy()
  })
}

/**
 * One frame of the stage mechanics as `StageMechanicsAdapter` hands it to the 12b adapters: the stage
 * clock (it holds while paused), its advance this frame, and the hero's body. Null while paused or with no hero.
 */
export type MechanicsFrame = {
  clockMs: number
  stepMs: number
  hero: { left: number; right: number; top: number; bottom: number }
  heroX: number
  prevHeroX: number
  grounded: boolean
  dying: boolean
}
