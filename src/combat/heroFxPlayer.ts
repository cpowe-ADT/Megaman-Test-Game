import type Phaser from 'phaser'
import { HERO_EFFECTS_ATLAS, HERO_PROJECTILES_ATLAS, type FrameStrip } from './heroCombatVisuals'

/**
 * Phaser adapter for the hero combat art (heroCombatVisuals.ts): builds strip animations on demand and
 * plays one-shot effects. Used by VfxSfxRouter (arcs, muzzle, aura) and SwordHitRouter (hit and deflect
 * sparks). Everything is a no-op when the Game scene has not loaded the atlases.
 */
export function stripAtlasKey(strip: FrameStrip): string {
  return strip.frames[0]?.startsWith('projectiles_hero/') ? HERO_PROJECTILES_ATLAS.key : HERO_EFFECTS_ATLAS.key
}

export function heroFxReady(scene: Phaser.Scene, strip: FrameStrip): boolean {
  return scene.textures.exists(stripAtlasKey(strip))
}

/** Creates `hero_fx_<name>` from the strip once; false when the atlas is not loaded. */
export function ensureStripAnimation(scene: Phaser.Scene, name: string, strip: FrameStrip, repeat = 0): string | null {
  const atlas = stripAtlasKey(strip)
  if (!scene.textures.exists(atlas)) {
    return null
  }
  const key = `hero_fx_${name}`
  if (!scene.anims.exists(key)) {
    scene.anims.create({
      key,
      frames: strip.frames.map((frame) => ({ key: atlas, frame })),
      frameRate: strip.frameRate,
      repeat
    })
  }
  return key
}

export type StripPlayOptions = {
  flipX?: boolean
  rotation?: number
  depth?: number
  scale?: number
  tint?: number
  alpha?: number
  additive?: boolean
  /** Re-read each frame until the strip ends (arcs ride with the hero). */
  follow?: () => { x: number; y: number }
}

/** Plays a strip once at (x, y) and destroys the sprite when it ends. */
export function playStripOnce(
  scene: Phaser.Scene,
  name: string,
  strip: FrameStrip,
  x: number,
  y: number,
  options: StripPlayOptions = {}
): Phaser.GameObjects.Sprite | null {
  const animKey = ensureStripAnimation(scene, name, strip)
  if (!animKey) {
    return null
  }
  const sprite = scene.add.sprite(x, y, stripAtlasKey(strip), strip.frames[0])
  sprite.setDepth(options.depth ?? 8)
  sprite.setFlipX(Boolean(options.flipX))
  sprite.setRotation(options.rotation ?? 0)
  sprite.setScale(options.scale ?? 1)
  sprite.setAlpha(options.alpha ?? 1)
  if (options.tint != null) sprite.setTint(options.tint)
  if (options.additive) sprite.setBlendMode('ADD')
  const follow = options.follow
  const track = follow
    ? () => {
        const at = follow()
        sprite.setPosition(at.x, at.y)
      }
    : null
  if (track) scene.events.on('postupdate', track)
  let done = false
  const finish = () => {
    if (done) return
    done = true
    if (track) scene.events.off('postupdate', track)
    scene.events.off('shutdown', finish)
    sprite.destroy()
  }
  sprite.once('animationcomplete', finish)
  scene.events.once('shutdown', finish)
  sprite.play(animKey)
  return sprite
}
