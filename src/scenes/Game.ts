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
import { bossPhaseHudText } from './game/combatRules'
import { CameraDirector } from './game/CameraDirector'
import { DeathSequence } from './game/DeathSequence'
import { DevUx } from './game/DevUx'
import { installGameDebugHooks, uninstallGameDebugHooks } from './game/GameDebugHooks'
import { RunState } from './game/RunState'
import { StoryDirector, pendingMilestoneId } from './game/StoryDirector'
import { ToastLane } from '../ui/ToastLane'
import { fillSubTankFromPickup } from '../systems/subTanks'
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
  getBossRoomGateX,
  getBossRoomMovementBounds
} from '../content/stageArenaLayout'
import { buildWeaponEnergySnapshot, buildWeaponOrder, getWeaponConfig, getWeaponDisplayName } from '../content/weapons'
import { GAMEPLAY_TEXTURE_KEYS } from '../ui/gameplay/GameplayTextures'
import {
  getHolsteredWeaponRechargeTargets,
  PASSIVE_WEAPON_RECHARGE_AMOUNT,
  PASSIVE_WEAPON_RECHARGE_INTERVAL_MS,
  rechargeWeaponEnergyValue,
  SABER_WEAPON_RECHARGE_AMOUNT,
  SABER_WEAPON_RECHARGE_COOLDOWN_MS
} from '../content/weaponEnergyEconomy'
import { AUTOMATION } from '../config/automation'
import { GAMEPLAY_ACTOR_CEILING, getGameplayWorldBounds } from '../config/gameplayLayout'
import { GAME_HEIGHT, GAME_WIDTH } from '../config/renderPolicy'
import { returnToStageSelect, showToast } from '../core/navigation'
import { DigitalButtonPad } from '../input/DigitalButtonPad'
import InputActions, { type SceneInputActions } from '../input/InputActions'
import { NewPlayerRuntime } from '../player/NewPlayerRuntime'
import { applyPlayerBodyProfile } from '../player/PlayerBodyProfiles'
import { PLAYER_GAMEPLAY_CONFIG, resolvePlayerPhysicsLimits } from '../player/config'
import { resolvePlayerFeatureFlags } from '../player/featureFlags'
import { SwordHitRouter } from '../combat/SwordHitRouter'
import type { PlayerDamageRequest, PlayerDamageResult } from '../player/types'
import { ActiveRunSaveData, Save } from '../systems/Save'
import { queueStageAssets, resolveGameStageAndBoss } from './game/stageBackgroundLoading'
import { GameplayTouchControls } from '../ui/GameplayTouchControls'
import { HUD, formatDistrictLabel } from '../ui/HUD'
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
import { BossBeats } from './game/BossBeats'
import { BossDamageRouter, type BossHitContext } from './game/BossDamageRouter'
import { HitWires } from './game/HitWires'
import { WeaponRuntime } from './game/WeaponRuntime'
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
import { PlatformCollisionSystem, PlatformType } from '../physics'
import { installRoomLocks } from '../mechanics/adapters/RoomLockAdapter'
import { mainGroundPlatforms } from '../stage/stageGeometry'
import { StageBackdrop } from './game/StageBackdrop'
import { buildStageHazards, installStageMechanics, stageMechanicPlatforms } from '../mechanics/adapters/StageMechanicsAdapter'
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

  private onHitstop = (frames: number) => this.cameraDirector.onHitstop(frames)
  private onCameraShake = (config: { intensity: number; duration: number }) => this.cameraDirector.onCameraShake(config)
  private bossProjectileController?: BossProjectileController
  // Boss beats, boss damage, hit wires and the weapon runtime live in ./game (prompt 07 phase 7.0, EVAL-P7-008).
  private readonly bossBeats = new BossBeats(this)
  private readonly bossDamage = new BossDamageRouter(this)
  private readonly hitWires = new HitWires(this)
  private readonly weaponRuntime = new WeaponRuntime(this)
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
  private readonly combatDebugBus = new CombatDebugBus()
  private readonly jumpController = new JumpController(JUMP_VELOCITY)
  private readonly playerFeatureFlags = resolvePlayerFeatureFlags()
  private readonly enemyFeatureFlags = resolveEnemyFeatureFlags()
  private newPlayerRuntime?: NewPlayerRuntime
  private swordHitRouter?: SwordHitRouter
  private enemySpawner?: EnemySpawner
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
  private readonly stageBackdrop = new StageBackdrop(this)
  private scaleResizeHandler?: Phaser.Types.Core.ScaleEventCallback
  private readonly missingAnimationWarnings = new Set<string>()
  // ======================= [DEV-UX-BEGIN] (moved to ./game/DevUx; `_dev` stays readable for smoke)
  private readonly devUx = new DevUx(this, { install: installGameDebugHooks, uninstall: uninstallGameDebugHooks })
  private get _dev() { return this.devUx.state }
  // ======================= [DEV-UX-END]
  private readonly cameraDirector = new CameraDirector(this)
  private readonly deathSequence = new DeathSequence(this)
  private readonly runState = new RunState(this)

  // [REGION: STAGE-BUILDER - BEGIN]
  private applyStageCameraBounds(stageId: string): void { this.cameraDirector.applyStageCameraBounds(stageId) }
  private applyBossRoomCameraLock(): void { this.cameraDirector.applyBossRoomCameraLock() }
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
    this.stageBackdrop.render(stageId, worldWidth)
    this.platformCollisionSystem?.destroy()
    this.platformCollisionSystem = new PlatformCollisionSystem(this)

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

    this.platformCollisionSystem.rebuild(platforms, stageId)
    this.stagePlatforms = this.platformCollisionSystem.getSolidGroup()
    this.stageOneWayPlatforms = this.platformCollisionSystem.getOneWayGroup()
    this.bossGateLockX = getBossRoomGateX(cfg.bossRoom)
    this.bossGateLocked = false
    this.bossRoomCameraLocked = false
    this.installEntityPlatformCollisions()
    installRoomLocks({ scene: this, stageId, player: () => this.player, runtime: () => this.newPlayerRuntime, onArmed: (lockIndex, hint) => this.storyDirector?.onRoomLockArmed(lockIndex, hint), onDefeatLockArmed: () => this.storyDirector?.onMiniBossLock(), clearedMarkers: () => this.enemySpawner?.getClearedMarkerIds() ?? [], restoreCamera: () => (this.bossRoomCameraLocked ? this.applyBossRoomCameraLock() : this.applyStageCameraBounds(stageId)) })
    installStageMechanics({ scene: this, stageId, player: () => this.player, runtime: () => this.newPlayerRuntime, platforms: () => this.platformCollisionSystem, playerBullets: () => this.playerBullets, isDying: () => this.fallingToDeath, damagePlayer: (request) => this.requestPlayerDamage(request) })
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

  private updateRespawnCheckpoint(): void { this.deathSequence.updateRespawnCheckpoint() }
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

  private applySelectedCheckpoint(stageId: string, checkpointId?: string | null): void { this.deathSequence.applySelectedCheckpoint(stageId, checkpointId) }
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

  private activateBossEncounter(): void { this.bossBeats.activateBossEncounter() }

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

  private checkStageKillPlane(): void { this.deathSequence.checkStageKillPlane() }
  private killPlayer(reason: 'pit' | 'debug' | 'damage'): void { this.deathSequence.killPlayer(reason) }
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

  private recordCombatHit(...args: Parameters<HitWires['recordCombatHit']>): void { this.hitWires.recordCombatHit(...args) }
  // ======================= [OVERLAPS-END]

  private devRegister<T extends Phaser.GameObjects.GameObject>(ref: T | undefined, kind: string): T | undefined { return this.devUx.register(ref, kind) }
  private devUpdate(): void { this.devUx.update() }
  // ======================= [AI-UPDATE-BEGIN]
  // ======================= [AI-UPDATE-END]

  /** Loads only this stage's background layers and biome tile atlas; see stageBackgroundLoading.ts and stageTileLoading.ts. */
  preload(): void {
    const data = this.sys.settings.data as GameData
    queueStageAssets(this, ...resolveGameStageAndBoss(data, (data as any)?.loadFromSave ? Save.loadActiveRun() : null))
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
      this.stageBackdrop.clear()
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
    this.devUx.init()
    const loadFromSave = Boolean((data as any)?.loadFromSave)
    this.loadedFromSave = loadFromSave
    this.progressionSave = Save.load()
    const activeRun = loadFromSave ? Save.loadActiveRun() : null
    this.sessionStats = new CampaignSessionStatistics(activeRun?.stageElapsedMs)
    installProgressionDebugHooks(this, (previous, next, item) => { this.progressionSave = next; this.applyProgressionStateToRuntime(previous, next, item) })
    const [stageId, resolvedBossId] = resolveGameStageAndBoss(data as any, activeRun)
    const stage = getCampaignStage(stageId)
    const selectedBossId = resolvedBossId as BossId
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

    this.devUx.installOverlay()

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
    this.bossBeats.initializeProjectileController()
    this.projectileCollisionRouter = new ProjectileCollisionRouter({
      playerBullets: this.playerBullets,
      enemyBullets: this.bossBullets,
      getPlayer: () => this.player,
      getNow: () => this.time.now,
      getFacing: () => this.facing,
      damageBoss: (damage, meta) => { this.cameraDirector.onContactHit('pellet'); this.applyDamageToBoss(damage, meta) },
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
        this.cameraDirector.onContactHit('pellet')
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
      devLogOverlap: (tag, bullet, target, accepted, reason) => this.devUx.logOverlap(tag, bullet, target, accepted, reason),
      playEnemyHitSfx: () => AudioService.playSfx('enemy_hit'),
      spawnProjectileClashFx: (x, y, strong) => this.spawnProjectileClashFx(x, y, strong)
    })
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      console.debug('[Boss][Bullet] pool init', {
        textureReady: this.textures.exists(PROJECTILES_ATLAS_KEY),
        poolReady: this.bossBullets?.getLength()
      })
    }
    this.hazards = buildStageHazards(this, stageId)

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
    this.bossBeats.prepareArtVisuals(selectedBossId)
    this.bossHp = { current: bossMaxHp, max: bossMaxHp }
    this.bossName = bossCodename

    this.installEntityPlatformCollisions()
    this.hitWires.install()

    this.physics.add.overlap(this.player, this.hazards, (p, h) => this.hitWires.onHazardContact(p, h))
    this.physics.add.overlap(this.player, this.enemies, (p, e) => this.hitWires.onEnemyContact(p, e))
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
    this.swordHitRouter = new SwordHitRouter({
      scene: this, player: () => this.player, facing: () => this.facing, enemies: () => this.enemies, enemyShots: () => this.bossBullets,
      boss: () => (this.victoryTriggered ? null : ((this.bossTarget ?? this.bossBody) as any) ?? null), bossHp: () => this.bossHp?.current ?? null,
      projectiles: () => this.projectileSystem, damageBoss: (amount) => this.applyDamageToBoss(amount), flashEnemy: (enemy) => this.flashEnemy(enemy),
      damageEnemy: (enemy, amount, knockback) => { if (!this.enemySpawner?.applyDamageToSprite(enemy, { amount, type: 'melee', knockback, sourceId: 'player_sword' })) this.applyDamageToTarget(enemy, amount) },
      onSwing: () => this.weaponRuntime.rechargeSelectedFromSaber(), onContactHit: (kind, frames) => this.cameraDirector.onContactHit(kind, frames)
    })
    this.newPlayerRuntime = new NewPlayerRuntime(
      this,
      this.player,
      this.actions,
      this.playerFeatureFlags,
      {
        setAnimation: (key) => this.setPlayerAnimation(key),
        spawnProjectile: (request) => this.fireBulletFromRuntime(request),
        canChargeProjectile: () => this.getCurrentWeaponConfig().allowCharge,
        applySwordHitbox: (hitbox, claim) => this.swordHitRouter?.apply(hitbox, claim),
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
      getActiveHazardCount: () => this.bossBeats.countActiveBossRoomHazards(),
      telegraphProbe: () => this.bossBeats.telegraphs.getDebugState()
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
      this.hitWires.install()
      this.bossProjectileController?.startLoop()
    }
    this.initializeHud()
    this.applySelectedCheckpoint(stageId, activeRun?.checkpointId ?? (data as any)?.checkpointId ?? null)
    this.spawnProgressionPickups(stageId)
    this.applyActiveRunSnapshot(activeRun)
    this.flushPendingProgressionItems()
    if (!activeRun) this.autosaveActiveRun()
    this.currentPhaseName = this.bossController.currentPhase.name.toUpperCase()
    this.phaseLabel.setText(formatDistrictLabel(getCampaignStage(this.activeStageId).district))
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
    this.cameraDirector.startFollowingPlayer(this.player)
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
    if (this.cameraDirector.tickHitstop()) { this.newPlayerRuntime?.latchPressesDuringHitstop(); this.cameraDirector.tickCameraFollow(); return }

    if (!this.player || !this.actions) {
      const now = this.time.now
      this.bossBeats.update()
      this.enemySpawner?.update(now, delta)
      this.devUpdate()
      return
    }

    const pauseState = evaluatePauseState(this.paused, false)
    this.setPaused(pauseState.paused)
    const now = this.time.now

    this.bossUiBinder?.update()

    this.devUx.updateOverlay()

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
      this.bossBeats.update()
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
    this.weaponRuntime.handleCycling()
    this.newPlayerRuntime.update(now, delta)
    this.weaponRuntime.updateEnergyRecharge(delta)
    this.projectileSystem?.update(now, delta, {
      player: this.player,
      enemyReturnTarget: this.bossController
    })
    this.updateRespawnCheckpoint()
    this.bossBeats.updateEncounterActivation()
    if (this.dialogueOverlay?.isActive()) {
      this.devUpdate()
      return
    }
    this.checkStageKillPlane()
    this.facing = this.newPlayerRuntime.getFacing(); this.cameraDirector.tickCameraFollow()
    this.bossBeats.update()
    this.bossBeats.updateProjectiles(now, delta)
    this.enemySpawner?.update(now, delta)
    this.devUpdate()

    this.bossBeats.updateController(delta)
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
    this.hud.setNames(IDENTITY.HERO_CALLSIGN, String(bossLabelRaw))
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

  getWeaponEnergyDebugState(): Record<string, unknown> { return this.weaponRuntime.getEnergyDebugState() }
  private fireBulletFromRuntime(config: Parameters<WeaponRuntime['fire']>[0]) { return this.weaponRuntime.fire(config) }

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

  private recycleBullet(a: any, b: any): void { this.hitWires.recycleBullet(a, b) }

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
  private onBossDefeated(): void { this.bossBeats.onBossDefeated() }

  private disableBossCombatActors(): void { this.runState.disableBossCombatActors() }
  private disableProjectileGroups(): void { this.runState.disableProjectileGroups() }
  private freezeCombatWorld(): void { this.runState.freezeCombatWorld() }
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
  private drinkSelectedSubTank(): boolean { return this.runState.drinkSelectedSubTank() }
  private autosaveActiveRun(): boolean { return this.runState.autosaveActiveRun() }
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

  private captureActiveRunSnapshot(): ActiveRunSaveData | null { return this.runState.captureActiveRunSnapshot() }
  private applyActiveRunSnapshot(run: ActiveRunSaveData | null): void { this.runState.applyActiveRunSnapshot(run) }
  private onPlayerGameOver(): void { this.deathSequence.onPlayerGameOver() }
  // [REGION: FLOW-HOOKS - END]

  private applyDamageToBoss(dmg: number, hitContext: BossHitContext = {}): void { this.bossDamage.applyDamageToBoss(dmg, hitContext) }

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

  private setPlayerAnimation(key: string): void {
    if (!this.player.anims || this.player.anims.currentAnim?.key === key) {
      return
    }
    this.playAnimationSafe(this.player, key)
  }

  private updatePhaseHud(action?: string): void {
    this.phaseLabel?.setText(bossPhaseHudText(this.bossController?.blueprint, this.currentPhaseName, action))
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

  private changeWeapon(delta: number): void { this.weaponRuntime.changeWeapon(delta) }
  private updateWeaponLabel(): void { this.weaponRuntime.updateLabel() }
  private getCurrentWeaponId(): string { return this.weaponRuntime.getCurrentWeaponId() }
  private getCurrentWeaponConfig() { return this.weaponRuntime.getCurrentWeaponConfig() }
  private syncWeaponHud(): void { this.weaponRuntime.syncHud() }

  private requestPlayerDamage(request: PlayerDamageRequest): PlayerDamageResult { return this.hitWires.requestPlayerDamage(request) }
  private commitPlayerDamage(dmg: number): void { this.hitWires.commitPlayerDamage(dmg) }

  private playerDeathAndRespawn(): void { this.deathSequence.playerDeathAndRespawn() }
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
            this.spawnEnemyDrop(sprite.x, sprite.y - 8, this.enemySpawner?.defeatDropFor(sprite))
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

  getCombatDebugSnapshot(): Record<string, unknown> | null { return this.devUx.getCombatDebugSnapshot() }
  getNewPlayerDebugState(): Record<string, unknown> | null { return this.devUx.getNewPlayerDebugState() }
  getVisualDebugSnapshot(): Record<string, unknown> | null { return this.devUx.getVisualDebugSnapshot() }
}
