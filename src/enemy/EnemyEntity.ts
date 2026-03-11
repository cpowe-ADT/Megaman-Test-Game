import Phaser from 'phaser'
import { EnemyAnimator } from './EnemyAnimator'
import { EnemyCatalog } from './EnemyCatalog'
import { getGeneratedEnemyDefinition } from '../content/enemies'
import { EnemyCombat } from './EnemyCombat'
import { EnemyMotor } from './EnemyMotor'
import { EnemyAI } from './EnemyAI'
import { DamageEvent, EnemyDefinition, EnemyRuntimeContext, EnemyState } from './types'

function firstAvailableFrame(
  texture: Phaser.Textures.Texture,
  candidates: string[]
): string | undefined {
  for (const candidate of candidates) {
    if (texture.has(candidate)) {
      return candidate
    }
  }
  return undefined
}

function resolveEnemyTexture(
  scene: Phaser.Scene,
  typeKey: string
): { textureKey: string; frame?: string } {
  const atlasKey = `atlas_${typeKey}`
  if (!scene.textures.exists(atlasKey)) {
    throw new Error(`[EnemyEntity] Missing required atlas '${atlasKey}' for '${typeKey}'`)
  }

  const atlas = scene.textures.get(atlasKey)
  const frame = firstAvailableFrame(atlas, [
    `${typeKey}/idle/000`,
    `${typeKey}/idle/00`,
    `${typeKey}/idle/0`,
    `${typeKey}/idle`
  ])
  if (!frame) {
    throw new Error(`[EnemyEntity] Missing idle frame in atlas '${atlasKey}' for '${typeKey}'`)
  }

  return { textureKey: atlasKey, frame }
}

export type EnemyEntityOptions = {
  id: string
  x: number
  y: number
  enableAI: boolean
  enableProjectiles: boolean
  definitionOverride?: EnemyDefinition
}

export class EnemyEntity {
  readonly id: string
  readonly typeKey: string
  readonly definition: EnemyDefinition
  readonly context: EnemyRuntimeContext
  readonly sprite: Phaser.Physics.Arcade.Sprite
  readonly spawnPosition: Phaser.Math.Vector2

  state: EnemyState = 'idle'
  facing: 1 | -1 = 1

  readonly motor: EnemyMotor
  readonly combat: EnemyCombat
  readonly animator: EnemyAnimator
  readonly ai: EnemyAI

  constructor(context: EnemyRuntimeContext, typeKey: string, options: EnemyEntityOptions) {
    const definition = options.definitionOverride ?? getGeneratedEnemyDefinition(typeKey) ?? EnemyCatalog[typeKey]
    if (!definition) {
      throw new Error(`Unknown enemy type '${typeKey}'`)
    }

    this.id = options.id
    this.typeKey = typeKey
    this.definition = definition
    this.context = context
    this.spawnPosition = new Phaser.Math.Vector2(options.x, options.y)

    const textureInfo = resolveEnemyTexture(context.scene, typeKey)
    const sprite = context.enemyGroup.create(
      options.x,
      options.y,
      textureInfo.textureKey,
      textureInfo.frame
    ) as Phaser.Physics.Arcade.Sprite
    sprite.setActive(true).setVisible(true)
    sprite.setDataEnabled()
    sprite.data?.set('enemyFrameworkId', this.id)
    sprite.data?.set('enemyTypeKey', this.typeKey)
    sprite.data?.set('enemyState', this.state)
    sprite.data?.set('enemyAtlasKey', textureInfo.textureKey)
    sprite.data?.set('enemyUsingPlaceholder', false)
    sprite.setDepth(2)

    this.sprite = sprite
    this.motor = new EnemyMotor(sprite, definition, context)
    this.combat = new EnemyCombat(sprite, definition, context, this.motor, options.enableProjectiles)
    this.animator = new EnemyAnimator(context.scene, sprite, definition)
    this.ai = new EnemyAI(this, definition, this.motor, this.combat, options.enableAI)
  }

  update(now: number, deltaMs: number): void {
    if (!this.sprite.active) {
      if (this.state !== 'dead') {
        this.state = 'dead'
      }
      return
    }

    this.ai.update(now, deltaMs)
    this.combat.update(now, this.facing)
    this.motor.update(now)
    this.animator.update(this.state, this.facing)

    for (const marker of this.animator.consumeFrameMarkers()) {
      if (marker.event === 'enable_hitbox' || marker.event === 'disable_hitbox') {
        continue
      }
    }
  }

  applyDamage(event: DamageEvent): number {
    if (this.state === 'dead') {
      return 0
    }

    const remaining = this.combat.receiveDamage(event, this.context.scene.time.now)
    if (remaining <= 0) {
      this.state = 'dead'
      return 0
    }

    this.state = 'stunned'
    this.sprite.setTintFill(0xffffff)
    this.context.scene.time.delayedCall(80, () => {
      if (this.sprite.active) {
        this.sprite.clearTint()
      }
    })

    return remaining
  }

  destroy(): void {
    const sprite = this.sprite as Phaser.Physics.Arcade.Sprite & { body?: Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody }
    try {
      const body = sprite.body
      if (body && 'enable' in body) {
        ;(body as Phaser.Physics.Arcade.Body).enable = false
      }
      if (body && 'stop' in body && typeof (body as Phaser.Physics.Arcade.Body).stop === 'function') {
        ;(body as Phaser.Physics.Arcade.Body).stop()
      }
    } catch {
      // Sprite body may already be partially torn down during scene shutdown.
    }

    try {
      sprite.setActive(false).setVisible(false)
      sprite.destroy()
    } catch {
      // Sprite may already be destroyed by the scene lifecycle.
    }
  }
}
