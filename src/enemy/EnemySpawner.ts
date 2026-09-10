import Phaser from 'phaser'
import { GAME_HEIGHT } from '../config/renderPolicy'
import { EnemyEntity } from './EnemyEntity'
import { EnemyCatalog } from './EnemyCatalog'
import { EnemyDebugOverlay } from './EnemyDebugOverlay'
import { DamageEvent, EnemyDefinition, EnemyLevelMarker, EnemyRuntimeContext, EnemySpawnWave } from './types'
import { getGeneratedEnemyDefinition, getPilotEnemyConfigById } from '../content/enemies'
import { applyPilotEnemyOverride } from './EnemyDefinitionAdapters'

export type EnemySpawnerOptions = {
  enableAI: boolean
  enableProjectiles: boolean
  enableDebug: boolean
  maxActiveEnemies: number
}

export class EnemySpawner {
  private readonly context: EnemyRuntimeContext
  private readonly options: EnemySpawnerOptions
  private readonly enemies = new Map<string, EnemyEntity>()
  private readonly waves: EnemySpawnWave[] = []
  private readonly levelMarkers = new Map<string, EnemyLevelMarker>()
  private readonly activeMarkerIds = new Set<string>()
  private readonly retiredMarkerIds = new Set<string>()
  private readonly debugOverlay?: EnemyDebugOverlay
  private readonly startedAt: number
  private idSeed = 1

  constructor(context: EnemyRuntimeContext, options: EnemySpawnerOptions) {
    this.context = context
    this.options = options
    this.startedAt = context.scene.time.now

    if (options.enableDebug) {
      this.debugOverlay = new EnemyDebugOverlay(context.scene)
    }
  }

  spawn(
    typeKey: string,
    x: number,
    y: number,
    options?: {
      explicitId?: string
      patrolMinX?: number
      patrolMaxX?: number
    }
  ): EnemyEntity | null {
    const resolvedDefinition = this.resolveDefinition(typeKey)
    if (!resolvedDefinition) {
      console.warn(`[EnemySpawner] Unknown enemy type '${typeKey}'`)
      return null
    }
    if (this.enemies.size >= this.options.maxActiveEnemies) {
      return null
    }

    const id = options?.explicitId ?? `enemy_${this.idSeed++}`
    const hasPatrolBounds =
      typeof options?.patrolMinX === 'number' && typeof options?.patrolMaxX === 'number'
    const entity = new EnemyEntity(this.context, typeKey, {
      id,
      x,
      y,
      enableAI: this.options.enableAI,
      enableProjectiles: this.options.enableProjectiles,
      definitionOverride: resolvedDefinition,
      patrolBounds: hasPatrolBounds
        ? {
            minX: Math.min(options?.patrolMinX as number, options?.patrolMaxX as number),
            maxX: Math.max(options?.patrolMinX as number, options?.patrolMaxX as number)
          }
        : undefined
    })
    this.enemies.set(id, entity)

    return entity
  }

  spawnFromLevelMarkers(markers: EnemyLevelMarker[]): void {
    markers.forEach((marker) => {
      this.levelMarkers.set(marker.id, { ...marker })
    })
  }

  registerWave(wave: EnemySpawnWave): void {
    this.waves.push({ ...wave })
  }

  update(now: number, deltaMs: number): void {
    this.updateLevelMarkers()
    this.consumeTriggeredWaves(now)

    this.enemies.forEach((entity, id) => {
      entity.update(now, deltaMs)
      if (this.shouldRetireLevelEnemy(id, entity)) {
        this.retireLevelEnemy(id, entity)
        return
      }
      if (!entity.sprite.active) {
        this.enemies.delete(id)
        this.onEntityRemoved(id)
      }
    })

    this.debugOverlay?.update(this.getEntities())
  }

  pauseAnimations(): void {
    this.enemies.forEach((entity) => {
      entity.sprite.anims.pause()
    })
  }

  resumeAnimations(): void {
    this.enemies.forEach((entity) => {
      entity.sprite.anims.resume()
    })
  }

  applyDamageToSprite(sprite: Phaser.Physics.Arcade.Sprite, event: DamageEvent): boolean {
    const id = sprite.data?.get?.('enemyFrameworkId') as string | undefined
    if (!id) {
      return false
    }
    const entity = this.enemies.get(id)
    if (!entity) {
      return false
    }

    entity.applyDamage(event)
    return true
  }

