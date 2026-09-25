import { bossHudLabel, type BossBlueprint } from '../../bosses/types'
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

/** Boss i-frames after a player hit (prompt 07 phase 7.2 item 3: 240 ms down to 120 ms, the Buster's fire interval). */
export const BOSS_PLAYER_HIT_IFRAME_MS = 120
/** A plain hit's blink; a weakness hit's white flash lasts twice as long. */
export const BOSS_HIT_FLASH_MS = 70
export const BOSS_WEAK_HIT = {
  /** Multipliers at or above this react as weakness hits. */
  multiplierAtLeast: 1.4,
  stunMs: 200,
  /** After a weakness stun the next one waits this long, so a weakness weapon cannot stun-lock the boss. */
  stunLockoutMs: 1000,
  /** Until the audio lane adds `boss_hit_weak`, the audio service plays `boss_hit` for it. */
  sfx: 'boss_hit_weak'
} as const

export interface BossHitReaction {
  weakness: boolean
  iFrameMs: number
  /** Weakness hits only: the hurt-stun, its lockout, and the wind-up interrupt. */
  stunMs?: number
  stunLockoutMs?: number
  interruptWindup: boolean
  /** The alpha blink every hit plays. */
  flashMs: number
  /** The white fill a weakness hit adds (0 for a plain hit). */
  whiteFlashMs: number
  sfx: 'boss_hit' | typeof BOSS_WEAK_HIT.sfx
}

/** How the boss reacts to a player hit at `multiplier` (prompt 07 phase 7.2 item 3). */
export function bossHitReaction(multiplier: number): BossHitReaction {
  const weakness = multiplier >= BOSS_WEAK_HIT.multiplierAtLeast
  return weakness
    ? {
        weakness,
        iFrameMs: BOSS_PLAYER_HIT_IFRAME_MS,
        stunMs: BOSS_WEAK_HIT.stunMs,
        stunLockoutMs: BOSS_WEAK_HIT.stunLockoutMs,
        interruptWindup: true,
        flashMs: BOSS_HIT_FLASH_MS * 2,
        whiteFlashMs: BOSS_HIT_FLASH_MS * 2,
        sfx: BOSS_WEAK_HIT.sfx
      }
    : { weakness, iFrameMs: BOSS_PLAYER_HIT_IFRAME_MS, interruptWindup: false, flashMs: BOSS_HIT_FLASH_MS, whiteFlashMs: 0, sfx: 'boss_hit' }
}

/**
 * The boss phase panel's text: the phase's HUD label and, under it, the action (an attack's short name or the
 * raw label, twelve characters). The desperation phase and attack are looked up with the authored ones.
 */
export function bossPhaseHudText(
  blueprint: Pick<BossBlueprint, 'phases' | 'attacks' | 'desperation'> | undefined,
  currentPhaseName: string,
  action?: string
): string {
  const phaseName = (currentPhaseName || '').toUpperCase()
  const desperation = blueprint?.desperation
  const phaseEntry = [...(blueprint?.phases ?? []), ...(desperation ? [desperation] : [])].find((entry) => entry.name.toUpperCase() === phaseName)
  const phase = phaseEntry ? bossHudLabel(phaseEntry) : (currentPhaseName || 'PHASE --').replace(/^PHASE\s*•?\s*/i, 'PHASE ').toUpperCase()
  const cleaned = action?.replace(/^ACTION\s*•?\s*/i, '').trim()
  const attacks = [...(blueprint?.attacks ?? []), ...(desperation ? [desperation.attack] : [])]
  const attackEntry = cleaned ? attacks.find((entry) => entry.name.toUpperCase() === cleaned.toUpperCase()) : undefined
  const actionLabel = cleaned ? (attackEntry ? bossHudLabel(attackEntry) : cleaned.toUpperCase().slice(0, 12)) : undefined
  return actionLabel ? `${phase}\n${actionLabel}` : phase
}
