import type { EnemyAttackConfig } from './types'
import type { EnemyAttackPhase } from './attackHitbox'

/**
 * `charge` consumes `chargeSpeed` (armored_bot, bouncer, the drill serpent's lunge): during its own
 * telegraph it holds, during `active` it commits to `chargeSpeed` toward its facing regardless of where
 * the hero moves, and recovery brings it to a stop before the generic AI's chase takes back over.
 * Non-charge attacks (and a charge with no `chargeSpeed` set) return `null`: the caller leaves whatever
 * movement intent it already had alone.
 */
export function resolveChargeVelocityX(
  attack: Pick<EnemyAttackConfig, 'type' | 'chargeSpeed'>,
  phase: EnemyAttackPhase,
  facing: 1 | -1
): number | null {
  if (attack.type !== 'charge' || !attack.chargeSpeed) {
    return null
  }
  if (phase === 'active') {
    return facing * attack.chargeSpeed
  }
  if (phase === 'windup' || phase === 'recover') {
    return 0
  }
  return null
}
