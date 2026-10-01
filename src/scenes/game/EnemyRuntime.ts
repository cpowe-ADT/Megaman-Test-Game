import Phaser from 'phaser'
import { AUTOMATION } from '../../config/automation'
import { ENEMY_GLOBAL_TUNING, EnemySpawner, resolveLevelEnemyMarkers, type resolveEnemyFeatureFlags } from '../../enemy'
import type { PlayerDamageRequest, PlayerDamageResult } from '../../player/types'
import type { ProjectileSystem } from '../../projectiles'

type EnemyFeatureFlags = ReturnType<typeof resolveEnemyFeatureFlags>

/**
 * The members of the Game scene the enemy framework's init, spawn and teardown read and write
 * (prompt 06 phase 6.0, `EVAL-P6-014`). `enemySpawner` stays a host field (not owned here): it is part
 * of the automation surface (`scene.enemySpawner` in `main.ts`, every `scripts/smoke/*.mjs` route), so
 * this class reads and writes it in place instead of shadowing it behind a second reference.
 */
export interface EnemyRuntimeHost {
  player?: Phaser.Physics.Arcade.Sprite
  enemies?: Phaser.Physics.Arcade.Group
  bossBullets?: Phaser.Physics.Arcade.Group
  projectileSystem?: ProjectileSystem
  stagePlatforms?: Phaser.Physics.Arcade.StaticGroup
  enemySpawner?: EnemySpawner
  readonly enemyFeatureFlags: EnemyFeatureFlags
  requestPlayerDamage(request: PlayerDamageRequest): PlayerDamageResult
  onTargetDefeated(sprite: Phaser.Physics.Arcade.Sprite): void
  playAnimationSafe(
    target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite | undefined,
    key: string,
    ignoreIfPlaying?: boolean
  ): void
  pickupSystem: { spawnEnemyDrop(x: number, y: number, forcedType?: unknown): unknown }
}

/**
 * The enemy framework's per-stage init, its demo wave and debug spawn hook, and scene-shutdown teardown.
 * Moved out of `Game.initializeEnemyFramework` and the matching `SHUTDOWN` lines unchanged in behaviour
 * (prompt 06 phase 6.0, `EVAL-P6-014`); the per-frame `enemySpawner.update(now, delta)` calls stay in
 * `Game.update` as one-liners, same as before.
 */
export class EnemyRuntime {
  constructor(private readonly host: EnemyRuntimeHost & Phaser.Scene) {}

  initialize(stageId: string): void {
    const host = this.host
    if (!host.player || !host.enemies || !host.bossBullets) {
      return
    }

    host.enemySpawner = new EnemySpawner(
      {
        scene: host,
        player: host.player,
        stageId,
        enemyGroup: host.enemies,
        projectileGroup: host.bossBullets,
        projectileSystem: host.projectileSystem as ProjectileSystem,
        worldPlatforms: host.stagePlatforms,
        applyDamageToPlayer: (request) => host.requestPlayerDamage(request),
        onEnemyDefeated: (sprite: Phaser.Physics.Arcade.Sprite) => {
          if (host.enemyFeatureFlags.enableEnemyDrops) {
            host.pickupSystem.spawnEnemyDrop(sprite.x, sprite.y - 8, host.enemySpawner?.defeatDropFor(sprite))
          }
          host.onTargetDefeated(sprite)
        },
        playAnimationSafe: (target, key, ignoreIfPlaying) => host.playAnimationSafe(target, key, ignoreIfPlaying)
      },
      {
        enableAI: host.enemyFeatureFlags.enableEnemyAI,
        enableProjectiles: host.enemyFeatureFlags.enableEnemyProjectiles,
        enableDebug: host.enemyFeatureFlags.enableEnemyDebug,
        maxActiveEnemies: ENEMY_GLOBAL_TUNING.maxActiveEnemies
      }
    )

    const levelMarkers = resolveLevelEnemyMarkers(stageId)
    const runtimeMarkers = (host.registry.get('enemy_level_markers') as any[] | undefined) ?? []
    host.enemySpawner.spawnFromLevelMarkers([...levelMarkers, ...runtimeMarkers])

    if ((host.registry.get('enemy_scripted_wave_demo') as boolean | undefined) === true) {
      host.enemySpawner.registerWave({
        id: 'demo_enemy_wave_1',
        typeKey: 'enemy_gunner_bot',
        x: host.player.x + 120,
        y: host.player.y,
        trigger: 'time',
        triggerValue: 2500
      })
    }

    if (typeof window !== 'undefined' && AUTOMATION.enabled) {
      ;(window as any).spawnEnemyDebug = (
        typeKey = 'enemy_gunner_bot',
        x = host.player!.x + 100,
        y = host.player!.y
      ) => host.enemySpawner?.spawn(typeKey, x, y)
    }
  }

  /** Scene `SHUTDOWN`: stop the spawner and drop the debug spawn hook, moved unchanged from `Game.create`. */
  teardown(): void {
    this.host.enemySpawner?.destroy()
    this.host.enemySpawner = undefined
    if (typeof window !== 'undefined' && (window as any).spawnEnemyDebug) {
      delete (window as any).spawnEnemyDebug
    }
  }
}
