import Phaser from 'phaser'
import { GAME_WIDTH } from '../config/renderPolicy'
import { computeBossBodyOffset, measureContactOffset } from './bossBodyAlignment'
import { BossBlueprint, AttackPattern, type BossGroundReport, type BossId } from './types'
import { ArenaController } from '../boss/framework/ArenaController'
import { BossBase } from '../boss/framework/BossBase'
import { BossDefinition, DamageEvent, HitResult } from '../boss/framework/types'
import { clampBossXToBounds, type MovementBounds } from '../content/stageArenaLayout'
import { normalizedId, resolveAttackDamage, toAttackPatternFromDefinition, toBossDefinition } from '../boss/framework/bossDefinitionMapper'
import { defaultBossBodyPlan, resolveBossBodies, type BossBodyBoxes, type BossContactAttack } from './bossBodies'
import { getBossJumpInterval, getBossMotionProfile } from './bossMotionProfile'
import {
  BOSS_COMBAT_PROFILES,
  type BossAttackLifecyclePhase,
  type BossCombatProfile,
  type BossMotionIntentKind,
  getBossAttackCombatProfile
} from './bossCombatProfiles'
import { BossMotionController } from './BossMotionController'
import { bossDeathTimeline, paletteFlashColor, resolveDesperationArena, type DesperationArenaChange } from '../boss/fightBeats'
import { bossRecoilFrame, breakDirection, breakKnockbackOffset, breakKnockbackX, type BossBreakStyle } from '../boss/bossBreak'

export interface BossControllerConfig {
  spawn: Phaser.Math.Vector2
  lockIntro?: boolean
  runtimeDefinition?: BossDefinition
  movementBounds?: MovementBounds
  getActiveHazardCount?: () => number
  /** The Game scene's live attack telegraph, reported by getDebugState (`bossState.runtime.telegraph`). */
  telegraphProbe?: () => unknown
  /** The Game scene's live boss hazards, reported by getDebugState (`bossState.runtime.hazards`). */
  hazardProbe?: () => unknown
}

interface BossPhaseView {
  name: string
  threshold: number
}

/** The last break, for `getDebugState().break` (smoke 44): where the knockback started and ended. */
interface BossBreakRecord {
  atMs: number
  heroX: number
  direction: 'west' | 'east'
  style: BossBreakStyle
  interruptedAttackId: string | null
  fromX: number | null
  toX: number | null
}

interface BossRuntimeTrace {
  sequence: number
  atMs: number
  event: 'attack_started' | 'phase_changed' | 'motion_started' | 'landed' | 'attack_resolved' | 'attack_interrupted'
  attackId: string | null
  lifecycle: BossAttackLifecyclePhase
  motion: BossMotionIntentKind
  facing: 'west' | 'east'
  x: number
  y: number
  vx: number
  vy: number
}

function makePhaseName(index: number): string {
  return index <= 0 ? 'Phase 1' : `Phase ${index + 1}`
}

function seedBossPattern(id: string): number {
  let seed = 0x811c9dc5
  for (let index = 0; index < id.length; index += 1) {
    seed ^= id.charCodeAt(index)
    seed = Math.imul(seed, 0x01000193)
  }
  return seed >>> 0
}

export class BossController extends Phaser.GameObjects.Container {
  readonly blueprint: BossBlueprint

  private readonly sprite: Phaser.GameObjects.Sprite
  private readonly atlasKey: string
  private readonly atlasFrames: string[]
  private readonly groupedAtlasFrames: Record<string, string[]>
  private readonly runtimeDefinition: BossDefinition
  private readonly bossBrain: BossBase
  private readonly arenaController: ArenaController
  private readonly movementBounds: MovementBounds
  private readonly getActiveHazardCount: () => number
  private readonly combatProfile?: BossCombatProfile
  private readonly motionController?: BossMotionController

  private introLocked: boolean
  private moveDirection: -1 | 0 | 1 = 0
  private phaseView: BossPhaseView = { name: 'Phase 1', threshold: 1 }
  private lastFiredAttackId: string | null = null
  private lastFiredAttackAtMs = 0
  private nextJumpAtMs = 0
  private airborneVelocityX = 0
  private patternRngState = 1
  private attackFacing: -1 | 1 = 1
  private lastLifecyclePhase: BossAttackLifecyclePhase = 'done'
  private lastMotionIntent: BossMotionIntentKind = 'hold'
  private lastGroundY = 0
  private readonly telegraphProbe?: () => unknown
  private readonly hazardProbe?: () => unknown
  /** Each attack's id, authored contact hitbox and hit damage, for `getBodyBoxes`. */
  private readonly contactAttacks: BossContactAttack[]
  /** Feet row relative to the container origin, measured from the idle frame. */
  private readonly contactOffsetY: number
  private traceSequence = 0
  private readonly runtimeTraces: BossRuntimeTrace[] = []
  private awaitingActionLanding = false
  private landingPresentationUntilMs = 0
  /** Prompt 07 phase 7.2: attacks started per phase index (the phase-kit trace), intro, desperation and defeat. */
  private readonly startedByPhase: Record<string, Record<string, number>> = {}
  private introPresenting = false
  private defeatStartedAtMs: number | null = null
  private whiteFlashUntilMs = 0
  private paletteFlashStartedAtMs: number | null = null
  private desperationArena: DesperationArenaChange | null = null
  private interrupts = { count: 0, lastAttackId: null as string | null }
  /** A break's knockback in flight: it starts on the first boss frame after the hit-stop (part 12f wave 5). */
  private breakKnockback: { direction: -1 | 1; style: BossBreakStyle; grounded: boolean; elapsedMs: number; fromX: number | null; fromY: number | null } | null = null
  private breaks: { count: number; last: BossBreakRecord | null } = { count: 0, last: null }

