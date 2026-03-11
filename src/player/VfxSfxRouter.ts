import Phaser from 'phaser'
import AudioService from '../audio'
import type { PlayerRuntimeEvent } from './types'

const EFFECTS_ATLAS_KEY = 'atlas_effects_core'

const VFX_FRAMES = {
  muzzle: ['effects_core/core/008', 'effects_core/core/009', 'effects_core/core/016'],
  aura: ['effects_core/core/006', 'effects_core/core/007', 'effects_core/core/014', 'effects_core/core/015'],
  swordTrail: ['effects_core/core/004', 'effects_core/core/005', 'effects_core/core/013', 'effects_core/core/021'],
  spark: ['effects_core/core/011', 'effects_core/core/019', 'effects_core/core/003']
} as const

const SWORD_TRAIL_OFFSETS: Record<string, { x: number; y: number }> = {
  n: { x: 0, y: -26 },
  ne: { x: 16, y: -18 },
  e: { x: 22, y: -8 },
  se: { x: 18, y: 8 },
  s: { x: 0, y: 18 },
  sw: { x: -18, y: 8 },
  w: { x: -22, y: -8 },
  nw: { x: -16, y: -18 }
}

export class VfxSfxRouter {
  constructor(private readonly scene: Phaser.Scene, private readonly player: Phaser.GameObjects.Sprite) {}

  dispatch(events: PlayerRuntimeEvent[]): void {
    for (const event of events) {
      if (event.type === 'vfx') {
        this.spawnVfx(event.key)
      } else if (event.type === 'sfx') {
        this.playSfx(event.key)
      }
    }
  }

  private spawnVfx(key: string): void {
    if (!this.scene.textures.exists(EFFECTS_ATLAS_KEY)) {
      return
    }

    switch (key) {
      case 'fx_muzzle_small': {
        const emitter = this.scene.add.particles(this.player.x, this.player.y - 4, EFFECTS_ATLAS_KEY, {
          frame: [...VFX_FRAMES.muzzle],
          lifespan: 80,
          speed: { min: 10, max: 60 },
          quantity: 4,
          scale: { start: 1.0, end: 0 },
          blendMode: Phaser.BlendModes.ADD
        })
        this.scene.time.delayedCall(100, () => emitter.destroy())
        break
      }
      case 'fx_charge_aura_lv1':
      case 'fx_charge_aura_lv2':
      case 'fx_charge_aura_lv3':
      case 'fx_charge_aura_lv4': {
        const emitter = this.scene.add.particles(0, 0, EFFECTS_ATLAS_KEY, {
          frame: [...VFX_FRAMES.aura],
          follow: this.player,
          lifespan: 200,
          quantity: 1,
          speed: { min: 5, max: 25 },
          scale: { start: 1, end: 0 },
          blendMode: Phaser.BlendModes.ADD
        })
        this.scene.time.delayedCall(200, () => emitter.destroy())
        break
      }
      case 'fx_hit_spark':
      case 'dash_dust': {
        const frames = key === 'dash_dust' ? VFX_FRAMES.spark : VFX_FRAMES.spark
        const emitter = this.scene.add.particles(this.player.x, this.player.y + 8, EFFECTS_ATLAS_KEY, {
          frame: [...frames],
          lifespan: 120,
          quantity: 5,
          speed: { min: 15, max: 45 },
          scale: { start: 1.0, end: 0 },
          blendMode: Phaser.BlendModes.ADD
        })
        this.scene.time.delayedCall(160, () => emitter.destroy())
        break
      }
      default: {
        if (key.startsWith('fx_sword_trail_dir_')) {
          const direction = key.slice('fx_sword_trail_dir_'.length)
          const offset = SWORD_TRAIL_OFFSETS[direction] ?? SWORD_TRAIL_OFFSETS.e
          const emitter = this.scene.add.particles(
            this.player.x + offset.x,
            this.player.y + offset.y,
            EFFECTS_ATLAS_KEY,
            {
              frame: [...VFX_FRAMES.swordTrail],
              lifespan: 110,
              quantity: 6,
              speed: { min: 10, max: 38 },
              scale: { start: 1.05, end: 0 },
              blendMode: Phaser.BlendModes.ADD
            }
          )
          this.scene.time.delayedCall(150, () => emitter.destroy())
        }
        break
      }
    }
  }

  private playSfx(key: string): void {
    AudioService.playSfx(key)
  }
}
