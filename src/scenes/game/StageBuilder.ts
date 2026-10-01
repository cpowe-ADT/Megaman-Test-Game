import Phaser from 'phaser'
import { getCampaignStage } from '../../content/campaign'
import { getBossRoomGateX, type StageBossRoomDefinition } from '../../content/stageArenaLayout'
import { getGameplayWorldBounds } from '../../config/gameplayLayout'
import { GAME_HEIGHT, GAME_WIDTH } from '../../config/renderPolicy'
import { PlatformCollisionSystem } from '../../physics'
import { mainGroundPlatforms } from '../../stage/stageGeometry'
import { installRoomLocks } from '../../mechanics/adapters/RoomLockAdapter'
import { installStageMechanics, stageMechanicPlatforms } from '../../mechanics/adapters/StageMechanicsAdapter'
import { shotPlatformProcess } from '../../projectiles/firePlayerShot'
import type { NewPlayerRuntime } from '../../player/NewPlayerRuntime'
import type { PlayerDamageRequest, PlayerDamageResult } from '../../player/types'
import type { EnemySpawner } from '../../enemy'
import type { StoryDirector } from './StoryDirector'
import type { StageBackdrop } from './StageBackdrop'

/** An Arcade sprite's `body` is nullable in its own type; every sprite here already has a live body
 * once physics is attached (true at every call site below, as it was before this moved out of `Game`). */
function asBodied(sprite: Phaser.Physics.Arcade.Sprite): Phaser.Types.Physics.Arcade.GameObjectWithBody {
  return sprite as unknown as Phaser.Types.Physics.Arcade.GameObjectWithBody
}

/**
 * The members of the Game scene the stage build, the boss gate barrier and the platform colliders read
 * and write (prompt 06 phase 6.0, `EVAL-P6-014`). Moved out of `Game` unchanged in behaviour; the gate
 * rectangle and its colliders are this class's own state now, because nothing outside the moved methods
 * ever read `bossGateBarrier`/`bossGateBarrierColliders` directly.
 */
export interface StageBuilderHost {
  player?: Phaser.Physics.Arcade.Sprite
  enemies?: Phaser.Physics.Arcade.Group
  playerBullets?: Phaser.Physics.Arcade.Group
  bossBullets?: Phaser.Physics.Arcade.Group
  bossBody?: Phaser.Physics.Arcade.Sprite
  bossTarget?: Phaser.Physics.Arcade.Sprite
  stagePlatforms?: Phaser.Physics.Arcade.StaticGroup
  stageOneWayPlatforms?: Phaser.Physics.Arcade.StaticGroup
  platformCollisionSystem?: PlatformCollisionSystem
  activeBossRoom?: StageBossRoomDefinition
  bossGateLockX: number
  bossGateLocked: boolean
  bossRoomCameraLocked: boolean
  activeStageId: string
  respawnPoint?: Phaser.Math.Vector2
  fallingToDeath: boolean
  newPlayerRuntime?: NewPlayerRuntime
  storyDirector?: Pick<StoryDirector, 'onRoomLockArmed' | 'onMiniBossLock' | 'waterLevelFlagHeard'>
  enemySpawner?: Pick<EnemySpawner, 'getClearedMarkerIds' | 'spawnFromLevelMarkers' | 'getEntities'>
  readonly stageBackdrop: Pick<StageBackdrop, 'render'>
  applyStageCameraBounds(stageId: string): void
  applyBossRoomCameraLock(): void
  requestPlayerDamage(request: PlayerDamageRequest): PlayerDamageResult
  recycleBullet(a: any, b: any): void
}

/**
 * Stage geometry (ground runs, mid-platforms, walls), the boss-room gate barrier and the platform
 * colliders every actor and projectile needs. Moved out of `Game.buildStage` and its neighbours
 * (prompt 06 phase 6.0, `EVAL-P6-014`); `Game.ts` keeps thin calls where other modules need the same
 * method names (`lockBossGate`/`unlockBossGate` are on `BossBeats`'s host contract).
 */
export class StageBuilder {
  private bossGateBarrier?: Phaser.GameObjects.Rectangle
  private bossGateBarrierColliders: Phaser.Physics.Arcade.Collider[] = []