  private readonly enforceRoomBoundsAfterPhysics = (): void => {
    const clampedX = clampBossXToBounds(this.x, this.getSafeMovementBounds())
    if (clampedX === this.x) {
      return
    }
    this.x = clampedX
    this.body.updateFromGameObject()
    this.body.setVelocityX(0)
    this.airborneVelocityX = 0
  }

  declare body: Phaser.Physics.Arcade.Body

  constructor(scene: Phaser.Scene, blueprint: BossBlueprint, config: BossControllerConfig) {
    super(scene, config.spawn.x, config.spawn.y)
    this.blueprint = blueprint
    this.runtimeDefinition = config.runtimeDefinition ?? toBossDefinition(blueprint)
    this.combatProfile = BOSS_COMBAT_PROFILES[blueprint.id as BossId]
    this.motionController = this.combatProfile ? new BossMotionController(this.combatProfile.room) : undefined
    this.patternRngState = seedBossPattern(this.runtimeDefinition.boss_id) || 1
    this.introLocked = !!config.lockIntro
    this.movementBounds = config.movementBounds ?? {
      minX: 16,
      maxX: GAME_WIDTH - 16
    }
    this.getActiveHazardCount = config.getActiveHazardCount ?? (() => 0)
    this.telegraphProbe = config.telegraphProbe
    this.hazardProbe = config.hazardProbe
    this.contactAttacks = [...blueprint.attacks, ...(blueprint.desperation ? [blueprint.desperation.attack] : [])].map((attack) => ({
      id: normalizedId(attack.name),
      hitbox: attack.hitbox,
      damage: resolveAttackDamage(attack)
    }))

    this.atlasKey = `atlas_${blueprint.id}`
    if (!scene.textures.exists(this.atlasKey)) {
      throw new Error(`[BossController] Missing required boss atlas '${this.atlasKey}'`)
    }
    this.atlasFrames = scene.textures
      .get(this.atlasKey)
      .getFrameNames()
      .filter((name) => name !== '__BASE')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    if (this.atlasFrames.length === 0) {
      throw new Error(`[BossController] Boss atlas '${this.atlasKey}' has no frames`)
    }
    this.groupedAtlasFrames = this.buildGroupedAtlasFrames()
    const idleFrame = this.groupedAtlasFrames.idle?.[0] ?? this.atlasFrames[0]

    this.sprite = scene.add.sprite(0, 0, this.atlasKey, idleFrame)
    this.sprite.setOrigin(blueprint.spritePlan.origin.x, blueprint.spritePlan.origin.y)
    this.add(this.sprite)
    scene.add.existing(this)

    scene.physics.add.existing(this)
    this.setSize(this.width || 32, this.height || 32)
    // Boss feet belong on the arena floor. Gravity and platform collision make
    // jumps readable and prevent the old permanent mid-air hover.
    this.body.setAllowGravity(true)
    this.body.setCollideWorldBounds(true)
    this.body.setMaxVelocity(460, 560)
    scene.events.on(Phaser.Scenes.Events.POST_UPDATE, this.enforceRoomBoundsAfterPhysics)
    this.once(Phaser.GameObjects.Events.DESTROY, () => {
      scene.events.off(Phaser.Scenes.Events.POST_UPDATE, this.enforceRoomBoundsAfterPhysics)
    })

    const body = this.body
    // The body bottom must sit on the drawn feet, otherwise the art floats above the floor the
    // body is standing on. See bossBodyAlignment.ts for the container/offset math.
    this.contactOffsetY = measureContactOffset(scene.textures, this.atlasKey, idleFrame, this.sprite.originY)
    const bodyOffset = computeBossBodyOffset({
      bodyWidth: blueprint.spritePlan.frame.x,
      bodyHeight: blueprint.spritePlan.frame.y,
      containerWidth: this.width,
      containerHeight: this.height,
      contactOffsetY: this.contactOffsetY
    })
    body.setSize(blueprint.spritePlan.frame.x, blueprint.spritePlan.frame.y)
    body.setOffset(bodyOffset.x, bodyOffset.y)
    body.updateFromGameObject()

    this.arenaController = new ArenaController({
      lockDoors: () => this.scene.events.emit('arena-lock', { id: this.runtimeDefinition.boss_id }),
      unlockDoors: () => this.scene.events.emit('arena-unlock', { id: this.runtimeDefinition.boss_id }),
      startBossMusic: () => this.scene.events.emit('boss-music-start', { id: this.runtimeDefinition.boss_id }),
      stopBossMusic: () => this.scene.events.emit('boss-music-stop', { id: this.runtimeDefinition.boss_id }),
      dropReward: () =>
        this.scene.events.emit('boss-reward-drop', {
          id: this.runtimeDefinition.boss_id,
          reward: this.blueprint.weaponReward
        })
    })

    this.bossBrain = new BossBase(this.runtimeDefinition, {
      onAttackStarted: (attack) => {
        const phaseLog = (this.startedByPhase[String(this.bossBrain.currentPhaseIndex)] ??= {})
        phaseLog[attack.id] = (phaseLog[attack.id] ?? 0) + 1
        this.lastFiredAttackId = attack.id
        this.lastFiredAttackAtMs = Math.max(0, Math.round(this.scene.time.now ?? 0))
        const playerX = (this.scene.registry.get('player_x') as number | undefined) ?? this.x
        const grounded = this.body?.onFloor?.() || this.body?.blocked?.down || false
        if (grounded) this.lastGroundY = this.y
        const attackProfile = getBossAttackCombatProfile(this.blueprint.id as BossId, attack.id)
        if (attackProfile && this.motionController) {
          this.motionController.beginAttack(
            this.scene.time.now,
            attack,
            attackProfile,
            this.x,
            playerX,
            this.lastGroundY || this.y
          )
          this.attackFacing = playerX < this.x ? -1 : 1
          this.lastLifecyclePhase = 'windup'
          this.lastMotionIntent = attackProfile.motion.kind
          this.pushRuntimeTrace('attack_started')
        }
        const attackPattern = this.toSceneAttackPattern(attack)
        this.scene.events.emit('boss-attack', {
          id: this.runtimeDefinition.boss_id,
          attack: attackPattern,
          attackData: attack
        })
      },
      onAttackResolved: () => {
        this.pushRuntimeTrace('attack_resolved')
        const grounded = this.body?.onFloor?.() || this.body?.blocked?.down || false
        const waitsForLanding =
          !grounded &&
          (this.lastMotionIntent === 'jump_to' ||
            this.lastMotionIntent === 'dive_to' ||
            this.lastMotionIntent === 'slam_to_floor')
        if (waitsForLanding) {
          this.awaitingActionLanding = true
          this.lastLifecyclePhase = 'landing'
        } else {
          this.motionController?.finishAttack()
          this.lastLifecyclePhase = 'done'
          this.lastMotionIntent = 'hold'
        }
      },
      onPhaseChanged: (phaseIndex, phase) => {
        this.phaseView = {
          name: this.blueprint.phases[phaseIndex]?.name ?? phase.name ?? makePhaseName(phaseIndex),
          threshold: phase.threshold
        }
        if (phase.desperation) this.enterDesperation()
        this.scene.events.emit('boss-phase-change', {
          id: this.runtimeDefinition.boss_id,
          phase: this.phaseView,
          phaseIndex,
          phaseData: phase
        })
      },
      onDamageApplied: (event, result) => {
        this.scene.events.emit('boss-damage', {
          id: this.runtimeDefinition.boss_id,
          event,
          result,
          hp: this.bossBrain.hpSnapshot
        })
      },
      onAttackInterrupted: (attack) => {
        this.interrupts = { count: this.interrupts.count + 1, lastAttackId: attack.id }
        this.motionController?.finishAttack()
        this.awaitingActionLanding = false
        this.lastLifecyclePhase = 'done'
        this.lastMotionIntent = 'hold'
        this.pushRuntimeTrace('attack_interrupted')
        this.scene.events.emit('boss-attack-interrupted', {
          id: this.runtimeDefinition.boss_id,
          attackId: attack.id,
          attackName: attack.displayName ?? attack.id
        })
      },
      onBroken: ({ interruptedAttack }) => this.beginBreak(interruptedAttack?.id ?? null),
      onDied: () => {
        this.arenaController.onBossDeath()
        // destroy() waits for the defeat frames and the chained explosion (prompt 07 phase 7.2 item 5).
        this.beginDefeat()
        this.scene.events.emit('boss-defeated', {
          id: this.runtimeDefinition.boss_id,
          reward: this.blueprint.weaponReward
        })
      }
    })

    this.bossBrain.OnFightStart()
    this.phaseView = { name: this.blueprint.phases[0]?.name ?? makePhaseName(0), threshold: 1 }
    this.nextJumpAtMs = this.scene.time.now + 850
    if (!this.introLocked) {
      this.arenaController.onIntroStart()
      this.bossBrain.unlockIntro()
    }
  }

