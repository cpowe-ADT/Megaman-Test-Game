import Phaser from 'phaser'
import { computeTilePlacements } from '../../stage/tileSkin'
import { stageTileAtlasKey } from '../../stage/stageBiome'

export const GAMEPLAY_TEXTURE_KEYS = {
  spikeBank: 'gameplay_spike_bank',
  flameVent: 'gameplay_flame_vent',
  chargeParticle: 'gameplay_charge_particle'
} as const

function createSpikeBank(scene: Phaser.Scene): void {
  if (scene.textures.exists(GAMEPLAY_TEXTURE_KEYS.spikeBank)) {
    return
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
  graphics.fillStyle(0x07111f, 1)
  graphics.fillRect(0, 12, 32, 4)
  graphics.fillStyle(0x173451, 1)
  graphics.fillRect(1, 12, 30, 2)

  const spikeXs = [1, 11, 21]
  spikeXs.forEach((x) => {
    graphics.fillStyle(0x06101d, 1)
    graphics.fillTriangle(x, 12, x + 5, 0, x + 10, 12)
    graphics.fillStyle(0xb9def4, 1)
    graphics.fillTriangle(x + 2, 11, x + 5, 2, x + 6, 11)
    graphics.fillStyle(0x5d86a4, 1)
    graphics.fillTriangle(x + 6, 11, x + 6, 4, x + 9, 11)
    graphics.fillStyle(0xf4fbff, 1)
    graphics.fillRect(x + 4, 3, 2, 2)
  })

  graphics.generateTexture(GAMEPLAY_TEXTURE_KEYS.spikeBank, 32, 16)
  graphics.destroy()
}

function createChargeParticle(scene: Phaser.Scene): void {
  if (scene.textures.exists(GAMEPLAY_TEXTURE_KEYS.chargeParticle)) {
    return
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
  graphics.fillStyle(0xffffff, 1)
  graphics.fillRect(2, 0, 2, 2)
  graphics.fillRect(0, 2, 6, 2)
  graphics.fillRect(2, 4, 2, 2)
  graphics.fillStyle(0xbff7ff, 1)
  graphics.fillRect(2, 2, 2, 2)
  graphics.generateTexture(GAMEPLAY_TEXTURE_KEYS.chargeParticle, 6, 6)
  graphics.destroy()
}

function createFlameVent(scene: Phaser.Scene): void {
  if (scene.textures.exists(GAMEPLAY_TEXTURE_KEYS.flameVent)) {
    return
  }

  const graphics = scene.make.graphics({ x: 0, y: 0 }, false)
  graphics.fillStyle(0x35130c, 1)
  graphics.fillRect(0, 12, 32, 4)
  graphics.fillStyle(0x8d3218, 1)
  graphics.fillRect(2, 10, 28, 3)
  graphics.fillStyle(0xff6b1c, 1)
  graphics.fillTriangle(3, 11, 8, 1, 13, 11)
  graphics.fillTriangle(10, 11, 16, 4, 22, 11)
  graphics.fillTriangle(20, 11, 25, 0, 30, 11)
  graphics.fillStyle(0xffdc62, 1)
  graphics.fillTriangle(6, 11, 8, 5, 10, 11)
  graphics.fillTriangle(14, 11, 16, 7, 19, 11)
  graphics.fillTriangle(23, 11, 25, 4, 27, 11)
  graphics.fillStyle(0xfff4bd, 1)
  graphics.fillRect(7, 7, 2, 3)
  graphics.fillRect(24, 6, 2, 3)
  graphics.generateTexture(GAMEPLAY_TEXTURE_KEYS.flameVent, 32, 16)
  graphics.destroy()
}

/**
 * Bakes the biome atlas's `spike` frame, tiled twice, into a 32x16 texture matching the generated
 * spike bank's footprint so a hazard sprite's physics body (sized from its texture) does not change
 * when it switches from the flat generated art to the tileset. Cached per atlas key.
 */
function createBiomeSpikeBank(scene: Phaser.Scene, atlasKey: string): string {
  const key = `${atlasKey}_hazard_spike`
  if (scene.textures.exists(key)) {
    return key
  }

  const placements = computeTilePlacements({ x: 0, y: 0, width: 32, height: 16 }, 'spike')
  const rt = scene.make.renderTexture({ width: 32, height: 16 }, false)
  // Never added to the scene's display list: it exists only as a source for RenderTexture.draw below.
  const stamp = new Phaser.GameObjects.Image(scene, 0, 0, atlasKey, placements[0]?.frame)
  stamp.setOrigin(0, 0)
  placements.forEach((placement) => {
    stamp.setFrame(placement.frame)
    stamp.setCrop(0, 0, placement.width, placement.height)
    rt.draw(stamp, placement.x, placement.y)
  })
  stamp.destroy()
  rt.saveTexture(key)
  rt.destroy()
  return key
}

/** Lava hazards keep the flame vent art. Everything else uses the stage's biome spike tile when its atlas is loaded. */
export function resolveStageHazardTexture(hazardId: string, stageId?: string, scene?: Phaser.Scene): string {
  if (hazardId.includes('lava')) {
    return GAMEPLAY_TEXTURE_KEYS.flameVent
  }
  const biomeAtlasKey = stageId ? stageTileAtlasKey(stageId) : undefined
  if (biomeAtlasKey && scene && scene.textures.exists(biomeAtlasKey)) {
    return createBiomeSpikeBank(scene, biomeAtlasKey)
  }
  return GAMEPLAY_TEXTURE_KEYS.spikeBank
}

export function ensureGameplayTextures(scene: Phaser.Scene): void {
  createSpikeBank(scene)
  createFlameVent(scene)
  createChargeParticle(scene)
}
