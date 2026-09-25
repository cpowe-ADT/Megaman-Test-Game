import type Phaser from 'phaser'
import AudioService from '../../audio'
import { BossProjectileController } from '../../boss/framework/BossProjectileController'
import type { BossUIBinder } from '../../boss/framework/BossUIBinder'
import type { BossController } from '../../bosses/BossController'
import { countClearedRobotMasters, FINAL_STAGE_ID, getCampaignStage, TUTORIAL_STAGE_ID } from '../../content/campaign'
import { IDENTITY } from '../../content/identity'
import { evaluateFinalGate, getLocationCheckId } from '../../progression'
import type { ProjectileSystem } from '../../projectiles'
import { Save } from '../../systems/Save'
import type { HUD } from '../../ui/HUD'
import { GAMEPLAY_TEXTURE_KEYS } from '../../ui/gameplay/GameplayTextures'
import { VictoryModal } from '../../ui/VictoryModal'
import { BossTelegraphs } from './BossTelegraphs'
import { bossHazardRingCount } from './combatRules'
import { pendingMilestoneId, type StoryDirector } from './StoryDirector'

/** The legacy boss body (no controller) walks at this speed and turns at walls. */
const LEGACY_BOSS_WALK_SPEED = 60

/** The Game scene state the boss beats read and write (the scene itself supplies add, tweens, time and the rest). */
export interface BossBeatsState {
  hazards?: Phaser.Physics.Arcade.StaticGroup
  bossController?: BossController
  bossTarget?: Phaser.Physics.Arcade.Sprite
  bossBody?: Phaser.Physics.Arcade.Sprite
  bossArt?: Phaser.GameObjects.Sprite
  player?: Phaser.Physics.Arcade.Sprite
  projectileSystem?: ProjectileSystem
  bossBullets?: Phaser.Physics.Arcade.Group
  bossProjectileController?: BossProjectileController
  bossEncounterActive: boolean
  victoryTriggered: boolean
  bossDeathHandled: boolean
  bossActivationX: number
  bossHp?: { current: number; max: number }
  bossName?: string
  stageId?: string
  currentPhaseName: string
  phaseLabel?: Phaser.GameObjects.Text
  hud?: Pick<HUD, 'setBossBarVisible' | 'updateBossHp'>
  bossUiBinder?: Pick<BossUIBinder, 'onFightStart' | 'onBossDeath'>
  storyDirector?: Pick<StoryDirector, 'playBossIntro' | 'playBossDefeat'>
  victoryModal?: VictoryModal
  progressionSave: ReturnType<typeof Save.load>
  bossUsingPlaceholder: boolean
  lockBossGate(): void
  unlockBossGate(): void
  applyBossRoomCameraLock(): void
  updatePhaseHud(action?: string): void
  showStageToast(message: string, durationMs?: number): void
  devRegister<T extends Phaser.GameObjects.GameObject>(ref: T | undefined, kind: string): T | undefined
  playAnimationSafe(target: Phaser.GameObjects.Sprite | undefined, key: string, ignoreIfPlaying?: boolean): void
  disableBossCombatActors(): void
  disableProjectileGroups(): void
  freezeCombatWorld(): void
  collectProgressionLocation(locationId: string): void
  handleReturnToStageSelect(
    reason: 'victory',
    options: { toastMessage?: string; focusBossId?: string | null; requireConfirmRelease?: boolean }
  ): void
}

export type BossBeatsHost = Phaser.Scene & BossBeatsState

/**
 * The boss's beats in the Game scene: room activation and the fight start, the projectile controller
 * and its ground hazards, the attack telegraphs, the per-frame boss update, the art check, and the
 * defeat and victory flow. Moved out of `Game` in prompt 07 phase 7.0 (EVAL-P7-008); `Game` keeps
 * `activateBossEncounter` and `onBossDefeated` as one-line delegations for the debug hooks.
 */
export class BossBeats {
  readonly telegraphs: BossTelegraphs

  constructor(private readonly host: BossBeatsHost) {
    this.telegraphs = new BossTelegraphs(host)
  }