  /** The phase the brain is in (0 for phase one; desperation counts after the authored phases). */
  get phaseIndex(): number {
    return this.bossBrain.currentPhaseIndex
  }

  /**
   * The hurtbox and the contact hitbox this frame (prompt 07 phase 7.0, EVAL-P7-010): placed from the floor body's
   * feet and the drawn facing; an active attack with an authored `hitbox` swaps in its box and damage.
   */
  getBodyBoxes(): BossBodyBoxes {
    const body = this.body
    return resolveBossBodies({
      plan: this.blueprint.bodies ?? defaultBossBodyPlan(this.blueprint.spritePlan.frame),
      contactDamage: this.blueprint.baseStats.contactDamage,
      feet: { x: body?.center?.x ?? this.x, y: body?.bottom ?? this.y },
      facing: this.sprite.flipX ? -1 : 1,
      activeAttackId: this.bossBrain.activeAttackId ?? null,
      lifecycle: this.bossBrain.activeAttackLifecycle ?? null,
      attacks: this.contactAttacks
    })
  }

  get currentPhase(): BossPhaseView {
    return this.phaseView
  }

  get hp(): { current: number; max: number } {
    return this.bossBrain.hpSnapshot
  }

  /** The encounter began: the INTRO state plays the intro frames once and holds the last. */
  beginIntroPresentation(): void {
    this.introPresenting = true
  }

