import Phaser from 'phaser'
import { GAME_HEIGHT } from '../config/renderPolicy'
import {
  shouldCollideWithOneWayPlatform,
  type OneWayCollisionProbe
} from './platformCollisionRules'

export type PlatformType = 'solid' | 'oneWay' | 'passThrough'

export type PlatformDefinition = {
  id: string
  x: number
  y: number
  width: number
  height: number
  type: PlatformType
  color?: number
  motion?: {
    toX: number
    duration: number
    yoyo?: boolean
    repeat?: number
    ease?: string
  }
}

export type PlatformActorOptions = {
  allowOneWay?: boolean
  allowDropThrough?: boolean
}

function asDynamicBody(
  target: Phaser.GameObjects.GameObject
): Phaser.Physics.Arcade.Body | undefined {
  const body = (target as Phaser.Types.Physics.Arcade.GameObjectWithBody).body
  return body instanceof Phaser.Physics.Arcade.Body ? body : undefined
}

function asStaticBody(target: Phaser.GameObjects.GameObject): Phaser.Physics.Arcade.StaticBody | undefined {
  const body = (target as Phaser.Types.Physics.Arcade.GameObjectWithBody).body
  return body instanceof Phaser.Physics.Arcade.StaticBody ? body : undefined
}

export class PlatformCollisionSystem {
  private solidGroup?: Phaser.Physics.Arcade.StaticGroup
  private oneWayGroup?: Phaser.Physics.Arcade.StaticGroup
  private stageVisuals: Phaser.GameObjects.GameObject[] = []
  private stageTweens: Phaser.Tweens.Tween[] = []
  private actorOptions = new WeakMap<Phaser.GameObjects.GameObject, Required<PlatformActorOptions>>()
  private dropThroughUntil = new WeakMap<Phaser.GameObjects.GameObject, number>()
  private actorColliders = new Map<object, Phaser.Physics.Arcade.Collider[]>()

  constructor(private readonly scene: Phaser.Scene) {}

  rebuild(platforms: PlatformDefinition[]): void {
    this.clearStage()
    this.solidGroup = this.scene.physics.add.staticGroup()
    this.oneWayGroup = this.scene.physics.add.staticGroup()

    for (const platform of platforms) {
      const visual = this.scene.add.rectangle(
        platform.x,
        platform.y,
        platform.width,
        platform.height,
        platform.color ?? (platform.type === 'solid' ? 0x1a2230 : 0x33404f)
      )
      this.stageVisuals.push(visual)

      if (platform.type === 'passThrough') {
        continue
      }

      this.scene.physics.add.existing(visual, true)
      const staticBody = visual.body as Phaser.Physics.Arcade.StaticBody | undefined
      staticBody?.updateFromGameObject()
      visual.setDataEnabled?.()
      visual.data?.set('platformId', platform.id)
      visual.data?.set('platformType', platform.type)

      if (platform.type === 'solid') {
        this.solidGroup.add(visual)
      } else if (platform.type === 'oneWay') {
        this.oneWayGroup.add(visual)
      }

      if (platform.motion) {
        const tween = this.scene.tweens.add({
          targets: visual,
          x: platform.motion.toX,
          duration: Math.max(1, platform.motion.duration),
          yoyo: platform.motion.yoyo ?? true,
          repeat: platform.motion.repeat ?? -1,
          ease: platform.motion.ease ?? 'Sine.inOut',
          onUpdate: () => staticBody?.updateFromGameObject()
        })
        this.stageTweens.push(tween)
      }
    }
  }

  getSolidGroup(): Phaser.Physics.Arcade.StaticGroup | undefined {
    return this.solidGroup
  }

  getOneWayGroup(): Phaser.Physics.Arcade.StaticGroup | undefined {
    return this.oneWayGroup
  }

  attachActor(actor: Phaser.Types.Physics.Arcade.GameObjectWithBody, options?: PlatformActorOptions): void {
    const target = actor as Phaser.GameObjects.GameObject
    const resolved = this.resolveOptions(options)
    this.actorOptions.set(target, resolved)
    this.clearAttachedColliders(actor as unknown as object)
    const colliders: Phaser.Physics.Arcade.Collider[] = []

    if (this.solidGroup) {
      colliders.push(this.scene.physics.add.collider(actor, this.solidGroup))
    }

    if (this.oneWayGroup && resolved.allowOneWay) {
      colliders.push(
        this.scene.physics.add.collider(
          actor,
          this.oneWayGroup,
          undefined,
          (actorObj, platformObj) => this.processOneWay(actorObj as any, platformObj as any),
          this
        )
      )
    }

    this.actorColliders.set(actor as unknown as object, colliders)
  }

