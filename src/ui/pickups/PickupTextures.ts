import Phaser from 'phaser'
import { PICKUPS_ATLAS, PICKUP_ART_SCALE, PICKUP_BOB_MS, PICKUP_BOB_PX, PICKUP_FRAME_RATE, pickupAnimationKey, pickupFrame, type PickupArtGroup } from './pickupArt'

export const PICKUP_TEXTURE_KEYS = {
  health: 'pickup_capsule_health',
  weapon: 'pickup_capsule_weapon',
  bonus: 'pickup_energy_core_bonus',
  upgrade: 'pickup_capsule_upgrade',
  heartTank: 'pickup_tank_health',
  subTank: 'pickup_tank_weapon'
} as const

function createCapsuleTexture(
  scene: Phaser.Scene,
  key: string,
  bodyColor: number,
  glowColor: number,
  width = 12,
  height = 16
): void {
  if (scene.textures.exists(key)) {
    return
  }
  const graphics = new Phaser.GameObjects.Graphics(scene)
  graphics.fillStyle(0x020914, 1)
  graphics.fillRoundedRect(0, 0, width, height, 4)
  graphics.fillStyle(bodyColor, 1)
  graphics.fillRoundedRect(1, 1, width - 2, height - 2, 3)
  graphics.fillStyle(0xffffff, 0.9)
  graphics.fillRect(3, 2, 2, 4)
  graphics.fillStyle(glowColor, 1)
  graphics.fillRect(3, 7, width - 6, 5)
  graphics.fillStyle(0xffffff, 0.75)
  graphics.fillRect(4, 8, 1, 3)
  graphics.fillStyle(0x020914, 0.75)
  graphics.fillRect(2, 5, width - 4, 1)
  graphics.fillRect(2, height - 4, width - 4, 1)
  graphics.generateTexture(key, width, height)
  graphics.destroy()
}

function createCoreTexture(scene: Phaser.Scene): void {
  const key = PICKUP_TEXTURE_KEYS.bonus
  if (scene.textures.exists(key)) {
    return
  }
  const graphics = new Phaser.GameObjects.Graphics(scene)
  graphics.fillStyle(0x020914, 1)
  graphics.fillTriangle(7, 0, 14, 7, 7, 14)
  graphics.fillTriangle(7, 0, 0, 7, 7, 14)
  graphics.fillStyle(0xffc857, 1)
  graphics.fillTriangle(7, 2, 12, 7, 7, 12)
  graphics.fillTriangle(7, 2, 2, 7, 7, 12)
  graphics.fillStyle(0xffffff, 1)
  graphics.fillRect(6, 4, 2, 4)
  graphics.generateTexture(key, 14, 14)
  graphics.destroy()
}

export function ensurePickupTextures(scene: Phaser.Scene): void {
  createCapsuleTexture(scene, PICKUP_TEXTURE_KEYS.health, 0x163e2d, 0x63ff88)
  createCapsuleTexture(scene, PICKUP_TEXTURE_KEYS.weapon, 0x14345e, 0x58d8ff)
  createCapsuleTexture(scene, PICKUP_TEXTURE_KEYS.upgrade, 0x563e11, 0xffd65c, 14, 18)
  createCapsuleTexture(scene, PICKUP_TEXTURE_KEYS.heartTank, 0x4a1822, 0xff6677, 14, 18)
  createCapsuleTexture(scene, PICKUP_TEXTURE_KEYS.subTank, 0x173d57, 0x58d8ff, 14, 18)
  createCoreTexture(scene)
}

/** The code-drawn capsule (and its scale) each group falls back to when the pickups atlas is missing. */
const FALLBACK_ART: Record<PickupArtGroup, { key: string; scale: number }> = {
  health_small: { key: PICKUP_TEXTURE_KEYS.health, scale: 1 },
  health_large: { key: PICKUP_TEXTURE_KEYS.health, scale: 1.3 },
  energy_small: { key: PICKUP_TEXTURE_KEYS.weapon, scale: 1 },
  energy_large: { key: PICKUP_TEXTURE_KEYS.bonus, scale: 1.05 },
  extra_life: { key: PICKUP_TEXTURE_KEYS.bonus, scale: 1 },
  heart_tank: { key: PICKUP_TEXTURE_KEYS.heartTank, scale: 1 },
  sub_tank: { key: PICKUP_TEXTURE_KEYS.subTank, scale: 1 },
  capsule: { key: PICKUP_TEXTURE_KEYS.upgrade, scale: 1.08 }
}

/**
 * Draws a pickup as its pickups_v1 group with the two frames looping, or as the code-drawn capsule when the
 * atlas is missing, and fits its body to the art. `bob` floats a pickup without gravity (a stage's placed
 * items); an enemy drop is a physics body that falls and rests, so it only animates.
 */
export function applyPickupArt(sprite: Phaser.Physics.Arcade.Sprite, group: PickupArtGroup, options: { bob?: boolean } = {}): void {
  const scene = sprite.scene
  if (scene.textures.exists(PICKUPS_ATLAS.key)) {
    const key = pickupAnimationKey(group)
    if (!scene.anims.exists(key)) {
      const frames = [pickupFrame(group, 0), pickupFrame(group, 1)].map((frame) => ({ key: PICKUPS_ATLAS.key, frame }))
      scene.anims.create({ key, frames, frameRate: PICKUP_FRAME_RATE, repeat: -1 })
    }
    sprite.setTexture(PICKUPS_ATLAS.key, pickupFrame(group)).setScale(PICKUP_ART_SCALE)
    sprite.play(key)
  } else {
    ensurePickupTextures(scene)
    sprite.anims?.stop()
    sprite.setTexture(FALLBACK_ART[group].key).setScale(FALLBACK_ART[group].scale)
  }
  ;(sprite.body as Phaser.Physics.Arcade.Body | undefined)?.setSize()
  if (options.bob) {
    scene.tweens.killTweensOf(sprite)
    scene.tweens.add({ targets: sprite, y: sprite.y - PICKUP_BOB_PX, duration: PICKUP_BOB_MS, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 })
  }
}