  /**
   * The death presentation: the body stops colliding, the defeat frames play once, and the container is
   * destroyed when the chained explosion ends (`bossDeathTimeline().explosionEndMs`). Safe to call twice.
   */
  beginDefeat(): void {
    if (this.defeatStartedAtMs !== null) return
    this.defeatStartedAtMs = Math.max(0, Math.round(this.scene.time.now ?? 0))
    this.motionController?.finishAttack()
    this.breakKnockback = null
    if (this.body) {
      this.body.setVelocity(0, 0)
      this.body.setAllowGravity(false)
      this.body.enable = false
    }
    this.sprite.clearTint()
    this.sprite.setScale(1).setAngle(0).setAlpha(1)
    this.playFrameGroup('defeat', 0)
    this.scene.time.delayedCall(bossDeathTimeline().explosionEndMs, () => {
      if (this.active) this.destroy()
    })
  }

  /** A weakness hit's white flash: the sprite fills white until `durationMs` has passed. */
  flashWhite(durationMs: number): void {
    this.whiteFlashUntilMs = this.scene.time.now + durationMs
    this.sprite.setTintFill(0xffffff)
  }

  /**
   * A break landed (part 12f wave 5): whatever the boss was doing stops (the interrupted attack's motion, a passive
   * jump, a walk), and the knockback starts away from the hero. Grounded and hybrid bosses hop; aerial ones bob.
   */
  private beginBreak(interruptedAttackId: string | null): void {
    const heroX = (this.scene.registry.get('player_x') as number | undefined) ?? this.x
    const direction = breakDirection(this.x, heroX, this.sprite.flipX ? -1 : 1)
    const style: BossBreakStyle = this.combatProfile?.locomotion === 'aerial' ? 'hover' : 'hop'
    const grounded = this.body?.onFloor?.() || this.body?.blocked?.down || false
    this.motionController?.finishAttack()
    this.awaitingActionLanding = false
    this.landingPresentationUntilMs = 0
    this.lastLifecyclePhase = 'done'
    this.lastMotionIntent = 'hold'
    this.airborneVelocityX = 0
    this.body?.setVelocity(0, 0)
    this.body?.setAllowGravity(false)
    this.breakKnockback = { direction, style, grounded, elapsedMs: 0, fromX: null, fromY: null }
    const atMs = Math.max(0, Math.round(this.scene.time.now ?? 0))
    const record: BossBreakRecord = { atMs, heroX: Math.round(heroX), direction: direction === -1 ? 'west' : 'east', style, interruptedAttackId, fromX: null, toX: null }
    this.breaks = { count: this.breaks.count + 1, last: record }
    // The recoil pose shows at once, so the weakness hit-stop freezes the boss in it rather than in its attack pose.
    this.sprite.setFlipX(heroX < this.x)
    this.playAnimationForState()
  }

  /**
   * The knockback, scripted in boss time from where the boss stood when the hit-stop let go: out along the curve,
   * clamped to the safe bounds, gravity off until it ends; then gravity lands it.
   */
  private stepBreakKnockback(delta: number): void {
    const knockback = this.breakKnockback
    if (!knockback) return
    if (knockback.fromX === null || knockback.fromY === null) {
      knockback.fromX = this.x
      knockback.fromY = this.y
      if (this.breaks.last) this.breaks.last.fromX = Math.round(this.x)
    }
    knockback.elapsedMs += Math.max(0, delta)
    const offset = breakKnockbackOffset(knockback.elapsedMs, knockback.style, knockback.grounded)
    this.x = breakKnockbackX(knockback.fromX, knockback.direction, offset.dx, this.getSafeMovementBounds())
    this.y = knockback.fromY + offset.dy
    this.body.setVelocity(0, 0)
    this.body.setAllowGravity(offset.done)
    if (offset.done) {
      this.breakKnockback = null
      if (this.breaks.last) this.breaks.last.toX = Math.round(this.x)
    }
  }

  get isInvulnerable(): boolean {
    return this.bossBrain.state === 'HURT_INVULN' || this.bossBrain.state === 'PHASE_TRANSITION'
  }

