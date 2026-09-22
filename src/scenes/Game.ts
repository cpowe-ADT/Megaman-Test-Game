// @ts-nocheck
import { IDENTITY } from '../content/identity'
import { firePlayerShot } from '../projectiles/firePlayerShot'
import { resolveUpgradeModifiers, upgradeEffectLabel } from '../progression/upgrades'
import { CampaignSessionStatistics } from '../progression/statistics'
import { installProgressionDebugHooks } from './game/ProgressionDebugHooks'
import { createPauseOverlay } from './game/createPauseOverlay'
import { openNewCampaign } from './NewCampaignScene'
import Phaser from 'phaser'
import AudioService from '../audio'
import { BossController } from '../bosses/BossController'
import { BossId } from '../bosses/types'
import { getBossById } from '../bosses/roster'
import { bossHudLabel } from '../bosses/types'
import { installGameDebugHooks, uninstallGameDebugHooks } from './game/GameDebugHooks'
import { StoryDirector, pendingMilestoneId } from './game/StoryDirector'
import { ToastLane } from '../ui/ToastLane'
import { Settings } from '../systems/Settings'
import { drinkSubTank, fillSubTankFromPickup } from '../systems/subTanks'
import type { PauseInventory } from './menu/systemMenuSelector'
import { getBossDefinitionById } from '../boss/config'
import {
  countClearedRobotMasters,
  FINAL_STAGE_ID,
  getCampaignStage,
  TUTORIAL_STAGE_ID
} from '../content/campaign'
import {
  DIALOGUE_REGISTRY,
  resolveDialogueText,
  type DialogueInterpolationValues,
  type DialogueLineDefinition,
  type DialogueTrigger
} from '../content/dialogue/index'
import {
  getBossRoomActivationX,
  getBossRoomCameraBounds,
  getBossRoomGateX,
  getBossRoomMovementBounds
} from '../content/stageArenaLayout'
import { buildWeaponEnergySnapshot, buildWeaponOrder, getWeaponConfig, getWeaponDisplayName } from '../content/weapons'
import { GAMEPLAY_TEXTURE_KEYS, resolveStageHazardTexture } from '../ui/gameplay/GameplayTextures'
import {
  getHolsteredWeaponRechargeTargets,
  PASSIVE_WEAPON_RECHARGE_AMOUNT,
  PASSIVE_WEAPON_RECHARGE_INTERVAL_MS,
  rechargeWeaponEnergyValue,
  SABER_WEAPON_RECHARGE_AMOUNT,
  SABER_WEAPON_RECHARGE_COOLDOWN_MS
} from '../content/weaponEnergyEconomy'
import { AUTOMATION } from '../config/automation'
import { DEBUG_UI } from '../config/debug'
import { GAMEPLAY_ACTOR_CEILING, GAMEPLAY_VIEWPORT_TOP, getGameplayWorldBounds } from '../config/gameplayLayout'
import { GAME_HEIGHT, GAME_WIDTH, STRICT_PIXEL_RENDER_POLICY } from '../config/renderPolicy'
import { returnToStageSelect, showToast } from '../core/navigation'
import { DigitalButtonPad } from '../input/DigitalButtonPad'
import InputActions, { type SceneInputActions } from '../input/InputActions'
import { NewPlayerRuntime } from '../player/NewPlayerRuntime'
import { applyPlayerBodyProfile } from '../player/PlayerBodyProfiles'
import { PLAYER_GAMEPLAY_CONFIG, resolvePlayerPhysicsLimits } from '../player/config'
import { resolvePlayerFeatureFlags } from '../player/featureFlags'
import { resolveSwordHitboxOrigin, swordHitboxIntersectsTarget } from '../player/swordCollision'
import type { PlayerDamageRequest, PlayerDamageResult, ResolvedHitbox } from '../player/types'
import { ActiveRunSaveData, Save } from '../systems/Save'
import { queueStageBackgrounds, resolveGameStageId } from './game/stageBackgroundLoading'
import { parkTrailEmitter, reuseParkedTrailEmitter } from '../projectiles/trailEmitterParking'
import { DebugOverlay } from '../ui/DebugOverlay'
import { GameplayTouchControls } from '../ui/GameplayTouchControls'
import { HUD } from '../ui/HUD'
import { VictoryModal } from '../ui/VictoryModal'
import { DialogueOverlayController } from '../ui/DialogueOverlayController'
import { ensurePickupTextures, PICKUP_TEXTURE_KEYS } from '../ui/pickups/PickupTextures'
import type { DialoguePlaybackLine } from '../narrative/DialoguePlayback'
import {
  claimLocationCheck,
  drainPendingConsumable,
  evaluateFinalGate,
  getBossWeaknessProfile,
  getBusterDamageBonus,
  getLocationCheckId,
  getProgressionItemLabel,
  getPlayerMaxHpFromSave,
  getStageLocationDefinitions,
  getMovementSpeedMultiplier,
  getStageBossRewardLabel,
  getWeaponDamageBonus,
  getWeaknessStrictness,
  resolveBossDamageMultiplier,
  type ProgressionConsumableId
} from '../progression'
import { BossProjectileController } from '../boss/framework/BossProjectileController'
import { BossSceneEventBindings } from '../boss/framework/BossSceneEventBindings'
import { BossUIBinder } from '../boss/framework/BossUIBinder'
import { JumpController } from './game/JumpController'
import { evaluatePauseState } from './game/pauseLogic'
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
  getLatestActiveProjectile,
  spawnDebugProjectileClash,
  summarizeProjectilePool,
  ProjectileCollisionRouter,
  ProjectileRegistry,
  ProjectileSystem,
  PROJECTILES_ATLAS_KEY,
  canAffordPlayerShot,
  energyAfterPlayerShot,
  resolvePlayerShot
} from '../projectiles'

const EFFECTS_ATLAS_KEY = 'atlas_effects_core'
const HAZARD_SPIKES_TEXTURE = GAMEPLAY_TEXTURE_KEYS.spikeBank
const SABER_TRAIL_FRAMES = ['effects_core/core/004', 'effects_core/core/005', 'effects_core/core/013', 'effects_core/core/021']
const CHARGE_AURA_FRAMES = ['effects_core/core/006', 'effects_core/core/007', 'effects_core/core/014', 'effects_core/core/015']
const PROJECTILE_CLASH_FRAMES = ['effects_core/core/011', 'effects_core/core/019', 'effects_core/core/003']
const JUMP_VELOCITY = -420

interface GameData {
  bossId: BossId
}



export class Game extends Phaser.Scene {
  private actions!: SceneInputActions
  private player!: Phaser.Physics.Arcade.Sprite
  private playerBullets!: Phaser.Physics.Arcade.Group
  private bossBullets!: Phaser.Physics.Arcade.Group
  private projectileRegistry!: ProjectileRegistry
  private projectileSystem!: ProjectileSystem
  private projectileCollisionRouter!: ProjectileCollisionRouter
  private hazards!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private drops?: Phaser.Physics.Arcade.Group
  private progressionPickups?: Phaser.Physics.Arcade.Group
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
  private dialogueOverlay?: DialogueOverlayController
  private bossHitFeedbackTimer?: Phaser.Time.TimerEvent
  private hitstopRemainingFrames = 0

  private onHitstop = (frames: number) => {
    this.hitstopRemainingFrames = Math.max(this.hitstopRemainingFrames, frames)
    this.physics.world.pause()
    this.newPlayerRuntime?.pauseAnimations?.()
    this.enemySpawner?.pauseAnimations?.()
    this.bossController?.pauseAnimations?.()
  }

  private onCameraShake = (config: { intensity: number; duration: number }) => {
    if (!Settings.get().screenShake) return
    // Shake amplitude is intensity * canvas width * zoom; the HD canvas is already zoom times wider.
    this.cameras.main.shake(config.duration, config.intensity / Math.max(1, this.cameras.main.zoom))
  }

  private spawnGroundSlamHazard(origin: Phaser.GameObjects.GameObject, attackData?: any): void {
    if (!this.hazards) {
      return
    }
    const attackId = String(attackData?.id ?? 'ground_slam')
    const radius = Math.max(24, Number(attackData?.params?.radius ?? 72))
    const duration = Math.max(200, Number(attackData?.params?.hazardDuration ?? 700))
    const activeBossHazards = this.countActiveBossRoomHazards()
    const cap = this.bossController?.getRoomHazardCap() ?? 3
    const rings = Math.max(0, Math.min(3, cap - activeBossHazards))
    const direction = this.bossController?.getAttackFacing() ?? 1
    const texture =
      attackId === 'ignition_dash' || attackId === 'toxic_slide'
        ? GAMEPLAY_TEXTURE_KEYS.flameVent
        : HAZARD_SPIKES_TEXTURE
    for (let i = 0; i < rings; i += 1) {
      const laneOffset = attackId === 'ignition_dash' ? direction * i * (radius * 0.42) : (i - 1) * (radius * 0.45)
      const x = origin.x + laneOffset
      const hazard = this.hazards.create(x, origin.y + 16, texture)
      hazard.setDataEnabled?.()
      hazard.data?.set?.('damageSourceType', 'boss_projectile')
      hazard.data?.set?.('damageSourceId', attackId)
      hazard.data?.set?.('damageAmount', Number(attackData?.hit?.damageAmount ?? 2))
      hazard.data?.set?.('bossRoomHazard', true)
      hazard.refreshBody()
      const body = hazard.body as Phaser.Physics.Arcade.StaticBody | undefined
      if (body) body.enable = false
      hazard.setAlpha(0.22)
      hazard.setTint(this.bossController?.blueprint.theme.glow ?? 0xffffff)
      this.tweens.add({
        targets: hazard,
        alpha: 0.82 - i * 0.08,
        duration: 180,
        yoyo: false,
        onComplete: () => {
          if (!hazard.active) return
          hazard.clearTint()
          if (body) body.enable = true
        }
      })
      this.time.delayedCall(180 + duration + i * 90, () => hazard.destroy())
    }
  }