  initializeProjectileController(): void {
    const host = this.host
    if (!host.projectileSystem || !host.bossBullets) {
      return
    }
    this.telegraphs.reset()
    const origin = () => (host.bossTarget ?? host.bossBody) ?? null
    host.bossProjectileController = new BossProjectileController({
      projectileSystem: host.projectileSystem,
      projectileGroup: host.bossBullets,
      getNow: () => host.time.now,
      isEncounterActive: () => host.bossEncounterActive,
      isControllerDriven: () => Boolean(host.bossController),
      getPlayerPosition: () => (host.player?.active ? { x: host.player.x, y: host.player.y } : null),
      getBossOrigin: origin,
      getBossMovementBody: () => origin()?.body as Phaser.Physics.Arcade.Body | undefined,
      getBossAttackFacing: () => host.bossController?.getAttackFacing() ?? 1,
      getTrailTint: () => host.bossController?.blueprint.theme.trail ?? 0x55ccff,
      createTrailEmitter: (bullet) => {
        const emitter = host.add.particles(0, 0, 'px', {
          lifespan: 180,
          speed: 0,
          quantity: 1,
          scale: { start: 0.8, end: 0 },
          alpha: { start: 0.7, end: 0 },
          follow: bullet
        })
        emitter.setDepth(1)
        return emitter
      },
      registerProjectile: (bullet, kind) => host.devRegister(bullet, kind),
      playAttackSfx: (name) => AudioService.playSfx(name as Parameters<typeof AudioService.playSfx>[0]),
      setActionLabel: (text) => host.updatePhaseHud(text),
      playShootAnimation: () => {
        if (host.bossArt) host.playAnimationSafe(host.bossArt, 'boss_shoot', true)
      },
      restoreWalkAnimation: () => {
        if (host.bossArt?.anims) host.playAnimationSafe(host.bossArt, 'boss_walk', true)
      },
      spawnGroundSlamHazard: (hazardOrigin, attackData) => this.spawnGroundSlamHazard(hazardOrigin, attackData),
      log: (level, message, payload) => {
        if (typeof window === 'undefined' || !(window as unknown as { __DEV__?: boolean }).__DEV__) {
          return
        }
        const logger = console[level] ?? console.log
        logger.call(console, message, payload)
      }
    })
  }