  getDebugState(): Record<string, unknown> {
    const visibleBossSprites = this.list.filter(
      (child) => child instanceof Phaser.GameObjects.Sprite && child.visible && child.active
    )
    return {
      blueprintId: this.blueprint.id,
      runtimeConfigId: this.runtimeDefinition.boss_id,
      state: this.bossBrain.state,
      phaseIndex: this.bossBrain.currentPhaseIndex,
      phaseName: this.phaseView.name,
      activeAttackId: this.bossBrain.activeAttackId ?? null,
      lastFiredAttackId: this.lastFiredAttackId,
      lastFiredAttackAtMs: this.lastFiredAttackAtMs,
      attackLifecyclePhase: this.lastLifecyclePhase,
      motionIntent: this.lastMotionIntent,
      lockedFacing: this.attackFacing === -1 ? 'west' : 'east',
      animationKey: this.sprite.anims.currentAnim?.key ?? null,
      animationFrame: String(this.sprite.frame?.name ?? ''),
      combatIdentity: this.combatProfile?.identity ?? null,
      roomDynamics: this.combatProfile?.room ?? null,
      activeHazardCount: this.getActiveHazardCount(),
      phaseKit: this.getPhaseKitDebug(),
      intro: { presenting: this.introPresenting },
      defeat: { startedAtMs: this.defeatStartedAtMs, destroyAtMs: this.defeatStartedAtMs === null ? null : this.defeatStartedAtMs + bossDeathTimeline().explosionEndMs },
      interrupts: { ...this.interrupts },
      break: {
        broken: this.bossBrain.isBroken,
        lockoutRemainingMs: Math.round(this.bossBrain.breakLockoutRemainingMs),
        knockback: this.breakKnockback ? { style: this.breakKnockback.style, elapsedMs: Math.round(this.breakKnockback.elapsedMs) } : null,
        count: this.breaks.count,
        last: this.breaks.last ? { ...this.breaks.last } : null
      },
      activeAttackLifecycle: this.bossBrain.activeAttackLifecycle ?? null,
      traceCount: this.runtimeTraces.length,
      traceTail: this.runtimeTraces.slice(-8),
      grounded: this.body?.onFloor?.() || this.body?.blocked?.down || false,
      ground: this.getGroundReport(),
      telegraph: this.telegraphProbe?.() ?? null,
      bodies: this.getBodyBoxes(),
      hazards: this.hazardProbe?.() ?? null,
      velocity: { x: Math.round(this.body?.velocity?.x ?? 0), y: Math.round(this.body?.velocity?.y ?? 0) },
      invulnerable: this.isInvulnerable,
      facing: this.sprite.flipX ? 'west' : 'east',
      visualChildCount: this.list.length,
      visibleBossSpriteCount: visibleBossSprites.length,
      movementBounds: { ...this.movementBounds }
    }
  }

  update(_time: number, delta: number): void {
    const playerX = (this.scene.registry.get('player_x') as number | undefined) ?? this.x
    const playerY = (this.scene.registry.get('player_y') as number | undefined) ?? this.y
    const distance = Math.abs(playerX - this.x)
    const groundedBeforeTick = this.body.onFloor() || this.body.blocked.down
    if (this.awaitingActionLanding && groundedBeforeTick) {
      this.awaitingActionLanding = false
      this.landingPresentationUntilMs =
        this.scene.time.now +
        (getBossAttackCombatProfile(this.blueprint.id as BossId, this.lastFiredAttackId ?? '')?.landingMs ?? 160)
      this.lastLifecyclePhase = 'landing'
      this.pushRuntimeTrace('landed')
      this.motionController?.finishAttack()
    } else if (
      this.landingPresentationUntilMs > 0 &&
      this.scene.time.now >= this.landingPresentationUntilMs
    ) {
      this.landingPresentationUntilMs = 0
      this.lastLifecyclePhase = 'done'
      this.lastMotionIntent = 'hold'
    }

    const tick = this.bossBrain.TickAI({
      nowMs: this.scene.time.now,
      dtMs: delta,
      bossPosition: { x: this.x, y: this.y },
      playerPosition: { x: playerX, y: playerY },
      distanceToPlayer: distance,
      lineOfSight: true,
      rng: () => this.nextPatternRandom(),
      phaseIndex: this.bossBrain.currentPhaseIndex,
      speedMultiplier: 1,
      thinkTimeMultiplier: 1,
      bossGrounded: groundedBeforeTick,
      activeHazardCount: this.getActiveHazardCount()
    })

    this.moveDirection = tick.movementDirection
    const speed = (this.runtimeDefinition.moveSpeed ?? this.blueprint.baseStats.moveSpeed) * 0.9
    const grounded = this.body.onFloor() || this.body.blocked.down
    if (grounded) this.lastGroundY = this.y

    if (this.breakKnockback) {
      // The break owns the body until its knockback ends: no attack motion, walk or passive jump.
      this.stepBreakKnockback(delta)
      this.sprite.setFlipX(playerX < this.x)
      this.playAnimationForState()
      return
    }

    const motionFrame = this.motionController?.update({
      nowMs: this.scene.time.now,
      x: this.x,
      y: this.y,
      velocityX: this.body.velocity.x,
      velocityY: this.body.velocity.y,
      grounded,
      playerX,
      playerY,
      groundY: this.lastGroundY || this.y,
      bounds: this.getSafeMovementBounds()
    })

    if (motionFrame) {
      this.body.setAllowGravity(motionFrame.allowGravity)
      if (motionFrame.setX != null) this.x = clampBossXToBounds(motionFrame.setX, this.getSafeMovementBounds())
      if (motionFrame.setY != null) this.y = motionFrame.setY
      if (motionFrame.velocityX != null) this.body.setVelocityX(motionFrame.velocityX)
      if (motionFrame.velocityY != null) this.body.setVelocityY(motionFrame.velocityY)
      this.attackFacing = motionFrame.facing
      this.lastMotionIntent = motionFrame.intent
      if (motionFrame.phaseChanged) {
        this.lastLifecyclePhase = motionFrame.phase
        this.pushRuntimeTrace('phase_changed')
      }
      if (motionFrame.motionStarted) this.pushRuntimeTrace('motion_started')
      if (motionFrame.landed && !this.awaitingActionLanding) this.pushRuntimeTrace('landed')
    } else {
      // Between attacks every boss stands on the floor, hover bosses included; their hover_to and
      // dive_to attacks lift them and gravity brings them back down.
      this.body.setAllowGravity(true)
    }

    if (!motionFrame && grounded) {
      this.airborneVelocityX = 0
      this.body.setVelocityX(this.moveDirection * speed)

      const motion = getBossMotionProfile(this.blueprint)
      const canJump =
        this.combatProfile?.passiveMotion === 'jump_to' &&
        !this.introLocked &&
        this.lastFiredAttackId !== null &&
        (tick.state === 'THINK' || tick.state === 'MOVE_TO_RANGE') &&
        this.scene.time.now >= this.nextJumpAtMs
      if (canJump) {
        const direction = playerX < this.x ? -1 : 1
        this.airborneVelocityX = direction * speed * motion.airSpeedMultiplier
        this.body.setVelocity(this.airborneVelocityX, motion.jumpVelocityY)
        this.nextJumpAtMs =
          this.scene.time.now + getBossJumpInterval(motion, this.bossBrain.currentPhaseIndex)
      }
    } else if (!motionFrame && this.airborneVelocityX !== 0) {
      this.body.setVelocityX(this.airborneVelocityX)
    }

    // Keep movement collision-safe in the arena.
    const safeMovementBounds = this.getSafeMovementBounds()
    this.x = clampBossXToBounds(this.x, safeMovementBounds)
    const projectedX = this.x + this.body.velocity.x * (Math.max(0, delta) / 1000)
    if (
      (projectedX <= safeMovementBounds.minX && this.body.velocity.x < 0) ||
      (projectedX >= safeMovementBounds.maxX && this.body.velocity.x > 0)
    ) {
      this.x = Phaser.Math.Clamp(projectedX, safeMovementBounds.minX, safeMovementBounds.maxX)
      this.body.setVelocityX(0)
      this.airborneVelocityX = 0
    }

    // Boss artwork must communicate the same target used by the attack system.
    // Movement can stop or reverse during an attack, so velocity is not a
    // reliable facing source.
    this.sprite.setFlipX(motionFrame ? this.attackFacing === -1 : playerX < this.x)

    this.playAnimationForState()
  }