  attachGroup(group: Phaser.Physics.Arcade.Group, options?: PlatformActorOptions): void {
    this.clearAttachedColliders(group as unknown as object)
    const colliders: Phaser.Physics.Arcade.Collider[] = []

    if (this.solidGroup) {
      colliders.push(this.scene.physics.add.collider(group, this.solidGroup))
    }

    if (this.oneWayGroup && (options?.allowOneWay ?? true)) {
      colliders.push(
        this.scene.physics.add.collider(
          group,
          this.oneWayGroup,
          undefined,
          (actorObj, platformObj) => this.processOneWay(actorObj as any, platformObj as any),
          this
        )
      )
    }

    this.actorColliders.set(group as unknown as object, colliders)
  }

  requestDropThrough(
    actor: Phaser.Types.Physics.Arcade.GameObjectWithBody,
    nowMs = this.scene.time.now,
    durationMs = 220
  ): boolean {
    const target = actor as Phaser.GameObjects.GameObject
    const options = this.actorOptions.get(target)
    if (!options?.allowDropThrough) {
      return false
    }
    const body = asDynamicBody(target)
    if (!body) {
      return false
    }

    const standingOnOneWay = this.isStandingOnOneWay(target)
    if (!standingOnOneWay) {
      const mainGroundTop = GAME_HEIGHT - 16
      if (body.bottom >= mainGroundTop - 1) {
        return false
      }
    }

    if (body.velocity.y < 0) {
      return false
    }

    this.dropThroughUntil.set(target, nowMs + Math.max(100, durationMs))
    body.y += 12
    if (body.velocity.y < 100) {
      body.setVelocityY(100)
    }
    return true
  }

  isDropThroughActive(actor: Phaser.GameObjects.GameObject, nowMs = this.scene.time.now): boolean {
    const until = this.dropThroughUntil.get(actor)
    return typeof until === 'number' && nowMs < until
  }

  isStandingOnOneWay(actor: Phaser.GameObjects.GameObject): boolean {
    if (!this.oneWayGroup) {
      return false
    }

    const body = asDynamicBody(actor)
    if (!body) {
      return false
    }

    const children = this.oneWayGroup.getChildren()
    for (const child of children) {
      const platform = child as Phaser.GameObjects.GameObject
      const staticBody = asStaticBody(platform)
      if (!staticBody) {
        continue
      }

      const horizontalOverlap = body.right > staticBody.left + 1 && body.left < staticBody.right - 1
      if (!horizontalOverlap) {
        continue
      }

      const verticalGap = Math.abs(body.bottom - staticBody.top)
      if (verticalGap <= 12 && body.velocity.y >= -20) {
        return true
      }
    }

    return false
  }

  clearStage(): void {
    this.clearAllAttachedColliders()
    this.stageTweens.forEach((tween) => tween.stop())
    this.stageTweens = []

    const detachGroup = (group?: Phaser.Physics.Arcade.StaticGroup) => {
      if (!group) {
        return
      }
      try {
        group.clear(false, false)
      } catch {
        // Group may already be partially destroyed during scene shutdown.
      }
      try {
        group.destroy()
      } catch {
        // Group may already be destroyed by the scene lifecycle.
      }
    }

    this.stageVisuals.forEach((obj) => obj.destroy())
    this.stageVisuals = []

    detachGroup(this.solidGroup)
    detachGroup(this.oneWayGroup)
    this.solidGroup = undefined
    this.oneWayGroup = undefined
  }

  destroy(): void {
    this.clearStage()
  }

  private processOneWay(actorObj: any, platformObj: any): boolean {
    const actor = actorObj as Phaser.GameObjects.GameObject
    const body = asDynamicBody(actor)
    const platformBody = asStaticBody(platformObj)
    if (!body || !platformBody) {
      return false
    }

    const dropThroughActive = this.isDropThroughActive(actor)
    return shouldCollideWithOneWayPlatform({
      actorPrevBottom: body.prev.y + body.height,
      actorBottom: body.y + body.height,
      actorVelocityY: body.velocity.y,
      actorLeft: body.left,
      actorRight: body.right,
      platformTop: platformBody.top,
      platformLeft: platformBody.left,
      platformRight: platformBody.right,
      dropThroughActive
    })
  }

  private resolveOptions(options?: PlatformActorOptions): Required<PlatformActorOptions> {
    return {
      allowOneWay: options?.allowOneWay ?? true,
      allowDropThrough: options?.allowDropThrough ?? false
    }
  }

  private clearAttachedColliders(target: object): void {
    const existing = this.actorColliders.get(target)
    if (existing) {
      existing.forEach((collider) => collider.destroy())
      this.actorColliders.delete(target)
    }
  }

  private clearAllAttachedColliders(): void {
    this.actorColliders.forEach((colliders) => {
      colliders.forEach((collider) => collider.destroy())
    })
    this.actorColliders.clear()
  }
}
