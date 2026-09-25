import { BossAttackController } from './BossAttackController'
import { BossDamageController } from './BossDamageController'
import { BossPhaseController } from './BossPhaseController'
import { BossStateMachine } from './BossStateMachine'
import {
  AttackContext,
  BossContext,
  BossDefinition,
  BossEventHooks,
  BossTickResult,
  DamageEvent,
  HitResult,
  IBoss
} from './types'

function randomBetween(min: number, max: number, rng: () => number): number {
  return min + (max - min) * rng()
}

export class BossBase implements IBoss {
  readonly definition: BossDefinition

  private readonly stateMachine = new BossStateMachine()
  private readonly attackController: BossAttackController
  private readonly damageController: BossDamageController
  private readonly phaseController: BossPhaseController
  private readonly hooks: BossEventHooks

  private introUnlocked = false
  private thinkDelayRemainingMs = 0
  private recoverRemainingMs = 0
  private hurtRemainingMs = 0
  private phaseTransitionRemainingMs = 0
  private lastAttackContext?: AttackContext
  private stunLockoutRemainingMs = 0

  constructor(definition: BossDefinition, hooks: BossEventHooks = {}) {
    this.definition = definition
    this.hooks = hooks
    this.attackController = new BossAttackController(definition.attacks)
    this.damageController = new BossDamageController({
      maxHP: definition.maxHP,
      defense: definition.defense ?? 0,
      resistances: definition.resistances ?? {},
      invulnMs: definition.hurtInvulnMs ?? 220
    })
    this.phaseController = new BossPhaseController(definition.phases)

    const initialUnlocks = new Set(definition.attacks.map((attack) => attack.id))
    const firstPhaseUnlocks = this.phaseController.currentPhase.unlockAttacks ?? []
    if (firstPhaseUnlocks.length > 0) {
      initialUnlocks.clear()
      firstPhaseUnlocks.forEach((id) => initialUnlocks.add(id))
    }
    this.attackController.setUnlockedAttacks([...initialUnlocks])
    this.attackController.setSelectionDeck(this.phaseController.currentPhase.patternDeck ?? [])
    this.attackController.setPhaseKit({
      enabled: this.phaseController.currentPhase.attackEnabled,
      timing: this.phaseController.currentPhase.attackTiming
    })
  }

  /** Whether the phase kit lets `attackId` start in the current phase. */
  isAttackEnabled(attackId: string): boolean {
    return this.attackController.isEnabled(attackId)
  }

  get state() {
    return this.stateMachine.state
  }

  get currentPhaseIndex(): number {
    return this.phaseController.index
  }

  get currentPhase() {
    return this.phaseController.currentPhase
  }

  get activeAttackId(): string | undefined {
    return this.attackController.activeAttackId
  }

  get activeAttackLifecycle(): string | undefined {
    return this.attackController.activeLifecycle
  }

  get hpSnapshot(): { current: number; max: number } {
    return {
      current: this.damageController.currentHP,
      max: this.damageController.maxHp
    }
  }

  unlockIntro(): void {
    this.introUnlocked = true
  }

  OnFightStart(): void {
    this.stateMachine.reset('INTRO')
    this.introUnlocked = false
    this.thinkDelayRemainingMs = 0
    this.recoverRemainingMs = 0
    this.hurtRemainingMs = 0
    this.phaseTransitionRemainingMs = 0
    this.hooks.onStateChanged?.(this.stateMachine.state)
  }

