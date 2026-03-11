// @ts-nocheck
import Phaser from 'phaser'
import AudioService from '../audio'
import { BossController } from '../bosses/BossController'
import { BossId, damageMultiplier } from '../bosses/types'
import { getBossById } from '../bosses/roster'
import { getBossDefinitionById } from '../boss/config'
import { FINAL_STAGE_ID, getCampaignStage, TUTORIAL_STAGE_ID } from '../content/campaign'
import {
  getBossRoomActivationX,
  getBossRoomCameraBounds,
  getBossRoomGateX,
  getBossRoomMovementBounds
} from '../content/stageArenaLayout'
import { buildWeaponEnergySnapshot, buildWeaponOrder, getWeaponConfig, getWeaponDisplayName } from '../content/weapons'
import { DEBUG_UI } from '../config/debug'
import { STRICT_PIXEL_RENDER_POLICY } from '../config/renderPolicy'
import { returnToStageSelect, showToast } from '../core/navigation'
import InputActions from '../input/InputActions'
import { NewPlayerRuntime } from '../player/NewPlayerRuntime'
import { resolvePlayerFeatureFlags } from '../player/featureFlags'
import { resolveSwordHitboxOrigin, swordHitboxIntersectsTarget } from '../player/swordCollision'
import type { ResolvedHitbox } from '../player/types'
import { ActiveRunSaveData, Save } from '../systems/Save'
import { DebugOverlay } from '../ui/DebugOverlay'
import { HUD } from '../ui/HUD'
import { VictoryModal } from '../ui/VictoryModal'
import { BossProjectileController } from '../boss/framework/BossProjectileController'
import { BossSceneEventBindings } from '../boss/framework/BossSceneEventBindings'
import { BossUIBinder } from '../boss/framework/BossUIBinder'
import { JumpController } from './game/JumpController'
import { evaluatePauseState } from './game/pauseLogic'
import PauseScene from './PauseScene'
import GameOverScene from './GameOverScene'
import type { SystemMenuAction } from './menu/systemMenuSelector'
import {
  ENEMY_GLOBAL_TUNING,
  EnemySpawner,
  resolveEnemyFeatureFlags,
  resolveLevelEnemyMarkers
} from '../enemy'
import { CombatDebugBus } from '../tools/debug/CombatDebugBus'
import { makeGameCombatSnapshot } from '../tools/debug/StateSnapshot'
import { PlatformCollisionSystem, PlatformType } from '../physics'
import {
  createDefaultProjectileRegistry,
  spawnDebugProjectileClash,
  summarizeProjectilePool,
  ProjectileCollisionRouter,
  ProjectileRegistry,
  ProjectileSystem,
  PROJECTILES_ATLAS_KEY,
  resolvePlayerProjectileId
} from '../projectiles'

const EFFECTS_ATLAS_KEY = 'atlas_effects_core'
const HAZARD_SPIKES_FRAME = 'effects_core/core/004'
const SABER_TRAIL_FRAMES = ['effects_core/core/004', 'effects_core/core/005', 'effects_core/core/013', 'effects_core/core/021']
const CHARGE_AURA_FRAMES = ['effects_core/core/006', 'effects_core/core/007', 'effects_core/core/014', 'effects_core/core/015']
const PROJECTILE_CLASH_FRAMES = ['effects_core/core/011', 'effects_core/core/019', 'effects_core/core/003']
const PLAYER_COLLIDER_STAND = { width: 16, height: 22, offsetX: 16, offsetY: 24 }
const PLAYER_COLLIDER_SLIDE = { width: 20, height: 14, offsetX: 14, offsetY: 32 }

const JUMP_VELOCITY = -420

interface GameData {
  bossId: BossId
}

type ActionKeyMap = {
  dash: Phaser.Input.Keyboard.Key
  shoot: Phaser.Input.Keyboard.Key
  saber: Phaser.Input.Keyboard.Key
  cycleForward: Phaser.Input.Keyboard.Key
  shoulderPrev: Phaser.Input.Keyboard.Key
  shoulderNext: Phaser.Input.Keyboard.Key
  modifier: Phaser.Input.Keyboard.Key
}

type BossArtVisuals = {
  atlasKey: string
  defaultFrame: string
}