  spawnGroundSlamHazard(origin: { x: number; y: number }, attackData?: unknown): void {
    const host = this.host
    if (!host.hazards) {
      return
    }
    const data = (attackData ?? {}) as { id?: string; params?: { radius?: number; hazardDuration?: number }; hit?: { damageAmount?: number } }
    const attackId = String(data.id ?? 'ground_slam')
    const radius = Math.max(24, Number(data.params?.radius ?? 72))
    const duration = Math.max(200, Number(data.params?.hazardDuration ?? 700))
    const rings = bossHazardRingCount(host.bossController?.getRoomHazardCap() ?? 3, this.countActiveBossRoomHazards())
    const direction = host.bossController?.getAttackFacing() ?? 1
    const texture =
      attackId === 'ignition_dash' || attackId === 'toxic_slide' ? GAMEPLAY_TEXTURE_KEYS.flameVent : GAMEPLAY_TEXTURE_KEYS.spikeBank
    for (let i = 0; i < rings; i += 1) {
      const laneOffset = attackId === 'ignition_dash' ? direction * i * (radius * 0.42) : (i - 1) * (radius * 0.45)
      const hazard = host.hazards.create(origin.x + laneOffset, origin.y + 16, texture) as Phaser.Physics.Arcade.Sprite
      hazard.setDataEnabled?.()
      hazard.data?.set?.('damageSourceType', 'boss_projectile')
      hazard.data?.set?.('damageSourceId', attackId)
      hazard.data?.set?.('damageAmount', Number(data.hit?.damageAmount ?? 2))
      hazard.data?.set?.('bossRoomHazard', true)
      hazard.refreshBody()
      const body = hazard.body as Phaser.Physics.Arcade.StaticBody | undefined
      if (body) body.enable = false
      hazard.setAlpha(0.22)
      hazard.setTint(host.bossController?.blueprint.theme.glow ?? 0xffffff)
      host.tweens.add({
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
      host.time.delayedCall(180 + duration + i * 90, () => hazard.destroy())
    }
  }

  countActiveBossRoomHazards(): number {
    const hazards = this.host.hazards
    if (!hazards) return 0
    return hazards
      .getChildren()
      .filter((hazard) => Boolean(hazard?.active && (hazard as Phaser.GameObjects.Sprite).data?.get?.('bossRoomHazard'))).length
  }

  /** BossController draws the boss; this only fails fast when the stage's boss atlas is missing or empty. */
  prepareArtVisuals(bossId: string): void {
    const atlasKey = `atlas_${bossId}`
    if (!this.host.textures.exists(atlasKey)) {
      throw new Error(`[Game] Missing required boss atlas '${atlasKey}'`)
    }
    if (this.host.textures.get(atlasKey).frameTotal <= 1) {
      throw new Error(`[Game] Boss atlas '${atlasKey}' has no animation frames`)
    }
    this.host.bossUsingPlaceholder = false
  }

  /** Every frame: the art follows the boss; a legacy body without a controller walks and turns at walls. */
  update(): void {
    const host = this.host
    this.syncBossArt()
    const legacy = host.bossBody
    if (!host.bossEncounterActive || !legacy || !legacy.active || host.bossController) {
      return
    }
    const body = legacy.body as Phaser.Physics.Arcade.Body | undefined
    if (!body) {
      return
    }
    if (body.blocked.left) {
      legacy.setVelocityX(LEGACY_BOSS_WALK_SPEED)
    } else if (body.blocked.right) {
      legacy.setVelocityX(-LEGACY_BOSS_WALK_SPEED)
    } else if (body.velocity.x === 0) {
      legacy.setVelocityX(LEGACY_BOSS_WALK_SPEED * (host.player && host.player.x < legacy.x ? -1 : 1))
    }
  }

  /** Shots, hazards and the telegraphs of attacks still in their wind-up. */
  updateProjectiles(now: number, delta: number): void {
    this.host.bossProjectileController?.update(now, delta)
    this.telegraphs.update(now)
  }

  /** `delta` is the scene update's own; `game.loop.delta` is stale under stepFrames and ran the boss slow. */
  updateController(delta: number): void {
    const host = this.host
    const controller = host.bossController
    if (!controller || !host.bossEncounterActive) {
      return
    }
    if (!controller.active || controller.scene !== host) {
      host.bossController = undefined
      return
    }
    if (host.victoryTriggered || host.bossDeathHandled) {
      return
    }
    controller.update(host.time.now, delta)
  }

  updateEncounterActivation(): void {
    const host = this.host
    if (host.bossEncounterActive || !host.player || host.victoryTriggered || host.bossDeathHandled) {
      return
    }
    if (host.player.x >= host.bossActivationX) {
      this.activateBossEncounter()
    }
  }

  activateBossEncounter(): void {
    const host = this.host
    if (host.bossEncounterActive) {
      return
    }
    host.bossEncounterActive = true
    host.lockBossGate()
    host.applyBossRoomCameraLock()
    AudioService.playMusic(host, 'boss')
    AudioService.playSfx('boss_activate')
    const phase = host.bossController?.currentPhase
    if (phase) {
      host.currentPhaseName = phase.name.toUpperCase()
      host.updatePhaseHud()
    } else {
      host.phaseLabel?.setText('BOSS\nACTIVE')
    }
    if (!host.storyDirector) {
      host.showStageToast('Boss room sealed', 800)
      this.beginBossCombat()
      return
    }
    host.storyDirector.playBossIntro(() => this.beginBossCombat())
  }

  /** The first frame of the fight: the boss acts and the HP bar shows the boss's full, current HP. */
  beginBossCombat(): void {
    const host = this.host
    host.bossController?.unlockIntro()
    host.bossUiBinder?.onFightStart()
    host.hud?.setBossBarVisible(Boolean(host.bossHp))
  }

  onBossDefeated(): void {
    const host = this.host
    if (host.bossDeathHandled) {
      return
    }
    host.bossDeathHandled = true
    host.victoryTriggered = true
    host.bossProjectileController?.stop()
    this.telegraphs.clear()
    host.bossUiBinder?.onBossDeath()
    AudioService.stopMusic()
    AudioService.playSfx('stage_clear')
    if (host.bossHp) {
      host.bossHp = { current: 0, max: host.bossHp.max }
      host.hud?.updateBossHp(host.bossHp.current, host.bossHp.max)
    }
    host.unlockBossGate()
    host.disableBossCombatActors()
    host.disableProjectileGroups()
    host.freezeCombatWorld()
    const stageId = host.stageId ?? 'unknown'
    const bossName = host.bossName ?? stageId
    const stage = getCampaignStage(stageId)
    const previousClearedCount = countClearedRobotMasters(host.progressionSave)
    host.collectProgressionLocation(getLocationCheckId(stage.id as Parameters<typeof getLocationCheckId>[0], 'boss_clear'))
    Save.clearActiveRun()
    host.progressionSave = Save.load()
    const clearedCount = countClearedRobotMasters(host.progressionSave)
    const gate = evaluateFinalGate(Save.load())
    const milestoneCount = clearedCount !== previousClearedCount ? clearedCount : null
    host.registry.set('ui.stageSelect.milestoneCount', milestoneCount !== null && pendingMilestoneId(milestoneCount) ? milestoneCount : null)
    const showVictory = () => this.showBossVictory(stage, bossName, gate.unlocked)
    if (host.storyDirector) {
      host.storyDirector.playBossDefeat(showVictory)
    } else {
      showVictory()
    }
  }

  private showBossVictory(stage: ReturnType<typeof getCampaignStage>, bossName: string, finalRouteUnlocked: boolean): void {
    const host = this.host
    host.victoryModal?.destroy()
    host.victoryModal = new VictoryModal(host)
    host.victoryModal.show({
      bossName,
      onNext: () => {
        if (stage.id === FINAL_STAGE_ID) {
          host.scene.start('EndingScene')
          return
        }
        host.handleReturnToStageSelect('victory', {
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

  private syncBossArt(): void {
    const host = this.host
    if (!host.bossArt) {
      return
    }
    const source = (host.bossController ? host.bossTarget : host.bossBody) ?? host.bossBody
    if (!source) {
      return
    }
    host.bossArt.setPosition(source.x, source.y)
    const body = source.body as Phaser.Physics.Arcade.Body | undefined
    if (body && body.velocity.x !== 0) {
      host.bossArt.setFlipX(body.velocity.x < 0)
    }
  }
}