  private countActiveBossRoomHazards(): number {
    if (!this.hazards) return 0
    return this.hazards.getChildren().filter((hazard: any) =>
      Boolean(hazard?.active && hazard?.data?.get?.('bossRoomHazard'))
    ).length
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
    const parked = reuseParkedTrailEmitter<Phaser.GameObjects.Particles.ParticleEmitter>(bullet)
    if (parked) return parked
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
      getBossAttackFacing: () => this.bossController?.getAttackFacing() ?? 1,
      getTrailTint: () => this.bossController?.blueprint.theme.trail ?? 0x55ccff,
      createTrailEmitter: (bullet) => this.createBossProjectileTrailEmitter(bullet),
      registerProjectile: (bullet, kind) => this.devRegister(bullet, kind),
      playAttackSfx: (name) => AudioService.playSfx(name),
      setActionLabel: (text) => {
        this.updatePhaseHud(text)
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
  private virtualButtons?: DigitalButtonPad
  private touchControls?: GameplayTouchControls
  private currentWeaponIndex = 0
  private weapons: string[] = ['Buster']
  private weaponEnergyById: Record<string, number> = buildWeaponEnergySnapshot([])
  private facing: 1 | -1 = 1
  private currentPhaseName = ''
  // [REGION: CHARGE-AURA - BEGIN]
  // [REGION: CHARGE-AURA - END]
  private debugOverlay?: DebugOverlay
  private readonly combatDebugBus = new CombatDebugBus()
  private readonly jumpController = new JumpController(JUMP_VELOCITY)
  private readonly playerFeatureFlags = resolvePlayerFeatureFlags()
  private readonly enemyFeatureFlags = resolveEnemyFeatureFlags()
  private newPlayerRuntime?: NewPlayerRuntime
  private enemySpawner?: EnemySpawner
  private debugToggleHandler?: () => void
  private pauseOverlay?: Phaser.GameObjects.Container
  private paused = false
  private playerMaxHp = 0
  private playerHp = 0
  private weaponEnergy = { current: 28, max: 28 }
  private passiveWeaponRechargeAccumulatorMs = 0
  private lastSaberWeaponRechargeAtMs = Number.NEGATIVE_INFINITY
  private playerLives = 0
  private respawnPoint?: Phaser.Math.Vector2
  private currentCheckpointIndex = 0
  private currentCheckpointId: string | null = null
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
  private progressionSave = Save.load()
  private sessionStats = new CampaignSessionStatistics()
  private flushStatistics(): void {
    this.progressionSave = this.sessionStats.flush(Save.load())
    Save.save(this.progressionSave)
  }
  private bossUsingPlaceholder = false
  private storyDirector?: StoryDirector
  private selectedSubTank = 0
  private toastLane?: ToastLane
  private stageBackgroundLayers: Phaser.GameObjects.TileSprite[] = []
  private stageBackgroundBackdrop?: Phaser.GameObjects.Graphics
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
        label?: Phaser.GameObjects.Text
      }
    >(),
    nextId: 1
  }
  // ======================= [DEV-UX-END]

  // [REGION: STAGE-BUILDER - BEGIN]
  private clearStageBackgroundLayers(): void {
    this.stageBackgroundLayers.forEach((layer) => layer.destroy())
    this.stageBackgroundLayers = []
    this.stageBackgroundBackdrop?.destroy()
    this.stageBackgroundBackdrop = undefined
  }

  private renderStageBackground(stageId: string, worldWidth: number): void {
    this.clearStageBackgroundLayers()

    const stage = getCampaignStage(stageId)
    // Game pixels, not this.scale (canvas pixels): the parallax canvases were 252*scale tall, 32MB at scale 6.
    const height = GAME_HEIGHT
    const layers = stage.arena.background?.layers ?? []
    const baseColor = Phaser.Display.Color.HexStringToColor(stage.arena.background.baseColor).color
    const accentColor = layers.find((layer) => typeof layer.tint === 'number')?.tint ?? 0x4a8cff
    const backdrop = this.add.graphics().setDepth(-50)
    backdrop.fillStyle(baseColor, 1).fillRect(0, 0, worldWidth, height)
    backdrop.fillStyle(accentColor, 0.1).fillRect(0, GAMEPLAY_VIEWPORT_TOP, worldWidth, height - GAMEPLAY_VIEWPORT_TOP)
    for (let y = GAMEPLAY_VIEWPORT_TOP; y < height; y += 14) {
      const depthAlpha = 0.08 + ((y - GAMEPLAY_VIEWPORT_TOP) / Math.max(1, height - GAMEPLAY_VIEWPORT_TOP)) * 0.1
      backdrop.fillStyle(accentColor, depthAlpha).fillRect(0, y, worldWidth, 1)
    }
    backdrop.lineStyle(1, accentColor, 0.1)
    for (let x = 0; x < worldWidth; x += 64) {
      backdrop.lineBetween(x, GAMEPLAY_VIEWPORT_TOP, x + 32, height)
    }
    backdrop.fillStyle(accentColor, 0.45).fillRect(0, GAMEPLAY_VIEWPORT_TOP, worldWidth, 2)
    this.stageBackgroundBackdrop = backdrop
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
    const worldWidth = Math.max(GAME_WIDTH, Number(stage.arena.width ?? GAME_WIDTH))
    this.cameras.main.setBounds(0, 0, worldWidth, GAME_HEIGHT)
    this.bossRoomCameraLocked = false
  }

  private applyBossRoomCameraLock(): void {
    if (!this.activeBossRoom?.lockCamera) {
      return
    }
    const bounds = getBossRoomCameraBounds(this.activeBossRoom, GAME_HEIGHT)
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
    const width = GAME_WIDTH
    const height = GAME_HEIGHT
    const worldWidth = Math.max(width, Number(cfg.width ?? width))
    this.activeBossRoom = cfg.bossRoom

    const gameplayBounds = getGameplayWorldBounds(worldWidth, height)
    this.physics.world.setBounds(
      gameplayBounds.x,
      gameplayBounds.y,
      gameplayBounds.width,
      gameplayBounds.height,
      cfg.leftWall,
      cfg.rightWall,
      true,
      !cfg.allowFallOff
    )
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
    const gateHeight = Math.max(96, GAME_HEIGHT - 26)
    const gate = this.add
      .rectangle(this.bossGateLockX, GAME_HEIGHT * 0.5, gateWidth, gateHeight, 0x7ec8ff, 0.28)
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
    this.currentCheckpointId = nextCheckpoint.id
    this.flushStatistics()
    Save.unlockCheckpoint(this.activeStageId, nextCheckpoint.id)
    this.autosaveActiveRun()
    this.progressionSave = Save.load()
    if (this.storyDirector) {
      this.storyDirector.onCheckpoint(this.currentCheckpointIndex, nextCheckpoint)
    } else {
      this.showStageToast(`Checkpoint ${this.currentCheckpointIndex + 1}`, 900)
    }
    if (this.currentCheckpointIndex >= stage.arena.checkpoints.length - 1 || this.player.x >= stage.arena.bossRoom.x) {
      this.activateBossEncounter()
    }
  }

  private refreshWeaponsFromProgression(): void {
    const currentWeaponId = this.getCurrentWeaponId()
    this.weapons = buildWeaponOrder(this.progressionSave.weaponsUnlocked)
    const nextIndex = this.weapons.indexOf(currentWeaponId)
    this.currentWeaponIndex = nextIndex >= 0 ? nextIndex : Phaser.Math.Clamp(this.currentWeaponIndex, 0, this.weapons.length - 1)
    this.weaponEnergyById = {
      ...buildWeaponEnergySnapshot(this.progressionSave.weaponsUnlocked),
      ...this.weaponEnergyById
    }
    this.updateWeaponLabel()
  }

  private applyProgressionMovementModifiers(): void {
    if (!this.player) {
      return
    }
    const speedMultiplier = getMovementSpeedMultiplier(this.progressionSave)
    const limits = resolvePlayerPhysicsLimits(PLAYER_GAMEPLAY_CONFIG, speedMultiplier)
    this.player.setMaxVelocity(limits.maxVelocityX, limits.maxVelocityY)
    this.newPlayerRuntime?.setUpgradeModifiers(resolveUpgradeModifiers(this.progressionSave))
  }

  private applySelectedCheckpoint(stageId: string, checkpointId?: string | null): void {
    const stage = getCampaignStage(stageId)
    const selectedId = checkpointId ?? Save.load().selectedCheckpointByStage?.[stageId] ?? stage.arena.checkpoints[0]?.id
    const checkpointIndex = Math.max(
      0,
      stage.arena.checkpoints.findIndex((checkpoint) => checkpoint.id === selectedId)
    )
    const checkpoint = stage.arena.checkpoints[checkpointIndex] ?? stage.arena.checkpoints[0]
    if (!checkpoint || !this.player) {
      return
    }
    this.currentCheckpointIndex = checkpointIndex
    this.currentCheckpointId = checkpoint.id
    this.player.setPosition(checkpoint.x, checkpoint.y)
    this.respawnPoint = new Phaser.Math.Vector2(checkpoint.x, checkpoint.y)
    Save.setSelectedCheckpoint(stageId, checkpoint.id)
    Save.unlockCheckpoint(stageId, checkpoint.id)
    this.progressionSave = Save.load()
  }

