import Phaser from 'phaser'
import AudioService from '../audio'
import type { PlayerRuntimeEvent } from './types'
import { GAMEPLAY_TEXTURE_KEYS } from '../ui/gameplay/GameplayTextures'
import { resolveSwordTrailPose } from './SwordTrailProfile'
import { SHAKES, resolveChargeAuraFrequencyMs } from './hitFeel'
import { FEEL_FRAME_MS, LANDING_SQUASH_FRAMES } from './config'
import { Settings } from '../systems/Settings'

const EFFECTS_ATLAS_KEY = 'atlas_effects_core'

const VFX_FRAMES = {
  muzzle: ['effects_core/core/008', 'effects_core/core/009', 'effects_core/core/016'],
  aura: ['effects_core/core/006', 'effects_core/core/007', 'effects_core/core/014', 'effects_core/core/015'],
  spark: ['effects_core/core/011', 'effects_core/core/019', 'effects_core/core/003']
} as const

/** Death burst orbs (the atlas's round aura frames) and the respawn beam-in. */
const DEATH_ORB_COUNT = 8
const DEATH_ORB_RADIUS_PX = 56
const DEATH_ORB_MS = 600
const BEAM_IN_MS = 180

export class VfxSfxRouter {
  private readonly ownedResources = new Set<{ destroy: () => void }>()
  private readonly ownedTimers = new Set<Phaser.Time.TimerEvent>()
  private destroyed = false
  private scaleTween?: Phaser.Tweens.Tween
  private baseScale?: { x: number; y: number }

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
    this.scaleTween?.stop()
    this.scaleTween = undefined
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
      this.scene.events.emit('camera.shake', { ...SHAKES.light })
      return
    }
    if (key === 'fx_shake_camera_medium') {
      this.scene.events.emit('camera.shake', { ...SHAKES.medium })
      return
    }
    if (key === 'fx_shake_camera_heavy') {
      this.scene.events.emit('camera.shake', { ...SHAKES.heavy })
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
          frequency: resolveChargeAuraFrequencyMs(Settings.get().reducedFlashing),
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
      case 'fx_land_squash': {
        this.tweenPlayerScale(1.18, 0.78, LANDING_SQUASH_FRAMES * FEEL_FRAME_MS)
        break
      }
      case 'fx_beam_in': {
        this.tweenPlayerScale(0.2, 1.8, BEAM_IN_MS)
        break
      }
      case 'fx_death_orbs': {
        for (let index = 0; index < DEATH_ORB_COUNT; index += 1) {
          const angle = (index / DEATH_ORB_COUNT) * Math.PI * 2
          const frame = VFX_FRAMES.aura[index % VFX_FRAMES.aura.length]
          const orb = this.own(this.scene.add.sprite(this.player.x, this.player.y, EFFECTS_ATLAS_KEY, frame))
          orb.setDepth(this.player.depth + 2)
          orb.setBlendMode(Phaser.BlendModes.ADD)
          orb.setScale(1.4)
          this.scene.tweens.add({
            targets: orb,
            x: this.player.x + Math.cos(angle) * DEATH_ORB_RADIUS_PX,
            y: this.player.y + Math.sin(angle) * DEATH_ORB_RADIUS_PX,
            alpha: 0.2,
            duration: DEATH_ORB_MS,
            ease: 'Quad.Out'
          })
          this.destroyLater(orb, DEATH_ORB_MS + 40)
        }
        break
      }
      case 'fx_hit_spark':
      case 'fx_land_dust':
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

          // WREN's cutter is amber, the hero accent (docs/art/hero-brief.md); the green beam was the retired skin's.
          const swordGlow = this.scene.add.graphics()
          swordGlow.setBlendMode(Phaser.BlendModes.ADD)
          swordGlow.lineStyle(10, 0xb8741c, 0.24)
          swordGlow.beginPath()
          swordGlow.arc(0, 0, 30, -1.02, 1.02, false)
          swordGlow.strokePath()

          const swordBlade = this.scene.add.graphics()
          swordBlade.setBlendMode(Phaser.BlendModes.ADD)
          swordBlade.fillStyle(0xf2a93b, 0.24)
          swordBlade.fillTriangle(2, -5, 35, 0, 2, 5)
          swordBlade.fillStyle(0xffd27a, 0.82)
          swordBlade.fillTriangle(5, -2, 34, 0, 5, 2)
          swordBlade.lineStyle(5, 0xf2a93b, 0.94)
          swordBlade.beginPath()
          swordBlade.arc(0, 0, 29, -1, 1, false)
          swordBlade.strokePath()
          swordBlade.lineStyle(2, 0xfff4d6, 1)
          swordBlade.beginPath()
          swordBlade.arc(0, 0, 27, -0.94, 0.94, false)
          swordBlade.strokePath()
          swordBlade.fillStyle(0xfff4d6, 0.96)
          swordBlade.fillCircle(34, 0, 2)
          swordBlade.fillStyle(0xffd27a, 0.72)
          swordBlade.fillCircle(29, -10, 1.5)
          swordBlade.fillCircle(30, 9, 1.5)

          const swordEcho = this.scene.add.graphics()
          swordEcho.setBlendMode(Phaser.BlendModes.ADD)
          swordEcho.lineStyle(2, 0xffd27a, 0.38)
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

  /** Squash or beam-in: set a scale relative to the resting scale and tween back; never compounds. */
  private tweenPlayerScale(fromX: number, fromY: number, durationMs: number): void {
    this.scaleTween?.stop()
    const base = this.baseScale ?? { x: this.player.scaleX, y: this.player.scaleY }
    this.baseScale = base
    this.player.setScale(base.x * fromX, base.y * fromY)
    this.scaleTween = this.scene.tweens.add({
      targets: this.player,
      scaleX: base.x,
      scaleY: base.y,
      duration: durationMs,
      ease: 'Quad.Out',
      onComplete: () => {
        this.scaleTween = undefined
      }
    })
  }

  private playSfx(key: string): void {
    AudioService.playSfx(key)
  }
}
