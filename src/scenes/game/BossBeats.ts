import type Phaser from 'phaser'
import AudioService from '../../audio'
import { BossProjectileController, resolveBossMuzzleY } from '../../boss/framework/BossProjectileController'
import { HAZARD_PIECES_BY_ATTACK, type BossHazardId } from '../../boss/hazards/hazardSpawners'
import { getBossAttackCombatProfile } from '../../bosses/bossCombatProfiles'
import type { BossId } from '../../bosses/types'
import type { BossUIBinder } from '../../boss/framework/BossUIBinder'
import type { BossController } from '../../bosses/BossController'
import { countClearedRobotMasters, FINAL_STAGE_ID, getCampaignStage, TUTORIAL_STAGE_ID } from '../../content/campaign'
import { IDENTITY } from '../../content/identity'
import { evaluateFinalGate, getLocationCheckId } from '../../progression'
import type { ProjectileSystem } from '../../projectiles'
import { Save } from '../../systems/Save'
import type { HUD } from '../../ui/HUD'
import { VictoryModal } from '../../ui/VictoryModal'
import { BossBodies } from './BossBodies'
import { BossHazards } from './BossHazards'
import { BossPresentation } from './BossPresentation'
import { BossTelegraphs } from './BossTelegraphs'
import type { CameraDirector } from './CameraDirector'
import { pendingMilestoneId, type StoryDirector } from './StoryDirector'

/** Icicles hang from this far below the camera's top: under the HUD panels, not over them. */
const HAZARD_CEILING_BELOW_VIEW_TOP = 66

/** The Game scene state the boss beats read and write (the scene itself supplies add, tweens, time and the rest). */
export interface BossBeatsState {
  hazards?: Phaser.Physics.Arcade.StaticGroup
  bossController?: BossController
  bossTarget?: Phaser.Physics.Arcade.Sprite
  bossBody?: Phaser.Physics.Arcade.Sprite
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
  hud?: Pick<HUD, 'setBossBarVisible' | 'updateBossHp' | 'setBossBarFill'>
  activeBossRoom?: { x: number; width: number }
  hitstopRemainingFrames: number
  readonly cameraDirector: Pick<CameraDirector, 'onHitstop'>
  bossUiBinder?: Pick<BossUIBinder, 'onFightStart' | 'onBossDeath'>
  storyDirector?: Pick<StoryDirector, 'playBossIntro' | 'playBossDefeat' | 'onBossPhaseTwo'>
  victoryModal?: VictoryModal
  progressionSave: ReturnType<typeof Save.load>
  bossUsingPlaceholder: boolean
  lockBossGate(): void
  unlockBossGate(): void
  applyBossRoomCameraLock(): void
  updatePhaseHud(action?: string): void
  showStageToast(message: string, durationMs?: number): void
  devRegister<T extends Phaser.GameObjects.GameObject>(ref: T | undefined, kind: string): T | undefined
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
  /** WARNING band, name card, bar fill, desperation pulses and the death chain (prompt 07 phase 7.2). */
  readonly presentation: BossPresentation
  /** Every authored hazard's own spawner: body, art and timing (prompt 07 phase 7.1, EVAL-P7-001). */
  readonly hazards: BossHazards
  /** The hurtbox and contact hitbox beside the floor body (prompt 07 phase 7.0, EVAL-P7-010). */
  readonly bodies: BossBodies
  private listening = false

  constructor(private readonly host: BossBeatsHost) {
    this.telegraphs = new BossTelegraphs(host)
    this.presentation = new BossPresentation(host)
    this.hazards = new BossHazards(host)
    this.bodies = new BossBodies(host)
  }

  /** Once per scene run: a weakness interrupt cancels the pending spawn and tell; the desperation phase starts the arena pulses. */
  private listen(): void {
    const host = this.host
    if (this.listening) return
    this.listening = true
    const onInterrupted = (event: { attackId?: string }) => host.bossProjectileController?.cancelPendingAttack(String(event?.attackId ?? ''))
    const onPhase = (event: { phaseIndex?: number; phaseData?: { desperation?: boolean } }) => {
      // Phase two (and any later phase) crossfades the boss track to its phase-two layer; a no-op after the first.
      if (Number(event?.phaseIndex ?? 0) >= 1) AudioService.setMusicPhase(2)
      if (event?.phaseData?.desperation) this.presentation.beginDesperation()
      if (event?.phaseIndex === 1) host.storyDirector?.onBossPhaseTwo()
    }
    host.events.on('boss-attack-interrupted', onInterrupted)
    host.events.on('boss-phase-change', onPhase)
    host.events.once('shutdown', () => {
      host.events.off('boss-attack-interrupted', onInterrupted)
      host.events.off('boss-phase-change', onPhase)
      this.presentation.resetFight()
      this.bodies.forget()
      this.listening = false
    })
  }