  getEntityBySprite(sprite: Phaser.Physics.Arcade.Sprite): EnemyEntity | undefined {
    const id = sprite.data?.get?.('enemyFrameworkId') as string | undefined
    return id ? this.enemies.get(id) : undefined
  }

  getEntities(): EnemyEntity[] {
    return Array.from(this.enemies.values())
  }

  getStreamDebugSnapshot(): {
    totalMarkers: number
    pendingMarkers: number
    activeMarkers: number
    retiredMarkers: number
  } {
    return {
      totalMarkers: this.levelMarkers.size,
      pendingMarkers: Math.max(
        0,
        this.levelMarkers.size - this.activeMarkerIds.size - this.retiredMarkerIds.size
      ),
      activeMarkers: this.activeMarkerIds.size,
      retiredMarkers: this.retiredMarkerIds.size
    }
  }

  destroy(): void {
    this.enemies.forEach((entity) => {
      try {
        entity.destroy()
      } catch {
        // Enemy teardown should not block scene transitions.
      }
    })
    this.enemies.clear()
    this.debugOverlay?.destroy()
  }

  private consumeTriggeredWaves(now: number): void {
    const cameraBounds = this.context.scene.cameras.main.worldView

    this.waves.forEach((wave) => {
      if (wave.consumed) {
        return
      }

      let triggered = false
      if (wave.trigger === 'time') {
        triggered = now - this.startedAt >= wave.triggerValue
      } else if (wave.trigger === 'distance') {
        triggered = Phaser.Math.Distance.Between(this.context.player.x, this.context.player.y, wave.x, wave.y) <= wave.triggerValue
      } else if (wave.trigger === 'camera') {
        triggered = cameraBounds.contains(wave.x, wave.y)
      }

      if (!triggered) {
        return
      }

      const spawned = this.spawn(wave.typeKey, wave.x, wave.y, { explicitId: wave.id })
      if (spawned) {
        wave.consumed = true
      }
    })
  }

  private updateLevelMarkers(): void {
    if (!this.levelMarkers.size) {
      return
    }

    const playerX = this.context.player.x

    this.levelMarkers.forEach((marker, markerId) => {
      if (this.activeMarkerIds.has(markerId) || this.retiredMarkerIds.has(markerId)) {
        return
      }

      const retireTriggerX = marker.retireTriggerX ?? marker.x + 128
      if (playerX >= retireTriggerX) {
        this.retiredMarkerIds.add(markerId)
        return
      }

      const spawnTriggerX = marker.spawnTriggerX ?? Math.max(0, marker.x - (marker.spawnLeadX ?? 96))
      if (playerX < spawnTriggerX) {
        return
      }

      const spawned = this.spawn(marker.typeKey, marker.x, marker.y, {
        explicitId: marker.id,
        patrolMinX: marker.patrolMinX,
        patrolMaxX: marker.patrolMaxX
      })
      if (!spawned) {
        return
      }

      this.activeMarkerIds.add(markerId)
    })
  }

  private shouldRetireLevelEnemy(id: string, entity: EnemyEntity): boolean {
    const marker = this.levelMarkers.get(id)
    if (!marker || marker.persistent) {
      return false
    }

    const playerX = this.context.player.x
    const retireTriggerX = marker.retireTriggerX ?? marker.x + 128
    const lagBehindPx = playerX - entity.sprite.x
    const fellOutOfStage = entity.sprite.y >= GAME_HEIGHT + 96

    return fellOutOfStage || (playerX >= retireTriggerX && lagBehindPx >= 72)
  }

  private retireLevelEnemy(id: string, entity: EnemyEntity): void {
    this.enemies.delete(id)
    this.onEntityRemoved(id)
    entity.destroy()
  }

  private onEntityRemoved(id: string): void {
    if (!this.levelMarkers.has(id)) {
      return
    }
    this.activeMarkerIds.delete(id)
    this.retiredMarkerIds.add(id)
  }

  private resolveDefinition(typeKey: string): EnemyDefinition | undefined {
    const pilot = getPilotEnemyConfigById(typeKey)
    if (pilot) {
      const pilotDefinition = applyPilotEnemyOverride(typeKey, pilot)
      if (pilotDefinition) {
        return pilotDefinition
      }
    }
    return getGeneratedEnemyDefinition(typeKey) ?? EnemyCatalog[typeKey]
  }
}
