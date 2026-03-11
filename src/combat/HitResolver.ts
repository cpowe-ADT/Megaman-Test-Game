import type { DamageEvent, DamageResult } from './DamageEvent'
import { CombatantRegistry } from './Combatant'

export class HitResolver {
  constructor(private readonly registry: CombatantRegistry) {}

  resolve(event: DamageEvent): DamageResult {
    const target = this.registry.get(event.targetId)
    if (!target) {
      return {
        accepted: false,
        immune: true,
        amountApplied: 0,
        remainingHp: 0,
        defeated: false,
        reason: 'dead'
      }
    }

    const currentHp = Math.max(0, target.getHp())
    if (currentHp <= 0) {
      return {
        accepted: false,
        immune: true,
        amountApplied: 0,
        remainingHp: 0,
        defeated: true,
        reason: 'dead'
      }
    }

    if (target.iFrames.isInvulnerable(event.nowMs)) {
      return {
        accepted: false,
        immune: true,
        amountApplied: 0,
        remainingHp: currentHp,
        defeated: false,
        reason: 'invulnerable'
      }
    }

    const amount = Math.max(0, Math.round(event.amount))
    if (amount <= 0) {
      return {
        accepted: false,
        immune: true,
        amountApplied: 0,
        remainingHp: currentHp,
        defeated: false,
        reason: 'zero-damage'
      }
    }

    const nextHp = Math.max(0, currentHp - amount)
    target.setHp(nextHp)
    if (event.iFrameMs && event.iFrameMs > 0) {
      target.iFrames.start(event.nowMs, event.iFrameMs)
    }

    return {
      accepted: true,
      immune: false,
      amountApplied: amount,
      remainingHp: nextHp,
      defeated: nextHp <= 0
    }
  }
}