  constructor(private readonly host: StageBuilderHost & Phaser.Scene) {}

  buildStage(stageId: string): void {
    const host = this.host
    const stage = getCampaignStage(stageId)
    const cfg = stage.arena
    const width = GAME_WIDTH
    const height = GAME_HEIGHT
    const worldWidth = Math.max(width, Number(cfg.width ?? width))
    host.activeBossRoom = cfg.bossRoom
    const gameplayBounds = getGameplayWorldBounds(worldWidth, height)
    host.physics.world.setBounds(
      gameplayBounds.x,
      gameplayBounds.y,
      gameplayBounds.width,
      gameplayBounds.height,
      cfg.leftWall,
      cfg.rightWall,
      true,
      !cfg.allowFallOff
    )
    host.physics.world.setBoundsCollision(cfg.leftWall, cfg.rightWall, true, !cfg.allowFallOff)
    host.applyStageCameraBounds(stageId)
    host.cameras.main.setBackgroundColor(cfg.background.baseColor ?? cfg.backgroundColor ?? '#0b1220')
    host.stageBackdrop.render(stageId, worldWidth)
    host.platformCollisionSystem?.destroy()
    host.platformCollisionSystem = new PlatformCollisionSystem(host)

    const platforms = [
      ...mainGroundPlatforms(stage.id, worldWidth, height, cfg.floorGaps),
      ...cfg.midPlatforms.map((platform) => ({
        id: platform.id,
        x: platform.x,
        y: platform.y,
        width: platform.width,
        height: platform.height ?? 8,
        type: platform.type ?? 'oneWay',
        color: platform.color ?? 0x33404f,
        motion: platform.motion
      })),
      ...stageMechanicPlatforms(cfg)
    ]

    host.platformCollisionSystem.rebuild(platforms, stageId)
    host.stagePlatforms = host.platformCollisionSystem.getSolidGroup()
    host.stageOneWayPlatforms = host.platformCollisionSystem.getOneWayGroup()
    host.bossGateLockX = getBossRoomGateX(cfg.bossRoom)
    host.bossGateLocked = false
    host.bossRoomCameraLocked = false
    this.installEntityPlatformCollisions()
    installRoomLocks({
      scene: host,
      stageId,
      player: () => host.player,
      runtime: () => host.newPlayerRuntime,
      onArmed: (lockIndex, hint) => host.storyDirector?.onRoomLockArmed(lockIndex, hint),
      onDefeatLockArmed: () => host.storyDirector?.onMiniBossLock(),
      clearedMarkers: () => host.enemySpawner?.getClearedMarkerIds() ?? [],
      spawnMarkers: (markers) => host.enemySpawner?.spawnFromLevelMarkers(markers),
      restoreCamera: () => (host.bossRoomCameraLocked ? host.applyBossRoomCameraLock() : host.applyStageCameraBounds(stageId))
    })
    installStageMechanics({
      scene: host,
      stageId,
      player: () => host.player,
      runtime: () => host.newPlayerRuntime,
      platforms: () => host.platformCollisionSystem,
      playerBullets: () => host.playerBullets,
      isDying: () => host.fallingToDeath,
      damagePlayer: (request) => host.requestPlayerDamage(request),
      enemies: () => host.enemySpawner?.getEntities() ?? [],
      waterFlagged: () => host.storyDirector?.waterLevelFlagHeard() ?? false
    })
  }

  rebuildBossGateBarrier(): void {
    const host = this.host
    this.destroyBossGateBarrier()
    const gateWidth = 12
    const gateHeight = Math.max(96, GAME_HEIGHT - 26)
    const gate = host.add
      .rectangle(host.bossGateLockX, GAME_HEIGHT * 0.5, gateWidth, gateHeight, 0x7ec8ff, 0.28)
      .setDepth(4)
      .setVisible(false)
      .setAlpha(0)

    host.physics.add.existing(gate, true)
    const body = gate.body as Phaser.Physics.Arcade.StaticBody | undefined
    body?.updateFromGameObject?.()
    if (body) {
      body.enable = false
    }

    this.bossGateBarrier = gate
    this.installBossGateBarrierColliders()
  }