  TickAI(ctx: BossContext): BossTickResult {
    this.damageController.tick(ctx.dtMs)
    this.stunLockoutRemainingMs = Math.max(0, this.stunLockoutRemainingMs - ctx.dtMs)
    this.stateMachine.tick(ctx.dtMs)

    const hp = this.hpSnapshot
    const ratio = hp.max > 0 ? hp.current / hp.max : 0
    const phaseTransition = this.phaseController.evaluate(ratio)

    if (phaseTransition && this.stateMachine.state !== 'DEAD') {
      this.attackController.unlockAttacks(phaseTransition.phase.unlockAttacks ?? [])
      this.attackController.setWeightOverrides(phaseTransition.phase.attackWeightOverrides ?? {})
      this.attackController.setSelectionDeck(phaseTransition.phase.patternDeck ?? [])
      this.attackController.setPhaseKit({ enabled: phaseTransition.phase.attackEnabled, timing: phaseTransition.phase.attackTiming })
      this.phaseTransitionRemainingMs = phaseTransition.phase.transitionLockMs ?? 420
      this.stateMachine.tryTransition('PHASE_TRANSITION')
      this.hooks.onPhaseChanged?.(phaseTransition.current, phaseTransition.phase)
      this.hooks.onStateChanged?.(this.stateMachine.state)
    }

    const attackContext = this.createAttackContext(ctx)
    this.lastAttackContext = attackContext
    const attackTick = this.attackController.tick(ctx.dtMs, attackContext)
    if (attackTick.done) {
      this.hooks.onAttackResolved?.(attackTick.done)
    }

    let moveDirection: -1 | 0 | 1 = 0

    switch (this.stateMachine.state) {
      case 'INTRO': {
        const lockMs = this.definition.introLockMs ?? 1200
        if (this.introUnlocked && this.stateMachine.stateTimerMs >= lockMs) {
          this.transitionTo('THINK')
        }
        break
      }
      case 'THINK': {
        if (this.thinkDelayRemainingMs <= 0) {
          const thinkMult = this.phaseController.getThinkMultiplier()
          this.thinkDelayRemainingMs = randomBetween(180, 420, ctx.rng) / thinkMult
        }
        this.thinkDelayRemainingMs -= ctx.dtMs
        if (this.thinkDelayRemainingMs <= 0) {
          const started = this.attackController.tryStartAttack(
            attackContext,
            this.definition.panicDistance ?? 36
          )
          if (started) {
            this.hooks.onAttackStarted?.(started)
            this.transitionTo('ATTACKING')
          } else {
            this.transitionTo('MOVE_TO_RANGE')
          }
        }
        break
      }
      case 'MOVE_TO_RANGE': {
        const preferred = this.definition.preferredRange ?? { min: 48, max: 160 }
        if (ctx.distanceToPlayer < preferred.min) {
          moveDirection = ctx.playerPosition.x < ctx.bossPosition.x ? 1 : -1
        } else if (ctx.distanceToPlayer > preferred.max) {
          moveDirection = ctx.playerPosition.x < ctx.bossPosition.x ? -1 : 1
        } else {
          const started = this.attackController.tryStartAttack(
            attackContext,
            this.definition.panicDistance ?? 36
          )
          if (started) {
            this.hooks.onAttackStarted?.(started)
            this.transitionTo('ATTACKING')
          } else {
            this.transitionTo('THINK')
          }
        }
        break
      }
      case 'ATTACKING': {
        if (!this.attackController.activeAttackId) {
          this.recoverRemainingMs = this.definition.recoverMs ?? 180
          this.transitionTo('RECOVER')
        }
        break
      }
      case 'RECOVER': {
        this.recoverRemainingMs -= ctx.dtMs
        if (this.recoverRemainingMs <= 0) {
          this.transitionTo('THINK')
        }
        break
      }
      case 'HURT_INVULN': {
        this.hurtRemainingMs -= ctx.dtMs
        if (this.hurtRemainingMs <= 0) {
          this.transitionTo('THINK')
        }
        break
      }
      case 'PHASE_TRANSITION': {
        this.phaseTransitionRemainingMs -= ctx.dtMs
        if (this.phaseTransitionRemainingMs <= 0) {
          this.transitionTo(this.attackController.activeAttackId ? 'ATTACKING' : 'THINK')
        }
        break
      }
      case 'DEAD':
      default:
        moveDirection = 0
        break
    }

    return {
      state: this.stateMachine.state,
      activeAttackId: this.attackController.activeAttackId,
      movementDirection: moveDirection,
      hp,
      phaseChanged: phaseTransition
        ? { previous: phaseTransition.previous, current: phaseTransition.current }
        : undefined,
      firedAttack: attackTick.fired,
      transitionLocked: this.stateMachine.state === 'PHASE_TRANSITION'
    }
  }

  ApplyDamage(event: DamageEvent): HitResult {
    const result = this.damageController.applyDamage(event)
    this.hooks.onDamageApplied?.(event, result)
    if (result.defeated) {
      this.Die()
    } else if (result.accepted && this.stateMachine.state !== 'DEAD') {
      const weaknessStun = event.stunMs !== undefined && this.stunLockoutRemainingMs <= 0
      if (weaknessStun) this.stunLockoutRemainingMs = event.stunLockoutMs ?? 0
      if (weaknessStun && event.interruptWindup) {
        const interrupted = this.attackController.interruptWindup(this.lastAttackContext ?? this.idleAttackContext())
        if (interrupted) {
          result.interruptedAttackId = interrupted.id
          this.hooks.onAttackInterrupted?.(interrupted)
        }
      }
      this.hurtRemainingMs = weaknessStun ? (event.stunMs ?? 70) : (this.definition.hurtStunMs ?? 70)
      this.transitionTo('HURT_INVULN')
    }
    return result
  }

  private idleAttackContext(): AttackContext {
    return this.createAttackContext({
      nowMs: 0,
      dtMs: 0,
      bossPosition: { x: 0, y: 0 },
      playerPosition: { x: 0, y: 0 },
      distanceToPlayer: 0,
      lineOfSight: true,
      rng: () => 0,
      phaseIndex: this.phaseController.index,
      speedMultiplier: 1,
      thinkTimeMultiplier: 1
    })
  }

  Die(): void {
    if (this.stateMachine.state === 'DEAD') {
      return
    }
    this.transitionTo('DEAD')
    this.hooks.onDied?.()
  }

  private transitionTo(next: Parameters<BossStateMachine['tryTransition']>[0]): void {
    const transitioned = this.stateMachine.tryTransition(next)
    if (transitioned) {
      this.hooks.onStateChanged?.(next)
    }
  }

  private createAttackContext(ctx: BossContext): AttackContext {
    return {
      ...ctx,
      phaseIndex: this.phaseController.index,
      speedMultiplier: this.phaseController.getAttackSpeedMultiplier(),
      thinkTimeMultiplier: this.phaseController.getThinkMultiplier(),
      isPlayerTooClose: ctx.distanceToPlayer <= (this.definition.panicDistance ?? 36)
    }
  }
}