  private spawnProgressionPickups(stageId: string): void {
    if (!this.progressionPickups) {
      return
    }
    const collected = new Set(this.progressionSave.collectedChecks)
    getStageLocationDefinitions(stageId)
      .filter((location) => location.category !== 'boss_clear' && location.x != null && location.y != null)
      .filter((location) => !collected.has(location.id))
      .forEach((location) => {
        const textureKey =
          location.category === 'capsule'
            ? PICKUP_TEXTURE_KEYS.upgrade
            : location.category === 'heart_tank'
              ? PICKUP_TEXTURE_KEYS.heartTank
              : location.category === 'sub_tank'
                ? PICKUP_TEXTURE_KEYS.subTank
                : PICKUP_TEXTURE_KEYS.bonus
        const pickup = this.progressionPickups?.create(
          Number(location.x),
          Number(location.y),
          textureKey
        ) as Phaser.Physics.Arcade.Sprite | undefined
        if (!pickup) {
          return
        }
        pickup.setActive(true).setVisible(true).setDepth(5)
        pickup.setScale(location.category === 'capsule' ? 1.08 : 1)
        pickup.setDataEnabled()
        pickup.data?.set('locationId', location.id)
        pickup.data?.set('locationCategory', location.category)
        pickup.clearTint()
        const body = pickup.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          body.enable = true
          body.setAllowGravity(false)
          body.setImmovable(true)
        }
      })
  }

  private onProgressionPickupCollected(
    _playerObj: Phaser.GameObjects.GameObject,
    pickupObj: Phaser.GameObjects.GameObject
  ): void {
    const pickup = pickupObj as Phaser.Physics.Arcade.Sprite
    if (!pickup?.active) {
      return
    }
    const locationId = String(pickup.data?.get?.('locationId') ?? '') as Parameters<typeof claimLocationCheck>[1]
    if (!locationId) {
      return
    }
    const body = pickup.body as Phaser.Physics.Arcade.Body | undefined
    body?.setVelocity(0, 0)
    if (body) {
      body.enable = false
    }
    pickup.setActive(false).setVisible(false)
    this.collectProgressionLocation(locationId)
  }

  private collectProgressionLocation(locationId: string): void {
    this.flushStatistics()
    const previous = this.progressionSave
    const claim = claimLocationCheck(previous, locationId as any)
    if (claim.duplicate) {
      return
    }
    const next = this.sessionStats.claim(claim.nextSave, locationId, claim.duplicate)
    Save.save(next)
    this.progressionSave = Save.load()
    this.applyProgressionStateToRuntime(previous, this.progressionSave, claim.itemId)
  }

  private applyProgressionStateToRuntime(previous: any, next: any, itemId: string | null): void {
    if (itemId) {
      const effect = upgradeEffectLabel(itemId, next.progressionWorld?.progressionMode === 'classic')
      this.showStageToast(effect ? `${getProgressionItemLabel(itemId).toUpperCase()} · ${effect}` : `CHECK SECURED • ${getProgressionItemLabel(itemId).toUpperCase()}`, effect ? 1800 : 1100)
    }

    if (previous.weaponsUnlocked.join(',') !== next.weaponsUnlocked.join(',')) {
      this.refreshWeaponsFromProgression()
    }

    const previousMaxHp = getPlayerMaxHpFromSave(previous)
    const nextMaxHp = getPlayerMaxHpFromSave(next)
    if (nextMaxHp !== previousMaxHp) {
      const gained = nextMaxHp - previousMaxHp
      this.playerMaxHp = nextMaxHp
      this.playerHp = Math.min(nextMaxHp, this.playerHp + Math.max(0, gained))
      this.player.data?.set?.('hp', this.playerHp)
      this.player.data?.set?.('maxHp', this.playerMaxHp)
      this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)
    }

    this.applyProgressionMovementModifiers()
    this.flushPendingProgressionItems()
  }

  private flushPendingProgressionItems(): void {
    let working = this.progressionSave
    while ((working.pendingProgressionItems?.length ?? 0) > 0) {
      const drained = drainPendingConsumable(working)
      if (!drained.item) {
        break
      }
      const consumed = this.applyPendingConsumable(drained.item.itemId, drained.item.amount)
      if (consumed < drained.item.amount) {
        working = {
          ...drained.nextSave,
          pendingProgressionItems: [
            {
              itemId: drained.item.itemId,
              amount: drained.item.amount - consumed
            },
            ...(drained.nextSave.pendingProgressionItems ?? [])
          ]
        }
        Save.save(working)
        this.progressionSave = Save.load()
        return
      }
      working = drained.nextSave
      Save.save(working)
      this.progressionSave = Save.load()
    }
  }

  private applyPendingConsumable(itemId: ProgressionConsumableId, amount: number): number {
    if (itemId.startsWith('hp_')) {
      const healed = this.restorePlayerHealth(amount)
      if (healed > 0) {
        AudioService.playSfx('pickup_health')
        this.showStageToast(`HP +${healed}`, 700)
      }
      return healed
    }
    const ammo = this.restoreWeaponEnergy(amount)
    if (ammo.restored > 0) {
      AudioService.playSfx('pickup_ammo')
      this.showStageToast(
        `${getWeaponDisplayName(ammo.weaponId ?? 'Buster').toUpperCase()} +${ammo.restored}`,
        700
      )
    }
    return ammo.restored
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
    const phase = this.bossController?.currentPhase
    if (phase) {
      this.currentPhaseName = phase.name.toUpperCase()
      this.updatePhaseHud()
    } else {
      this.phaseLabel.setText('BOSS\nACTIVE')
    }
    if (!this.storyDirector) {
      this.showStageToast('Boss room sealed', 800)
      this.beginBossCombat()
      return
    }
    this.storyDirector.playBossIntro(() => this.beginBossCombat())
  }

  private beginBossCombat(): void {
    this.bossController?.unlockIntro()
    this.bossUiBinder?.onFightStart()
    this.hud?.setBossBarVisible(Boolean(this.bossHp))
  }

  private dialogueValues(): DialogueInterpolationValues {
    const stage = getCampaignStage(this.activeStageId)
    const clearedCount = countClearedRobotMasters(this.progressionSave)
    return {
      hero: IDENTITY.HERO_CALLSIGN,
      rewardLabel: getStageBossRewardLabel(
        this.progressionSave,
        stage.id,
        stage.rewardWeaponId ? getWeaponDisplayName(stage.rewardWeaponId) : 'campaign access'
      ),
      clearedCount,
      remainingCount: Math.max(0, 8 - clearedCount),
      districtName: stage.district,
      wardenName: getBossById(stage.bossId)?.codename ?? stage.title
    }
  }

  /** Automation and smoke read this; the StoryDirector owns the policy. */
  buildDialogueLines(stageId: string, trigger: DialogueTrigger): DialoguePlaybackLine[] {
    return this.storyDirector?.buildLines(stageId, trigger) ?? []
  }

  private freezeForDialogue(): void {
    this.newPlayerRuntime?.cancelPendingCharge()
    this.physics.world.pause()
    this.newPlayerRuntime?.pauseAnimations?.()
    this.enemySpawner?.pauseAnimations?.()
    this.bossController?.pauseAnimations?.()
  }

  private resumeAfterDialogue(): void {
    if (this.victoryTriggered || this.paused) return
    this.physics.world.resume()
    this.newPlayerRuntime?.resumeAnimations?.()
    this.enemySpawner?.resumeAnimations?.()
    this.bossController?.resumeAnimations?.()
  }

  private checkStageKillPlane(): void {
    if (!this.player || !this.player.active || this.fallingToDeath) {
      return
    }
    const stage = getCampaignStage(this.activeStageId)
    if (!stage.arena.allowFallOff) {
      return
    }
    if (this.player.y <= GAME_HEIGHT + 40) {
      return
    }
    this.requestPlayerDamage({
      amount: Math.max(1, this.playerHp),
      tier: 'heavy',
      sourceType: 'fall',
      sourceId: 'stage_kill_plane',
      bypassIFrames: true,
      knockback: { x: 0, y: 0 }
    })
  }

  private killPlayer(reason: 'pit' | 'debug' | 'damage'): void {
    if (!this.player || this.fallingToDeath) {
      return
    }
    this.sessionStats.defeat()
    this.flushStatistics()
    this.playerHp = 0
    this.player.data?.set?.('hp', this.playerHp)
    this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)
    this.fallingToDeath = true
    this.playerDeathAndRespawn()
  }

  private showStageToast(message: string, durationMs = 1200): void {
    if (this.toastLane) this.toastLane.enqueue({ kind: 'toast', text: message, durationMs })
    else showToast(this, message, durationMs)
  }

  private installProjectilePlatformCollisions(): void {
    if (!this.physics || !this.stagePlatforms) {
      return
    }

    this.physics.add.collider(
      this.playerBullets,
      this.stagePlatforms,
      this.recycleBullet,
      this.shouldProjectileHitPlatform,
      this
    )
    this.physics.add.collider(
      this.bossBullets,
      this.stagePlatforms,
      this.recycleBullet,
      this.shouldProjectileHitPlatform,
      this
    )
  }

  private shouldProjectileHitPlatform(
    objA: Phaser.GameObjects.GameObject,
    objB: Phaser.GameObjects.GameObject
  ): boolean {
    const spriteA = objA as Phaser.Physics.Arcade.Sprite
    const spriteB = objB as Phaser.Physics.Arcade.Sprite
    const bullet =
      this.playerBullets?.contains(spriteA) || this.bossBullets?.contains(spriteA)
        ? spriteA
        : this.playerBullets?.contains(spriteB) || this.bossBullets?.contains(spriteB)
          ? spriteB
          : null
    const platform = bullet === spriteA ? spriteB : spriteA
    const platformBody = platform?.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | undefined
    if (!bullet || !platformBody) {
      return false
    }

    const visibleBounds = bullet.getBounds()
    const platformBounds = new Phaser.Geom.Rectangle(
      platformBody.x,
      platformBody.y,
      platformBody.width,
      platformBody.height
    )
    return Phaser.Geom.Rectangle.Overlaps(visibleBounds, platformBounds)
  }

  private handleDropThroughInput(now: number): void {
    if (!this.player || !this.newPlayerRuntime || !this.platformCollisionSystem) {
      return
    }

    const input = this.actions.snapshot()
    if (!input.jump.pressed || !input.aimDown.held) {
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
  private bossContactWire?: Phaser.Physics.Arcade.Collider
  private projectileClashWire?: Phaser.Physics.Arcade.Collider

  private installHitWires(): void {
    if (!this.physics) {
      return
    }

    this.bossHitWire?.destroy()
    this.playerHitWire?.destroy()
    this.bossContactWire?.destroy()
    this.projectileClashWire?.destroy()
    this.bossHitWire = undefined
    this.playerHitWire = undefined
    this.bossContactWire = undefined
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
      if (this.player) {
        this.bossContactWire = this.physics.add.overlap(
          this.player,
          target,
          (playerObj, bossObj) => this.onBossContact(playerObj, bossObj),
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
    world.createDebugGraphic?.()
    // createDebugGraphic() turns drawDebug on, which drew every body into this hidden graphic each frame.
    world.drawDebug = false
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

    installGameDebugHooks(this, dump)
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

    if (this.actions) {
      this.actions.onPressed('debugOverlay', toggleOverlay)
      this.actions.onPressed('debugDump', handleDump)
      this.actions.onPressed('debugPhysics', handlePhysics)

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this._dev.initOnce = false
        this._dev.entries.clear()
        this._dev.tick = 0
        uninstallGameDebugHooks(dump)
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

    // The overlay label is created in devUpdate the first time the overlay shows this entry: up to
    // 132 Text objects per stage (player, boss, every pooled bullet) otherwise sat unused in normal play.
    let entry = this._dev.entries.get(id)
    if (!entry) {
      entry = { kind, ref }
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

    for (const entry of this._dev.entries.values()) {
      const { kind, ref } = entry
      if (!ref?.active) {
        entry.label?.setVisible(false)
        continue
      }
      const label = (entry.label ??= this.add.text(0, 0, '', { fontFamily: 'monospace', fontSize: '8px', color: '#7fffd4' }).setDepth(10000))

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
    if (!AUTOMATION.enabled) return
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

  /** Loads only this stage's background layers; see stageBackgroundLoading.ts. */
  preload(): void {
    const data = this.sys.settings.data as GameData
    queueStageBackgrounds(this, resolveGameStageId(data, (data as any)?.loadFromSave ? Save.loadActiveRun() : null))
  }

  create(data: GameData): void {
    this.combatDebugBus.clear()
    this._bossSpawned = false
    this.bossBody = undefined
    this.bossArt = undefined
    this.bossTarget = undefined
    this.bossController = undefined

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
    })

    const manager = this.scene.manager
    if (!manager.keys['GameOver']) {
      this.scene.add('GameOver', GameOverScene, false)
    }

    this.actions = InputActions.forScene(this)
    this.actions.deferGameplayWhile(() => this.hitstopRemainingFrames > 0)
    this.devInit()
    const loadFromSave = Boolean((data as any)?.loadFromSave)
    this.loadedFromSave = loadFromSave
    this.progressionSave = Save.load()
    const activeRun = loadFromSave ? Save.loadActiveRun() : null
    this.sessionStats = new CampaignSessionStatistics(activeRun?.stageElapsedMs)
    installProgressionDebugHooks(this, (previous, next, item) => { this.progressionSave = next; this.applyProgressionStateToRuntime(previous, next, item) })
    const stageId = resolveGameStageId(data as any, activeRun)
    const stage = getCampaignStage(stageId)
    const bossIdFromQuery = AUTOMATION.enabled ? (params?.get('bossId') as BossId | null) : null
    const selectedBossId =
      (activeRun?.bossId as BossId | undefined) ?? bossIdFromQuery ?? data.bossId ?? stage.bossId
    this.activeBossId = selectedBossId
    this.activeStageId = stage.id
    const blueprint = getBossById(selectedBossId)
    const runtimeDefinitionId =
      (AUTOMATION.enabled ? params?.get('bossConfig') : null) ??
      (data as any)?.runtimeBossConfigId ??
      stage.runtimeBossConfigId
    const runtimeDefinition = runtimeDefinitionId ? getBossDefinitionById(runtimeDefinitionId) : undefined
    const bossMaxHp = runtimeDefinition?.maxHP ?? blueprint.baseStats?.maxHp ?? 20
    const bossCodename = runtimeDefinition?.displayName ?? blueprint.codename ?? blueprint.id
    const width = GAME_WIDTH
    const height = GAME_HEIGHT
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

    AudioService.playMusic(this, stage.id === FINAL_STAGE_ID ? 'final' : 'stage')
    const unlockAudio = () => AudioService.unlock()
    this.input.once('pointerdown', unlockAudio)
    this.createPauseOverlay(width, height)
    this.dialogueOverlay = new DialogueOverlayController(this)
    this.toastLane = new ToastLane(this)

    this.actions.onPressed('pause', () => this.openSystemMenu())
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
      this.events?.off?.(Phaser.Scenes.Events.RESUME, resumeHandler)
      this.events?.off?.(Phaser.Scenes.Events.WAKE, wakeHandler)
      this.physics?.world?.off?.('pause', physicsPauseHandler)
      this.physics?.world?.off?.('resume', physicsResumeHandler)
      this.dialogueOverlay = undefined
      this.toastLane = undefined
      this.storyDirector = undefined
    })

    this.actions.onPressed('debugOverlay', () => this.debugOverlay?.toggle())

    if (DEBUG_UI) {
      this.debugOverlay = new DebugOverlay(this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugOverlay?.destroy())
    }

    this.jumpController.reset()
    this.bossName = bossCodename
    this.bossHp = { current: bossMaxHp, max: bossMaxHp }
    this.weapons = buildWeaponOrder(this.progressionSave.weaponsUnlocked)
    this.weaponEnergyById = buildWeaponEnergySnapshot(this.progressionSave.weaponsUnlocked)
    this.passiveWeaponRechargeAccumulatorMs = 0
    this.lastSaberWeaponRechargeAtMs = Number.NEGATIVE_INFINITY

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
      .text(width / 2, 8, 'PHASE --', {
        fontFamily: 'monospace',
        fontSize: '7px',
        color: '#d4e7ff',
        align: 'center'
      })
      .setScrollFactor(0)
      .setOrigin(0.5, 0)
      .setDepth(1000)
    this.phaseLabel.setFixedSize(64, 24)
    this.phaseLabel.setLetterSpacing(1)
    this.phaseLabel.setShadow(0, 1, '#041224', 0, false, true)
    this.phaseLabel.setStroke('#0a2137', 2)

    this.events.on('player.hitstop', this.onHitstop)
    this.events.on('camera.shake', this.onCameraShake)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.events.off('player.hitstop', this.onHitstop)
      this.events.off('camera.shake', this.onCameraShake)
    })

    this.player = this.physics.add.sprite(stage.arena.spawn.x, stage.arena.spawn.y, 'atlas_player_main', 'player_main/idle/000')
    this.player.setCollideWorldBounds(true)
    this.player.setDragX(900)
    const movementSpeedMultiplier = getMovementSpeedMultiplier(this.progressionSave)
    const movementLimits = resolvePlayerPhysicsLimits(PLAYER_GAMEPLAY_CONFIG, movementSpeedMultiplier)
    this.player.setMaxVelocity(movementLimits.maxVelocityX, movementLimits.maxVelocityY)
    applyPlayerBodyProfile(this.player, 'stand')
    this.playAnimationSafe(this.player, 'player-idle')
    this.playerMaxHp = getPlayerMaxHpFromSave(this.progressionSave)
    this.playerHp = this.playerMaxHp
    this.playerLives = 3
    this.respawnPoint = new Phaser.Math.Vector2(this.player.x, this.player.y)
    this.currentCheckpointIndex = 0
    this.currentCheckpointId = stage.arena.checkpoints[0]?.id ?? null
    this.player.setDataEnabled()
    this.player.data.set('hp', this.playerHp)
    this.player.data.set('maxHp', this.playerMaxHp)
    this.devRegister(this.player, 'player')

    this.buildStage(stageId)
    ensurePickupTextures(this)

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
      damagePlayer: (damage, meta) =>
        this.requestPlayerDamage({
          amount: damage,
          tier: meta.tier,
          sourceType: meta.sourceType,
          sourceId: meta.sourceId,
          direction: meta.direction,
          element: meta.element
        }),
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
      const sprite = this.hazards.create(hazard.x, hazard.y, resolveStageHazardTexture(hazard.id))
      sprite.setDataEnabled?.()
      sprite.data?.set?.('damageSourceType', 'hazard')
      sprite.data?.set?.('damageSourceId', hazard.id)
      sprite.data?.set?.('damageAmount', 1)
      sprite.setSize?.(28, 10)
      sprite.refreshBody()
    })

    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite })
    this.drops = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 24,
      allowGravity: true
    })
    this.progressionPickups = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 32,
      allowGravity: false,
      immovable: true
    })
    this.installEntityPlatformCollisions()

    this.initializeEnemyFramework(stageId)

    // The modular BossController below is the single authoritative boss actor.
    // Do not create a second legacy sprite here: even when hidden, that actor
    // retained independent physics, position, animation, and facing state and
    // could reappear as the vertically offset "double boss" seen in playtests.
    this.prepareBossArtVisuals(selectedBossId)
    this.bossHp = { current: bossMaxHp, max: bossMaxHp }
    this.bossName = bossCodename

    this.installEntityPlatformCollisions()
    this.installHitWires()

    this.physics.add.overlap(this.player, this.hazards, this.onHazardContact, undefined, this)
    this.physics.add.overlap(this.player, this.enemies, this.onEnemyContact, undefined, this)
    if (this.drops) {
      this.physics.add.overlap(this.player, this.drops, this.onPickupCollected, undefined, this)
      if (this.stagePlatforms) {
        this.physics.add.collider(this.drops, this.stagePlatforms)
      }
    }
    if (this.progressionPickups) {
      this.physics.add.overlap(this.player, this.progressionPickups, this.onProgressionPickupCollected, undefined, this)
    }
    this.physics.add.overlap(this.playerBullets, this.enemies, this.onBulletHitsEnemy, undefined, this)

    this.installProjectilePlatformCollisions()

    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.handleWorldBounds)

    this.virtualButtons = new DigitalButtonPad()
    this.actions.setTouchSource(this.virtualButtons)
    this.touchControls?.destroy()
    this.touchControls = undefined
    if (this.playerFeatureFlags.enableTouchControls && GameplayTouchControls.shouldEnable()) {
      this.touchControls = new GameplayTouchControls(this, this.virtualButtons, {
        onPause: () => this.actions.pulse('pause')
      })
      this.touchControls.setVisible(true)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        this.touchControls?.destroy()
        this.touchControls = undefined
      })
    }
    this.newPlayerRuntime = new NewPlayerRuntime(
      this,
      this.player,
      this.actions,
      this.playerFeatureFlags,
      {
        setAnimation: (key) => this.setPlayerAnimation(key),
        spawnProjectile: (request) => this.fireBulletFromRuntime(request),
        canChargeProjectile: () => this.getCurrentWeaponConfig().allowCharge,
        applySwordHitbox: (hitbox) => this.applySwordHitboxFromRuntime(hitbox),
        applyDamage: (damage) => this.commitPlayerDamage(damage)
      },
      this.virtualButtons
    )
    this.newPlayerRuntime.setMovementSpeedMultiplier(movementSpeedMultiplier)
    this.playerMaxHp = Math.max(this.playerMaxHp, 8)
    this.playerHp = this.playerMaxHp
    this.player.data?.set('hp', this.playerHp)
    this.player.data?.set('maxHp', this.playerMaxHp)
    this.updateWeaponLabel()

    this.bossController = new BossController(this, blueprint, {
      spawn: new Phaser.Math.Vector2(stage.arena.bossSpawn.x, stage.arena.bossSpawn.y),
      lockIntro: true,
      runtimeDefinition,
      movementBounds: getBossRoomMovementBounds(stage.arena.bossRoom),
      getActiveHazardCount: () => this.countActiveBossRoomHazards()
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
    this.applySelectedCheckpoint(stageId, activeRun?.checkpointId ?? (data as any)?.checkpointId ?? null)
    this.spawnProgressionPickups(stageId)
    this.applyActiveRunSnapshot(activeRun)
    this.flushPendingProgressionItems()
    if (!activeRun) this.autosaveActiveRun()
    this.currentPhaseName = this.bossController.currentPhase.name.toUpperCase()
    this.phaseLabel.setText('BOSS GATE\nADVANCE')
    this.bossSceneEvents?.destroy()
    this.bossSceneEvents = new BossSceneEventBindings({
      events: this.events,
      playBossMusic: () => AudioService.playMusic(this, 'boss'),
      playStageMusic: () => AudioService.playMusic(this, stage.id === FINAL_STAGE_ID ? 'final' : 'stage'),
      onPhaseChanged: (phaseName) => {
        this.currentPhaseName = phaseName
        this.updatePhaseHud()
      },
      onAttack: (event) => {
        this.bossProjectileController?.onBossAttack(event.attack, event.attackData)
      },
      onBossDamage: (hp) => {
        this.bossHp = { current: hp.current, max: hp.max }
      },
      onBossDefeated: (rewardName) => {
        this.phaseLabel.setText(`VICTORY\n${rewardName.toUpperCase().slice(0, 12)}`)
        this.onBossDefeated()
      }
    })
    this.bossSceneEvents.bind()

    this.applyProgressionMovementModifiers()
    this.cameras.main.startFollow(this.player, false, 0.1, 0.1)
    this.storyDirector = new StoryDirector({
      scene: this,
      stageId: stage.id as any,
      overlay: () => this.dialogueOverlay,
      lane: () => this.toastLane,
      values: () => this.dialogueValues(),
      freeze: () => this.freezeForDialogue(),
      resume: () => this.resumeAfterDialogue()
    })
    this.storyDirector.beginStage(
      { resumedFromRun: Boolean(activeRun), startCheckpointIndex: this.currentCheckpointIndex },
      () => {}
    )
  }

  update(_time: number, delta: number): void {
    this.sessionStats.tick(delta, Boolean(this.player?.active && !this.paused && !this.victoryTriggered && !this.dialogueOverlay?.isActive() && !this.victoryModal?.isOpen() && !this.storyDirector?.isBlocking()))
    if (this.hitstopRemainingFrames > 0) {
      this.hitstopRemainingFrames -= 1
      if (this.hitstopRemainingFrames <= 0) {
        this.physics.world.resume()
        this.newPlayerRuntime?.resumeAnimations?.()
        this.enemySpawner?.resumeAnimations?.()
        this.bossController?.resumeAnimations?.()
      }
      return
    }

    if (!this.player || !this.actions) {
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

    if (this.dialogueOverlay?.isActive()) {
      this.devUpdate()
      return
    }

    if (this.storyDirector?.isBlocking()) {
      this.storyDirector.update(delta)
      this.devUpdate()
      return
    }
    this.toastLane?.update(delta)

    if (pauseState.skipUpdate) {
      this.bossUpdate(now)
      this.enemySpawner?.update(now, delta)
      this.devUpdate()
      return
    }

    this.registry.set('player_x', this.player.x)
    this.registry.set('player_y', this.player.y)

    if (!this.newPlayerRuntime) {
      throw new Error('[Game] NewPlayerRuntime is required in v2 runtime')
    }
    this.handleDropThroughInput(now)
    this.handleWeaponCycling()
    this.newPlayerRuntime.update(now, delta)
    this.updateWeaponEnergyRecharge(delta)
    this.projectileSystem?.update(now, delta, {
      player: this.player,
      enemyReturnTarget: this.bossController
    })
    this.updateRespawnCheckpoint()
    this.updateBossEncounterActivation()
    if (this.dialogueOverlay?.isActive()) {
      this.devUpdate()
      return
    }
    this.checkStageKillPlane()
    this.facing = this.newPlayerRuntime.getFacing()
    this.bossUpdate(now)
    this.bossProjectileController?.update(now, delta)
    this.enemySpawner?.update(now, delta)
    this.devUpdate()

    this.updateBossControllerSafe()
  }

  private createPauseOverlay(width: number, height: number): void {
    this.pauseOverlay = createPauseOverlay(this, width, height)
  }

  private openSystemMenu(): void {
    if (this.dialogueOverlay?.isActive()) {
      this.dialogueOverlay.skip()
      return
    }
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

  private setPaused(paused: boolean): void {
    if (this.paused === paused) {
      return
    }

    this.paused = paused
    if (paused) {
      this.newPlayerRuntime?.cancelPendingCharge()
      this.physics.world.pause()
    } else {
      this.physics.world.resume()
    }

    this.pauseOverlay?.setVisible(paused)
  }

  private initializeHud(): void {
    this.hud = new HUD(this)
    const bossLabelRaw =
      this.bossController?.blueprint.codename ??
      this.bossBody?.data?.get?.('name') ??
      this.bossName ??
      '??'
    this.hud.setNames(IDENTITY.DEV_SKIN.enabled ? IDENTITY.DEV_SKIN.heroLabel : IDENTITY.HERO_CALLSIGN, String(bossLabelRaw))
    this.hud.setWeaponName(getWeaponDisplayName(this.getCurrentWeaponId()))
    this.hud.setWeaponColor(this.getCurrentWeaponConfig().tint)
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
    if (this.actions.snapshot().weaponNext.pressed) {
      this.changeWeapon(1)
    }

    if (this.actions.snapshot().weaponPrev.pressed) {
      this.changeWeapon(-1)
    }
  }

  private updateWeaponEnergyRecharge(deltaMs: number): void {
    this.passiveWeaponRechargeAccumulatorMs += Math.max(0, deltaMs)
    const ticks = Math.min(
      4,
      Math.floor(this.passiveWeaponRechargeAccumulatorMs / PASSIVE_WEAPON_RECHARGE_INTERVAL_MS)
    )
    if (ticks <= 0) {
      return
    }
    this.passiveWeaponRechargeAccumulatorMs -= ticks * PASSIVE_WEAPON_RECHARGE_INTERVAL_MS
    const selectedWeaponId = this.getCurrentWeaponId()
    const targets = getHolsteredWeaponRechargeTargets(this.weapons, selectedWeaponId)
    for (const weaponId of targets) {
      const config = getWeaponConfig(weaponId)
      const current = this.weaponEnergyById[weaponId] ?? config.maxEnergy
      const result = rechargeWeaponEnergyValue(
        current,
        config.maxEnergy,
        PASSIVE_WEAPON_RECHARGE_AMOUNT * ticks
      )
      this.weaponEnergyById[weaponId] = result.next
    }
  }

  private rechargeSelectedWeaponFromSaber(): number {
    const weaponId = this.getCurrentWeaponId()
    if (weaponId === 'Buster' || this.time.now - this.lastSaberWeaponRechargeAtMs < SABER_WEAPON_RECHARGE_COOLDOWN_MS) {
      return 0
    }
    const config = getWeaponConfig(weaponId)
    const current = this.weaponEnergyById[weaponId] ?? config.maxEnergy
    const result = rechargeWeaponEnergyValue(current, config.maxEnergy, SABER_WEAPON_RECHARGE_AMOUNT)
    this.lastSaberWeaponRechargeAtMs = this.time.now
    if (result.restored <= 0) {
      return 0
    }
    this.weaponEnergyById[weaponId] = result.next
    this.syncWeaponHud()
    if (current === 0) {
      this.showStageToast(`${getWeaponDisplayName(weaponId).toUpperCase()} REBOOT +${result.restored}`, 550)
    }
    return result.restored
  }

  getWeaponEnergyDebugState(): Record<string, unknown> {
    return {
      selectedWeaponId: this.getCurrentWeaponId(),
      inventory: { ...this.weaponEnergyById },
      saberRechargeAmount: SABER_WEAPON_RECHARGE_AMOUNT,
      saberCooldownMs: SABER_WEAPON_RECHARGE_COOLDOWN_MS,
      passiveRechargeAmount: PASSIVE_WEAPON_RECHARGE_AMOUNT,
      passiveIntervalMs: PASSIVE_WEAPON_RECHARGE_INTERVAL_MS,
      passiveAccumulatorMs: Math.round(this.passiveWeaponRechargeAccumulatorMs)
    }
  }

  private fireBulletFromRuntime(config: {
    type: 'pellet' | 'charge'
    weaponId?: 'ArcSlash'
    chargeLevel: 0 | 1 | 2 | 3 | 4
    facing: 1 | -1
  }): boolean {
    if (!this.player?.active) {
      return false
    }
    const currentWeapon = this.getCurrentWeaponConfig()
    const fired = firePlayerShot({ request: config, equippedWeaponId: currentWeapon.id, availableEnergy: this.weaponEnergyById[currentWeapon.id] ?? currentWeapon.maxEnergy, x: this.player.x + (config.facing === -1 ? -8 : 8), y: this.player.y - 6, activeBusterCount: this.playerBullets.countActive(true), modifiers: resolveUpgradeModifiers(this.progressionSave), spawn: request => this.projectileSystem?.spawn(request) })
    if (!fired) return false
    const { projectile: bullet, shot } = fired
    this.weaponEnergyById[currentWeapon.id] = fired.remainingEnergy
    this.devRegister(bullet, 'bullet')
    this.syncWeaponHud()
    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    return {
      source: 'player',
      projectileId: shot.projectileId,
      weaponId: shot.weapon.id,
      weaponElement: shot.weapon.element,
      chargeLevel: shot.chargeLevel,
      damage: Number(bullet.data?.get?.('damage') ?? shot.weapon.damage),
      speed: Math.round(Math.hypot(body?.velocity.x ?? 0, body?.velocity.y ?? 0)),
      scale: Number(bullet.scaleX ?? shot.weapon.scale),
      pierce: Number(bullet.data?.get?.('pierceRemaining') ?? shot.weapon.projectile.pierce),
      impactFxKey: shot.impactFxKey,
      energyCost: shot.energyCost,
      energyRemaining: this.weaponEnergyById[currentWeapon.id]
    }
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

  private ensurePlayerBulletTexture(): void {
    // Placeholder retained for now; bullets are atlas-backed.
  }

  // [REGION: BOSS-ART-PLACEHOLDER - BEGIN]
  /** BossController draws the boss; this only fails fast when the stage's boss atlas is missing or empty. */
  private prepareBossArtVisuals(bossId: string): void {
    const atlasKey = `atlas_${bossId}`
    if (!this.textures.exists(atlasKey)) {
      throw new Error(`[Game] Missing required boss atlas '${atlasKey}'`)
    }
    if (this.textures.get(atlasKey).frameTotal <= 1) {
      throw new Error(`[Game] Boss atlas '${atlasKey}' has no animation frames`)
    }
    this.bossUsingPlaceholder = false
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
    parkTrailEmitter(bullet)
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
    this.rechargeSelectedWeaponFromSaber()
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
        this.spawnSwordImpactFx(enemy.x, enemy.y, false)
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
        // The boss is a container; its display size is not its hurt box. Use the aligned body.
        x: boss.body?.center?.x ?? boss.x,
        y: boss.body?.center?.y ?? boss.y,
        width: boss.body?.width ?? boss.displayWidth,
        height: boss.body?.height ?? boss.displayHeight
      })
    ) {
      this.applyDamageToBoss(2)
      this.tweens?.add({ targets: boss, alpha: 0.25, yoyo: true, duration: 70 })
      this.spawnSwordImpactFx(boss.x + this.facing * 10, boss.y - 6, true)
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
    const stageId = ((this as any).stageId as string | undefined) ?? 'unknown'
    const bossName = this.bossName ?? stageId
    const stage = getCampaignStage(stageId)
    const previousClearedCount = countClearedRobotMasters(this.progressionSave)
    this.collectProgressionLocation(getLocationCheckId(stage.id as any, 'boss_clear'))
    Save.clearActiveRun()
    this.progressionSave = Save.load()
    const clearedCount = countClearedRobotMasters(this.progressionSave)
    const gate = evaluateFinalGate(Save.load())

    const milestoneCount = clearedCount !== previousClearedCount ? clearedCount : null
    this.registry.set('ui.stageSelect.milestoneCount', milestoneCount !== null && pendingMilestoneId(milestoneCount) ? milestoneCount : null)
    const showVictory = () => this.showBossVictory(stage, bossName, gate.unlocked)
    if (this.storyDirector) {
      this.storyDirector.playBossDefeat(showVictory)
    } else {
      showVictory()
    }
  }

  private showBossVictory(stage: ReturnType<typeof getCampaignStage>, bossName: string, finalRouteUnlocked: boolean): void {
    this.victoryModal?.destroy()
    this.victoryModal = new VictoryModal(this)
    this.victoryModal.show({
      bossName,
      onNext: () => {
        if (stage.id === FINAL_STAGE_ID) {
          this.scene.start('EndingScene')
          return
        }
        this.handleReturnToStageSelect('victory', {
          toastMessage:
            stage.id === TUTORIAL_STAGE_ID
              ? `Tutorial cleared. ${IDENTITY.WARDEN_TERM} Select unlocked.`
              : finalRouteUnlocked
                ? `${bossName} freed! Omega Fortress unlocked.`
                : `${bossName} freed!`,
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
    this.bossContactWire?.destroy()
    this.projectileClashWire?.destroy()
    this.bossHitWire = undefined
    this.playerHitWire = undefined
    this.bossContactWire = undefined
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
      const saved = snapshot ? Save.saveActiveRun(snapshot) : false
      this.setPaused(false)
      showToast(this, saved ? 'Game saved.' : 'Save failed.', 1000)
      return
    }

    if (action === 'load_game') {
      const run = Save.loadActiveRun()
      this.setPaused(false)
      if (!run) {
        showToast(this, 'No valid saved game found.', 1200)
        return
      }
      this.flushStatistics()
      this.scene.restart({
        bossId: run.bossId,
        stageId: run.stageId,
        loadFromSave: true
      })
      return
    }

    if (action === 'new_game') {
      openNewCampaign(this, () => this.setPaused(false))
      return
    }

    if (action === 'clear_save') {
      Save.clearAll()
      this.setPaused(false)
      this.scene.start('Title')
      return
    }

    if (action === 'sub_tank') {
      this.drinkSelectedSubTank()
      return
    }

    if (action === 'stage_select') {
      Save.clearActiveRun()
      this.setPaused(false)
      this.handleReturnToStageSelect('menu-exit')
    }
  }

  /** Pause-menu cycle rows: the weapon row equips as it cycles; the sub-tank row selects a tank. */
  onSystemMenuCycle(action: SystemMenuAction, delta: number): void {
    if (action === 'weapon') {
      this.changeWeapon(delta)
      return
    }
    if (action === 'sub_tank') {
      const count = this.progressionSave.subTankFill?.length ?? 0
      if (count > 0) this.selectedSubTank = (this.selectedSubTank + delta + count) % count
    }
  }

  getPauseInventory(): PauseInventory {
    const fills = [...(this.progressionSave.subTankFill ?? [])]
    return {
      weapons: this.weapons.map((weaponId) => {
        const config = getWeaponConfig(weaponId)
        return {
          id: weaponId,
          label: getWeaponDisplayName(weaponId),
          energy: { current: Math.round(this.weaponEnergyById[weaponId] ?? config.maxEnergy), max: config.maxEnergy }
        }
      }),
      currentWeaponIndex: this.currentWeaponIndex,
      subTankFill: fills,
      selectedSubTank: Math.min(this.selectedSubTank, Math.max(0, fills.length - 1)),
      heartTanks: this.progressionSave.heartTanks ?? 0,
      upgrades: [...(this.progressionSave.upgradeUnlocks ?? [])]
    }
  }

  /** Drinks the selected tank: heals its fill ratio of max HP over 900ms and empties it. */
  private drinkSelectedSubTank(): boolean {
    const fills = this.progressionSave.subTankFill ?? []
    const { fills: next, restoredRatio } = drinkSubTank(fills, this.selectedSubTank)
    if (restoredRatio <= 0) return false
    Save.setSubTankFill(next)
    this.progressionSave = Save.load()
    const total = restoredRatio * this.playerMaxHp
    const steps = 6
    let applied = 0
    AudioService.playSfx('pickup_health')
    this.time.addEvent({
      delay: 150,
      repeat: steps - 1,
      callback: () => {
        const target = Math.round((total * (applied + 1)) / steps * 100) / 100
        this.restorePlayerHealth(target - Math.round(applied * 100) / 100)
        applied = target
      }
    })
    return true
  }

  private autosaveActiveRun(): boolean {
    if (this.victoryTriggered || this.gameOverTriggered) return false
    const snapshot = this.captureActiveRunSnapshot()
    return snapshot ? Save.saveActiveRun(snapshot) : false
  }

  private handleReturnToStageSelect(
    reason: string,
    options: { toastMessage?: string; focusBossId?: string | null; requireConfirmRelease?: boolean } = {}
  ): void {
    this.flushStatistics()
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
    this.flushStatistics()
    const stageId = ((this as any).stageId as string | undefined) ?? this.activeStageId
    return {
      version: 2,
      savedAt: Date.now(),
      stageElapsedMs: this.sessionStats.stageElapsedMs,
      stageId,
      bossId: this.activeBossId,
      playerHp: Math.max(Number.EPSILON, this.playerHp),
      playerMaxHp: Math.max(1, Math.round(this.playerMaxHp)),
      playerLives: Math.max(0, Math.round(this.playerLives)),
      currentWeaponIndex: Math.max(0, Math.round(this.currentWeaponIndex)),
      currentWeaponId: this.getCurrentWeaponId(),
      checkpointIndex: Math.max(0, Math.round(this.currentCheckpointIndex)),
      checkpointId: this.currentCheckpointId ?? undefined,
      weaponEnergyById: { ...this.weaponEnergyById }
    }
  }

  private applyActiveRunSnapshot(run: ActiveRunSaveData | null): void {
    if (!run || !this.player) {
      return
    }

    this.playerMaxHp = Math.max(1, Math.round(run.playerMaxHp))
    this.playerHp = Phaser.Math.Clamp(run.playerHp, Number.EPSILON, this.playerMaxHp)
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
    const stage = getCampaignStage(this.activeStageId)
    const checkpointIndex =
      typeof run.checkpointId === 'string'
        ? stage.arena.checkpoints.findIndex((checkpoint) => checkpoint.id === run.checkpointId)
        : -1
    if (checkpointIndex >= 0) {
      const checkpoint = stage.arena.checkpoints[checkpointIndex]
      this.currentCheckpointIndex = checkpointIndex
      this.currentCheckpointId = checkpoint.id
      this.respawnPoint = new Phaser.Math.Vector2(checkpoint.x, checkpoint.y)
      this.player.setPosition(checkpoint.x, checkpoint.y)
    } else if (typeof run.checkpointIndex === 'number' && stage.arena.checkpoints[run.checkpointIndex]) {
      const checkpoint = stage.arena.checkpoints[run.checkpointIndex]
      this.currentCheckpointIndex = run.checkpointIndex
      this.currentCheckpointId = checkpoint.id
      this.respawnPoint = new Phaser.Math.Vector2(checkpoint.x, checkpoint.y)
      this.player.setPosition(checkpoint.x, checkpoint.y)
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
    Save.clearActiveRun()
    AudioService.stopMusic()
    AudioService.playSfx('game_over')
    const stageId = ((this as any).stageId as string | undefined) ?? 'unknown'
    if (this.scene.manager.keys['GameOver']) {
      this.scene.start('GameOver', { stageId, checkpointId: this.currentCheckpointId ?? null })
    }
  }
  // [REGION: FLOW-HOOKS - END]

  private applyDamageToBoss(
    dmg: number,
    hitContext: {
      weaponId?: string
      weaponElement?: string
      projectileId?: string
      chargeLevel?: 0 | 1 | 2 | 3 | 4
      kind?: string
    } = {}
  ): void {
    const currentWeapon = this.getCurrentWeaponConfig()
    const weaponId = hitContext.weaponId ?? currentWeapon.id
    const hitKind = hitContext.kind ?? 'direct'
    const weaknessProfile = getBossWeaknessProfile(this.progressionSave, this.activeBossId ?? 'pyro_maw')
    const chargeLevel = weaponId === 'Buster' ? hitContext.chargeLevel ?? 0 : 0
    const multiplier = resolveBossDamageMultiplier({
      strictness: getWeaknessStrictness(this.progressionSave),
      profile: weaknessProfile,
      weaponId,
      chargeLevel,
      hasArmsUpgrade: resolveUpgradeModifiers(this.progressionSave).hasArmsUpgrade
    })
    if (multiplier <= 0) {
      this.recordCombatHit('player', 'boss', dmg, hitKind, false, 'blocked-by-weakness-rules')
      this.showBossHitFeedback(weaponId, multiplier, 'BLOCKED')
      return
    }
    const damageBonus = this.progressionSave.progressionWorld?.progressionMode === 'classic' ? 0 :
      weaponId === 'Buster' ? getBusterDamageBonus(this.progressionSave) : getWeaponDamageBonus(this.progressionSave)
    const scaledDamage = Math.max(1, Math.round((dmg + damageBonus) * multiplier))
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

    if (multiplier >= 1.4) this.storyDirector?.onWeaknessHit()
    const label =
      forcedLabel ??
      (multiplier >= 1.4 ? 'WEAKNESS HIT' : multiplier <= 0.8 ? 'RESISTED HIT' : '')
    if (!label) {
      return
    }

    this.bossHitFeedbackTimer?.remove(false)
    this.updatePhaseHud(`${label.slice(0, 7)} ${getWeaponDisplayName(weaponId)}`)
    this.bossHitFeedbackTimer = this.time.delayedCall(520, () => {
      if (this.victoryTriggered) {
        return
      }
      if (this.bossEncounterActive && this.currentPhaseName) {
        this.updatePhaseHud()
      } else {
        this.phaseLabel.setText('BOSS GATE\nADVANCE')
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

    const textureKey =
      dropType === 'health'
        ? PICKUP_TEXTURE_KEYS.health
        : dropType === 'ammo'
          ? PICKUP_TEXTURE_KEYS.weapon
          : PICKUP_TEXTURE_KEYS.bonus
    const drop = this.drops.get(x, y, textureKey) as
      | Phaser.Physics.Arcade.Sprite
      | null
    if (!drop) {
      return null
    }

    this.clearDropExpireTimer(drop)
    drop.setActive(true).setVisible(true).setDepth(5)
    drop.setPosition(x, y)
    drop.setTexture(textureKey)
    drop.setScale(dropType === 'bonus' ? 1.05 : 1)
    drop.setDataEnabled()
    drop.data?.set('dropType', dropType)
    drop.clearTint()

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
      // Health collected at full HP fills the first non-full sub tank.
      const fills = this.progressionSave.subTankFill ?? []
      const stored = fillSubTankFromPickup(fills, amount / Math.max(1, this.playerMaxHp))
      if (stored.stored) {
        Save.setSubTankFill(stored.fills)
        this.progressionSave = Save.load()
      }
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

  private spawnSwordImpactFx(x: number, y: number, strong: boolean): void {
    this.events.emit('camera.shake', {
      intensity: strong ? 0.009 : 0.005,
      duration: strong ? 100 : 75
    })

    if (!this.textures.exists(EFFECTS_ATLAS_KEY)) {
      return
    }

    const flash = this.add
      .sprite(x, y, EFFECTS_ATLAS_KEY, strong ? 'effects_core/core/019' : 'effects_core/core/011')
      .setDepth(8)
      .setBlendMode(Phaser.BlendModes.ADD)
      .setTint(strong ? 0xd8fff4 : 0xc4fff2)
      .setScale(strong ? 1.35 : 1.05)

    this.tweens.add({
      targets: flash,
      alpha: 0,
      scale: strong ? 1.95 : 1.45,
      duration: strong ? 120 : 90,
      ease: 'Quad.Out',
      onComplete: () => flash.destroy()
    })

    const emitter = this.add.particles(x, y, EFFECTS_ATLAS_KEY, {
      frame: strong ? PROJECTILE_CLASH_FRAMES : ['effects_core/core/011', 'effects_core/core/003'],
      lifespan: { min: 70, max: 120 },
      speed: strong ? { min: 35, max: 120 } : { min: 25, max: 80 },
      quantity: strong ? 12 : 7,
      scale: { start: strong ? 0.7 : 0.5, end: 0 },
      alpha: { start: 0.85, end: 0 },
      tint: strong ? [0xc7fff1, 0xffffff, 0x7effc8] : [0xb8fff0, 0xffffff],
      blendMode: 'ADD'
    })
    emitter.setDepth(7)
    this.time.delayedCall(strong ? 135 : 105, () => {
      emitter.stop()
      emitter.destroy()
    })
  }

  private onHazardContact(
    playerObj: Phaser.GameObjects.GameObject,
    hazardObj: Phaser.GameObjects.GameObject
  ): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite
    const hazard = hazardObj as Phaser.Physics.Arcade.Sprite
    if (!player.active) {
      return
    }
    const rawSourceType = String(hazard.data?.get?.('damageSourceType') ?? 'hazard')
    this.requestPlayerDamage({
      amount: Number(hazard.data?.get?.('damageAmount') ?? 1),
      tier: Number(hazard.data?.get?.('damageAmount') ?? 1) >= 2 ? 'heavy' : 'light',
      sourceType: rawSourceType === 'boss_projectile' ? 'boss_projectile' : 'hazard',
      sourceId: String(hazard.data?.get?.('damageSourceId') ?? 'stage_hazard'),
      direction: player.x >= hazard.x ? 1 : -1
    })
  }

  private onEnemyContact(
    playerObj: Phaser.GameObjects.GameObject,
    enemyObj: Phaser.GameObjects.GameObject
  ): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
    if (!player.active || !enemy.active) {
      return
    }
    const entity = this.enemySpawner?.getEntityBySprite(enemy)
    const damage = Number(entity?.definition.stats.contactDamage ?? entity?.definition.stats.damage ?? 1)
    this.requestPlayerDamage({
      amount: damage,
      tier: damage >= 2 ? 'heavy' : 'light',
      sourceType: 'enemy_contact',
      sourceId: String(entity?.id ?? enemy.data?.get?.('enemyFrameworkId') ?? 'enemy_contact'),
      direction: player.x >= enemy.x ? 1 : -1
    })
  }

  private onBossContact(
    playerObj: Phaser.GameObjects.GameObject,
    bossObj: Phaser.GameObjects.GameObject
  ): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite
    const boss = bossObj as Phaser.Physics.Arcade.Sprite
    if (!player.active || !boss.active || !this.bossEncounterActive) {
      return
    }
    this.requestPlayerDamage({
      amount: 2,
      tier: 'heavy',
      sourceType: 'boss_contact',
      sourceId: String(this.activeBossId ?? 'boss_contact'),
      direction: player.x >= boss.x ? 1 : -1
    })
  }

  private setPlayerAnimation(key: string): void {
    if (!this.player.anims || this.player.anims.currentAnim?.key === key) {
      return
    }
    this.playAnimationSafe(this.player, key)
  }

  private updatePhaseHud(action?: string): void {
    if (!this.phaseLabel) {
      return
    }
    const blueprint = this.bossController?.blueprint
    const phaseName = (this.currentPhaseName || '').toUpperCase()
    const phaseEntry = blueprint?.phases?.find((entry) => entry.name.toUpperCase() === phaseName)
    const phase = phaseEntry
      ? bossHudLabel(phaseEntry)
      : (this.currentPhaseName || 'PHASE --').replace(/^PHASE\s*•?\s*/i, 'PHASE ').toUpperCase()
    const cleaned = action?.replace(/^ACTION\s*•?\s*/i, '').trim()
    const attackEntry = cleaned
      ? blueprint?.attacks?.find((entry) => entry.name.toUpperCase() === cleaned.toUpperCase())
      : undefined
    const actionLabel = cleaned ? (attackEntry ? bossHudLabel(attackEntry) : cleaned.toUpperCase().slice(0, 12)) : undefined
    this.phaseLabel.setText(actionLabel ? `${phase}\n${actionLabel}` : phase)
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
    this.hud?.setWeaponColor(getWeaponConfig(weapon).tint)
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

  private requestPlayerDamage(request: PlayerDamageRequest): PlayerDamageResult {
    const debugSource =
      request.sourceType.startsWith('boss_')
        ? 'boss'
        : request.sourceType.startsWith('enemy_')
          ? 'enemy'
          : request.sourceType === 'hazard'
            ? 'hazard'
            : 'system'
    if (!this.player || !this.player.active || this.playerLives < 0 || !this.newPlayerRuntime) {
      const result: PlayerDamageResult = {
        accepted: false,
        reason: 'inactive',
        amount: 0,
        request
      }
      this.recordCombatHit(debugSource, 'player', request.amount, request.sourceType, false, `${request.sourceId}:inactive`)
      return result
    }

    const result = this.newPlayerRuntime.receiveDamage(request)
    this.recordCombatHit(
      debugSource,
      'player',
      result.amount,
      request.sourceType,
      result.accepted,
      `${request.sourceId}:${result.reason}`
    )
    if (result.accepted) {
      AudioService.playSfx('player_hit')
      if (this.player.active) {
        this.player.setTint(0xff6b6b)
        this.time.delayedCall(140, () => {
          if (this.player?.active) {
            this.player.clearTint()
          }
        })
      }
    }
    return result
  }

  private commitPlayerDamage(dmg: number): void {
    if (!this.player || !this.player.active || this.playerLives < 0) {
      return
    }
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
        this.sessionStats.respawn()
        this.newPlayerRuntime?.resetForRespawn(1000)
        this.resumeRespawnCombatState()
        this.syncWeaponHud()
        this.fallingToDeath = false
        this.autosaveActiveRun()
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
        applyDamageToPlayer: (request) => this.requestPlayerDamage(request),
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

    if (typeof window !== 'undefined' && AUTOMATION.enabled) {
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
    const newPlayerState = this.getNewPlayerDebugState()
    const locomotionDebug = ((newPlayerState as any)?.locomotion ?? {}) as Record<string, unknown>
    const combatPlayerDebug = ((newPlayerState as any)?.combat ?? {}) as Record<string, unknown>
    const physicsDebug = ((newPlayerState as any)?.physics ?? {}) as Record<string, unknown>
    const inputDebug = ((newPlayerState as any)?.input ?? {}) as Record<string, unknown>
    const iFramesMs = Number((newPlayerState as any)?.combat?.iFramesMs ?? 0)
    const chargeMs = Number(combatPlayerDebug.chargeElapsedMs ?? 0)
    const shotsFiredTotal = Number(combatPlayerDebug.shotsFiredTotal ?? 0)
    const lastProjectileSpawnMs = Number(combatPlayerDebug.lastProjectileSpawnMs ?? 0)
    const lastProjectileSpawnFrame = Number(combatPlayerDebug.lastProjectileSpawnFrame ?? 0)
    const lastProjectile = (combatPlayerDebug.lastProjectile as any) ?? null
    const dashCooldownMs = Number(locomotionDebug.dashCooldownMs ?? 0)
    const slideRemainingMs = Number(locomotionDebug.dashMs ?? 0)
    const wallSliding = Boolean(locomotionDebug.wallSliding ?? false)
    const virtualControlsVisible = Boolean(this.touchControls?.isVisible?.())
    const snapshot = makeGameCombatSnapshot({
      recentHits: this.combatDebugBus.getRecentHits(10),
      totals: this.combatDebugBus.getTotals(),
      player: {
        hp: this.playerHp,
        maxHp: this.playerMaxHp,
        bodyProfileKey: String(physicsDebug.bodyProfileKey ?? '') || null,
        blocked: (physicsDebug.blocked as any) ?? null,
        touching: (physicsDebug.touching as any) ?? null,
        dropThroughActive: Boolean(physicsDebug.dropThroughActive),
        coyoteMs: Number(locomotionDebug.coyoteMs ?? 0),
        jumpBufferMs: Number(locomotionDebug.jumpBufferMs ?? 0),
        dashRemainingMs: Number(locomotionDebug.dashMs ?? 0),
        dashCooldownMs,
        dashStarted: Boolean(locomotionDebug.dashStarted),
        dashEnded: Boolean(locomotionDebug.dashEnded),
        slideRemainingMs,
        wallSide: (locomotionDebug.wallSide === -1 || locomotionDebug.wallSide === 1 ? locomotionDebug.wallSide : 0) as -1 | 0 | 1,
        lastLandingSpeed: Number(locomotionDebug.lastLandingSpeed ?? 0),
        lastJumpSource: String(locomotionDebug.lastJumpSource ?? 'none'),
        chargeMs,
        shotsFiredTotal,
        lastProjectileSpawnMs,
        lastProjectileSpawnFrame,
        lastProjectile,
        iFramesMs,
        lastDamageSource: String(combatPlayerDebug.lastDamageSource ?? 'none'),
        lastDamageTier: String(combatPlayerDebug.lastDamageTier ?? 'none'),
        knockback: (combatPlayerDebug.lastKnockback as any) ?? null,
        wallSliding,
        touchButtons: (inputDebug.touchButtons as any) ?? null,
        virtualControlsVisible
      },
      boss: {
        hp: this.bossHp ?? null,
        phase: this.currentPhaseName
      }
    })

    return snapshot
  }

  getNewPlayerDebugState(): Record<string, unknown> | null {
    const runtimeState = this.newPlayerRuntime?.getDebugState?.() ?? null
    if (!runtimeState) {
      return null
    }
    const physicsState = (runtimeState as any).physics && typeof (runtimeState as any).physics === 'object'
      ? { ...(runtimeState as any).physics }
      : {}
    physicsState.dropThroughActive = Boolean(
      this.player && this.platformCollisionSystem?.isDropThroughActive(this.player)
    )
    return {
      ...runtimeState,
      physics: physicsState
    }
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
