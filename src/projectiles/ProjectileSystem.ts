import Phaser from 'phaser'
import { ProjectileRegistry } from './ProjectileRegistry'
import { resolveProjectileStall } from './projectileLifecycle'
import type { ProjectileDefinition, ProjectilePoolKey, ProjectileSpawnRequest } from './types'

type ProjectileSystemOptions = {
  playerPoolSize?: number
  enemyPoolSize?: number
}

type UpdateContext = {
  player?: Phaser.Physics.Arcade.Sprite
  enemyReturnTarget?: Phaser.GameObjects.GameObject & { x: number; y: number }
}

export class ProjectileSystem {
  private readonly groups: Record<ProjectilePoolKey, Phaser.Physics.Arcade.Group>

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
    bullet.data?.set('originY', request.y)
    bullet.data?.set('direction', request.direction)
    bullet.data?.set('lifetimeMs', definition.lifetimeMs)
    bullet.data?.set('pierceRemaining', definition.hitPolicy.pierce)
    bullet.data?.set('weaponBehavior', definition.behavior.kind)
    bullet.data?.set('baseSpeedX', velocityX)
    bullet.data?.set('baseSpeedY', velocityY)
    bullet.data?.set('baseScale', request.scale ?? definition.visual.scale)
    bullet.data?.set('stalledSince', null)
    bullet.data?.set('chargeLevel', request.chargeLevel ?? 0)

    if (definition.behavior.kind === 'wave') {
      bullet.data?.set('waveAmplitude', definition.behavior.amplitude)
      bullet.data?.set('wavePeriodMs', definition.behavior.periodMs)
      bullet.data?.set('waveOriginY', request.y)
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
          this.recycle(bullet)
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
          this.recycle(bullet)
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
              this.recycle(bullet)
              return false
            }
            const scale = returnSpeed / Math.max(1, distance)
            body.setVelocity(dx * scale, dy * scale)
          }
        }

        const baseScale = Number(bullet.data?.get?.('baseScale') ?? definition.visual.scale)
        if (projectileId.startsWith('player_buster_charge_lv')) {
          const elapsed = now - spawnedAt
          const pulse = 1 + Math.sin(elapsed * 0.026) * 0.08
          bullet.setScale(baseScale * pulse)
          bullet.setAngle((elapsed * 0.16) % 360)
        } else if (projectileId === 'player_weapon_MagcutDisc' || projectileId === 'player_weapon_ThunderSpike') {
          bullet.setAngle((now * 0.42 * Math.sign(body.velocity.x || 1)) % 360)
        } else {
          bullet.setScale(baseScale)
          bullet.setAngle(0)
        }

        return false
      })
    })
  }

  recycle(target: Phaser.GameObjects.GameObject | null | undefined): boolean {
    const bullet = target as Phaser.Physics.Arcade.Sprite | null
    if (!bullet) {
      return false
    }

    const owner = bullet.data?.get?.('owner') as ProjectileDefinition['owner'] | undefined
    if (owner !== 'player' && owner !== 'enemy') {
      return false
    }

    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
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

  private recycleInvalidProjectile(bullet: Phaser.Physics.Arcade.Sprite): void {
    if (this.recycle(bullet)) {
      return
    }
    bullet.disableBody(true, true)
    bullet.setVelocity(0, 0)
  }
}