  pauseAnimations(): void {
    this.sprite.anims.pause()
  }

  resumeAnimations(): void {
    this.sprite.anims.resume()
  }

  hurt(amount: number): HitResult {
    const event: DamageEvent = {
      amount,
      type: 'normal',
      source: 'player',
      hitstopFrames: 2
    }
    return this.applyDamage(event)
  }

  applyDamage(event: DamageEvent): HitResult {
    return this.bossBrain.ApplyDamage(event)
  }

  unlockIntro(): void {
    if (!this.introLocked) {
      return
    }
    this.introLocked = false
    this.arenaController.onIntroStart()
    this.bossBrain.unlockIntro()
  }

  /**
   * Where the drawn feet are versus the physics body. `feetToBodyGap` is 0 when the art stands
   * exactly where the body does; `grounded` with a non-zero gap means the boss looks like it floats.
   */
  getGroundReport(): BossGroundReport {
    const body = this.body
    const feetY = this.y + this.contactOffsetY
    return {
      x: Math.round(this.x * 100) / 100,
      y: Math.round(this.y * 100) / 100,
      feetY: Math.round(feetY * 100) / 100,
      bodyTop: Math.round((body?.top ?? this.y) * 100) / 100,
      bodyBottom: Math.round((body?.bottom ?? this.y) * 100) / 100,
      feetToBodyGap: Math.round(((body?.bottom ?? feetY) - feetY) * 100) / 100,
      contactOffsetY: Math.round(this.contactOffsetY * 100) / 100,
      grounded: body?.onFloor?.() || body?.blocked?.down || false,
      allowGravity: body?.allowGravity ?? true,
      velocityY: Math.round(body?.velocity?.y ?? 0),
      lastGroundY: Math.round(this.lastGroundY),
      motionIntent: this.lastMotionIntent,
      lifecyclePhase: this.lastLifecyclePhase
    }
  }

  getAttackFacing(): -1 | 1 {
    return this.attackFacing
  }

  /** The feet line the boss last stood on (the arena floor); its current y before it first lands. */
  getGroundY(): number {
    return this.lastGroundY || this.y
  }

  /**
   * The floor the boss stands on: the last ground line plus the floor body's bottom offset. `getGroundY` is the
   * container's y, a few pixels above the body bottom the hero and the boss actually stand on.
   */
  getFloorY(): number {
    return this.getGroundY() + ((this.body?.bottom ?? this.y) - this.y)
  }

  getRoomHazardCap(): number {
    return this.combatProfile?.room.maxActiveHazards ?? 3
  }

  private toSceneAttackPattern(attack: BossDefinition['attacks'][number]): AttackPattern {
    const pattern = toAttackPatternFromDefinition(attack)

    if (pattern.spawns && pattern.spawns.length > 0) {
      return pattern
    }

    if (attack.type === 'projectile') {
      if (attack.id.includes('spark') || attack.id.includes('shot')) {
        pattern.spawns = ['arc_shards']
      } else {
        pattern.spawns = ['slow_bullet']
      }
    }

    // An unauthored slam quakes (the short_quake spawner). A dash spawns nothing: its authored hitbox rides the
    // boss while it is active (`getBodyBoxes`), so no stand-in bullet is injected (prompt 07 phase 7.1 item 3).
    if (attack.type === 'hazard' || attack.type === 'slam') {
      pattern.spawns = ['ground_slam_hazard']
    }

    return pattern
  }