  installBossGateBarrierColliders(): void {
    const host = this.host
    this.bossGateBarrierColliders.forEach((collider) => collider.destroy())
    this.bossGateBarrierColliders = []

    if (!host.physics || !this.bossGateBarrier) {
      return
    }

    const addCollider = (
      a: Phaser.Types.Physics.Arcade.ArcadeColliderType,
      callback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
    ) => {
      this.bossGateBarrierColliders.push(
        host.physics.add.collider(a, this.bossGateBarrier!, callback, undefined, host)
      )
    }

    if (host.player) {
      addCollider(host.player)
    }
    if (host.enemies) {
      addCollider(host.enemies)
    }
    if (host.playerBullets) {
      addCollider(host.playerBullets, host.recycleBullet)
    }
    if (host.bossBullets) {
      addCollider(host.bossBullets, host.recycleBullet)
    }
  }

  destroyBossGateBarrier(): void {
    this.bossGateBarrierColliders.forEach((collider) => collider.destroy())
    this.bossGateBarrierColliders = []
    this.bossGateBarrier?.destroy()
    this.bossGateBarrier = undefined
    this.host.bossGateLocked = false
  }

  lockBossGate(): void {
    const host = this.host
    if (host.bossGateLocked || !this.bossGateBarrier) {
      return
    }

    host.bossGateLocked = true
    const gate = this.bossGateBarrier
    gate.setVisible(true)
    host.tweens.killTweensOf(gate)
    host.tweens.add({
      targets: gate,
      alpha: { from: 0.22, to: 0.58 },
      duration: 380,
      yoyo: true,
      repeat: -1
    })

    const body = gate.body as Phaser.Physics.Arcade.StaticBody | undefined
    body?.updateFromGameObject?.()
    if (body) {
      body.enable = true
    }

    const stage = getCampaignStage(host.activeStageId)
    const respawnX = Math.max(host.bossGateLockX + 18, stage.arena.bossRoom.playerIntroX)
    const respawnY = stage.arena.spawn.y
    host.respawnPoint = new Phaser.Math.Vector2(respawnX, respawnY)
    if (host.player && host.player.x < host.bossGateLockX + 18) {
      host.player.setPosition(host.bossGateLockX + 18, host.player.y)
    }
  }

  unlockBossGate(): void {
    const host = this.host
    if (!this.bossGateBarrier) {
      host.bossGateLocked = false
      return
    }
    host.bossGateLocked = false
    host.tweens.killTweensOf(this.bossGateBarrier)
    this.bossGateBarrier.setVisible(false).setAlpha(0)
    const body = this.bossGateBarrier.body as Phaser.Physics.Arcade.StaticBody | undefined
    if (body) {
      body.enable = false
    }
  }

  installEntityPlatformCollisions(): void {
    const host = this.host
    if (!host.platformCollisionSystem) {
      return
    }

    if (host.player) {
      host.platformCollisionSystem.attachActor(asBodied(host.player), {
        allowOneWay: true,
        allowDropThrough: true
      })
    }

    if (host.enemies) {
      host.platformCollisionSystem.attachGroup(host.enemies, {
        allowOneWay: true
      })
    }

    if (host.bossBody) {
      host.platformCollisionSystem.attachActor(asBodied(host.bossBody), {
        allowOneWay: true
      })
    }

    if (host.bossTarget && host.bossTarget !== host.bossBody) {
      host.platformCollisionSystem.attachActor(asBodied(host.bossTarget), {
        allowOneWay: true
      })
    }

    this.installBossGateBarrierColliders()
  }

  installProjectilePlatformCollisions(): void {
    const host = this.host
    if (!host.physics || !host.stagePlatforms) {
      return
    }

    // Shots hit platforms by their physics body, not their drawn bounds (prompt 07 phase 7.0 note, EVAL-P7-010).
    // `playerBullets`/`bossBullets` are set earlier the same frame in `Game.create`, same as before this moved.
    host.physics.add.collider(host.playerBullets as Phaser.Physics.Arcade.Group, host.stagePlatforms, host.recycleBullet, shotPlatformProcess, host)
    host.physics.add.collider(host.bossBullets as Phaser.Physics.Arcade.Group, host.stagePlatforms, host.recycleBullet, shotPlatformProcess, host)
  }
}
