import Phaser from 'phaser'
import { EnemyAnimationManifest } from './EnemyAnimationManifest'
import { EnemyDefinition, EnemyFrameEventMarker, EnemyState } from './types'

export class EnemyAnimator {
  private readonly scene: Phaser.Scene
  private readonly sprite: Phaser.Physics.Arcade.Sprite
  private readonly definition: EnemyDefinition
  private readonly emittedMarkers = new Set<string>()

  constructor(scene: Phaser.Scene, sprite: Phaser.Physics.Arcade.Sprite, definition: EnemyDefinition) {
    this.scene = scene
    this.sprite = sprite
    this.definition = definition
    this.ensureAnimations()
  }

  update(state: EnemyState, facing: 1 | -1): void {
    this.sprite.setFlipX(facing < 0)
    const key = this.resolveAnimationKey(state)
    if (key && this.sprite.anims?.currentAnim?.key !== key) {
      this.playSafe(key)
      this.emittedMarkers.clear()
    }
  }

  consumeFrameMarkers(): EnemyFrameEventMarker[] {
    const currentAnimKey = this.sprite.anims?.currentAnim?.key
    const currentFrame = this.sprite.anims?.currentFrame?.index
    if (!currentAnimKey || currentFrame == null) {
      return []
    }
    const entries = EnemyAnimationManifest[this.definition.typeKey] ?? []
    const entry = entries.find((candidate) => candidate.key === currentAnimKey)
    if (!entry) {
      return []
    }

    const markers = entry.events.filter((marker) => marker.frame === currentFrame)
    const freshMarkers = markers.filter((marker) => {
      const markerKey = `${currentAnimKey}:${currentFrame}:${marker.event}`
      if (this.emittedMarkers.has(markerKey)) {
        return false
      }
      this.emittedMarkers.add(markerKey)
      return true
    })

    return freshMarkers
  }

  private ensureAnimations(): void {
    const entries = EnemyAnimationManifest[this.definition.typeKey] ?? []
    const atlasKey = `atlas_${this.definition.typeKey}`
    if (!this.scene.textures.exists(atlasKey)) {
      throw new Error(`[EnemyAnimator] Missing required atlas '${atlasKey}'`)
    }
    entries.forEach((entry) => {
      if (this.scene.anims.exists(entry.key)) {
        return
      }
      const atlasFrames = this.resolveAtlasFrames(atlasKey, entry.key)
      if (atlasFrames.length === 0) {
        throw new Error(
          `[EnemyAnimator] No frames resolved for '${entry.key}' in atlas '${atlasKey}'`
        )
      }
      this.scene.anims.create({
        key: entry.key,
        frames: atlasFrames,
        frameRate: entry.frameRate,
        repeat: entry.repeat
      })
    })
  }

  private resolveAnimationKey(state: EnemyState): string {
    const animations = this.definition.animations
    switch (state) {
      case 'patrol':
      case 'chase':
      case 'retreat':
        return animations.move
      case 'attack_windup':
        return animations.attackWindup
      case 'attack_active':
        return animations.attackActive
      case 'attack_recover':
        return animations.attackRecover ?? animations.attackActive
      case 'stunned':
        return animations.stunned ?? animations.hurt
      case 'dead':
        return animations.death
      case 'alert':
      case 'idle':
      default:
        return animations.idle
    }
  }

  private playSafe(key: string): void {
    if (!this.scene.anims.exists(key)) {
      return
    }
    try {
      this.sprite.play(key)
    } catch {
      // Keep strict atlas mode: do not inject fallback frames at runtime.
    }
  }

  private resolveAtlasFrames(atlasKey: string, animationKey: string): Phaser.Types.Animations.AnimationFrame[] {
    if (!this.scene.textures.exists(atlasKey)) {
      return []
    }

    const texture = this.scene.textures.get(atlasKey)
    const shortName = animationKey.replace(`${this.definition.typeKey}_`, '')
    const aliases = this.animationAliases(shortName)
    const frames: Phaser.Types.Animations.AnimationFrame[] = []

    for (const alias of aliases) {
      for (let i = 0; i < 64; i += 1) {
        const frameName = `${this.definition.typeKey}/${alias}/${String(i).padStart(3, '0')}`
        if (!texture.has(frameName)) {
          if (i > 0) {
            break
          }
          continue
        }
        frames.push({ key: atlasKey, frame: frameName })
      }
      if (frames.length > 0) {
        return frames
      }
    }

    return []
  }

  private animationAliases(shortName: string): string[] {
    switch (shortName) {
      case 'idle':
        return ['idle', 'pose']
      case 'move':
        return ['run', 'move', 'walk', 'hover']
      case 'hover':
        return ['hover', 'idle']
      case 'attack_windup':
        return ['attack_windup', 'attack_charge', 'attack']
      case 'attack_active':
        return ['attack_active', 'attack', 'shoot', 'melee']
      case 'hurt':
        return ['hurt', 'hit', 'attack', 'idle']
      case 'death':
        return ['death', 'defeat', 'explode']
      case 'stunned':
        return ['stunned', 'hurt', 'attack', 'idle']
      case 'spawn':
        return ['spawn', 'idle']
      case 'turn':
        return ['turn', 'move', 'run', 'idle']
      case 'explode':
        return ['explode', 'death']
      default:
        return [shortName]
    }
  }
}
