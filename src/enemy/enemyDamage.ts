import type { EnemyHeavyConfig } from './types'

/**
 * A heavy (super-armoured) enemy ignores the push of light hits (buster pellets, the first two combo
 * swings) and slides a little from a hit of `pushMinDamage` or more (the combo finisher).
 */
export function resolveHeavyPush(
  amount: number,
  knockbackX: number,
  heavy: EnemyHeavyConfig
): { vx: number; ms: number } | null {
  if (amount < heavy.pushMinDamage || knockbackX === 0) {
    return null
  }
  return { vx: Math.sign(knockbackX) * heavy.pushSpeed, ms: heavy.pushMs }
}
