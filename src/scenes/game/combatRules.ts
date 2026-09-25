import { PASSIVE_WEAPON_RECHARGE_INTERVAL_MS } from '../../content/weaponEnergyEconomy'

/**
 * The pure rules behind the modules moved out of `Game` in prompt 07 phase 7.0 (EVAL-P7-008): no Phaser,
 * so `tests/boss-telegraphs.test.ts` runs them without a scene.
 */

export type CombatHitSource = 'player' | 'enemy' | 'boss' | 'hazard' | 'system'
export type CombatHitTarget = 'player' | 'enemy' | 'boss' | 'environment'

/** The combat-debug lane a player-damage request is recorded under. */
export function combatSourceForDamage(sourceType: string): CombatHitSource {
  if (sourceType.startsWith('boss_')) return 'boss'
  if (sourceType.startsWith('enemy_')) return 'enemy'
  return sourceType === 'hazard' ? 'hazard' : 'system'
}

/** Weapon slot after cycling `delta` steps through `total` weapons (wraps both ways). */
export function wrapWeaponIndex(index: number, delta: number, total: number): number {
  if (total <= 0) {
    return 0
  }
  return (((index + delta) % total) + total) % total
}

/** Passive recharge ticks due for an accumulator (capped at four a frame) and the remainder it keeps. */
export function passiveRechargeTicks(accumulatorMs: number, intervalMs = PASSIVE_WEAPON_RECHARGE_INTERVAL_MS): { ticks: number; remainderMs: number } {
  const ticks = Math.min(4, Math.floor(accumulatorMs / intervalMs))
  return ticks <= 0 ? { ticks: 0, remainderMs: accumulatorMs } : { ticks, remainderMs: accumulatorMs - ticks * intervalMs }
}

/** Damage a boss hit deals after the weakness multiplier and the progression bonus; never below 1. */
export function scaleBossHitDamage(baseDamage: number, damageBonus: number, multiplier: number): number {
  return Math.max(1, Math.round((baseDamage + damageBonus) * multiplier))
}

/** The HUD line a hit flashes: a forced label (BLOCKED, IMMUNE), a weakness, a resisted hit, or nothing. */
export function bossHitFeedbackLabel(multiplier: number, forcedLabel?: string): string {
  return forcedLabel ?? (multiplier >= 1.4 ? 'WEAKNESS HIT' : multiplier <= 0.8 ? 'RESISTED HIT' : '')
}

/** Ground-slam style hazards laid by one attack: at most three, and never past the room's hazard cap. */
export function bossHazardRingCount(cap: number, activeHazards: number): number {
  return Math.max(0, Math.min(3, cap - activeHazards))
}