  private nextPatternRandom(): number {
    let value = this.patternRngState
    value ^= value << 13
    value ^= value >>> 17
    value ^= value << 5
    this.patternRngState = value >>> 0
    return this.patternRngState / 0x100000000
  }

  private getSafeMovementBounds(): MovementBounds {
    const inset = 4
    return {
      minX: this.movementBounds.minX + inset,
      maxX: this.movementBounds.maxX - inset
    }
  }

  private getPhaseKitDebug(): Record<string, unknown> {
    const phase = this.runtimeDefinition.phases[this.bossBrain.currentPhaseIndex]
    return {
      phaseIndex: this.bossBrain.currentPhaseIndex,
      desperation: Boolean(phase?.desperation),
      retired: Object.entries(phase?.attackEnabled ?? {}).filter(([, enabled]) => !enabled).map(([id]) => id),
      timing: { ...(phase?.attackTiming ?? {}) },
      startedByPhase: JSON.parse(JSON.stringify(this.startedByPhase)),
      arena: this.desperationArena,
      paletteFlashActive: this.paletteFlashStartedAtMs !== null && this.currentPaletteColor() !== null
    }
  }

  /** Desperation (prompt 07 phase 7.2 item 2): the palette flash, and anchor rooms shift their anchors. */
  private enterDesperation(): void {
    this.paletteFlashStartedAtMs = this.scene.time.now
    this.desperationArena = this.combatProfile ? resolveDesperationArena(this.combatProfile.room) : null
    if (this.desperationArena?.kind === 'anchors_shifting') {
      this.motionController?.setAnchorFractions(this.desperationArena.anchorFractions)
    }
  }

  private currentPaletteColor(): number | null {
    if (this.paletteFlashStartedAtMs === null) return null
    return paletteFlashColor(this.scene.time.now - this.paletteFlashStartedAtMs, this.blueprint.desperation?.flashPalette ?? [0xffffff])
  }

  /**
   * Boss animations are global but the boss atlas is stage-scoped (evicted and reloaded on a revisit): an animation
   * still bound to the old texture's frames is rebuilt, or `play` reads a destroyed frame.
   */
  private ensureAnimation(key: string, config: () => Phaser.Types.Animations.Animation): void {
    const existing = this.scene.anims.get(key)
    const texture = this.scene.textures.get(this.atlasKey)
    if (existing && existing.frames.every((entry) => entry.frame?.texture === texture)) return
    if (existing) this.scene.anims.remove(key)
    this.scene.anims.create(config())
  }

  private playFrameGroup(group: 'intro' | 'phase' | 'defeat', repeat: number): void {
    const animKey = `${this.blueprint.id}_${group}`
    this.ensureAnimation(animKey, () => ({ key: animKey, frames: this.resolveGroupedFrames(group), frameRate: 8, repeat }))
    if (this.sprite.anims.currentAnim?.key !== animKey) this.sprite.play(animKey)
  }

  private playAnimationForState(): void {
    if (this.defeatStartedAtMs !== null) return
    const runtimeState = this.bossBrain.state
    const attackProfile = this.lastFiredAttackId
      ? getBossAttackCombatProfile(this.blueprint.id as BossId, this.lastFiredAttackId)
      : undefined
    const animationPhase =
      this.lastLifecyclePhase === 'windup' ||
      this.lastLifecyclePhase === 'active' ||
      this.lastLifecyclePhase === 'recovery' ||
      this.lastLifecyclePhase === 'landing'
        ? this.lastLifecyclePhase
        : 'recovery'
    const actionKey = attackProfile
      ? attackProfile.animation[animationPhase] ?? attackProfile.animation.recovery
      : null
    const landingPresentation = this.scene.time.now < this.landingPresentationUntilMs
    // A break holds its recoil pose (the first defeat frame) for the whole stun; a plain hit's flinch stays idle.
    const stateKey = this.bossBrain.isBroken
      ? 'recoil'
      : (runtimeState === 'ATTACKING' || landingPresentation) && actionKey
        ? actionKey
        : runtimeState === 'MOVE_TO_RANGE'
          ? 'move'
          : runtimeState === 'HURT_INVULN'
            ? 'idle'
            : runtimeState === 'PHASE_TRANSITION'
              ? 'phase'
              : runtimeState === 'INTRO' && this.introPresenting
                ? 'intro'
                : 'idle'

    const animKey = `${this.blueprint.id}_${stateKey}`
    const frameRate = this.resolveFrameRate(stateKey)
    const repeat = runtimeState === 'ATTACKING' || landingPresentation || stateKey === 'intro' || stateKey === 'phase' ? 0 : -1
    this.ensureAnimation(animKey, () => ({ key: animKey, frames: this.resolveGroupedFrames(stateKey), frameRate, repeat }))

    // Intro and phase poses play once and hold their last frame (a finished anim would otherwise restart).
    const holdsLastFrame = (stateKey === 'intro' || stateKey === 'phase') && this.sprite.anims.currentAnim?.key === animKey
    if (!holdsLastFrame) this.sprite.play(animKey, true)
    this.applyActionPresentation(
      landingPresentation ? 'ATTACKING' : runtimeState,
      this.lastLifecyclePhase,
      attackProfile?.motion.kind
    )
    const paletteColor = this.currentPaletteColor()
    if (paletteColor !== null) this.sprite.setTint(paletteColor)
    if (this.scene.time.now < this.whiteFlashUntilMs) this.sprite.setTintFill(0xffffff)
  }

