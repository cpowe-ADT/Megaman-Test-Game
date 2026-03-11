import {
  AttackContext,
  AttackTickResult,
  BossAttackDefinition,
  IAttack
} from './types'

type AttackLifecyclePhase = 'idle' | 'windup' | 'active' | 'recovery' | 'done'

export class TimedAttackModule implements IAttack {
  readonly id: string
  readonly Cooldown: number
  readonly definition: BossAttackDefinition

  private phase: AttackLifecyclePhase = 'idle'
  private phaseRemainingMs = 0
  private emittedActiveSpawn = false

  constructor(definition: BossAttackDefinition) {
    this.definition = definition
    this.id = definition.id
    this.Cooldown = definition.cooldown
  }

  Enter(_ctx: AttackContext): void {
    this.phase = 'windup'
    this.phaseRemainingMs = this.definition.windupTime
    this.emittedActiveSpawn = false
  }

  Tick(dtMs: number, _ctx: AttackContext): AttackTickResult {
    if (this.phase === 'idle' || this.phase === 'done') {
      return { phase: 'done' }
    }

    this.phaseRemainingMs -= dtMs
    if (this.phaseRemainingMs > 0) {
      return { phase: this.phase === 'windup' ? 'windup' : this.phase === 'active' ? 'active' : 'recovery' }
    }

    if (this.phase === 'windup') {
      this.phase = 'active'
      this.phaseRemainingMs = this.definition.activeTime
      const firstActive = !this.emittedActiveSpawn
      this.emittedActiveSpawn = true
      return {
        phase: 'active',
        spawnedHitbox: firstActive && this.definition.type === 'melee',
        spawnedProjectile: firstActive && this.definition.type === 'projectile',
        spawnedHazard: firstActive && this.definition.type === 'hazard'
      }
    }

    if (this.phase === 'active') {
      this.phase = 'recovery'
      this.phaseRemainingMs = this.definition.recoveryTime
      return { phase: 'recovery' }
    }

    this.phase = 'done'
    this.phaseRemainingMs = 0
    return { phase: 'done' }
  }

  Exit(_ctx: AttackContext): void {
    this.phase = 'idle'
    this.phaseRemainingMs = 0
    this.emittedActiveSpawn = false
  }

  CanUse(ctx: AttackContext): boolean {
    const attack = this.definition
    if (attack.enabled === false) {
      return false
    }
    if (ctx.distanceToPlayer < attack.rangeMin || ctx.distanceToPlayer > attack.rangeMax) {
      return false
    }
    return true
  }
}