  initializeProjectileController(): void {
    const host = this.host
    this.listen()
    this.hazards.reset()
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
      spawnHazard: (id, hazardOrigin, attackData) => this.spawnHazard(id, hazardOrigin, attackData),
      getPhaseIndex: () => host.bossController?.phaseIndex ?? 0,
      log: (level, message, payload) => {
        if (typeof window === 'undefined' || !(window as unknown as { __DEV__?: boolean }).__DEV__) {
          return
        }
        const logger = console[level] ?? console.log
        logger.call(console, message, payload)
      }
    })
  }

  /** An attack's hazard, placed from the boss, the floor it stands on, the room and the hero (see hazardSpawners.ts). */
  spawnHazard(id: BossHazardId, origin: { x: number; y: number }, attackData?: unknown): void {
    const host = this.host
    const data = (attackData ?? {}) as { id?: string; displayName?: string; params?: { dashSpeed?: number }; hit?: { damageAmount?: number } }
    const attackId = String(data.id ?? id)
    const controller = host.bossController
    const originBody = (host.bossTarget ?? host.bossBody)?.body as Phaser.Physics.Arcade.Body | undefined
    const view = host.cameras.main.worldView
    const room = host.activeBossRoom
    const motion = controller ? getBossAttackCombatProfile(controller.blueprint.id as BossId, attackId)?.motion : undefined
    this.hazards.spawn(
      {
        id,
        originX: origin.x,
        floorY: controller?.getFloorY() ?? originBody?.bottom ?? origin.y,
        ceilingY: view.y + HAZARD_CEILING_BELOW_VIEW_TOP,
        muzzleY: resolveBossMuzzleY(origin.y, originBody),
        facing: controller?.getAttackFacing() ?? 1,
        heroX: host.player?.active ? host.player.x : origin.x,
        minX: room ? room.x + 8 : view.x + 8,
        maxX: room ? room.x + room.width - 8 : view.right - 8,
        damage: Math.max(1, Number(data.hit?.damageAmount ?? 2)),
        speed: motion?.speed ?? data.params?.dashSpeed,
        count: HAZARD_PIECES_BY_ATTACK[attackId]
      },
      String(data.displayName ?? attackId)
    )
  }

  countActiveBossRoomHazards(): number {
    return this.hazards.countActive()
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

  /** Every frame: the hurtbox and hitbox follow the floor body (BossController draws and moves the boss itself). */
  update(): void {
    this.bodies.sync()
  }

  /** Shots, hazards and the telegraphs of attacks still in their wind-up. */
  updateProjectiles(now: number, delta: number): void {
    this.host.bossProjectileController?.update(now, delta)
    this.hazards.update(delta)
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
    AudioService.playMusic(host, 'boss', { bossId: host.bossController?.blueprint.id })
    AudioService.playSfx('boss_activate')
    const phase = host.bossController?.currentPhase
    if (phase) {
      host.currentPhaseName = phase.name.toUpperCase()
      host.updatePhaseHud()
    } else {
      host.phaseLabel?.setText('BOSS\nACTIVE')
    }
    // WARNING and the name-and-element card, then the intro dialogue, then the bar fills and the fight starts.
    const blueprint = host.bossController?.blueprint
    const card = {
      name: String(host.bossName ?? blueprint?.codename ?? 'BOSS').toUpperCase(),
      element: `${String(blueprint?.element ?? 'Normal').toUpperCase()} TYPE`,
      color: blueprint?.theme.accent ?? 0xffffff
    }
    this.presentation.playIntro(card, () => {
      if (!host.storyDirector) {
        host.showStageToast('Boss room sealed', 800)
        this.fillBarThenFight()
        return
      }
      host.storyDirector.playBossIntro(() => this.fillBarThenFight())
    })
  }

  private fillBarThenFight(): void {
    const host = this.host
    this.presentation.fillBar(
      () => {
        host.bossUiBinder?.onFightStart()
        host.hud?.setBossBarVisible(Boolean(host.bossHp))
      },
      () => this.beginBossCombat()
    )
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
    this.hazards.clear()
    host.bossUiBinder?.onBossDeath()
    AudioService.stopMusic()
    if (host.bossHp) {
      host.bossHp = { current: 0, max: host.bossHp.max }
      host.hud?.updateBossHp(host.bossHp.current, host.bossHp.max)
    }
    host.unlockBossGate()
    host.disableProjectileGroups()
    host.freezeCombatWorld()
    const stageId = host.stageId ?? 'unknown'
    const bossName = host.bossName ?? stageId
    const stage = getCampaignStage(stageId)
    const previousClearedCount = countClearedRobotMasters(host.progressionSave)
    const previousWeapons = [...host.progressionSave.weaponsUnlocked]
    host.collectProgressionLocation(getLocationCheckId(stage.id as Parameters<typeof getLocationCheckId>[0], 'boss_clear'))
    Save.clearActiveRun()
    host.progressionSave = Save.load()
    const clearedCount = countClearedRobotMasters(host.progressionSave)
    const gate = evaluateFinalGate(Save.load())
    const milestoneCount = clearedCount !== previousClearedCount ? clearedCount : null
    host.registry.set('ui.stageSelect.milestoneCount', milestoneCount !== null && pendingMilestoneId(milestoneCount) ? milestoneCount : null)
    const showVictory = () => this.showBossVictory(stage, bossName, gate.unlocked)
    // The boss stays for its defeat frames and chained explosion; the defeat dialogue follows the freeze.
    this.presentation.playDeath(
      () => host.disableBossCombatActors(),
      () => {
        AudioService.playSfx('stage_clear')
        if (host.storyDirector) {
          host.storyDirector.playBossDefeat(showVictory, previousWeapons)
        } else {
          showVictory()
        }
      }
    )
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
                ? `${bossName} freed! Central Core unlocked.`
                : `${bossName} freed!`,
          focusBossId: stage.id,
          requireConfirmRelease: true
        })
      }
    })
  }
}