export class Game extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite
  private actionKeys!: ActionKeyMap
  private playerBullets!: Phaser.Physics.Arcade.Group
  private bossBullets!: Phaser.Physics.Arcade.Group
  private projectileRegistry!: ProjectileRegistry
  private projectileSystem!: ProjectileSystem
  private projectileCollisionRouter!: ProjectileCollisionRouter
  private hazards!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private drops?: Phaser.Physics.Arcade.Group
  private stagePlatforms?: Phaser.Physics.Arcade.StaticGroup
  private stageOneWayPlatforms?: Phaser.Physics.Arcade.StaticGroup
  private platformCollisionSystem?: PlatformCollisionSystem
  private bossGateBarrier?: Phaser.GameObjects.Rectangle
  private bossGateBarrierColliders: Phaser.Physics.Arcade.Collider[] = []
  private bossController?: BossController
  private bossLabel!: Phaser.GameObjects.Text
  private weaponLabel!: Phaser.GameObjects.Text
  private phaseLabel!: Phaser.GameObjects.Text
  // ======================= [BOSS-HITBOX-BEGIN]
  private bossBody?: Phaser.Physics.Arcade.Sprite
  private bossArt?: Phaser.GameObjects.Sprite
  private bossTarget?: Phaser.Physics.Arcade.Sprite
  private _bossSpawned = false
  private victoryTriggered = false
  private bossDeathHandled = false
  private gameOverTriggered = false
  private victoryModal?: VictoryModal
  private bossHitFeedbackTimer?: Phaser.Time.TimerEvent

  private spawnGroundSlamHazard(origin: Phaser.GameObjects.GameObject, attackData?: any): void {
    if (!this.hazards) {
      return
    }
    const radius = Math.max(24, Number(attackData?.params?.radius ?? 72))
    const duration = Math.max(200, Number(attackData?.params?.hazardDuration ?? 700))
    const rings = 3
    for (let i = 0; i < rings; i += 1) {
      const x = origin.x + (i - 1) * (radius * 0.45)
      const hazard = this.hazards.create(x, origin.y + 16, EFFECTS_ATLAS_KEY, HAZARD_SPIKES_FRAME)
      hazard.refreshBody()
      hazard.setAlpha(0.9 - i * 0.2)
      this.time.delayedCall(duration + i * 90, () => hazard.destroy())
    }
  }
  private bossProjectileController?: BossProjectileController

  private spawnBossOnce(cb: () => void): void {
    if (this._bossSpawned) {
      return
    }

    this._bossSpawned = true
    cb()
    this.syncBossArt()
  }

  private syncBossArt(): void {
    if (!this.bossArt) {
      return
    }

    const source = (this.bossController ? this.bossTarget : this.bossBody) ?? this.bossBody
    if (!source) {
      return
    }

    this.bossArt.setPosition(source.x, source.y)

    const body = source.body as Phaser.Physics.Arcade.Body | undefined
    if (body && body.velocity.x !== 0) {
      this.bossArt.setFlipX(body.velocity.x < 0)
    }
  }

  private createBossProjectileTrailEmitter(
    bullet: Phaser.Physics.Arcade.Sprite
  ): Phaser.GameObjects.Particles.ParticleEmitter | null {
    const emitter = this.add.particles(0, 0, 'px', {
      lifespan: 180,
      speed: 0,
      quantity: 1,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.7, end: 0 },
      follow: bullet
    })
    emitter.setDepth(1)
    return emitter
  }

  private initializeBossProjectileController(): void {
    if (!this.projectileSystem || !this.bossBullets) {
      return
    }

    this.bossProjectileController = new BossProjectileController({
      projectileSystem: this.projectileSystem,
      projectileGroup: this.bossBullets,
      getNow: () => this.time.now,
      isEncounterActive: () => this.bossEncounterActive,
      isControllerDriven: () => Boolean(this.bossController),
      getPlayerPosition: () => (this.player?.active ? { x: this.player.x, y: this.player.y } : null),
      getBossOrigin: () => (this.bossTarget ?? this.bossBody) ?? null,
      getBossMovementBody: () => {
        const origin = (this.bossTarget ?? this.bossBody) as Phaser.Physics.Arcade.Sprite | undefined
        return origin?.body as Phaser.Physics.Arcade.Body | undefined
      },
      getTrailTint: () => this.bossController?.blueprint.theme.trail ?? 0x55ccff,
      createTrailEmitter: (bullet) => this.createBossProjectileTrailEmitter(bullet),
      registerProjectile: (bullet, kind) => this.devRegister(bullet, kind),
      playAttackSfx: (name) => AudioService.playSfx(name),
      setActionLabel: (text) => {
        if (this.phaseLabel) {
          this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}\n${text}`)
        }
      },
      playShootAnimation: () => {
        if (this.bossArt) {
          this.playAnimationSafe(this.bossArt, 'boss_shoot', true)
        }
      },
      restoreWalkAnimation: () => {
        if (this.bossArt?.anims) {
          this.playAnimationSafe(this.bossArt, 'boss_walk', true)
        }
      },
      spawnGroundSlamHazard: (origin, attackData) => this.spawnGroundSlamHazard(origin, attackData),
      log: (level, message, payload) => {
        if (typeof window === 'undefined' || !(window as any).__DEV__) {
          return
        }
        const logger = console[level] ?? console.log
        logger.call(console, message, payload)
      }
    })
  }
  // ======================= [BOSS-HITBOX-END]
  private hud?: HUD
  private bossUiBinder?: BossUIBinder
  private bossSceneEvents?: BossSceneEventBindings
  private isChargingShot = false
  private chargeStartedAt = 0
  private currentWeaponIndex = 0
  private weapons: string[] = ['Buster']
  private weaponEnergyById: Record<string, number> = buildWeaponEnergySnapshot([])
  private dashActive = false
  private dashTimer = 0
  private dashCooldownTimer = 0
  private readonly dashDuration = 140
  private readonly dashCooldown = 420
  private saberComboStep = 0
  private saberComboTimer = 0
  private readonly saberComboWindow = 320
  private facing: 1 | -1 = 1
  private usingSlideHitbox = false
  private slideUntil = 0
  private readonly slideDuration = 260
  private currentPhaseName = ''
  private animationLockUntil = 0
  // [REGION: CHARGE-AURA - BEGIN]
  private chargeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter
  private charging = false
  private fullyCharged = false
  // [REGION: CHARGE-AURA - END]
  private debugOverlay?: DebugOverlay
  private readonly combatDebugBus = new CombatDebugBus()
  private readonly jumpController = new JumpController(JUMP_VELOCITY)
  private readonly playerFeatureFlags = resolvePlayerFeatureFlags()
  private readonly enemyFeatureFlags = resolveEnemyFeatureFlags()
  private newPlayerRuntime?: NewPlayerRuntime
  private enemySpawner?: EnemySpawner
  private debugToggleHandler?: () => void
  private preventScrollHandler?: (event: KeyboardEvent) => void
  private pauseOverlay?: Phaser.GameObjects.Container
  private paused = false
  private jumpKey?: Phaser.Input.Keyboard.Key
  private dropJumpHeld = false
  private playerMaxHp = 0
  private playerHp = 0
  private weaponEnergy = { current: 28, max: 28 }
  private playerLives = 0
  private respawnPoint?: Phaser.Math.Vector2
  private currentCheckpointIndex = 0
  private bossEncounterActive = false
  private bossActivationX = 0
  private bossGateLockX = 0
  private bossGateLocked = false
  private bossRoomCameraLocked = false
  private activeBossRoom?: { x: number; width: number; playerIntroX: number; bossSpawnX: number; lockCamera: true; leftInset: number; rightInset: number }
  private fallingToDeath = false
  private bossHp?: { current: number; max: number }
  private bossName?: string
  private activeBossId?: BossId
  private activeStageId = 'pyro_maw'
  private loadedFromSave = false
  private bossUsingPlaceholder = false
  private stageBackgroundLayers: Phaser.GameObjects.TileSprite[] = []
  private scaleResizeHandler?: Phaser.Types.Core.ScaleEventCallback
  private _devOn = false
  private _devInitOnce = false
  private _devPanel!: Phaser.GameObjects.Text
  private _devGfx!: Phaser.GameObjects.Graphics
  private _devTick = 0
  private _registry = new Map<number, { kind: string; ref: any; label: Phaser.GameObjects.Text }>()
  private _eid = 1
  private readonly missingAnimationWarnings = new Set<string>()
  // ======================= [DEV-UX-BEGIN]
  private readonly _dev = {
    on: false,
    initOnce: false,
    tick: 0,
    panel: undefined as Phaser.GameObjects.Text | undefined,
    gfx: undefined as Phaser.GameObjects.Graphics | undefined,
    entries: new Map<
      number,
      {
        kind: string
        ref: (Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.Body }) | undefined
        label: Phaser.GameObjects.Text
      }
    >(),
    nextId: 1
  }
  // ======================= [DEV-UX-END]

  // [REGION: STAGE-BUILDER - BEGIN]
  private clearStageBackgroundLayers(): void {
    this.stageBackgroundLayers.forEach((layer) => layer.destroy())
    this.stageBackgroundLayers = []
  }

  private renderStageBackground(stageId: string, worldWidth: number): void {
    this.clearStageBackgroundLayers()

    const stage = getCampaignStage(stageId)
    const { height } = this.scale
    const layers = stage.arena.background?.layers ?? []
    layers.forEach((layer, index) => {
      if (!this.textures.exists(layer.key)) {
        return
      }
      const tileSprite = this.add
        .tileSprite(0, layer.y, worldWidth, Math.max(16, height - layer.y), layer.key)
        .setOrigin(0, 0)
        .setScrollFactor(layer.scrollFactorX, 1)
        .setDepth(-40 + index)

      if (typeof layer.alpha === 'number') {
        tileSprite.setAlpha(layer.alpha)
      }
      if (typeof layer.tint === 'number') {
        tileSprite.setTint(layer.tint)
      }

      this.stageBackgroundLayers.push(tileSprite)
    })
  }

  private applyStageCameraBounds(stageId: string): void {
    const stage = getCampaignStage(stageId)
    const worldWidth = Math.max(this.scale.width, Number(stage.arena.width ?? this.scale.width))
    this.cameras.main.setBounds(0, 0, worldWidth, this.scale.height)
    this.bossRoomCameraLocked = false
  }

  private applyBossRoomCameraLock(): void {
    if (!this.activeBossRoom?.lockCamera) {
      return
    }
    const bounds = getBossRoomCameraBounds(this.activeBossRoom, this.scale.height)
    this.cameras.main.setBounds(bounds.x, bounds.y, bounds.width, bounds.height)
    this.cameras.main.scrollX = Phaser.Math.Clamp(
      this.cameras.main.scrollX,
      bounds.x,
      bounds.x + bounds.width - this.cameras.main.width
    )
    this.bossRoomCameraLocked = true
  }

  private buildStage(stageId: string): void {
    const stage = getCampaignStage(stageId)
    const cfg = stage.arena
    const { width, height } = this.scale
    const worldWidth = Math.max(width, Number(cfg.width ?? width))
    this.activeBossRoom = cfg.bossRoom

    this.physics.world.setBounds(0, 0, worldWidth, height, true, cfg.leftWall, cfg.rightWall, true)
    this.physics.world.setBoundsCollision(cfg.leftWall, cfg.rightWall, true, !cfg.allowFallOff)
    this.applyStageCameraBounds(stageId)
    this.cameras.main.setBackgroundColor(cfg.background.baseColor ?? cfg.backgroundColor ?? '#0b1220')
    this.renderStageBackground(stageId, worldWidth)

    this.platformCollisionSystem?.destroy()
    this.platformCollisionSystem = new PlatformCollisionSystem(this)

    const platforms = [
      {
        id: `${stage.id}_main_ground`,
        x: worldWidth / 2,
        y: height - 8,
        width: worldWidth,
        height: 16,
        type: 'solid' as const,
        color: 0x1a2230
      },
      ...cfg.midPlatforms.map((platform) => ({
        id: platform.id,
        x: platform.x,
        y: platform.y,
        width: platform.width,
        height: platform.height ?? 8,
        type: platform.type ?? 'oneWay',
        color: platform.color ?? 0x33404f,
        motion: platform.motion
      }))
    ]

    this.platformCollisionSystem.rebuild(platforms)
    this.stagePlatforms = this.platformCollisionSystem.getSolidGroup()
    this.stageOneWayPlatforms = this.platformCollisionSystem.getOneWayGroup()
    this.bossGateLockX = getBossRoomGateX(cfg.bossRoom)
    this.bossGateLocked = false
    this.bossRoomCameraLocked = false
    this.installEntityPlatformCollisions()
  }

  private rebuildBossGateBarrier(): void {
    this.destroyBossGateBarrier()
    const gateWidth = 12
    const gateHeight = Math.max(96, this.scale.height - 26)
    const gate = this.add
      .rectangle(this.bossGateLockX, this.scale.height * 0.5, gateWidth, gateHeight, 0x7ec8ff, 0.28)
      .setDepth(4)
      .setVisible(false)
      .setAlpha(0)

    this.physics.add.existing(gate, true)
    const body = gate.body as Phaser.Physics.Arcade.StaticBody | undefined
    body?.updateFromGameObject?.()
    if (body) {
      body.enable = false
    }

    this.bossGateBarrier = gate
    this.installBossGateBarrierColliders()
  }

  private installBossGateBarrierColliders(): void {
    this.bossGateBarrierColliders.forEach((collider) => collider.destroy())
    this.bossGateBarrierColliders = []

    if (!this.physics || !this.bossGateBarrier) {
      return
    }

    const addCollider = (
      a: Phaser.Types.Physics.Arcade.ArcadeColliderType,
      callback?: Phaser.Types.Physics.Arcade.ArcadePhysicsCallback
    ) => {
      this.bossGateBarrierColliders.push(
        this.physics.add.collider(a, this.bossGateBarrier!, callback, undefined, this)
      )
    }

    if (this.player) {
      addCollider(this.player)
    }
    if (this.enemies) {
      addCollider(this.enemies)
    }
    if (this.playerBullets) {
      addCollider(this.playerBullets, this.recycleBullet)
    }
    if (this.bossBullets) {
      addCollider(this.bossBullets, this.recycleBullet)
    }
  }

  private destroyBossGateBarrier(): void {
    this.bossGateBarrierColliders.forEach((collider) => collider.destroy())
    this.bossGateBarrierColliders = []
    this.bossGateBarrier?.destroy()
    this.bossGateBarrier = undefined
    this.bossGateLocked = false
  }

  private lockBossGate(): void {
    if (this.bossGateLocked || !this.bossGateBarrier) {
      return
    }

    this.bossGateLocked = true
    const gate = this.bossGateBarrier
    gate.setVisible(true)
    this.tweens.killTweensOf(gate)
    this.tweens.add({
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

    const stage = getCampaignStage(this.activeStageId)
    const respawnX = Math.max(this.bossGateLockX + 18, stage.arena.bossRoom.playerIntroX)
    const respawnY = stage.arena.spawn.y
    this.respawnPoint = new Phaser.Math.Vector2(respawnX, respawnY)
    if (this.player && this.player.x < this.bossGateLockX + 18) {
      this.player.setPosition(this.bossGateLockX + 18, this.player.y)
    }
  }

  private unlockBossGate(): void {
    if (!this.bossGateBarrier) {
      this.bossGateLocked = false
      return
    }
    this.bossGateLocked = false
    this.tweens.killTweensOf(this.bossGateBarrier)
    this.bossGateBarrier.setVisible(false).setAlpha(0)
    const body = this.bossGateBarrier.body as Phaser.Physics.Arcade.StaticBody | undefined
    if (body) {
      body.enable = false
    }
  }

  private installEntityPlatformCollisions(): void {
    if (!this.platformCollisionSystem) {
      return
    }

    if (this.player) {
      this.platformCollisionSystem.attachActor(this.player, {
        allowOneWay: true,
        allowDropThrough: true
      })
    }

    if (this.enemies) {
      this.platformCollisionSystem.attachGroup(this.enemies, {
        allowOneWay: true
      })
    }

    if (this.bossBody) {
      this.platformCollisionSystem.attachActor(this.bossBody, {
        allowOneWay: true
      })
    }

    if (this.bossTarget && this.bossTarget !== this.bossBody) {
      this.platformCollisionSystem.attachActor(this.bossTarget, {
        allowOneWay: true
      })
    }

    this.installBossGateBarrierColliders()
  }

  private updateRespawnCheckpoint(): void {
    if (!this.player) {
      return
    }
    const stage = getCampaignStage(this.activeStageId)
    const nextCheckpoint = stage.arena.checkpoints[this.currentCheckpointIndex + 1]
    if (!nextCheckpoint || this.player.x < nextCheckpoint.triggerX) {
      return
    }
    this.currentCheckpointIndex += 1
    this.respawnPoint = new Phaser.Math.Vector2(nextCheckpoint.x, nextCheckpoint.y)
    this.showStageToast(`Checkpoint ${this.currentCheckpointIndex + 1}`, 900)
    if (this.currentCheckpointIndex >= stage.arena.checkpoints.length - 1 || this.player.x >= stage.arena.bossRoom.x) {
      this.activateBossEncounter()
    }
  }

  private updateBossEncounterActivation(): void {
    if (this.bossEncounterActive || !this.player || this.victoryTriggered || this.bossDeathHandled) {
      return
    }
    if (this.player.x < this.bossActivationX) {
      return
    }
    this.activateBossEncounter()
  }

  private activateBossEncounter(): void {
    if (this.bossEncounterActive) {
      return
    }
    this.bossEncounterActive = true
    this.lockBossGate()
    this.applyBossRoomCameraLock()
    AudioService.playMusic(this, 'boss')
    AudioService.playSfx('boss_activate')
    this.bossController?.unlockIntro()
    const phase = this.bossController?.currentPhase
    if (phase) {
      this.currentPhaseName = phase.name.toUpperCase()
      this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}`)
    } else {
      this.phaseLabel.setText('BOSS • ACTIVE')
    }
    this.bossUiBinder?.onFightStart()
    this.hud?.setBossBarVisible(Boolean(this.bossHp))
    this.showStageToast('Boss room sealed', 1000)
  }

  private checkStageKillPlane(): void {
    if (!this.player || !this.player.active || this.fallingToDeath) {
      return
    }
    const stage = getCampaignStage(this.activeStageId)
    if (!stage.arena.allowFallOff) {
      return
    }
    if (this.player.y <= this.scale.height + 40) {
      return
    }
    this.killPlayer('pit')
  }

  private killPlayer(reason: 'pit' | 'debug' | 'damage'): void {
    if (!this.player || this.fallingToDeath) {
      return
    }
    if (reason === 'pit') {
      this.recordCombatHit('system', 'player', this.playerHp, 'fall', true, 'pit')
    }
    this.playerHp = 0
    this.player.data?.set?.('hp', this.playerHp)
    this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)
    this.fallingToDeath = true
    this.playerDeathAndRespawn()
  }

  private showStageToast(message: string, durationMs = 1200): void {
    showToast(this, message, durationMs)
  }

  private installProjectilePlatformCollisions(): void {
    if (!this.physics || !this.stagePlatforms) {
      return
    }

    this.physics.add.collider(this.playerBullets, this.stagePlatforms, this.recycleBullet, undefined, this)
    this.physics.add.collider(this.bossBullets, this.stagePlatforms, this.recycleBullet, undefined, this)
  }

  private handleDropThroughInput(now: number): void {
    if (!this.player || !this.newPlayerRuntime || !this.platformCollisionSystem) {
      return
    }

    const jumpHeld = Boolean(this.jumpKey?.isDown)
    const jumpPressed = jumpHeld && !this.dropJumpHeld
    this.dropJumpHeld = jumpHeld
    if (!jumpPressed || !this.cursors.down?.isDown) {
      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined
    const grounded = Boolean(body?.onFloor?.() || body?.blocked.down)
    if (!grounded) {
      return
    }

    const dropped = this.platformCollisionSystem.requestDropThrough(this.player, now, 240)
    if (!dropped) {
      return
    }

    this.newPlayerRuntime.suppressJumpFor(220)
    if (body && body.velocity.y < 120) {
      body.setVelocityY(120)
    }
  }
  // [REGION: STAGE-BUILDER - END]

  private readonly handleWorldBounds = (body: Phaser.Physics.Arcade.Body) => {
    const sprite = body.gameObject as Phaser.Physics.Arcade.Sprite | null
    if (!sprite) {
      return
    }
    if (this.playerBullets?.contains(sprite) || this.bossBullets?.contains(sprite)) {
      this.recycleBullet(sprite, undefined)
    }
  }

  constructor() {
    super('Game')
  }

  // ======================= [OVERLAPS-BEGIN]
  private bossHitWire?: Phaser.Physics.Arcade.Collider
  private playerHitWire?: Phaser.Physics.Arcade.Collider
  private projectileClashWire?: Phaser.Physics.Arcade.Collider

  private installHitWires(): void {
    if (!this.physics) {
      return
    }

    this.bossHitWire?.destroy()
    this.playerHitWire?.destroy()
    this.projectileClashWire?.destroy()
    this.bossHitWire = undefined
    this.playerHitWire = undefined
    this.projectileClashWire = undefined

    const target = this.bossTarget
    if (target) {
      const body = target.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = true
        body.allowGravity = body.allowGravity ?? false
      }
      target.setDataEnabled?.()
      if (target.data?.get('maxHp') == null) target.data?.set('maxHp', 20)
      if (target.data?.get('hp') == null) target.data?.set('hp', target.data?.get('maxHp') ?? 20)

      if (this.playerBullets) {
        this.bossHitWire = this.physics.add.overlap(
          this.playerBullets,
          target,
          (a, b) => this.projectileCollisionRouter.handlePlayerBulletHitsBoss(a, b, target),
          undefined,
          this
        )
      }
    }

    if (this.player && this.bossBullets) {
      this.playerHitWire = this.physics.add.overlap(
        this.player,
        this.bossBullets,
        (playerObj, bulletObj) => this.projectileCollisionRouter.handleEnemyBulletHitsPlayer(playerObj, bulletObj),
        undefined,
        this
      )
    }

    if (this.playerBullets && this.bossBullets) {
      this.projectileClashWire = this.physics.add.overlap(
        this.playerBullets,
        this.bossBullets,
        (playerBulletObj, enemyBulletObj) =>
          this.projectileCollisionRouter.handleProjectileClash(playerBulletObj, enemyBulletObj),
        undefined,
        this
      )
    }
  }

  private recordCombatHit(
    source: 'player' | 'enemy' | 'boss' | 'hazard' | 'system',
    target: 'player' | 'enemy' | 'boss' | 'environment',
    amount: number,
    kind: string,
    accepted: boolean,
    note?: string
  ): void {
    this.combatDebugBus.record({
      timeMs: this.time?.now ?? 0,
      source,
      target,
      amount,
      kind,
      accepted,
      note
    })
  }
  // ======================= [OVERLAPS-END]

  private devInit() {
    if (this._dev.initOnce) return
    this._dev.initOnce = true

    this._dev.panel = this.add
      .text(8, 40, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#b0e0ff',
        lineSpacing: 2
      })
      .setScrollFactor(0)
      .setDepth(10001)
    this._dev.gfx = this.add.graphics().setDepth(10000)

    const world = this.physics.world as any
    world.drawDebug = false
    world.createDebugGraphic?.()
    world.debugGraphic?.clear?.()
    world.debugGraphic?.setVisible?.(false)

    const dump = () => {
      const rows = Array.from(this._dev.entries.values()).map(({ kind, ref }) => ({
        eid: ref?.data?.get?.('eid'),
        kind,
        owner: ref?.data?.get?.('owner'),
        hp: ref?.data?.get?.('hp'),
        maxHp: ref?.data?.get?.('maxHp'),
        active: !!ref?.active,
        visible: !!ref?.visible,
        bodyEnabled: !!ref?.body?.enable,
        immovable: !!ref?.body?.immovable,
        x: Math.round((ref as any)?.x ?? 0),
        y: Math.round((ref as any)?.y ?? 0),
        vx: Math.round(ref?.body?.velocity?.x ?? 0),
        vy: Math.round(ref?.body?.velocity?.y ?? 0),
        w: Math.round(ref?.body?.width ?? (ref as any)?.width ?? 0),
        h: Math.round(ref?.body?.height ?? (ref as any)?.height ?? 0),
        checkColl: ref?.body?.checkCollision ? { ...ref.body.checkCollision } : null
      }))
      console.table(rows)
      return rows
    }

    ;(window as any).dump = dump
    ;(window as any).bossDebug = {
      damage: (amount = 1) => this.applyDamageToBoss(amount),
      forceVictory: () => this.onBossDefeated(),
      unlockIntro: () => this.bossController?.unlockIntro(),
      hp: () => this.bossHp
    }
    ;(window as any).stageDebug = {
      checkpointIndex: () => this.currentCheckpointIndex,
      enemyStream: () => this.enemySpawner?.getStreamDebugSnapshot?.() ?? null,
      projectilePools: () => ({
        player: summarizeProjectilePool(this.playerBullets),
        enemy: summarizeProjectilePool(this.bossBullets)
      }),
      forcePlayerDeath: () => this.killPlayer('debug'),
      activateBossRoom: () => this.activateBossEncounter(),
      spawnProjectileClash: (options?: { strong?: boolean } | boolean) => {
        if (!this.player || !this.playerBullets || !this.bossBullets) {
          return null
        }
        const strong = typeof options === 'boolean' ? options : Boolean(options?.strong)
        const clashX = this.player.x + 96
        const clashY = this.player.y - 6
        return spawnDebugProjectileClash({
          playerGroup: this.playerBullets,
          enemyGroup: this.bossBullets,
          clashX,
          clashY,
          spawnPlayerProjectile: () =>
            this.fireBulletFromRuntime({
              speed: strong ? 300 : 260,
              damage: strong ? 3 : 1,
              scale: strong ? 1.35 : 1,
              chargeLevel: strong ? 2 : 0,
              facing: 1
            }),
          spawnEnemyProjectile: () =>
            this.devRegister(
              this.projectileSystem?.spawn({
                id: 'enemy_basic_shot',
                x: this.player.x + 12,
                y: this.player.y - 6,
                direction: -1,
                speed: 220,
                damage: 1,
                velocity: { x: -220, y: 0 },
                tint: this.bossController?.blueprint.theme.trail ?? 0x55ccff,
                metadata: {
                  attack: strong ? 'debug-projectile-clash-strong' : 'debug-projectile-clash',
                  ignoreBossUntil: this.time.now + 120
                }
              }) ?? undefined,
              'bullet.enemy'
            )
        })
      },
      setPlayerX: (x: number) => {
        if (!this.player) {
          return null
        }
        this.player.setPosition(x, this.player.y)
        return { x: this.player.x, y: this.player.y }
      },
      crossNextCheckpoint: () => {
        if (!this.player) {
          return null
        }
        const stage = getCampaignStage(this.activeStageId)
        const nextCheckpoint = stage.arena.checkpoints[this.currentCheckpointIndex + 1]
        if (!nextCheckpoint) {
          return null
        }
        this.player.setPosition(nextCheckpoint.triggerX + 8, this.player.y)
        return { x: this.player.x, triggerX: nextCheckpoint.triggerX, nextCheckpointId: nextCheckpoint.id }
      },
      crossBossGate: () => {
        if (!this.player) {
          return null
        }
        this.player.setPosition(this.bossActivationX + 8, this.player.y)
        return {
          x: this.player.x,
          bossActivationX: this.bossActivationX,
          bossRoomX: this.activeBossRoom?.x ?? null
        }
      },
      damagePlayer: (amount = 1) => {
        this.applyDamageToPlayer(amount)
        return { hp: this.playerHp, maxHp: this.playerMaxHp }
      },
      spawnPickup: (type: 'health' | 'ammo' | 'bonus' = 'health') => {
        if (!this.player) {
          return null
        }
        const pickup = this.spawnEnemyDrop(this.player.x, this.player.y - 18, type)
        return pickup ? { type, x: pickup.x, y: pickup.y, active: pickup.active } : null
      },
      spawnHostileProjectile: () => {
        if (!this.player || !this.projectileSystem) {
          return null
        }
        const projectile = this.devRegister(
          this.projectileSystem.spawn({
            id: 'enemy_basic_shot',
            x: this.player.x + 84,
            y: this.player.y - 10,
            direction: -1,
            speed: 210,
            damage: 1,
            velocity: { x: -210, y: 0 },
            metadata: {
              attack: 'debug-respawn-projectile',
              ignoreBossUntil: this.time.now + 120
            }
          }) ?? undefined,
          'bullet.enemy'
        )
        return projectile ? { x: projectile.x, y: projectile.y, active: projectile.active } : null
      },
      bossGateState: () => ({
        locked: this.bossGateLocked,
        x: this.bossGateLockX,
        bossRoomX: this.activeBossRoom?.x ?? null,
        bossRoomWidth: this.activeBossRoom?.width ?? null,
        cameraLocked: this.bossRoomCameraLocked
      })
    }

    const toggleOverlay = () => {
      this._dev.on = !this._dev.on
      if (!this._dev.on) {
        this._dev.panel?.setText('')
        this._dev.gfx?.clear()
      }
    }
    const handleDump = () => dump()
    const handlePhysics = () => {
      const arcadeWorld = this.physics.world as any
      arcadeWorld.drawDebug = !arcadeWorld.drawDebug
      arcadeWorld.debugGraphic?.clear?.()
      arcadeWorld.debugGraphic?.setVisible?.(arcadeWorld.drawDebug)
    }

    const keyboard = this.input.keyboard
    if (keyboard) {
      keyboard.on('keydown-BACKTICK', toggleOverlay)
      keyboard.on('keydown-D', handleDump)
      keyboard.on('keydown-BACKSLASH', handlePhysics)

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.input.keyboard?.off('keydown-BACKTICK', toggleOverlay)
        this.input.keyboard?.off('keydown-D', handleDump)
        this.input.keyboard?.off('keydown-BACKSLASH', handlePhysics)
        if ((window as any).dump === dump) {
          delete (window as any).dump
        }
        delete (window as any).bossDebug
        delete (window as any).stageDebug
      })
    }
  }

  private devRegister<T extends Phaser.GameObjects.GameObject & { data?: Phaser.Data.DataManager }>(
    ref: T | undefined,
    kind: string
  ): T | undefined {
    if (!ref) return ref

    const anyRef = ref as any
    anyRef.setDataEnabled?.()
    const data = anyRef.data as Phaser.Data.DataManager | undefined
    let id = data?.get?.('eid') as number | undefined
    if (id == null) {
      id = this._dev.nextId++
      data?.set?.('eid', id)
    }
    data?.set?.('kind', kind)

    let entry = this._dev.entries.get(id)
    if (!entry) {
      const label = this.add
        .text(anyRef.x ?? 0, (anyRef.y ?? 0) - 12, '', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#7fffd4'
        })
        .setDepth(10000)
      entry = { kind, ref, label }
      this._dev.entries.set(id, entry)
    } else {
      entry.kind = kind
      entry.ref = ref
    }

    return ref
  }

  private devUpdate() {
    if (!this._dev.on) {
      this._dev.panel?.setText('')
      this._dev.gfx?.clear()
      return
    }
    if (this.time.now < this._dev.tick) return
    this._dev.tick = this.time.now + 180

    this._dev.gfx?.clear()

    const camera = this.cameras.main
    const pad = 128
    const view = camera.worldView
    const left = view.left - pad
    const right = view.right + pad
    const top = view.top - pad
    const bottom = view.bottom + pad

    const lines: string[] = ['` overlay  D dump  \\ physics', '─ entities near camera ─']

    for (const { kind, ref, label } of this._dev.entries.values()) {
      if (!ref?.active) {
        label.setVisible(false)
        continue
      }

      const anyRef = ref as any
      const posx = Math.round(anyRef?.x ?? 0)
      const posy = Math.round(anyRef?.y ?? 0)
      const withinView = posx >= left && posx <= right && posy >= top && posy <= bottom
      label.setVisible(withinView)

      if (withinView) {
        const id = ref?.data?.get?.('eid')
        const hp = ref?.data?.get?.('hp')
        const mxhp = ref?.data?.get?.('maxHp')
        const own = ref?.data?.get?.('owner')
        const vx = Math.round(ref?.body?.velocity?.x ?? 0)
        const vy = Math.round(ref?.body?.velocity?.y ?? 0)

        label
          .setText(`#${id} ${kind}`)
          .setPosition((anyRef?.x ?? 0) - 18, (anyRef?.y ?? 0) - 16)

        const body = ref?.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          this._dev.gfx?.lineStyle(1, 0x2afe6f, 1)
          this._dev.gfx?.strokeRect(body.x, body.y, body.width, body.height)
        }

        const detailParts = [`#${id}`, kind]
        if (own) detailParts.push(`owner:${own}`)
        detailParts.push(`hp:${hp ?? '-'}/${mxhp ?? '-'}`, `xy:${posx},${posy}`, `v:${vx},${vy}`)
        lines.push(detailParts.join(' '))
      }
    }

    this._dev.panel?.setText(lines.join('\n'))
  }

  private devLogOverlap(tag: string, bullet: any, target: any, accepted: boolean, reason: string) {
    const bId = bullet?.data?.get?.('eid')
    const tId = target?.data?.get?.('eid')
    const status = accepted ? 'ACCEPT' : 'BLOCK '
    const msg = `[COLLIDE] ${tag} ${status} b#${bId ?? '-'} -> t#${tId ?? '-'} :: ${reason}`
    console.log(msg, {
      bulletOwner: bullet?.data?.get?.('owner'),
      bulletBody: !!bullet?.body?.enable,
      targetKind: target?.data?.get?.('kind'),
      targetBody: !!target?.body?.enable
    })
  }

  // ======================= [AI-UPDATE-BEGIN]
  private bossUpdate(now: number): void {
    this.syncBossArt()

    if (!this.bossEncounterActive || !this.bossBody || !this.bossBody.active || this.bossController) {
      return
    }

    const body = this.bossBody.body as Phaser.Physics.Arcade.Body | undefined
    if (!body) {
      return
    }

    if (body.blocked.left) {
      this.bossBody.setVelocityX(60)
    } else if (body.blocked.right) {
      this.bossBody.setVelocityX(-60)
    } else if (body.velocity.x === 0) {
      const direction = this.player && this.player.x < this.bossBody.x ? -1 : 1
      this.bossBody.setVelocityX(60 * direction)
    }
  }

  private updateBossControllerSafe(): void {
    const controller = this.bossController
    if (!controller) {
      return
    }
    if (!this.bossEncounterActive) {
      return
    }
    if (!controller.active || controller.scene !== this) {
      this.bossController = undefined
      return
    }
    if (this.victoryTriggered || this.bossDeathHandled) {
      return
    }
    controller.update(this.time.now, this.game.loop.delta)
  }
  // ======================= [AI-UPDATE-END]

  create(data: GameData): void {
    this.combatDebugBus.clear()

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null

    this.ensurePlayerBulletTexture()
    this.ensureSlashTexture()

    if (!this.textures.exists('px')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 2, 2)
      g.generateTexture('px', 2, 2)
      g.destroy()
    }

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.combatDebugBus.clear()
      this.physics?.world?.off?.('worldbounds', this.handleWorldBounds, this)
      this.physics?.world?.off?.(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.handleWorldBounds)
      this.bossSceneEvents?.destroy()
      this.bossSceneEvents = undefined
      this.bossProjectileController?.stop()
      this.bossProjectileController = undefined
      this.chargeEmitter?.stop()
      this.chargeEmitter?.destroy()
      this.chargeEmitter = undefined
      this.physics?.world?.colliders?.destroy?.()
      this.platformCollisionSystem?.destroy()
      this.platformCollisionSystem = undefined
      this.clearStageBackgroundLayers()
      this.destroyBossGateBarrier()
      this.stagePlatforms = undefined
      this.stageOneWayPlatforms = undefined
      this.activeBossRoom = undefined
      this.bossRoomCameraLocked = false
      this.playerBullets = undefined as unknown as Phaser.Physics.Arcade.Group
      this.bossBullets = undefined as unknown as Phaser.Physics.Arcade.Group
      this.hazards = undefined as unknown as Phaser.Physics.Arcade.StaticGroup
      this.enemies = undefined as unknown as Phaser.Physics.Arcade.Group
      this.drops = undefined
      this.newPlayerRuntime?.destroy()
      this.newPlayerRuntime = undefined
      this.enemySpawner?.destroy()
      this.enemySpawner = undefined
      if (typeof window !== 'undefined' && (window as any).spawnEnemyDebug) {
        delete (window as any).spawnEnemyDebug
      }
      this.bossUiBinder = undefined
      this.victoryModal?.destroy()
      this.victoryModal = undefined
      this.setPaused(false)
      this.dropJumpHeld = false
    })

    const manager = this.scene.manager
    if (!manager.keys['Pause']) {
      this.scene.add('Pause', PauseScene, false)
    }
    if (!manager.keys['GameOver']) {
      this.scene.add('GameOver', GameOverScene, false)
    }

    this.devInit()
    const loadFromSave = Boolean((data as any)?.loadFromSave)
    this.loadedFromSave = loadFromSave
    const activeRun = loadFromSave ? Save.loadActiveRun() : null
    const stageId = activeRun?.stageId ?? (data as any)?.stageId ?? ((data as any)?.bossId as string) ?? 'pyro_maw'
    const stage = getCampaignStage(stageId)
    const bossIdFromQuery = params?.get('bossId') as BossId | null
    const selectedBossId =
      (activeRun?.bossId as BossId | undefined) ?? bossIdFromQuery ?? data.bossId ?? stage.bossId
    this.activeBossId = selectedBossId
    this.activeStageId = stage.id
    const blueprint = getBossById(selectedBossId)
    const runtimeDefinitionId = params?.get('bossConfig') ?? (data as any)?.runtimeBossConfigId ?? stage.runtimeBossConfigId
    const runtimeDefinition = runtimeDefinitionId ? getBossDefinitionById(runtimeDefinitionId) : undefined
    const bossMaxHp = runtimeDefinition?.maxHP ?? blueprint.baseStats?.maxHp ?? 20
    const bossCodename = runtimeDefinition?.displayName ?? blueprint.codename ?? blueprint.id
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor(stage.arena.background.baseColor ?? stage.arena.backgroundColor ?? '#0e1622')
    this.cameras.main.fadeIn(140, 8, 16, 30)

    ;(this as any).stageId = stageId
    ;(this as any).rewardWeapon = stage.rewardEnabled ? stage.rewardWeaponId ?? blueprint.weaponReward?.id : undefined
    this.victoryTriggered = false
    this.bossDeathHandled = false
    this.gameOverTriggered = false
    this.fallingToDeath = false
    this.bossEncounterActive = false
    this.activeBossRoom = stage.arena.bossRoom
    this.bossActivationX = getBossRoomActivationX(stage.arena.bossRoom)
    this.bossRoomCameraLocked = false
    this.victoryModal?.destroy()
    this.victoryModal = undefined

    InputActions.init(this)
    AudioService.playMusic(this, stage.id === FINAL_STAGE_ID ? 'final' : 'stage')
    const unlockAudio = () => AudioService.unlock()
    this.input.keyboard?.once('keydown', unlockAudio)
    this.input.once('pointerdown', unlockAudio)
    this.installScrollGuards()
    this.createPauseOverlay(width, height)

    const escHandler = (event: KeyboardEvent) => {
      event.preventDefault()
      if (this.victoryModal?.isOpen()) {
        this.victoryModal.confirm()
        return
      }
      if (this.scene.isActive('SystemMenu')) {
        AudioService.playSfx('pause_resume')
        this.scene.stop('SystemMenu')
        this.onSystemMenuAction('resume')
        return
      }
      this.setPaused(true)
      AudioService.playSfx('pause_open')
      this.scene.launch('SystemMenu', { sourceScene: 'Game' })
    }
    this.input.keyboard?.on('keydown-ESC', escHandler)
    const resumeHandler = () => {
      this.setPaused(false)
      this.bossProjectileController?.onPauseChanged(false)
      this.bossProjectileController?.startLoop()
    }
    const wakeHandler = () => this.bossProjectileController?.startLoop()
    const physicsPauseHandler = () => this.bossProjectileController?.onPauseChanged(true)
    const physicsResumeHandler = () => this.bossProjectileController?.onPauseChanged(false)
    this.events.on(Phaser.Scenes.Events.RESUME, resumeHandler)
    this.events.on(Phaser.Scenes.Events.WAKE, wakeHandler)
    this.physics.world.on('pause', physicsPauseHandler)
    this.physics.world.on('resume', physicsResumeHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      AudioService.onSceneShutdown(this)
      this.input.keyboard?.off('keydown-ESC', escHandler)
      this.events?.off?.(Phaser.Scenes.Events.RESUME, resumeHandler)
      this.events?.off?.(Phaser.Scenes.Events.WAKE, wakeHandler)
      this.physics?.world?.off?.('pause', physicsPauseHandler)
      this.physics?.world?.off?.('resume', physicsResumeHandler)
    })

    if (this.input.keyboard) {
      this.debugToggleHandler = () => this.debugOverlay?.toggle()
      this.input.keyboard.on('keydown-BACKTICK', this.debugToggleHandler)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this.debugToggleHandler) {
          this.input.keyboard?.off('keydown-BACKTICK', this.debugToggleHandler)
          this.debugToggleHandler = undefined
        }
      })
    }

    if (DEBUG_UI) {
      this.debugOverlay = new DebugOverlay(this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugOverlay?.destroy())
    }

    this.jumpController.reset()
    this.dropJumpHeld = false
    this.bossName = bossCodename
    this.bossHp = { current: bossMaxHp, max: bossMaxHp }
    this.weapons = buildWeaponOrder(Save.load().weaponsUnlocked)
    this.weaponEnergyById = buildWeaponEnergySnapshot(Save.load().weaponsUnlocked)

    const makeOverlayLabel = (
      x: number,
      y: number,
      text: string,
      originX = 0
    ): Phaser.GameObjects.Text => {
      const label = this.add
        .text(x, y, text, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#b7e3ff',
          align: originX === 1 ? 'right' : 'left'
        })
        .setScrollFactor(0)
        .setOrigin(originX, 0)
        .setDepth(1000)

      label.setLetterSpacing(1)
      label.setShadow(0, 1, '#041224', 0, false, true)
      label.setStroke('#0a2137', 2)
      return label
    }

    this.bossLabel = makeOverlayLabel(
      10,
      8,
      `${(this.bossName ?? '').toUpperCase()} • ${blueprint.element.toUpperCase()}`
    )
    this.bossLabel.setVisible(false)

    this.weaponLabel = makeOverlayLabel(10, 18, '')
    this.weaponLabel.setVisible(false)

    this.phaseLabel = this.add
      .text(width / 2, 8, 'PHASE • --', {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#d4e7ff',
        align: 'center'
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(1000)
    this.phaseLabel.setLetterSpacing(1)
    this.phaseLabel.setShadow(0, 1, '#041224', 0, false, true)
    this.phaseLabel.setStroke('#0a2137', 2)

    this.player = this.physics.add.sprite(stage.arena.spawn.x, stage.arena.spawn.y, 'atlas_player_main', 'player_main/idle/000')
    this.player.setCollideWorldBounds(true)
    this.player.setDragX(900)
    this.player.setMaxVelocity(220, 550)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setSize(PLAYER_COLLIDER_STAND.width, PLAYER_COLLIDER_STAND.height)
    playerBody.setOffset(PLAYER_COLLIDER_STAND.offsetX, PLAYER_COLLIDER_STAND.offsetY)
    this.playAnimationSafe(this.player, 'player-idle')
    this.playerMaxHp = 8
    this.playerHp = this.playerMaxHp
    this.playerLives = 3
    this.respawnPoint = new Phaser.Math.Vector2(this.player.x, this.player.y)
    this.currentCheckpointIndex = 0
    this.player.setDataEnabled()
    this.player.data.set('hp', this.playerHp)
    this.player.data.set('maxHp', this.playerMaxHp)
    this.devRegister(this.player, 'player')

    this.buildStage(stageId)

    this.projectileRegistry = createDefaultProjectileRegistry()
    this.projectileSystem = new ProjectileSystem(this, this.projectileRegistry, {
      playerPoolSize: 50,
      enemyPoolSize: 80
    })
    this.playerBullets = this.projectileSystem.getGroup('player')
    this.bossBullets = this.projectileSystem.getGroup('enemy')
    this.rebuildBossGateBarrier()
    this.initializeBossProjectileController()
    this.projectileCollisionRouter = new ProjectileCollisionRouter({
      playerBullets: this.playerBullets,
      enemyBullets: this.bossBullets,
      getPlayer: () => this.player,
      getNow: () => this.time.now,
      getFacing: () => this.facing,
      damageBoss: (damage, meta) => this.applyDamageToBoss(damage, meta),
      damagePlayer: (damage) => {
        if (!this.newPlayerRuntime) {
          throw new Error('[Game] NewPlayerRuntime is required in v2 runtime')
        }
        return this.newPlayerRuntime.receiveDamage(damage, 'light')
      },
      damageEnemy: (enemy, damage) => {
        const handledByFramework = this.enemySpawner?.applyDamageToSprite(enemy, {
          amount: damage,
          type: 'bullet',
          knockback: new Phaser.Math.Vector2(this.facing * 120, -40),
          sourceId: 'player_bullet'
        })
        if (handledByFramework) {
          return {
            accepted: true,
            defeated: false,
            recycleBullet: true
          }
        }
        const remaining = this.applyDamageToTarget(enemy, damage)
        if (remaining > 0) {
          this.flashEnemy(enemy)
        }
        return {
          accepted: true,
          defeated: remaining <= 0,
          recycleBullet: true
        }
      },
      recycleBullet: (a, b) => this.recycleBullet(a, b),
      recordCombatHit: (source, target, amount, kind, accepted, note) =>
        this.recordCombatHit(source, target, amount, kind, accepted, note),
      devLogOverlap: (tag, bullet, target, accepted, reason) =>
        this.devLogOverlap(tag, bullet, target, accepted, reason),
      playEnemyHitSfx: () => AudioService.playSfx('enemy_hit'),
      spawnProjectileClashFx: (x, y, strong) => this.spawnProjectileClashFx(x, y, strong)
    })
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      console.debug('[Boss][Bullet] pool init', {
        textureReady: this.textures.exists(PROJECTILES_ATLAS_KEY),
        poolReady: this.bossBullets?.getLength()
      })
    }
    this.hazards = this.physics.add.staticGroup()
    stage.arena.hazards.forEach((hazard) => {
      this.hazards.create(hazard.x, hazard.y, EFFECTS_ATLAS_KEY, HAZARD_SPIKES_FRAME).refreshBody()
    })

    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite })
    this.drops = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 24,
      allowGravity: true
    })
    this.installEntityPlatformCollisions()

    this.initializeEnemyFramework(stageId)

    const bossArtVisuals = this.prepareBossArtVisuals(selectedBossId)
    // ======================= [BOSS-SPAWN-BEGIN]
    this.spawnBossOnce(() => {
      this.bossBody = this.physics.add.sprite(
        stage.arena.bossSpawn.x,
        stage.arena.bossSpawn.y - 64,
        bossArtVisuals.atlasKey,
        bossArtVisuals.defaultFrame
      )
      this.bossBody.setVisible(false)
      this.bossBody.setCollideWorldBounds(true)
      this.bossBody.setDataEnabled()
      this.bossBody.data.set('name', bossCodename)
      this.bossBody.data.set('maxHp', bossMaxHp)
      this.bossBody.data.set('hp', bossMaxHp)
      const bossBody = this.bossBody.body as Phaser.Physics.Arcade.Body
      if (this.bossBody.width > 0 && this.bossBody.height > 0) {
        bossBody.setSize(this.bossBody.width, this.bossBody.height)
        bossBody.setOffset(0, 0)
      }
      this.bossBody.setVelocityX(-60)
      this.bossHp = { current: bossMaxHp, max: bossMaxHp }
      this.bossName = this.bossBody.data.get('name')
      this.devRegister(this.bossBody, 'boss.body')
      this.bossTarget = this.bossBody

      this.installEntityPlatformCollisions()

      if (!this.bossArt) {
        this.bossArt = this.add.sprite(
          this.bossBody.x,
          this.bossBody.y,
          bossArtVisuals.atlasKey,
          bossArtVisuals.defaultFrame
        )
      } else {
        this.bossArt.setTexture(bossArtVisuals.atlasKey, bossArtVisuals.defaultFrame)
        this.bossArt.setVisible(true)
        this.bossArt.setPosition(this.bossBody.x, this.bossBody.y)
      }
      this.bossArt.setDepth(2)
      this.bossArt.setDataEnabled?.()
      this.playAnimationSafe(this.bossArt, 'boss_walk')
      this.devRegister(this.bossArt, 'boss.art')
      this.devRegister(this.bossTarget, 'boss.hitbox')
      this.bossProjectileController?.startLoop()
    })
    // ======================= [BOSS-SPAWN-END]

    this.installEntityPlatformCollisions()
    this.installHitWires()

    this.physics.add.overlap(this.player, this.hazards, this.onPlayerDamaged, undefined, this)
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerDamaged, undefined, this)
    if (this.drops) {
      this.physics.add.overlap(this.player, this.drops, this.onPickupCollected, undefined, this)
      if (this.stagePlatforms) {
        this.physics.add.collider(this.drops, this.stagePlatforms)
      }
    }
    this.physics.add.overlap(this.playerBullets, this.enemies, this.onBulletHitsEnemy, undefined, this)

    this.installProjectilePlatformCollisions()

    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.handleWorldBounds)

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.initializeActionKeys()
    this.newPlayerRuntime = new NewPlayerRuntime(
      this,
      this.player,
      this.cursors,
      this.actionKeys,
      this.playerFeatureFlags,
      {
        setAnimation: (key) => this.setPlayerAnimation(key),
        spawnProjectile: ({ speed, damage, scale, chargeLevel, facing }) =>
          this.fireBulletFromRuntime({ speed, damage, scale, chargeLevel, facing }),
        applySwordHitbox: (hitbox) => this.applySwordHitboxFromRuntime(hitbox),
        applyDamage: (damage) => this.applyDamageToPlayer(damage)
      }
    )
    this.playerMaxHp = Math.max(this.playerMaxHp, 8)
    this.playerHp = this.playerMaxHp
    this.player.data?.set('hp', this.playerHp)
    this.player.data?.set('maxHp', this.playerMaxHp)
    this.updateWeaponLabel()

    this.bossController = new BossController(this, blueprint, {
      spawn: new Phaser.Math.Vector2(stage.arena.bossSpawn.x, stage.arena.bossSpawn.y),
      lockIntro: true,
      runtimeDefinition,
      movementBounds: getBossRoomMovementBounds(stage.arena.bossRoom)
    })
    if (this.bossController) {
      const bossActor = this.bossController as Phaser.Types.Physics.Arcade.GameObjectWithBody
      this.bossTarget = bossActor as Phaser.Physics.Arcade.Sprite
      this.bossTarget?.setDataEnabled?.()
      if (this.bossTarget?.data?.get?.('maxHp') == null) {
        this.bossTarget?.data?.set?.('maxHp', bossMaxHp)
      }
      if (this.bossTarget?.data?.get?.('hp') == null) {
        this.bossTarget?.data?.set?.('hp', bossMaxHp)
      }
      if (this.bossTarget) {
        this.devRegister(this.bossTarget, 'boss.hitbox')
        this.installEntityPlatformCollisions()
      }
      this.installHitWires()
      this.bossProjectileController?.startLoop()
    }
    this.initializeHud()
    this.applyActiveRunSnapshot(activeRun)
    this.currentPhaseName = this.bossController.currentPhase.name.toUpperCase()
    this.phaseLabel.setText('BOSS GATE • ADVANCE')
    this.bossSceneEvents?.destroy()
    this.bossSceneEvents = new BossSceneEventBindings({
      events: this.events,
      playBossMusic: () => AudioService.playMusic(this, 'boss'),
      playStageMusic: () => AudioService.playMusic(this, stage.id === FINAL_STAGE_ID ? 'final' : 'stage'),
      onPhaseChanged: (phaseName) => {
        this.currentPhaseName = phaseName
        this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}`)
      },
      onAttack: (event) => {
        this.bossProjectileController?.onBossAttack(event.attack, event.attackData)
      },
      onBossDamage: (hp) => {
        this.bossHp = { current: hp.current, max: hp.max }
      },
      onBossDefeated: (rewardName) => {
        this.phaseLabel.setText(`VICTORY • WEAPON ACQUIRED\n${rewardName.toUpperCase()}`)
        this.onBossDefeated()
      }
    })
    this.bossSceneEvents.bind()

    this.cameras.main.startFollow(this.player, false, 0.1, 0.1)
  }

  update(_time: number, delta: number): void {
    if (!this.player || !this.cursors) {
      const now = this.time.now
      this.bossUpdate(now)
      this.enemySpawner?.update(now, delta)
      this.devUpdate()
      return
    }

    const pauseState = evaluatePauseState(this.paused, false)
    this.setPaused(pauseState.paused)
    const now = this.time.now

    this.bossUiBinder?.update()

    if (DEBUG_UI) {
      const combatDebug = this.getCombatDebugSnapshot()
      const recentHit = combatDebug?.recentHits?.[combatDebug.recentHits.length - 1]
      this.debugOverlay?.update({
        sceneName: this.scene.key,
        managerName: this.scene.key,
        confirmHint: 'Enter / NumpadEnter (menus)',
        jumpHint: 'Space',
        pauseHint: 'Esc (return)',
        playerHp: this.playerHp,
        playerMaxHp: this.playerMaxHp,
        bossHpCurrent: this.bossHp?.current ?? null,
        bossHpMax: this.bossHp?.max ?? null,
        phaseName: this.currentPhaseName || null,
        dashCooldownMs: combatDebug?.player?.dashCooldownMs ?? this.dashCooldownTimer,
        chargeMs: combatDebug?.player?.chargeMs ?? 0,
        iFramesMs: combatDebug?.player?.iFramesMs ?? 0,
        recentHit: recentHit
          ? `${recentHit.source}->${recentHit.target} ${recentHit.amount} (${recentHit.accepted ? 'ok' : 'blocked'})`
          : null
      })
    }

    if (this.victoryModal?.isOpen()) {
      this.devUpdate()
      return
    }

    if (pauseState.skipUpdate) {
      this.bossUpdate(now)
      this.enemySpawner?.update(now, delta)
      this.devUpdate()
      return
    }

    this.registry.set('player_x', this.player.x)

    if (!this.newPlayerRuntime) {
      throw new Error('[Game] NewPlayerRuntime is required in v2 runtime')
    }
    this.handleDropThroughInput(now)
    this.handleWeaponCycling()
    this.newPlayerRuntime.update(now, delta)
    this.projectileSystem?.update(now, delta, { player: this.player })
    this.updateRespawnCheckpoint()
    this.updateBossEncounterActivation()
    this.checkStageKillPlane()
    this.facing = this.player.flipX ? -1 : 1
    this.bossUpdate(now)
    this.bossProjectileController?.update(now, delta)
    this.enemySpawner?.update(now, delta)
    this.devUpdate()

    this.updateBossControllerSafe()
  }

  private createPauseOverlay(width: number, height: number): void {
    const overlay = this.add.container(0, 0)
    overlay.setScrollFactor(0)
    overlay.setDepth(900)

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
    dim.setScrollFactor(0)

    const label = this.add.text(width / 2, height / 2, 'Paused', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: 'rgba(8, 12, 20, 0.75)',
      padding: { x: 12, y: 8 },
      align: 'center'
    })
    label.setOrigin(0.5)
    label.setScrollFactor(0)
    label.setShadow(2, 2, '#000000', 4, true, true)

    overlay.add([dim, label])
    overlay.setVisible(false)
    this.pauseOverlay = overlay

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      overlay.destroy(true)
      if (this.pauseOverlay === overlay) {
        this.pauseOverlay = undefined
      }
    })
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) {
      return
    }

    this.paused = paused
    if (paused) {
      this.physics.world.pause()
    } else {
      this.physics.world.resume()
    }

    this.pauseOverlay?.setVisible(paused)
  }

  private installScrollGuards(): void {
    const keyboard = this.input.keyboard
    if (!keyboard || this.preventScrollHandler) {
      return
    }

    const blockedCodes = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const handler = (event: KeyboardEvent) => {
      if (blockedCodes.has(event.code)) {
        event.preventDefault()
      }
    }

    this.preventScrollHandler = handler
    keyboard.on('keydown', handler)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown', handler)
      if (this.preventScrollHandler === handler) {
        this.preventScrollHandler = undefined
      }
    })
  }

  private initializeActionKeys(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) {
      throw new Error('Keyboard input not available')
    }

    this.actionKeys = {
      dash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      shoot: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      saber: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      cycleForward: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      shoulderPrev: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      shoulderNext: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      modifier: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    }
    this.jumpKey = keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
  }

  private initializeHud(): void {
    this.hud = new HUD(this)
    const stage = getCampaignStage(this.activeStageId)
    const bossLabelRaw =
      this.bossController?.blueprint.codename ??
      this.bossBody?.data?.get?.('name') ??
      this.bossName ??
      '??'
    const bossLabelName = typeof bossLabelRaw === 'string' ? bossLabelRaw : String(bossLabelRaw)
    this.hud.setNames(stage.title, bossLabelName)
    this.hud.setWeaponName(getWeaponDisplayName(this.getCurrentWeaponId()))
    this.hud.setLives(this.playerLives)
    this.hud.updatePlayerHp(this.playerHp, this.playerMaxHp)
    this.syncWeaponHud()
    this.hud.setBossBarVisible(Boolean(this.bossHp))
    if (this.bossHp) {
      this.hud.updateBossHp(this.bossHp.current, this.bossHp.max)
    } else if (this.bossTarget) {
      const cur =
        (this.bossTarget.data?.get?.('hp') ?? this.bossTarget.data?.get?.('maxHp') ?? 0) as number
      const max = (this.bossTarget.data?.get?.('maxHp') ?? Math.max(cur, 1)) as number
      this.hud.updateBossHp(cur, max)
    }
    this.bossUiBinder = new BossUIBinder(this.hud, {
      getBossHealth: () => this.bossHp ?? { current: 0, max: 1 }
    })
    this.hud.setBossBarVisible(false)
    this.scaleResizeHandler = () => this.hud?.resize()
    this.scale.on('resize', this.scaleResizeHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.scaleResizeHandler) {
        this.scale.off('resize', this.scaleResizeHandler)
        this.scaleResizeHandler = undefined
      }
    })
  }

  private handleWeaponCycling(): void {
    if (
      Phaser.Input.Keyboard.JustDown(this.actionKeys.cycleForward) ||
      Phaser.Input.Keyboard.JustDown(this.actionKeys.shoulderNext)
    ) {
      this.changeWeapon(1)
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.shoulderPrev)) {
      this.changeWeapon(-1)
    }
  }

  private handleShooting(now: number, grounded: boolean): void {
    const shootKey = this.actionKeys.shoot
    if (Phaser.Input.Keyboard.JustDown(shootKey)) {
      this.isChargingShot = true
      this.chargeStartedAt = now
      this.startCharging()
    }

    if (this.isChargingShot && !shootKey.isDown) {
      const charged = now - this.chargeStartedAt >= 600
      this.stopCharging()
      this.fireBullet(charged)
      this.isChargingShot = false
      this.animationLockUntil = Math.max(this.animationLockUntil, now + 180)
      this.setPlayerAnimation(grounded ? 'player-shoot' : 'player-shoot-air')
    }
  }

  private handleSaberInput(now: number, grounded: boolean): void {
    if (!Phaser.Input.Keyboard.JustDown(this.actionKeys.saber)) {
      return
    }

    this.saberComboStep = ((this.saberComboStep % 3) + 1) as number
    this.saberComboTimer = this.saberComboWindow
    this.animationLockUntil = Math.max(this.animationLockUntil, now + 180)
    this.updatePlayerTint()
    this.setPlayerAnimation(grounded ? 'player-shoot' : 'player-shoot-air')
    this.applySaberDamage()
    if (this.player) {
      this.playSaberFx(this.player, this.facing)
    }
  }

  private startDash(now: number, movingLeft: boolean, movingRight: boolean): void {
    if (this.dashActive) {
      return
    }

    const direction = movingLeft && !movingRight ? -1 : movingRight && !movingLeft ? 1 : this.facing
    this.facing = direction === 0 ? this.facing : (direction as 1 | -1)

    this.dashActive = true
    this.dashTimer = this.dashDuration
    this.dashCooldownTimer = this.dashCooldown
    this.player.setAccelerationX(0)
    this.player.setDragX(0)
    this.player.setVelocityX(320 * this.facing)
    this.animationLockUntil = Math.max(this.animationLockUntil, now + this.dashDuration)
    this.updatePlayerTint()
  }

  private startSlide(now: number, movingLeft: boolean, movingRight: boolean): void {
    const direction = movingLeft && !movingRight ? -1 : movingRight && !movingLeft ? 1 : this.facing
    this.facing = direction === 0 ? this.facing : (direction as 1 | -1)
    this.slideUntil = now + this.slideDuration
    this.applySlideHitbox()
    this.player.setVelocityX(260 * this.facing)
    this.animationLockUntil = Math.max(this.animationLockUntil, this.slideUntil)
    this.updatePlayerTint()
    this.setPlayerAnimation('player-slide')
  }

  private applySlideHitbox(): void {
    if (this.usingSlideHitbox) {
      return
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(PLAYER_COLLIDER_SLIDE.width, PLAYER_COLLIDER_SLIDE.height)
    body.setOffset(PLAYER_COLLIDER_SLIDE.offsetX, PLAYER_COLLIDER_SLIDE.offsetY)
    this.usingSlideHitbox = true
  }

  private resetPlayerHitbox(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(PLAYER_COLLIDER_STAND.width, PLAYER_COLLIDER_STAND.height)
    body.setOffset(PLAYER_COLLIDER_STAND.offsetX, PLAYER_COLLIDER_STAND.offsetY)
    this.usingSlideHitbox = false
  }

  private fireBullet(charged: boolean): void {
    this.fireBulletFromRuntime({
      speed: charged ? 360 : 260,
      damage: charged ? 2 : 1,
      scale: charged ? 1.2 : 1,
      chargeLevel: charged ? 1 : 0,
      facing: this.facing
    })
  }

  private fireBulletFromRuntime(config: {
    speed: number
    damage: number
    scale: number
    chargeLevel: 0 | 1 | 2 | 3 | 4
    facing: 1 | -1
  }): void {
    if (!this.player?.active) {
      return
    }
    const currentWeapon = this.getCurrentWeaponConfig()
    const isBuster = currentWeapon.id === 'Buster'
    if (isBuster && this.playerBullets.countActive(true) >= 3) {
      return
    }
    if (!this.consumeWeaponEnergy(currentWeapon.id, currentWeapon.energyCost)) {
      AudioService.playSfx('ui_cancel')
      return
    }

    const shotFacing = config.facing
    const offsetX = shotFacing === -1 ? -8 : 8
    const bulletX = this.player.x + offsetX
    const bulletY = this.player.y - 6
    const outgoingDamage = isBuster ? config.damage : currentWeapon.damage
    const outgoingScale = isBuster ? config.scale : currentWeapon.scale
    const outgoingSpeed = isBuster ? config.speed : currentWeapon.speed
    const projectileId = resolvePlayerProjectileId(currentWeapon.id, isBuster ? config.chargeLevel : 0)
    const bullet = this.projectileSystem?.spawn({
      id: projectileId,
      x: bulletX,
      y: bulletY,
      direction: shotFacing,
      speed: outgoingSpeed,
      damage: outgoingDamage,
      scale: outgoingScale,
      tint: currentWeapon.tint,
      chargeLevel: isBuster ? config.chargeLevel : 0,
      metadata: {
        weaponId: currentWeapon.id,
        weaponElement: currentWeapon.element
      }
    })
    if (!bullet) {
      return
    }

    this.devRegister(bullet, 'bullet')
    this.syncWeaponHud()
  }

  // [REGION: SABER-FX - BEGIN]
  private ensureSlashTexture(): void {
    if (this.textures.exists('slash')) {
      return
    }
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(0xffffff, 1)
    for (let i = 0; i < 10; i += 1) {
      g.fillRect(i, 10 - i, 1, 2)
    }
    g.generateTexture('slash', 12, 12)
    g.destroy()
  }

  private playSaberFx(origin: Phaser.GameObjects.Sprite, direction: number): void {
    const emitter = this.add.particles(0, 0, 'slash', {
      x: origin.x + 8 * direction,
      y: origin.y,
      angle: { min: -20 + (direction < 0 ? 180 : 0), max: 20 + (direction < 0 ? 180 : 0) },
      speed: 80,
      lifespan: 160,
      scale: { start: 1.2, end: 0 },
      quantity: 6,
      blendMode: 'ADD'
    })
    emitter.setDepth(9)
    this.time.delayedCall(180, () => {
      emitter.stop()
      emitter.destroy()
    })
  }
  // [REGION: SABER-FX - END]

  // [REGION: CHARGE-AURA - BEGIN]
  private initChargeFx(): void {
    if (!this.textures.exists('px')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 2, 2)
      g.generateTexture('px', 2, 2)
      g.destroy()
    }
  }

  private startCharging(): void {
    if (!this.player?.active) {
      return
    }
    this.initChargeFx()
    if (this.charging) {
      return
    }
    this.charging = true
    this.fullyCharged = false

    this.chargeEmitter?.stop()
    this.chargeEmitter?.destroy()
    this.chargeEmitter = this.add.particles(0, 0, 'px', {
      follow: this.player,
      lifespan: 220,
      speed: { min: 10, max: 40 },
      scale: { start: 1.0, end: 0 },
      quantity: 6,
      alpha: { start: 0.9, end: 0 },
      tint: 0x88ddff,
      angle: { min: 0, max: 360 }
    })
    this.chargeEmitter.setDepth(10)

    this.time.delayedCall(600, () => {
      if (!this.charging) {
        return
      }
      this.fullyCharged = true
      this.chargeEmitter?.updateConfig?.({
        quantity: 2,
        lifespan: 400,
        speed: { min: 5, max: 20 },
        tint: 0x55ffcc
      })
      this.tweens.add({ targets: this.player, scale: 1.05, duration: 80, yoyo: true })
    })
  }

  private stopCharging(): void {
    this.charging = false
    if (!this.chargeEmitter) {
      return
    }

    if (!this.fullyCharged) {
      this.chargeEmitter.stop()
      this.chargeEmitter = undefined
      return
    }

    this.chargeEmitter.updateConfig?.({
      quantity: 1,
      lifespan: 500,
      speed: 10,
      alpha: { start: 0.5, end: 0 },
      tint: 0x99ffee
    })
  }
  // [REGION: CHARGE-AURA - END]

  private ensurePlayerBulletTexture(): void {
    // Placeholder retained for now; bullets are atlas-backed.
  }

  // [REGION: BOSS-ART-PLACEHOLDER - BEGIN]
  private prepareBossArtVisuals(bossId: string): BossArtVisuals {
    const atlasKey = `atlas_${bossId}`
    if (!this.textures.exists(atlasKey)) {
      throw new Error(`[Game] Missing required boss atlas '${atlasKey}'`)
    }
    const texture = this.textures.get(atlasKey)
    const frameNames = texture
      .getFrameNames()
      .filter((name) => name !== '__BASE')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    if (frameNames.length === 0) {
      throw new Error(`[Game] Boss atlas '${atlasKey}' has no animation frames`)
    }
    this.bossUsingPlaceholder = false
    this.makeBossAnimationsFromAtlas(atlasKey, bossId, frameNames)
    return { atlasKey, defaultFrame: frameNames[0] }
  }

  private makeBossAnimationsFromAtlas(
    atlasKey: string,
    bossId: string,
    precomputedFrameNames?: string[]
  ): void {
    const frameNames = precomputedFrameNames
      ? [...precomputedFrameNames]
      : this.textures
          .get(atlasKey)
          .getFrameNames()
          .filter((name) => name !== '__BASE')
          .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    if (frameNames.length === 0) {
      throw new Error(`[Game] Boss atlas '${atlasKey}' has no animation frames`)
    }

    const grouped = (group: string): Phaser.Types.Animations.AnimationFrame[] => {
      const prefix = `${bossId}/${group}/`
      const groupFrames = frameNames
        .filter((frame) => frame.startsWith(prefix))
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      return groupFrames.map((frame) => ({ key: atlasKey, frame }))
    }

    const pick = (start: number, count: number): Phaser.Types.Animations.AnimationFrame[] => {
      const frames: Phaser.Types.Animations.AnimationFrame[] = []
      for (let i = 0; i < count; i += 1) {
        const frame = frameNames[(start + i) % frameNames.length]
        frames.push({ key: atlasKey, frame })
      }
      return frames
    }

    const idleFrames = grouped('idle')
    const moveFrames = grouped('move')
    const shootFrames = grouped('shoot')

    if (this.anims.exists('boss_idle')) this.anims.remove('boss_idle')
    if (this.anims.exists('boss_walk')) this.anims.remove('boss_walk')
    if (this.anims.exists('boss_shoot')) this.anims.remove('boss_shoot')

    this.anims.create({
      key: 'boss_idle',
      frames: idleFrames.length > 0 ? idleFrames : pick(0, 2),
      frameRate: 4,
      repeat: -1
    })
    this.anims.create({
      key: 'boss_walk',
      frames: moveFrames.length > 0 ? moveFrames : pick(2, 4),
      frameRate: 7,
      repeat: -1
    })
    this.anims.create({
      key: 'boss_shoot',
      frames: shootFrames.length > 0 ? shootFrames : pick(7, 3),
      frameRate: 10,
      repeat: 0
    })
  }
  // [REGION: BOSS-ART-PLACEHOLDER - END]

  private asDynSprite(obj: any): Phaser.Physics.Arcade.Sprite | null {
    if (!obj || !obj.body) {
      return null
    }
    const body = obj.body
    const isDynamic = body instanceof Phaser.Physics.Arcade.Body
    const hasSetVelocity = typeof (obj as any).setVelocity === 'function'
    return isDynamic && hasSetVelocity ? (obj as Phaser.Physics.Arcade.Sprite) : null
  }

  private recycleBullet(a: any, b: any): void {
    const bullet = this.asDynSprite(a) || this.asDynSprite(b)
    if (!bullet) {
      return
    }
    if (this.projectileSystem?.recycle(bullet)) {
      return
    }
    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.onWorldBounds = false
    }
    const em = (bullet as any).__trailEmitter
    if (em && typeof em.stop === 'function') {
      em.stop()
      if (typeof em.destroy === 'function') {
        em.destroy()
      }
      ;(bullet as any).__trailEmitter = null
    }
    const anyBullet = bullet as any
    const owner = (bullet.data?.get?.('owner') as string | undefined) ?? 'player'
    const group = owner === 'enemy' ? this.bossBullets : this.playerBullets
    if (typeof anyBullet.disableBody === 'function') {
      anyBullet.disableBody(true, true)
    } else {
      group?.killAndHide(bullet)
      if (body) {
        body.enable = false
      }
    }

    if (typeof (bullet as any).setVelocity === 'function') {
      ;(bullet as any).setVelocity(0, 0)
    } else if (bullet.body && typeof (bullet.body as any).setVelocity === 'function') {
      ;(bullet.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0)
    }
  }

  private applySaberDamage(): void {
    this.enemies.children.iterate((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite | null
      if (!enemy || !enemy.active) {
        return false
      }
      const distanceX = Math.abs(enemy.x - this.player.x)
      const distanceY = Math.abs(enemy.y - this.player.y)
      if (distanceX <= 36 && distanceY <= 32) {
        const handledByFramework = this.enemySpawner?.applyDamageToSprite(enemy, {
          amount: 2,
          type: 'melee',
          knockback: new Phaser.Math.Vector2(this.facing * 100, -60),
          sourceId: 'player_saber'
        })
        const remaining = handledByFramework ? 1 : this.applyDamageToTarget(enemy, 2)
        if (remaining > 0) {
          this.flashEnemy(enemy)
        }
      }
      return false
    })

    const boss = this.bossTarget ?? this.bossBody
    if (!boss || !boss.active || this.victoryTriggered) {
      return
    }

    const bossBody = boss.body as Phaser.Physics.Arcade.Body | undefined
    if (bossBody && !bossBody.enable) {
      return
    }

    const distanceX = boss.x - this.player.x
    const distanceY = Math.abs(boss.y - this.player.y)
    const inFront = this.facing === 1 ? distanceX >= -4 : distanceX <= 4
    const inRange = Math.abs(distanceX) <= 44 && distanceY <= 36
    if (!inFront || !inRange) {
      return
    }

    this.applyDamageToBoss(2)
    this.tweens?.add({ targets: boss, alpha: 0.25, yoyo: true, duration: 70 })
  }

  private applySwordHitboxFromRuntime(hitbox: ResolvedHitbox): void {
    const origin = resolveSwordHitboxOrigin(this.player.x, this.player.y, this.facing, hitbox)
    let hitConfirmed = false

    this.enemies.children.iterate((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite | null
      if (!enemy || !enemy.active) {
        return false
      }
      const collided = swordHitboxIntersectsTarget(origin, hitbox, {
        x: enemy.x,
        y: enemy.y,
        width: enemy.displayWidth,
        height: enemy.displayHeight
      })
      if (!collided) {
        return false
      }
      const handledByFramework = this.enemySpawner?.applyDamageToSprite(enemy, {
        amount: 2,
        type: 'melee',
        knockback: new Phaser.Math.Vector2(this.facing * 100, -60),
        sourceId: 'player_sword'
      })
      const remaining = handledByFramework ? 1 : this.applyDamageToTarget(enemy, 2)
      if (remaining > 0) {
        this.flashEnemy(enemy)
        hitConfirmed = true
      }
      return false
    })

    const boss = this.bossTarget ?? this.bossBody
    if (!boss || !boss.active || this.victoryTriggered) {
      if (hitConfirmed) {
        AudioService.playSfx('sword_hit')
      }
      return
    }

    if (
      swordHitboxIntersectsTarget(origin, hitbox, {
        x: boss.x,
        y: boss.y,
        width: boss.displayWidth,
        height: boss.displayHeight
      })
    ) {
      this.applyDamageToBoss(2)
      this.tweens?.add({ targets: boss, alpha: 0.25, yoyo: true, duration: 70 })
      hitConfirmed = true
    }

    if (hitConfirmed) {
      AudioService.playSfx('sword_hit')
    }
  }

  private onBulletHitsEnemy(
    bulletObj: Phaser.GameObjects.GameObject,
    enemyObj: Phaser.GameObjects.GameObject
  ): void {
    this.projectileCollisionRouter.handlePlayerBulletHitsEnemy(bulletObj, enemyObj)
  }

  private applyDamageToTarget(target: Phaser.Physics.Arcade.Sprite, dmg: number): number {
    target.setDataEnabled()
    const current = (target.getData('hp') ?? target.getData('maxHp') ?? 3) as number
    const max = (target.getData('maxHp') ?? Math.max(3, current)) as number
    const next = Math.max(0, current - dmg)
    target.data.set('hp', next)
    target.data.set('maxHp', max)
    if (next <= 0) {
      this.onTargetDefeated(target)
    }
    return next
  }

  // [REGION: FLOW-HOOKS - BEGIN]
  private onBossDefeated(): void {
    if (this.bossDeathHandled) {
      return
    }

    this.bossDeathHandled = true
    this.victoryTriggered = true
    this.bossProjectileController?.stop()
    this.bossUiBinder?.onBossDeath()
    this.stopCharging()
    AudioService.stopMusic()
    AudioService.playSfx('stage_clear')

    if (this.bossHp) {
      this.bossHp = { current: 0, max: this.bossHp.max }
      this.hud?.updateBossHp(this.bossHp.current, this.bossHp.max)
    }
    this.unlockBossGate()
    this.disableBossCombatActors()
    this.disableProjectileGroups()
    this.freezeCombatWorld()
    Save.clearActiveRun()

    const stageId = ((this as any).stageId as string | undefined) ?? 'unknown'
    const weaponId = (this as any).rewardWeapon as string | undefined
    const bossName = this.bossName ?? stageId
    const stage = getCampaignStage(stageId)

    if (stage.id === TUTORIAL_STAGE_ID) {
      Save.markTutorialCleared()
    } else if (stage.id === FINAL_STAGE_ID) {
      Save.markFinalBossCleared()
      Save.markGameCompleted()
    } else {
      if (weaponId) {
        Save.addWeapon(weaponId)
      }
      Save.markBossCleared(stageId)
    }

    this.victoryModal?.destroy()
    this.victoryModal = new VictoryModal(this)
    this.victoryModal.show({
      bossName,
      onNext: () => {
        if (stage.id === FINAL_STAGE_ID) {
          this.scene.start('CompletionScene')
          return
        }
        this.handleReturnToStageSelect('victory', {
          toastMessage:
            stage.id === TUTORIAL_STAGE_ID ? 'Tutorial cleared. Robot Master Select unlocked.' : `${bossName} defeated!`,
          focusBossId: stage.id,
          requireConfirmRelease: true
        })
      }
    })
  }

  private disableBossCombatActors(): void {
    if (this.bossTarget) {
      const body = this.bossTarget.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = false
        body.setVelocity(0, 0)
      }
      this.bossTarget.setActive(false).setVisible(false)
    }
    if (this.bossBody) {
      const body = this.bossBody.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = false
        body.setVelocity(0, 0)
      }
      this.bossBody.setActive(false).setVisible(false)
    }
    this.bossArt?.setVisible(false)
    this.bossController = undefined
    this.bossHitWire?.destroy()
    this.playerHitWire?.destroy()
    this.projectileClashWire?.destroy()
    this.bossHitWire = undefined
    this.playerHitWire = undefined
    this.projectileClashWire = undefined
  }

  private disableProjectileGroups(): void {
    const disableGroup = (group?: Phaser.Physics.Arcade.Group) => {
      if (!group) {
        return
      }
      group.children.iterate((child) => {
        const sprite = child as Phaser.Physics.Arcade.Sprite | undefined
        if (!sprite?.active) {
          return false
        }
        if (this.projectileSystem?.recycle(sprite)) {
          return false
        }
        const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
        body?.setVelocity(0, 0)
        body && (body.enable = false)
        sprite.setActive(false).setVisible(false)
        return false
      })
    }

    disableGroup(this.playerBullets)
    disableGroup(this.bossBullets)
  }

  private prepareRespawnCombatState(): void {
    this.disableProjectileGroups()
    this.bossProjectileController?.onPauseChanged(true)
  }

  private resumeRespawnCombatState(): void {
    this.disableProjectileGroups()
    this.bossProjectileController?.onPauseChanged(false)
  }

  private freezeCombatWorld(): void {
    this.physics.world.pause()
    this.paused = false
    this.pauseOverlay?.setVisible(false)
    const playerBody = this.player?.body as Phaser.Physics.Arcade.Body | undefined
    if (playerBody) {
      playerBody.setVelocity(0, 0)
      playerBody.setAcceleration(0, 0)
    }
  }

  onSystemMenuAction(action: SystemMenuAction): void {
    if (action === 'resume' || action === 'back') {
      AudioService.playSfx('pause_resume')
      this.setPaused(false)
      return
    }

    if (action === 'save_game') {
      const snapshot = this.captureActiveRunSnapshot()
      if (snapshot) {
        Save.saveActiveRun(snapshot)
      }
      this.setPaused(false)
      showToast(this, snapshot ? 'Game saved.' : 'Save failed.', 1000)
      return
    }

    if (action === 'load_game') {
      const run = Save.loadActiveRun()
      this.setPaused(false)
      if (!run) {
        showToast(this, 'No saved game found.', 1200)
        return
      }
      this.scene.restart({
        bossId: run.bossId,
        stageId: run.stageId,
        loadFromSave: true
      })
      return
    }

    if (action === 'new_game') {
      Save.startNewCampaign()
      this.setPaused(false)
      this.scene.start('Title')
      return
    }

    if (action === 'clear_save') {
      Save.clearAll()
      this.setPaused(false)
      this.scene.start('Title')
      return
    }

    if (action === 'stage_select') {
      this.setPaused(false)
      this.handleReturnToStageSelect('menu-exit')
    }
  }

  private handleReturnToStageSelect(
    reason: string,
    options: { toastMessage?: string; focusBossId?: string | null; requireConfirmRelease?: boolean } = {}
  ): void {
    this.victoryModal?.destroy()
    this.victoryModal = undefined
    this.setPaused(false)
    returnToStageSelect(this, {
      reason,
      toastMessage: options.toastMessage,
      focusBossId: options.focusBossId ?? null,
      requireConfirmRelease: options.requireConfirmRelease ?? false
    })
  }

  private captureActiveRunSnapshot(): ActiveRunSaveData | null {
    if (!this.activeBossId) {
      return null
    }
    const stageId = ((this as any).stageId as string | undefined) ?? this.activeStageId
    return {
      version: 2,
      savedAt: Date.now(),
      stageId,
      bossId: this.activeBossId,
      playerHp: Math.max(1, Math.round(this.playerHp)),
      playerMaxHp: Math.max(1, Math.round(this.playerMaxHp)),
      playerLives: Math.max(0, Math.round(this.playerLives)),
      currentWeaponIndex: Math.max(0, Math.round(this.currentWeaponIndex)),
      currentWeaponId: this.getCurrentWeaponId(),
      weaponEnergyById: { ...this.weaponEnergyById }
    }
  }

  private applyActiveRunSnapshot(run: ActiveRunSaveData | null): void {
    if (!run || !this.player) {
      return
    }

    this.playerMaxHp = Math.max(1, Math.round(run.playerMaxHp))
    this.playerHp = Phaser.Math.Clamp(Math.round(run.playerHp), 1, this.playerMaxHp)
    this.playerLives = Math.max(0, Math.round(run.playerLives))
    const weaponIndexFromId =
      typeof run.currentWeaponId === 'string' ? this.weapons.indexOf(run.currentWeaponId) : -1
    this.currentWeaponIndex =
      weaponIndexFromId >= 0
        ? weaponIndexFromId
        : Phaser.Math.Clamp(Math.round(run.currentWeaponIndex), 0, this.weapons.length - 1)
    this.weaponEnergyById = {
      ...this.weaponEnergyById,
      ...(run.weaponEnergyById ?? {})
    }

    this.player.data?.set('hp', this.playerHp)
    this.player.data?.set('maxHp', this.playerMaxHp)
    this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)
    this.hud?.setLives(this.playerLives)
    this.updateWeaponLabel()
  }

  private onPlayerGameOver(): void {
    if (this.gameOverTriggered) {
      return
    }
    this.gameOverTriggered = true
    this.bossProjectileController?.stop()
    this.stopCharging()
    Save.clearActiveRun()
    AudioService.stopMusic()
    AudioService.playSfx('game_over')
    const stageId = ((this as any).stageId as string | undefined) ?? 'unknown'
    if (this.scene.manager.keys['Pause']) {
      this.scene.stop('Pause')
    }
    if (this.scene.manager.keys['GameOver']) {
      this.scene.start('GameOver', { stageId })
    }
  }
  // [REGION: FLOW-HOOKS - END]

  private applyDamageToBoss(
    dmg: number,
    hitContext: { weaponId?: string; weaponElement?: string; kind?: string } = {}
  ): void {
    const currentWeapon = this.getCurrentWeaponConfig()
    const weaponId = hitContext.weaponId ?? currentWeapon.id
    const weaponElement = hitContext.weaponElement ?? currentWeapon.element
    const hitKind = hitContext.kind ?? 'direct'
    const bossElement =
      this.bossController?.blueprint.element ?? getBossById(this.activeBossId ?? 'pyro_maw').element
    const multiplier = damageMultiplier(weaponElement, bossElement)
    const scaledDamage = Math.max(1, Math.round(dmg * multiplier))
    const controller = this.bossController
    if (controller) {
      const hit = controller.applyDamage({
        amount: scaledDamage,
        type: 'normal',
        source: 'player',
        hitstopFrames: 2,
        iFrameMs: 240
      })
      const hp = controller.hp
      this.bossHp = { current: hp.current, max: hp.max }
      if (this.bossTarget) {
        this.bossTarget.setDataEnabled?.()
        this.bossTarget.data?.set?.('hp', hp.current)
        this.bossTarget.data?.set?.('maxHp', hp.max)
      }
      if (hit.immune) {
        this.recordCombatHit('player', 'boss', scaledDamage, hitKind, false, hit.reason ?? 'immune')
        this.showBossHitFeedback(weaponId, multiplier, 'IMMUNE')
        this.tweens?.add({
          targets: this.bossTarget ?? this.bossArt,
          alpha: 0.6,
          yoyo: true,
          duration: 45,
          repeat: 1
        })
        return
      }
      this.recordCombatHit('player', 'boss', hit.amountApplied, hitKind, true)
      this.hud?.updateBossHp(hp.current, hp.max)
      if (this.bossDeathHandled || this.victoryTriggered) {
        return
      }
      this.tweens?.add({
        targets: this.bossTarget ?? this.bossArt,
        alpha: 0.25,
        yoyo: true,
        duration: 70
      })
      AudioService.playSfx('boss_hit')
      this.showBossHitFeedback(weaponId, multiplier)
      if (hit.defeated || hp.current <= 0) {
        this.onBossDefeated()
      }
      return
    }

    const target = this.bossTarget ?? this.bossBody
    if (!target || !target.active) {
      this.recordCombatHit('player', 'boss', dmg, hitKind, false, 'missing target')
      return
    }

    target.setDataEnabled?.()
    const current = (target.data?.get?.('hp') ?? target.data?.get?.('maxHp') ?? 0) as number
    const max = (target.data?.get?.('maxHp') ?? Math.max(1, current)) as number
    const next = Math.max(0, current - scaledDamage)
    this.recordCombatHit('player', 'boss', scaledDamage, hitKind, true, next <= 0 ? 'defeat' : 'hit')
    target.data?.set?.('hp', next)
    target.data?.set?.('maxHp', max)
    this.bossHp = { current: next, max }
    this.hud?.updateBossHp(next, max)
    AudioService.playSfx('boss_hit')
    this.showBossHitFeedback(weaponId, multiplier)

    if (next <= 0) {
      const anyTarget = target as any
      if (typeof anyTarget.disableBody === 'function') {
        anyTarget.disableBody(true, true)
      } else {
        target.setActive(false).setVisible(false)
        const body = target.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          body.enable = false
        }
      }

      this.events.emit('boss-defeated', {
        reward: { displayName: 'FROST SLASH' }
      })
      this.onBossDefeated()
    }
  }

  private showBossHitFeedback(weaponId: string, multiplier: number, forcedLabel?: string): void {
    if (!this.phaseLabel || this.victoryTriggered) {
      return
    }

    const label =
      forcedLabel ??
      (multiplier >= 1.4 ? 'WEAKNESS HIT' : multiplier <= 0.8 ? 'RESISTED HIT' : '')
    if (!label) {
      return
    }

    this.bossHitFeedbackTimer?.remove(false)
    this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}\n${label} • ${getWeaponDisplayName(weaponId).toUpperCase()}`)
    this.bossHitFeedbackTimer = this.time.delayedCall(520, () => {
      if (this.victoryTriggered) {
        return
      }
      if (this.bossEncounterActive && this.currentPhaseName) {
        this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}`)
      } else {
        this.phaseLabel.setText('BOSS GATE • ADVANCE')
      }
    })
  }

  private onTargetDefeated(target: Phaser.Physics.Arcade.Sprite): void {
    const anyTarget = target as any
    const { x, y, displayHeight } = target
    AudioService.playSfx('enemy_hit')
    if (typeof anyTarget.disableBody === 'function') {
      anyTarget.disableBody(true, true)
    } else {
      target.setActive(false).setVisible(false)
    }
    this.handleEnemyDefeat(x, y, displayHeight)
  }

  private handleEnemyDefeat(x: number, y: number, targetHeight: number): void {
    const explosion = this.add.sprite(x, y - targetHeight / 2, EFFECTS_ATLAS_KEY, 'effects_core/core/000')
    this.playAnimationSafe(explosion, 'dummy-explode')
    explosion.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      explosion.destroy()
    })
  }

  private spawnProjectileClashFx(x: number, y: number, strong: boolean): void {
    const flash = this.add
      .sprite(x, y, EFFECTS_ATLAS_KEY, strong ? 'effects_core/core/019' : 'effects_core/core/011')
      .setDepth(8)
      .setTint(strong ? 0xfff2ad : 0x9ee8ff)
      .setScale(strong ? 1.4 : 1.0)
      .setBlendMode(Phaser.BlendModes.ADD)

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: strong ? 2.1 : 1.6,
      duration: strong ? 160 : 120,
      ease: 'Quad.easeOut',
      onComplete: () => flash.destroy()
    })

    const emitter = this.add.particles(x, y, EFFECTS_ATLAS_KEY, {
      frame: PROJECTILE_CLASH_FRAMES,
      lifespan: { min: 90, max: 160 },
      speed: strong ? { min: 40, max: 130 } : { min: 30, max: 90 },
      scale: { start: strong ? 0.85 : 0.6, end: 0 },
      alpha: { start: 0.9, end: 0 },
      quantity: strong ? 12 : 7,
      tint: strong ? [0xfff3a8, 0xffc86a, 0xffffff] : [0x8eddff, 0x6fb7ff, 0xffffff],
      blendMode: 'ADD'
    })
    emitter.setDepth(7)
    this.time.delayedCall(strong ? 180 : 140, () => {
      emitter.stop()
      emitter.destroy()
    })
  }

  private spawnEnemyDrop(
    x: number,
    y: number,
    forcedType?: 'health' | 'ammo' | 'bonus'
  ): Phaser.Physics.Arcade.Sprite | null {
    if (!this.drops) {
      return null
    }

    let dropType = forcedType
    if (!dropType) {
      const roll = Phaser.Math.FloatBetween(0, 1)
      if (roll > 0.45) {
        return null
      }
      dropType = roll < 0.18 ? 'health' : roll < 0.33 ? 'ammo' : 'bonus'
    }

    const drop = this.drops.get(x, y, PROJECTILES_ATLAS_KEY, 'projectiles_core/core/002') as
      | Phaser.Physics.Arcade.Sprite
      | null
    if (!drop) {
      return null
    }

    this.clearDropExpireTimer(drop)
    drop.setActive(true).setVisible(true).setDepth(5)
    drop.setPosition(x, y)
    drop.setScale(dropType === 'bonus' ? 1.05 : 0.95)
    drop.setDataEnabled()
    drop.data?.set('dropType', dropType)
    drop.clearTint()
    if (dropType === 'health') {
      drop.setTint(0x7dff7d)
    } else if (dropType === 'ammo') {
      drop.setTint(0x7dc0ff)
    } else {
      drop.setTint(0xffd67d)
    }

    const body = drop.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.enable = true
      body.allowGravity = true
      body.setBounce(0.1, 0.16)
      body.setDrag(24, 0)
      body.setVelocity(Phaser.Math.Between(-30, 30), Phaser.Math.Between(-120, -72))
    }

    ;(drop as any).__expireTimer = this.time.delayedCall(4200, () => {
      if (!drop.active) {
        ;(drop as any).__expireTimer = undefined
        return
      }
      body?.setVelocity(0, 0)
      if (body) {
        body.enable = false
      }
      drop.setActive(false).setVisible(false)
      ;(drop as any).__expireTimer = undefined
    })

    return drop
  }

  private onPickupCollected(
    _playerObj: Phaser.GameObjects.GameObject,
    dropObj: Phaser.GameObjects.GameObject
  ): void {
    const drop = dropObj as Phaser.Physics.Arcade.Sprite
    if (!drop?.active) {
      return
    }

    this.clearDropExpireTimer(drop)
    const dropType = (drop.data?.get?.('dropType') as 'health' | 'ammo' | 'bonus' | undefined) ?? 'bonus'
    const outcome = this.applyPickupReward(dropType)
    const body = drop.body as Phaser.Physics.Arcade.Body | undefined
    body?.setVelocity(0, 0)
    if (body) {
      body.enable = false
    }
    drop.setActive(false).setVisible(false)

    if (outcome.sfx) {
      AudioService.playSfx(outcome.sfx)
    }
    if (outcome.message) {
      this.showStageToast(outcome.message, 650)
    }
  }

  private applyPickupReward(
    dropType: 'health' | 'ammo' | 'bonus'
  ): { sfx?: string; message?: string } {
    if (dropType === 'health') {
      const healed = this.restorePlayerHealth(2)
      if (healed > 0) {
        return { sfx: 'pickup_health', message: `HP +${healed}` }
      }
      const ammo = this.restoreWeaponEnergy(4)
      if (ammo.restored > 0) {
        return { sfx: 'pickup_ammo', message: `${getWeaponDisplayName(ammo.weaponId ?? 'Buster').toUpperCase()} +${ammo.restored}` }
      }
      return { sfx: 'pickup_bonus', message: 'SYSTEM OK' }
    }

    if (dropType === 'ammo') {
      const ammo = this.restoreWeaponEnergy(6)
      if (ammo.restored > 0) {
        return { sfx: 'pickup_ammo', message: `${getWeaponDisplayName(ammo.weaponId ?? 'Buster').toUpperCase()} +${ammo.restored}` }
      }
      const healed = this.restorePlayerHealth(1)
      if (healed > 0) {
        return { sfx: 'pickup_health', message: `HP +${healed}` }
      }
      return { sfx: 'pickup_bonus', message: 'ENERGY MAX' }
    }

    const healed = this.restorePlayerHealth(1)
    const ammo = this.restoreWeaponEnergy(3)
    if (healed > 0 || ammo.restored > 0) {
      if (healed > 0 && ammo.restored > 0) {
        return {
          sfx: 'pickup_bonus',
          message: `HP +${healed} • ${getWeaponDisplayName(ammo.weaponId ?? 'Buster').toUpperCase()} +${ammo.restored}`
        }
      }
      if (healed > 0) {
        return { sfx: 'pickup_health', message: `HP +${healed}` }
      }
      return { sfx: 'pickup_ammo', message: `${getWeaponDisplayName(ammo.weaponId ?? 'Buster').toUpperCase()} +${ammo.restored}` }
    }

    return { sfx: 'pickup_bonus', message: 'BONUS SECURED' }
  }

  private restorePlayerHealth(amount: number): number {
    if (!this.player || amount <= 0) {
      return 0
    }
    const next = Phaser.Math.Clamp(this.playerHp + amount, 0, this.playerMaxHp)
    const restored = next - this.playerHp
    if (restored <= 0) {
      return 0
    }
    this.playerHp = next
    this.player.data?.set?.('hp', this.playerHp)
    this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)
    return restored
  }

  private restoreWeaponEnergy(
    amount: number,
    preferredWeaponId?: string
  ): { weaponId: string | null; restored: number } {
    if (amount <= 0) {
      return { weaponId: null, restored: 0 }
    }

    const candidates = [preferredWeaponId, this.getCurrentWeaponId(), ...this.weapons].filter(
      (weaponId, index, array): weaponId is string => Boolean(weaponId) && array.indexOf(weaponId) === index
    )

    for (const weaponId of candidates) {
      if (weaponId === 'Buster') {
        continue
      }
      const config = getWeaponConfig(weaponId)
      const current = this.weaponEnergyById[weaponId] ?? config.maxEnergy
      if (current >= config.maxEnergy) {
        continue
      }
      const next = Phaser.Math.Clamp(current + amount, 0, config.maxEnergy)
      const restored = next - current
      if (restored <= 0) {
        continue
      }
      this.weaponEnergyById[weaponId] = next
      if (weaponId === this.getCurrentWeaponId()) {
        this.syncWeaponHud()
      }
      return { weaponId, restored }
    }

    return { weaponId: null, restored: 0 }
  }

  private clearDropExpireTimer(drop?: Phaser.Physics.Arcade.Sprite | null): void {
    const timer = (drop as any)?.__expireTimer as Phaser.Time.TimerEvent | undefined
    if (!timer) {
      return
    }
    timer.remove(false)
    ;(drop as any).__expireTimer = undefined
  }

  private flashEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    enemy.setTint(0xfff3a3)
    this.time.delayedCall(120, () => {
      if (enemy.active) {
        enemy.clearTint()
      }
    })
  }

  private onPlayerDamaged(playerObj: Phaser.GameObjects.GameObject): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite
    if (!player.active) {
      return
    }

    if (!this.newPlayerRuntime) {
      throw new Error('[Game] NewPlayerRuntime is required in v2 runtime')
    }
    const accepted = this.newPlayerRuntime.receiveDamage(1, 'light')
    this.recordCombatHit('hazard', 'player', 1, 'contact', accepted, 'new-player-runtime')
    if (!accepted) {
      return
    }
    player.setTint(0xff6b6b)
    this.time.delayedCall(140, () => {
      if (player.active) {
        player.clearTint()
      }
    })
  }

  private updatePlayerTint(): void {
    if (!this.player) {
      return
    }
    if (this.dashActive) {
      this.player.setTint(0x8bd2ff)
    } else if (this.saberComboStep > 0) {
      this.player.setTint(0xfff5a3)
    } else {
      this.player.clearTint()
    }
  }

  private setPlayerAnimation(key: string): void {
    if (!this.player.anims || this.player.anims.currentAnim?.key === key) {
      return
    }
    this.playAnimationSafe(this.player, key)
  }

  private playAnimationSafe(
    target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite | undefined,
    key: string,
    ignoreIfPlaying = false
  ): void {
    if (!target || !target.active) {
      return
    }
    if (!this.anims.exists(key)) {
      if (!this.missingAnimationWarnings.has(key)) {
        this.missingAnimationWarnings.add(key)
        console.warn(`[Anim] Missing animation '${key}'`)
      }
      return
    }
    try {
      target.play(key, ignoreIfPlaying)
    } catch (error) {
      const warningKey = `${key}:runtime`
      if (!this.missingAnimationWarnings.has(warningKey)) {
        this.missingAnimationWarnings.add(warningKey)
        console.warn(`[Anim] Failed to play '${key}'`, error)
      }
    }
  }

  private changeWeapon(delta: number): void {
    const total = this.weapons.length
    this.currentWeaponIndex = Phaser.Math.Wrap(this.currentWeaponIndex + delta, 0, total)
    AudioService.playSfx('ui_move')
    this.updateWeaponLabel()
  }

  private updateWeaponLabel(): void {
    const weapon = this.getCurrentWeaponId()
    this.weaponLabel.setText(`WEAPON • ${getWeaponDisplayName(weapon).toUpperCase()}`)
    this.hud?.setWeaponName(getWeaponDisplayName(weapon))
    this.syncWeaponHud()
  }

  private getCurrentWeaponId(): string {
    return this.weapons[this.currentWeaponIndex] ?? 'Buster'
  }

  private getCurrentWeaponConfig() {
    return getWeaponConfig(this.getCurrentWeaponId())
  }

  private syncWeaponHud(): void {
    const currentWeapon = this.getCurrentWeaponConfig()
    const current = this.weaponEnergyById[currentWeapon.id] ?? currentWeapon.maxEnergy
    this.weaponEnergy = {
      current,
      max: currentWeapon.maxEnergy
    }
    this.hud?.updateWeapon(this.weaponEnergy.current, this.weaponEnergy.max)
  }

  private consumeWeaponEnergy(weaponId: string, amount: number): boolean {
    if (weaponId === 'Buster' || amount <= 0) {
      return true
    }
    const current = this.weaponEnergyById[weaponId] ?? getWeaponConfig(weaponId).maxEnergy
    if (current < amount) {
      return false
    }
    this.weaponEnergyById[weaponId] = current - amount
    return true
  }

  private applyDamageToPlayer(dmg: number): void {
    if (!this.player || !this.player.active || this.playerLives < 0) {
      this.recordCombatHit('system', 'player', dmg, 'direct', false, 'player inactive')
      return
    }

    this.recordCombatHit('enemy', 'player', dmg, 'direct', true)
    AudioService.playSfx('player_hit')
    this.playerHp = Math.max(0, this.playerHp - dmg)
    this.player.setDataEnabled()
    this.player.data.set('hp', this.playerHp)
    this.player.data.set('maxHp', this.playerMaxHp)
    this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)

    if (this.playerHp <= 0) {
      this.killPlayer('damage')
    }
  }

  private playerDeathAndRespawn(): void {
    if (!this.player) {
      return
    }

    this.stopCharging()
    this.playerLives--
    this.hud?.setLives(this.playerLives)

    const anyPlayer = this.player as any
    if (typeof anyPlayer.disableBody === 'function') {
      anyPlayer.disableBody(true, true)
    } else {
      this.player.setActive(false).setVisible(false)
      const body = this.player.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = false
      }
    }
    this.prepareRespawnCombatState()

    if (this.playerLives > 0) {
      this.time.delayedCall(600, () => {
        if (!this.player || !this.respawnPoint) {
          return
        }
        const respawnX =
          this.bossEncounterActive && this.activeBossRoom
            ? Math.max(this.respawnPoint.x, this.activeBossRoom.playerIntroX)
            : this.respawnPoint.x
        const respawnY = this.respawnPoint.y - 4

        const playerAny = this.player as any
        if (typeof playerAny.enableBody === 'function') {
          playerAny.enableBody(true, respawnX, respawnY, true, true)
        } else {
          this.player.setPosition(respawnX, respawnY)
          const body = this.player.body as Phaser.Physics.Arcade.Body | undefined
          if (body) {
            body.enable = true
            body.reset(respawnX, respawnY)
          }
        }
        this.playerHp = this.playerMaxHp
        this.player.setDataEnabled()
        this.player.data.set('hp', this.playerHp)
        this.player.data.set('maxHp', this.playerMaxHp)
        this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)
        this.player.setVelocity(0, 0)
        this.player.setAcceleration(0, 0)
        this.player.clearTint()
        this.player.setActive(true).setVisible(true)
        this.newPlayerRuntime?.resetForRespawn(1000)
        this.resumeRespawnCombatState()
        this.syncWeaponHud()
        this.fallingToDeath = false
      })
    } else {
      this.fallingToDeath = false
      this.gameOver()
    }
  }

  private initializeEnemyFramework(stageId: string): void {
    if (!this.player || !this.enemies || !this.bossBullets) {
      return
    }

    this.enemySpawner = new EnemySpawner(
      {
        scene: this,
        player: this.player,
        stageId,
        enemyGroup: this.enemies,
        projectileGroup: this.bossBullets,
        projectileSystem: this.projectileSystem,
        worldPlatforms: this.stagePlatforms,
        applyDamageToPlayer: (amount: number) => this.applyDamageToPlayer(amount),
        onEnemyDefeated: (sprite: Phaser.Physics.Arcade.Sprite) => {
          if (this.enemyFeatureFlags.enableEnemyDrops) {
            this.spawnEnemyDrop(sprite.x, sprite.y - 8)
          }
          this.onTargetDefeated(sprite)
        },
        playAnimationSafe: (target, key, ignoreIfPlaying) =>
          this.playAnimationSafe(target, key, ignoreIfPlaying)
      },
      {
        enableAI: this.enemyFeatureFlags.enableEnemyAI,
        enableProjectiles: this.enemyFeatureFlags.enableEnemyProjectiles,
        enableDebug: this.enemyFeatureFlags.enableEnemyDebug,
        maxActiveEnemies: ENEMY_GLOBAL_TUNING.maxActiveEnemies
      }
    )

    const levelMarkers = resolveLevelEnemyMarkers(stageId)
    const runtimeMarkers = (this.registry.get('enemy_level_markers') as any[] | undefined) ?? []
    this.enemySpawner.spawnFromLevelMarkers([...levelMarkers, ...runtimeMarkers])

    if ((this.registry.get('enemy_scripted_wave_demo') as boolean | undefined) === true) {
      this.enemySpawner.registerWave({
        id: 'demo_enemy_wave_1',
        typeKey: 'enemy_gunner_bot',
        x: this.player.x + 120,
        y: this.player.y,
        trigger: 'time',
        triggerValue: 2500
      })
    }

    if (typeof window !== 'undefined') {
      ;(window as any).spawnEnemyDebug = (
        typeKey = 'enemy_gunner_bot',
        x = this.player.x + 100,
        y = this.player.y
      ) => this.enemySpawner?.spawn(typeKey, x, y)
    }
  }

  private gameOver(): void {
    this.onPlayerGameOver()
  }

  getCombatDebugSnapshot(): Record<string, unknown> | null {
    const now = this.time?.now ?? 0
    const newPlayerState = this.getNewPlayerDebugState()
    const iFramesMs = Number((newPlayerState as any)?.combat?.iFramesMs ?? 0)
    const chargeMs = this.isChargingShot ? Math.max(0, now - this.chargeStartedAt) : 0
    const snapshot = makeGameCombatSnapshot({
      recentHits: this.combatDebugBus.getRecentHits(10),
      totals: this.combatDebugBus.getTotals(),
      player: {
        hp: this.playerHp,
        maxHp: this.playerMaxHp,
        dashCooldownMs: this.dashCooldownTimer,
        slideRemainingMs: Math.max(0, this.slideUntil - now),
        chargeMs,
        iFramesMs
      },
      boss: {
        hp: this.bossHp ?? null,
        phase: this.currentPhaseName
      }
    })

    return snapshot
  }

  getNewPlayerDebugState(): Record<string, unknown> | null {
    return this.newPlayerRuntime?.getDebugState?.() ?? null
  }

  getVisualDebugSnapshot(): Record<string, unknown> | null {
    const enemyEntities = this.enemySpawner?.getEntities?.() ?? []
    let enemyPlaceholderCount = 0
    const missingEnemyAtlases = new Set<string>()

    enemyEntities.forEach((entity) => {
      const enemySprite = entity.sprite
      const usingPlaceholder = Boolean(enemySprite.data?.get?.('enemyUsingPlaceholder'))
      if (usingPlaceholder) {
        enemyPlaceholderCount += 1
      }

      const typeKey = entity.typeKey ?? (enemySprite.data?.get?.('enemyTypeKey') as string | undefined)
      if (typeof typeKey === 'string' && typeKey.length > 0 && !this.textures.exists(`atlas_${typeKey}`)) {
        missingEnemyAtlases.add(typeKey)
      }
    })

    if (enemyEntities.length === 0 && this.enemies) {
      this.enemies.getChildren().forEach((child) => {
        const sprite = child as Phaser.Physics.Arcade.Sprite
        const textureKey = String(sprite.texture?.key ?? '')
        if (!textureKey.startsWith('atlas_')) {
          enemyPlaceholderCount += 1
        }
      })
    }

    const playerTextureKey = String(this.player?.texture?.key ?? '')
    const playerUsingPlaceholder = Boolean(this.player) && playerTextureKey !== 'atlas_player_main'
    const playerAtlasMissing = this.textures.exists('atlas_player_main') ? 0 : 1

    const bossAtlasKey = this.activeBossId ? `atlas_${this.activeBossId}` : undefined
    const bossAtlasMissing =
      typeof bossAtlasKey === 'string' && bossAtlasKey.length > 0 && !this.textures.exists(bossAtlasKey) ? 1 : 0

    const config = this.game.config as any
    const renderConfig = config.render ?? {}
    const antialias = renderConfig.antialias ?? config.antialias ?? STRICT_PIXEL_RENDER_POLICY.antialias
    const roundPixels = renderConfig.roundPixels ?? config.roundPixels ?? STRICT_PIXEL_RENDER_POLICY.roundPixels
    const pixelArt = config.pixelArt ?? STRICT_PIXEL_RENDER_POLICY.pixelArt
    let nonPixelFilteredCount = 0
    if (antialias !== STRICT_PIXEL_RENDER_POLICY.antialias) {
      nonPixelFilteredCount += 1
    }
    if (roundPixels !== STRICT_PIXEL_RENDER_POLICY.roundPixels) {
      nonPixelFilteredCount += 1
    }
    if (pixelArt !== STRICT_PIXEL_RENDER_POLICY.pixelArt) {
      nonPixelFilteredCount += 1
    }

    return {
      placeholderCount: (playerUsingPlaceholder ? 1 : 0) + enemyPlaceholderCount + (this.bossUsingPlaceholder ? 1 : 0),
      missingAtlasCount: playerAtlasMissing + bossAtlasMissing + missingEnemyAtlases.size,
      nonPixelFilteredCount,
      backgroundLayerCount: this.stageBackgroundLayers.length
    }
  }
}
