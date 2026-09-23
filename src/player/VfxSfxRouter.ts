import Phaser from 'phaser'
import AudioService from '../audio'
import type { PlayerRuntimeEvent } from './types'
import { GAMEPLAY_TEXTURE_KEYS } from '../ui/gameplay/GameplayTextures'
import { resolveSwordTrailPose } from './SwordTrailProfile'

const EFFECTS_ATLAS_KEY = 'atlas_effects_core'

const VFX_FRAMES = {
  muzzle: ['effects_core/core/008', 'effects_core/core/009', 'effects_core/core/016'],
  aura: ['effects_core/core/006', 'effects_core/core/007', 'effects_core/core/014', 'effects_core/core/015'],
  spark: ['effects_core/core/011', 'effects_core/core/019', 'effects_core/core/003']
} as const

export class VfxSfxRouter {
  private readonly ownedResources = new Set<{ destroy: () => void }>()
  private readonly ownedTimers = new Set<Phaser.Time.TimerEvent>()
  private destroyed = false

  constructor(private readonly scene: Phaser.Scene, private readonly player: Phaser.GameObjects.Sprite) {}

  dispatch(events: PlayerRuntimeEvent[]): void {
    if (this.destroyed) {
      return
    }
    for (const event of events) {
      if (event.type === 'vfx') {
        this.spawnVfx(event.key)
      } else if (event.type === 'sfx') {
        this.playSfx(event.key)
      } else if (event.type === 'hitstop') {
        this.scene.events.emit('player.hitstop', event.frames)
      }
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    this.ownedTimers.forEach((timer) => timer.remove(false))
    this.ownedTimers.clear()
    this.ownedResources.forEach((resource) => resource.destroy())
    this.ownedResources.clear()
  }

  private own<T extends { destroy: () => void }>(resource: T): T {
    this.ownedResources.add(resource)
    return resource
  }

  private destroyLater(resource: { destroy: () => void }, delayMs: number): void {
    const timer = this.scene.time.delayedCall(delayMs, () => {
      this.ownedTimers.delete(timer)
      this.ownedResources.delete(resource)
      resource.destroy()
    })
    this.ownedTimers.add(timer)
  }

  private spawnVfx(key: string): void {
    if (!this.scene.textures.exists(EFFECTS_ATLAS_KEY)) {
      return
    }

    if (key === 'fx_shake_camera_light') {
      this.scene.events.emit('camera.shake', { intensity: 0.005, duration: 100 })
      return
    }
    if (key === 'fx_shake_camera_medium') {
      this.scene.events.emit('camera.shake', { intensity: 0.012, duration: 180 })
      return
    }
    if (key === 'fx_shake_camera_heavy') {
      this.scene.events.emit('camera.shake', { intensity: 0.025, duration: 300 })
      return
    }

    switch (key) {
      case 'fx_muzzle_small': {
        const emitter = this.own(this.scene.add.particles(this.player.x, this.player.y - 4, EFFECTS_ATLAS_KEY, {
          frame: [...VFX_FRAMES.muzzle],
          lifespan: 80,
          speed: { min: 10, max: 60 },
          quantity: 4,
          scale: { start: 1.0, end: 0 },
          blendMode: Phaser.BlendModes.ADD
        }))
        this.destroyLater(emitter, 100)
        break
      }
      case 'fx_charge_aura_lv1':
      case 'fx_charge_aura_lv2':
      case 'fx_charge_aura_lv3':
      case 'fx_charge_aura_lv4': {
        const level = Math.max(1, Number(key.slice(-1)) || 1)
        const colors = [0x63e7ff, 0x79f5d3, 0xffef7a, 0xff8df4]
        const color = colors[level - 1]
        const emitter = this.own(this.scene.add.particles(0, 0, GAMEPLAY_TEXTURE_KEYS.chargeParticle, {
          follow: this.player,
          lifespan: 360 + level * 45,
          quantity: 3 + level,
          frequency: 42,
          speed: { min: 22 + level * 5, max: 52 + level * 8 },
          radial: true,
          tint: color,
          alpha: { start: 0.95, end: 0 },
          scale: { start: 0.75 + level * 0.12, end: 0 },
          blendMode: Phaser.BlendModes.ADD
        }))
        const ring = this.own(this.scene.add.graphics({ x: this.player.x, y: this.player.y }))
        ring.setDepth(this.player.depth + 1)
        ring.lineStyle(level >= 4 ? 3 : 2, color, 0.9)
        ring.strokeCircle(0, 0, 11 + level * 3)
        this.scene.tweens.add({
          targets: ring,
          alpha: 0,
          scaleX: 1.45,
          scaleY: 1.45,
          duration: 300 + level * 40,
          ease: 'Sine.Out'
        })
        this.destroyLater(emitter, 520 + level * 45)
        this.destroyLater(ring, 470 + level * 40)
        break
      }
      case 'fx_hit_spark':
      case 'dash_dust': {
        const frames = key === 'dash_dust' ? VFX_FRAMES.spark : VFX_FRAMES.spark
        const emitter = this.own(this.scene.add.particles(this.player.x, this.player.y + 8, EFFECTS_ATLAS_KEY, {
          frame: [...frames],
          lifespan: 120,
          quantity: 5,
          speed: { min: 15, max: 45 },
          scale: { start: 1.0, end: 0 },
          blendMode: Phaser.BlendModes.ADD
        }))
        this.destroyLater(emitter, 160)
        break
      }
      case 'fx_wall_slide_dust': {
        const direction = this.player.flipX ? 1 : -1
        const emitter = this.own(this.scene.add.particles(
          this.player.x + direction * 12,
          this.player.y + 8,
          EFFECTS_ATLAS_KEY,
          {
            frame: [...VFX_FRAMES.spark],
            lifespan: 110,
            quantity: 4,
            speedX: { min: -18 * direction, max: -50 * direction },
            speedY: { min: -8, max: 20 },
            scale: { start: 0.85, end: 0 },
            alpha: { start: 0.45, end: 0 },
            blendMode: Phaser.BlendModes.ADD
          }
        ))
        this.destroyLater(emitter, 140)
        break
      }
      case 'fx_dash_afterimage': {
        const textureKey = this.player.texture?.key
        const frameName = this.player.frame?.name
        if (!textureKey || !this.scene.textures.exists(textureKey)) {
          break
        }
        const ghost = this.own(this.scene.add.sprite(this.player.x, this.player.y, textureKey, frameName))
        ghost.setDepth(Math.max(0, this.player.depth - 1))
        ghost.setAlpha(0.34)
        ghost.setFlipX(this.player.flipX)
        ghost.setScale(this.player.scaleX, this.player.scaleY)
        ghost.setTint(0x8fdcff)
        this.scene.tweens.add({
          targets: ghost,
          alpha: 0,
          y: ghost.y - 2,
          duration: 120,
          ease: 'Quad.Out',
          onComplete: () => {
            this.ownedResources.delete(ghost)
            ghost.destroy()
          }
        })
        break
      }
      default: {
        if (key.startsWith('fx_sword_trail_dir_')) {
          const direction = key.slice('fx_sword_trail_dir_'.length)
          const pose = resolveSwordTrailPose(direction)
          const swordRoot = this.own(this.scene.add.container(
            this.player.x + pose.anchorX,
            this.player.y + pose.anchorY
          ))
          swordRoot.setDepth(this.player.depth + 2)
          swordRoot.setRotation(pose.sweepStart)
          swordRoot.setScale(0.82)

          const swordGlow = this.scene.add.graphics()
          swordGlow.setBlendMode(Phaser.BlendModes.ADD)
          swordGlow.lineStyle(10, 0x0ac797, 0.24)
          swordGlow.beginPath()
          swordGlow.arc(0, 0, 30, -1.02, 1.02, false)
          swordGlow.strokePath()

          const swordBlade = this.scene.add.graphics()
          swordBlade.setBlendMode(Phaser.BlendModes.ADD)
          swordBlade.fillStyle(0x25e6ae, 0.24)
          swordBlade.fillTriangle(2, -5, 35, 0, 2, 5)
          swordBlade.fillStyle(0xa6ffe6, 0.82)
          swordBlade.fillTriangle(5, -2, 34, 0, 5, 2)
          swordBlade.lineStyle(5, 0x45f6c2, 0.94)
          swordBlade.beginPath()
          swordBlade.arc(0, 0, 29, -1, 1, false)
          swordBlade.strokePath()
          swordBlade.lineStyle(2, 0xf4fffb, 1)
          swordBlade.beginPath()
          swordBlade.arc(0, 0, 27, -0.94, 0.94, false)
          swordBlade.strokePath()
          swordBlade.fillStyle(0xf4fffb, 0.96)
          swordBlade.fillCircle(34, 0, 2)
          swordBlade.fillStyle(0x75ffd5, 0.72)
          swordBlade.fillCircle(29, -10, 1.5)
          swordBlade.fillCircle(30, 9, 1.5)

          const swordEcho = this.scene.add.graphics()
          swordEcho.setBlendMode(Phaser.BlendModes.ADD)
          swordEcho.lineStyle(2, 0x8dffe0, 0.38)
          swordEcho.beginPath()
          swordEcho.arc(0, 0, 35, -0.88, 0.88, false)
          swordEcho.strokePath()

          swordRoot.add([swordGlow, swordBlade, swordEcho])
          this.scene.tweens.add({
            targets: swordRoot,
            rotation: pose.sweepEnd,
            alpha: 0,
            scaleX: 1.08,
            scaleY: 1.08,
            duration: 145,
            ease: 'Cubic.Out',
            onUpdate: () => {
              swordRoot.setPosition(
                this.player.x + pose.anchorX,
                this.player.y + pose.anchorY
              )
            }
          })
          this.destroyLater(swordRoot, 160)
        }
        break
      }
    }
  }

  private playSfx(key: string): void {
    AudioService.playSfx(key)
  }
}
