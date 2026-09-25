import Phaser from 'phaser'
import { ProjectileRegistry } from './ProjectileRegistry'
import { liftShotAboveFloor, resolveProjectileStall } from './projectileLifecycle'
import type { ProjectileDefinition, ProjectilePoolKey, ProjectileSpawnRequest } from './types'
import { bounceVelocity, classifyImpact, magnetPullVelocity, resolveImpactFollowUp, shotAngleDeg } from './weaponEffects'

type ProjectileSystemOptions = {
  playerPoolSize?: number
  enemyPoolSize?: number
}

type UpdateContext = {
  player?: Phaser.Physics.Arcade.Sprite
  enemyReturnTarget?: Phaser.GameObjects.GameObject & { x: number; y: number }
  /** Enemy drops a MagcutDisc in flight pulls toward itself (prompt 07 phase 7.3 `magnet`). */
  pickups?: Phaser.GameObjects.Group
}

/** Why `recycle` was called: the lifetime ran out (no impact effects) or anything else (hits, floors, walls). */
export type ProjectileRecycleReason = 'expired' | 'impact'

export class ProjectileSystem {
  private readonly groups: Record<ProjectilePoolKey, Phaser.Physics.Arcade.Group>
  /** The last impact an on-hit tag acted on, and counts per follow-up (smoke 12 reads them). */
  lastImpact: { projectileId: string; tag: string; impact: string; followUp: string; atMs: number } | null = null
  readonly impactCounts: Record<string, number> = {}

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly registry: ProjectileRegistry,
    options: ProjectileSystemOptions = {}
  ) {
    this.groups = {
      player: this.scene.physics.add.group({
        classType: Phaser.Physics.Arcade.Sprite,
        maxSize: options.playerPoolSize ?? 50,
        runChildUpdate: false,
        allowGravity: false,
        collideWorldBounds: true
      }),
      enemy: this.scene.physics.add.group({
        classType: Phaser.Physics.Arcade.Sprite,
        maxSize: options.enemyPoolSize ?? 80,
        runChildUpdate: false,
        allowGravity: false,
        collideWorldBounds: true
      })
    }
  }

  getDefinition(id: string): ProjectileDefinition | undefined {
    return this.registry.get(id)
  }

  getGroup(pool: ProjectilePoolKey): Phaser.Physics.Arcade.Group {
    return this.groups[pool]
  }

  spawn(request: ProjectileSpawnRequest): Phaser.Physics.Arcade.Sprite | null {
    const definition = this.registry.get(request.id)
    if (!definition) {
      return null
    }

    const group = this.groups[definition.pool]
    const bullet = group.get(
      request.x,
      request.y,
      definition.visual.textureKey,
      definition.visual.frame
    ) as Phaser.Physics.Arcade.Sprite | null
    if (!bullet) {
      return null
    }

    bullet.setActive(true).setVisible(true)
    bullet.setPosition(request.x, request.y)
    bullet.setTexture(definition.visual.textureKey, definition.visual.frame)
    bullet.setDepth(definition.visual.depth)
    bullet.setAlpha(definition.visual.alpha ?? 1)
    bullet.setScale(request.scale ?? definition.visual.scale)
    bullet.setFlipX(Boolean(definition.visual.flipXWithDirection && request.direction < 0))
    bullet.setDataEnabled()
    bullet.clearTint()
    if (definition.visual.tint != null || request.tint != null) {
      bullet.setTint(request.tint ?? definition.visual.tint ?? 0xffffff)
    }
    if ((bullet as any).setBlendMode && definition.visual.blendMode != null) {
      ;(bullet as any).setBlendMode(definition.visual.blendMode)
    }

    let spawnY = request.y
    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.enable = true
      body.reset(request.x, request.y)
      const hitbox = definition.hitbox
      if (hitbox) {
        body.setSize(hitbox.width, hitbox.height, true)
      } else {
        body.setSize(bullet.frame.width, bullet.frame.height, true)
      }
      if (request.clearFloorY != null) {
        const scaleY = Math.abs(request.scale ?? definition.visual.scale)
        const halfHeight = Math.max(bullet.frame.height * scaleY, (hitbox?.height ?? bullet.frame.height) * scaleY) / 2
        spawnY = liftShotAboveFloor(request.y, halfHeight, request.clearFloorY)
        if (spawnY !== request.y) {
          bullet.setPosition(request.x, spawnY)
          body.reset(request.x, spawnY)
        }
      }
      body.allowGravity = false
      body.onWorldBounds = definition.hitPolicy.collidesWithWorldBounds
      body.setCollideWorldBounds(definition.hitPolicy.collidesWithWorldBounds)
      body.setAcceleration(0, 0)
      body.setMaxVelocity(definition.maxVelocityX, definition.maxVelocityY)
    }

    const speed = request.speed ?? definition.speed
    const damage = request.damage ?? definition.damage
    const velocityX = request.velocity?.x ?? speed * request.direction
    const velocityY = request.velocity?.y ?? 0

    bullet.data?.set('projectileId', definition.id)
    bullet.data?.set('owner', definition.owner)
    bullet.data?.set('damage', damage)
    bullet.data?.set('spawnedAt', this.scene.time.now)
    bullet.data?.set('originX', request.x)
    bullet.data?.set('originY', spawnY)
    bullet.data?.set('direction', request.direction)
    bullet.data?.set('lifetimeMs', definition.lifetimeMs)
    bullet.data?.set('pierceRemaining', definition.hitPolicy.pierce)
    bullet.data?.set('weaponBehavior', definition.behavior.kind)
    bullet.data?.set('baseSpeedX', velocityX)
    bullet.data?.set('baseSpeedY', velocityY)
    bullet.data?.set('baseScale', request.scale ?? definition.visual.scale)
    bullet.data?.set('stalledSince', null)
    bullet.data?.set('chargeLevel', request.chargeLevel ?? 0)
    // The router marks target hits here before recycling; impact effects read it (weaponEffects.classifyImpact).
    bullet.data?.set('hitTarget', null)
    bullet.data?.set('hitFloorY', null)
    // Aimed and fanned shots tilt their drawing along the flight line.
    const baseAngle = definition.visual.flipXWithDirection && request.velocity ? shotAngleDeg({ x: velocityX, y: velocityY }, request.direction) : 0
    bullet.data?.set('baseAngle', baseAngle)
    bullet.setAngle(baseAngle)

    if (definition.behavior.kind === 'wave') {
      bullet.data?.set('waveAmplitude', definition.behavior.amplitude)
      bullet.data?.set('wavePeriodMs', definition.behavior.periodMs)
      bullet.data?.set('waveOriginY', spawnY)
    }

    if (definition.behavior.kind === 'lob') {
      bullet.data?.set('gravityY', definition.behavior.gravityY)
      bullet.data?.set('initialVelocityY', definition.behavior.initialVelocityY)
    }

    if (definition.behavior.kind === 'boomerang') {
      bullet.data?.set('returnAfterMs', definition.behavior.returnAfterMs)
      bullet.data?.set('returnSpeed', definition.behavior.returnSpeed)
      bullet.data?.set('returning', false)
      bullet.data?.set('homeOffsetY', definition.behavior.homeOffsetY)
    }

    if (request.metadata) {
      Object.entries(request.metadata).forEach(([key, value]) => bullet.data?.set(key, value))
    }

    if (body) {
      body.setVelocity(velocityX, velocityY)
      if (definition.behavior.kind === 'lob' && request.velocity?.y == null) {
        body.setVelocityY(definition.behavior.initialVelocityY)
      }
    } else {
      bullet.setVelocity(velocityX, velocityY)
      if (definition.behavior.kind === 'lob' && request.velocity?.y == null) {
        bullet.setVelocityY(definition.behavior.initialVelocityY)
      }
    }

    return bullet
  }

  update(now: number, deltaMs: number, context: UpdateContext = {}): void {
    const deltaSeconds = deltaMs / 1000

    Object.values(this.groups).forEach((group) => {
      group.children.iterate((child) => {
        const bullet = child as Phaser.Physics.Arcade.Sprite | null
        if (!bullet?.active) {
          return false
        }

        const projectileId = bullet.data?.get?.('projectileId') as string | undefined
        if (!projectileId) {
          this.recycleInvalidProjectile(bullet)
          return false
        }

        const definition = this.registry.get(projectileId)
        if (!definition) {
          this.recycleInvalidProjectile(bullet)
          return false
        }

        const spawnedAt = Number(bullet.data?.get?.('spawnedAt') ?? now)
        const lifetimeMs = Number(bullet.data?.get?.('lifetimeMs') ?? definition.lifetimeMs)
        if (lifetimeMs > 0 && now - spawnedAt >= lifetimeMs) {
          this.recycle(bullet, 'expired')
          return false
        }

        const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
        if (!body || !body.enable) {
          this.recycleInvalidProjectile(bullet)
          return false
        }

        const rawStalledSince = bullet.data?.get?.('stalledSince')
        const stall = resolveProjectileStall({
          kind: definition.behavior.kind,
          now,
          stalledSince: typeof rawStalledSince === 'number' && Number.isFinite(rawStalledSince) ? rawStalledSince : null,
          expectedVelocityX: Number(bullet.data?.get?.('baseSpeedX') ?? 0),
          expectedVelocityY: Number(bullet.data?.get?.('baseSpeedY') ?? 0),
          actualVelocityX: body.velocity.x,
          actualVelocityY: body.velocity.y
        })
        // DataManager.set fires two change events per call; write only when the value moves.
        if (stall.stalledSince !== rawStalledSince) {
          bullet.data?.set('stalledSince', stall.stalledSince)
        }
        if (stall.shouldRecycle) {
          this.recycle(bullet, 'expired')
          return false
        }

        if (definition.behavior.kind === 'wave') {
          const baseY = Number(bullet.data?.get?.('waveOriginY') ?? bullet.y)
          const amplitude = Number(bullet.data?.get?.('waveAmplitude') ?? definition.behavior.amplitude)
          const periodMs = Math.max(60, Number(bullet.data?.get?.('wavePeriodMs') ?? definition.behavior.periodMs))
          const elapsed = now - spawnedAt
          bullet.y = baseY + Math.sin((elapsed / periodMs) * Math.PI * 2) * amplitude
        } else if (definition.behavior.kind === 'lob') {
          const gravityY = Number(bullet.data?.get?.('gravityY') ?? definition.behavior.gravityY)
          body?.setVelocityY(body.velocity.y + gravityY * deltaSeconds)
        } else if (definition.behavior.kind === 'boomerang' && body) {
          const returnTarget = definition.owner === 'enemy' ? context.enemyReturnTarget : context.player
          if (!returnTarget) return false
          const returnAfterMs = Math.max(
            80,
            Number(bullet.data?.get?.('returnAfterMs') ?? definition.behavior.returnAfterMs)
          )
          const returnSpeed = Math.max(
            120,
            Number(bullet.data?.get?.('returnSpeed') ?? definition.behavior.returnSpeed)
          )
          const homeOffsetY = Number(bullet.data?.get?.('homeOffsetY') ?? definition.behavior.homeOffsetY)
          const elapsed = now - spawnedAt
          if (elapsed >= returnAfterMs && !bullet.data?.get?.('returning')) {
            bullet.data?.set('returning', true)
          }

          if (bullet.data?.get?.('returning')) {
            const dx = returnTarget.x - bullet.x
            const dy = returnTarget.y + homeOffsetY - bullet.y
            const distance = Math.hypot(dx, dy)
            if (distance <= 14) {
              this.recycle(bullet, 'expired')
              return false
            }
            const scale = returnSpeed / Math.max(1, distance)
            body.setVelocity(dx * scale, dy * scale)
          }
        }

        const baseScale = Number(bullet.data?.get?.('baseScale') ?? definition.visual.scale)
        const animationFrames = definition.visual.animationFrames
        if (animationFrames && animationFrames.length > 1) {
          const frameMs = Math.max(16, definition.visual.animationFrameMs ?? 66)
          const frame = animationFrames[Math.floor((now - spawnedAt) / frameMs) % animationFrames.length]
          if (bullet.frame?.name !== frame) bullet.setFrame(frame)
        }
        if (projectileId.startsWith('player_buster_charge_lv')) {
          // Directional art: pulse, never spin.
          const elapsed = now - spawnedAt
          const pulse = 1 + Math.sin(elapsed * 0.026) * 0.06
          bullet.setScale(baseScale * pulse)
          bullet.setAngle(0)
        } else {
          // weapons_v1 art is drawn travelling right and animates itself: tilt along the aim, never spin.
          bullet.setScale(baseScale)
          bullet.setAngle(Number(bullet.data?.get?.('baseAngle') ?? 0))
        }
        if (context.pickups && bullet.data?.get?.('onHitTag') === 'magnet') {
          this.pullPickups(bullet, context.pickups)
        }

        return false
      })
    })
  }

  recycle(target: Phaser.GameObjects.GameObject | null | undefined, reason: ProjectileRecycleReason = 'impact'): boolean {
    const bullet = target as Phaser.Physics.Arcade.Sprite | null
    if (!bullet) {
      return false
    }

    const owner = bullet.data?.get?.('owner') as ProjectileDefinition['owner'] | undefined
    if (owner !== 'player' && owner !== 'enemy') {
      return false
    }

    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    if (owner === 'player' && reason === 'impact' && bullet.active && this.applyImpact(bullet, body)) {
      // A bounce: the shot flies on.
      return true
    }
    if (body) {
      body.onWorldBounds = false
    }

    const emitter = (bullet as any).__trailEmitter
    if (emitter && typeof emitter.stop === 'function') {
      emitter.stop()
      if (typeof emitter.destroy === 'function') {
        emitter.destroy()
      }
      ;(bullet as any).__trailEmitter = null
    }

    const anyBullet = bullet as any
    if (typeof anyBullet.disableBody === 'function') {
      anyBullet.disableBody(true, true)
    } else {
      const group = owner === 'enemy' ? this.groups.enemy : this.groups.player
      group.killAndHide(bullet)
      if (body) {
        body.enable = false
      }
    }

    if (typeof anyBullet.setVelocity === 'function') {
      anyBullet.setVelocity(0, 0)
    } else if (body && typeof body.setVelocity === 'function') {
      body.setVelocity(0, 0)
    }

    return true
  }

  /**
   * On-hit tags that act where a player shot ends (prompt 07 phase 7.3): a flame leaves a burn puddle, a knuckle
   * that lands quakes, a dart with a bounce left bounces. Returns true when the shot keeps flying (a bounce).
   */
  private applyImpact(bullet: Phaser.Physics.Arcade.Sprite, body: Phaser.Physics.Arcade.Body | undefined): boolean {
    const tag = bullet.data?.get?.('onHitTag') as string | undefined
    if (!tag || tag === 'none') return false
    const contact = body ? { up: body.touching.up || body.blocked.up, down: body.touching.down || body.blocked.down, left: body.touching.left || body.blocked.left, right: body.touching.right || body.blocked.right } : undefined
    const impact = classifyImpact(bullet.data?.get?.('hitTarget'), contact)
    const bouncesLeft = Number(bullet.data?.get?.('bouncesLeft') ?? 0)
    const followUp = resolveImpactFollowUp(tag, impact, bouncesLeft)
    if (!followUp) return false
    this.impactCounts[followUp.kind] = (this.impactCounts[followUp.kind] ?? 0) + 1
    this.lastImpact = { projectileId: String(bullet.data?.get?.('projectileId') ?? ''), tag, impact, followUp: followUp.kind, atMs: this.scene.time?.now ?? 0 }
    if (followUp.kind === 'bounce') {
      if (!body) return false
      const next = bounceVelocity({ x: body.velocity.x, y: body.velocity.y }, impact)
      bullet.data?.set('bouncesLeft', bouncesLeft - 1)
      bullet.data?.set('baseSpeedX', next.x)
      bullet.data?.set('baseSpeedY', next.y)
      body.setVelocity(next.x, next.y)
      const direction = next.x < 0 ? -1 : 1
      bullet.setFlipX(direction < 0)
      bullet.data?.set('baseAngle', shotAngleDeg(next, direction))
      return true
    }
    const hitFloorY = Number(bullet.data?.get?.('hitFloorY'))
    const floorY = impact === 'floor' && body ? body.bottom : Number.isFinite(hitFloorY) && hitFloorY > 0 ? hitFloorY : undefined
    this.spawn({
      id: followUp.projectileId,
      x: bullet.x,
      y: floorY ?? bullet.y,
      direction: bullet.flipX ? -1 : 1,
      clearFloorY: floorY,
      metadata: {
        weaponId: bullet.data?.get?.('weaponId'),
        weaponElement: bullet.data?.get?.('weaponElement'),
        chargeLevel: 0,
        source: 'player',
        onHitTag: 'none',
        followUpOf: bullet.data?.get?.('projectileId')
      }
    })
    if (followUp.kind === 'quake') this.drawQuake(bullet.x, floorY ?? bullet.y)
    return false
  }

  private drawQuake(x: number, floorY: number): void {
    const scene = this.scene as Phaser.Scene & { add?: Phaser.GameObjects.GameObjectFactory; tweens?: Phaser.Tweens.TweenManager }
    scene.cameras?.main?.shake?.(90, 0.004)
    const ring = scene.add?.ellipse?.(x, floorY - 3, 26, 7, 0xd29f68, 0.75)
    if (!ring) return
    ring.setDepth(2)
    scene.tweens?.add({ targets: ring, scaleX: 4.6, scaleY: 1.6, alpha: 0, duration: 220, onComplete: () => ring.destroy() })
  }

  /** MagcutDisc `magnet`: drops within reach drift to the disc (and come home with it). */
  private pullPickups(disc: Phaser.Physics.Arcade.Sprite, pickups: Phaser.GameObjects.Group): void {
    pickups.children?.iterate((child) => {
      const drop = child as Phaser.Physics.Arcade.Sprite | null
      const dropBody = drop?.body as Phaser.Physics.Arcade.Body | undefined
      if (!drop?.active || !dropBody?.enable) return true
      const pull = magnetPullVelocity(drop, disc)
      if (pull) {
        dropBody.setVelocity(pull.x, pull.y)
        drop.data?.set?.('pulledBy', 'MagcutDisc')
      }
      return true
    })
  }

  private recycleInvalidProjectile(bullet: Phaser.Physics.Arcade.Sprite): void {
    if (this.recycle(bullet, 'expired')) {
      return
    }
    bullet.disableBody(true, true)
    bullet.setVelocity(0, 0)
  }
}
