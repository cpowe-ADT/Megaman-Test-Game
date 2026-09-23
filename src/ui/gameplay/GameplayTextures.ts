import Phaser from 'phaser'

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

export function resolveStageHazardTexture(hazardId: string): string {
  return hazardId.includes('lava') ? GAMEPLAY_TEXTURE_KEYS.flameVent : GAMEPLAY_TEXTURE_KEYS.spikeBank
}

export function ensureGameplayTextures(scene: Phaser.Scene): void {
  createSpikeBank(scene)
  createFlameVent(scene)
  createChargeParticle(scene)
}