  private buildGroupedAtlasFrames(): Record<string, string[]> {
    const grouped: Record<string, string[]> = {}
    const prefix = `${this.blueprint.id}/`
    for (const frame of this.atlasFrames) {
      if (!frame.startsWith(prefix)) {
        continue
      }
      const rest = frame.slice(prefix.length)
      const group = rest.split('/')[0]
      if (!group) {
        continue
      }
      if (!grouped[group]) {
        grouped[group] = []
      }
      grouped[group].push(frame)
    }
    Object.values(grouped).forEach((frames) => {
      frames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    })
    return grouped
  }

  private resolveFrameRate(stateKey: string): number {
    const animations = this.blueprint.spritePlan.animations
    const preferred = animations.find((entry) => entry.key.includes(stateKey))
    return Math.max(4, preferred?.fps ?? 8)
  }

  private resolveGroupedFrames(stateKey: string): Phaser.Types.Animations.AnimationFrame[] {
    const actionGroup = stateKey.includes('dash') || stateKey.includes('slide') || stateKey.includes('hop') ||
      stateKey.includes('jump') || stateKey.includes('land') || stateKey.includes('dive') || stateKey.includes('ram')
      ? 'move'
      : stateKey.includes('idle')
        ? 'idle'
        : 'shoot'
    const recoil = bossRecoilFrame(this.groupedAtlasFrames, this.atlasFrames)
    const groupMap: Record<string, string[]> = {
      recoil: recoil ? [recoil] : [],
      intro: this.groupedAtlasFrames.intro ?? this.groupedAtlasFrames.idle ?? [],
      phase: this.groupedAtlasFrames.phase ?? this.groupedAtlasFrames.special ?? [],
      defeat: this.groupedAtlasFrames.defeat ?? this.groupedAtlasFrames.idle ?? [],
      idle: this.groupedAtlasFrames.idle ?? [],
      move: this.groupedAtlasFrames.move ?? this.groupedAtlasFrames.run ?? [],
      shoot: this.groupedAtlasFrames.shoot ?? this.groupedAtlasFrames.attack ?? [],
      special: this.groupedAtlasFrames.special ?? this.groupedAtlasFrames.shoot ?? [],
    }
    const grouped = groupMap[stateKey] ?? groupMap[actionGroup] ?? []
    if (grouped.length > 0) {
      return grouped.map((frame) => ({ key: this.atlasKey, frame }))
    }
    return this.resolveAnimationFrames(stateKey, Math.min(4, this.atlasFrames.length))
  }

  private applyActionPresentation(
    runtimeState: string,
    lifecycle: BossAttackLifecyclePhase,
    motion: BossMotionIntentKind | undefined
  ): void {
    this.sprite.clearTint()
    this.sprite.setAlpha(1)
    this.sprite.setScale(1)
    this.sprite.setAngle(0)
    if (runtimeState !== 'ATTACKING') return

    if (lifecycle === 'windup') {
      this.sprite.setTint(this.blueprint.theme.glow)
      this.sprite.setScale(0.96, 1.05)
    } else if (lifecycle === 'active') {
      this.sprite.setTint(this.blueprint.theme.accent)
      this.sprite.setScale(1.06, 0.96)
      if (motion === 'dash_through' || motion === 'dive_to') {
        this.sprite.setAngle(this.attackFacing * 5)
      }
    } else if (lifecycle === 'recovery') {
      this.sprite.setAlpha(0.88)
      this.sprite.setScale(1.03, 0.97)
    } else if (lifecycle === 'landing') {
      this.sprite.setScale(1.1, 0.88)
      this.sprite.setTint(this.blueprint.theme.primary)
    }
  }

  private pushRuntimeTrace(event: BossRuntimeTrace['event']): void {
    this.traceSequence += 1
    this.runtimeTraces.push({
      sequence: this.traceSequence,
      atMs: Math.max(0, Math.round(this.scene.time.now ?? 0)),
      event,
      attackId: this.lastFiredAttackId,
      lifecycle: this.lastLifecyclePhase,
      motion: this.lastMotionIntent,
      facing: this.attackFacing === -1 ? 'west' : 'east',
      x: Math.round(this.x),
      y: Math.round(this.y),
      vx: Math.round(this.body?.velocity?.x ?? 0),
      vy: Math.round(this.body?.velocity?.y ?? 0)
    })
    if (this.runtimeTraces.length > 32) this.runtimeTraces.splice(0, this.runtimeTraces.length - 32)
  }

  private resolveAnimationFrames(animationKey: string, desiredCount: number): Phaser.Types.Animations.AnimationFrame[] {
    const count = Math.max(1, Math.min(desiredCount, this.atlasFrames.length))
    const slice = this.atlasFrames.slice(0, count)
    if (slice.length === 0) {
      throw new Error(
        `[BossController] Unable to resolve frames for '${animationKey}' in atlas '${this.atlasKey}'`
      )
    }

    return slice.map((frame) => ({ key: this.atlasKey, frame }))
  }
}
