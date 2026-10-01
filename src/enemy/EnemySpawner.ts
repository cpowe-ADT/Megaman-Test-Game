import Phaser from 'phaser'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/renderPolicy'
import { getCampaignStage } from '../content/campaign'
import { EnemyEntity } from './EnemyEntity'
import { EnemyCatalog } from './EnemyCatalog'
import { EnemyDebugOverlay } from './EnemyDebugOverlay'
import { DamageEvent, EnemyDefinition, EnemyLevelMarker, EnemyRuntimeContext, EnemySpawnWave } from './types'
import { getGeneratedEnemyDefinition, getPilotEnemyConfigById } from '../content/enemies'
import { applyPilotEnemyOverride } from './EnemyDefinitionAdapters'
import { minibossDefeatDrop } from './minibossCatalog'
import { cameraEdgeDistance, createMarkerStreamState, nextMarkerStreamState, type MarkerStreamState } from './markerStreaming'
import { scaleEnemyDamage } from '../progression/difficulty'
import { Save } from '../systems/Save'

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
  /** Camera-relative spawn/respawn phase per level marker (13h.3a, `EVAL-P6-006`); pure decisions in `markerStreaming.ts`. */
  private readonly streamStates = new Map<string, MarkerStreamState>()
  /** Mini-boss and `room_lock` wave marker ids (this stage's `roomLocks`): cleared for good, never respawn. */
  private readonly noRespawnMarkerIds: Set<string>
  private readonly debugOverlay?: EnemyDebugOverlay
  private readonly startedAt: number
  private idSeed = 1

  constructor(context: EnemyRuntimeContext, options: EnemySpawnerOptions) {
    this.context = context
    this.options = options
    this.startedAt = context.scene.time.now
    this.noRespawnMarkerIds = EnemySpawner.collectNoRespawnMarkerIds(context.stageId)

    if (options.enableDebug) {
      this.debugOverlay = new EnemyDebugOverlay(context.scene)
    }
  }

  /** Every marker id named by this stage's `roomLocks`: a defeat lock's markers, or any of its later waves. */
  private static collectNoRespawnMarkerIds(stageId: string): Set<string> {
    const roomLocks = getCampaignStage(stageId).arena.roomLocks ?? []
    const ids = new Set<string>()
    roomLocks.forEach((lock) => {
      for (const id of lock.defeatMarkers ?? []) {
        ids.add(id)
      }
      for (const wave of lock.waves ?? []) {
        for (const marker of wave) {
          ids.add(marker.id)
        }
      }
    })
    return ids
  }

  spawn(
    typeKey: string,
    x: number,
    y: number,
    options?: {
      explicitId?: string
      patrolMinX?: number
      patrolMaxX?: number
      variant?: string
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
      variant: options?.variant,
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

  /**
   * A checkpoint death (13h.3a, `EVAL-P6-006`): every marker rearms for an immediate respawn once the
   * camera reaches it again, except one cleared for good (a mini-boss or `room_lock` wave). An entity
   * still alive and on screen is cleared too, so a death always gives a clean room back.
   */
  resetForRespawn(): void {
    this.streamStates.forEach((state, id) => {
      if (state.phase === 'cleared') {
        return
      }
      const entity = this.enemies.get(id)
      if (entity) {
        this.enemies.delete(id)
        this.onEntityRemoved(id)
        entity.destroy()
      }
      this.activeMarkerIds.delete(id)
      this.retiredMarkerIds.delete(id)
      this.streamStates.set(id, createMarkerStreamState())
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
      if (!entity.sprite.active) {
        // Defeated: nothing reads the sprite after the kill, so free it instead of leaving it hidden in the group.
        this.enemies.delete(id)
        this.onEntityRemoved(id)
        entity.destroy()
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

  /** The drop a defeat forces (a mini-boss's large health capsule), or undefined for the usual roll. */
  defeatDropFor(sprite: Phaser.Physics.Arcade.Sprite): 'health_large' | undefined {
    return minibossDefeatDrop(this.getEntityBySprite(sprite)?.definition)
  }

  /** Level markers gone for good this run (defeated, fallen out, or passed); a defeat room lock reads it. */
  getClearedMarkerIds(): ReadonlySet<string> {
    return this.retiredMarkerIds
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

  /**
   * Camera-relative spawn and respawn (13h.3a, `EVAL-P6-006`): the pure phase machine lives in
   * `markerStreaming.ts`; this is its only adapter edge (the camera read, the live entity, the spawn
   * call, and the exemptions a `persistent: false` marker or a `room_lock`/mini-boss wave gets).
   */
  private updateLevelMarkers(): void {
    if (!this.levelMarkers.size) {
      return
    }

    const camera = this.context.scene.cameras.main.worldView

    this.levelMarkers.forEach((marker, markerId) => {
      const state = this.streamStates.get(markerId) ?? createMarkerStreamState()
      const distance = cameraEdgeDistance(camera.x, camera.right, marker.x)
      const entity = this.enemies.get(markerId)
      const fellOutOfStage = Boolean(entity && entity.sprite.y >= GAME_HEIGHT + 96)
      const stillInPlay = Boolean(entity?.sprite.active) && !fellOutOfStage
      const canRespawn = marker.persistent !== false && !this.noRespawnMarkerIds.has(markerId)
      const next = nextMarkerStreamState(state, distance, stillInPlay, canRespawn, GAME_WIDTH)

      if (next.phase === state.phase) {
        this.streamStates.set(markerId, next)
        return
      }

      if (next.phase === 'active') {
        const spawned = this.spawn(marker.typeKey, marker.x, marker.y, {
          explicitId: markerId,
          patrolMinX: marker.patrolMinX,
          patrolMaxX: marker.patrolMaxX,
          variant: marker.variant
        })
        if (!spawned) {
          // Stays pending and ready: tries again next tick (the global enemy cap is momentarily full).
          return
        }
        this.activeMarkerIds.add(markerId)
        this.retiredMarkerIds.delete(markerId)
        this.streamStates.set(markerId, next)
        return
      }

      // Left `active`: cleared for good, or resting for a respawn. A live sprite that did not die on its
      // own (the defeat loop below only catches `!sprite.active`) is retired quietly right here.
      if (entity?.sprite.active) {
        this.enemies.delete(markerId)
        this.onEntityRemoved(markerId)
        entity.destroy()
      }
      this.streamStates.set(markerId, next)
    })
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
        return this.applyDifficultyToDefinition(pilotDefinition)
      }
    }
    const base = getGeneratedEnemyDefinition(typeKey) ?? EnemyCatalog[typeKey]
    return base ? this.applyDifficultyToDefinition(base) : undefined
  }

  /** Part 13c (EVAL-P6-012): a regular enemy's damage stat, read at spawn (calls only; the table lives in `src/progression/difficulty.ts`). */
  private applyDifficultyToDefinition(definition: EnemyDefinition): EnemyDefinition {
    const scaled = scaleEnemyDamage(definition.stats.damage, Save.load().difficulty)
    return scaled === definition.stats.damage ? definition : { ...definition, stats: { ...definition.stats, damage: scaled } }
  }
}
