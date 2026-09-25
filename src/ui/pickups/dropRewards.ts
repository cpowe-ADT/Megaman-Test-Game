import { getWeaponDisplayName } from '../../content/weapons'
import type { EnemyDropType } from './pickupArt'

/** HP a health drop restores; the large one heals what a placed `hp_refill_large` does (src/progression/state.ts). */
export const DROP_HEAL: Record<'health' | 'health_large', number> = { health: 2, health_large: 6 }

export type DropRewardEffects = {
  /** Heals up to `amount` HP and returns what it healed (0 at full HP, where the scene tops up a sub tank instead). */
  heal: (amount: number) => number
  /** Refills the first special weapon that needs it and returns which one and by how much. */
  restoreEnergy: (amount: number) => { weaponId: string | null; restored: number }
}

export type DropRewardOutcome = { sfx: 'pickup_health' | 'pickup_ammo' | 'pickup_bonus'; message: string }

function energyMessage(ammo: { weaponId: string | null; restored: number }): string {
  return `${getWeaponDisplayName(ammo.weaponId ?? 'Buster').toUpperCase()} +${ammo.restored}`
}

/**
 * What collecting an enemy drop does and the sound and toast it shows (moved out of `Game` in part 12h).
 * A health drop at full HP gives weapon energy instead; an energy drop with nothing to refill gives 1 HP.
 */
export function applyDropReward(dropType: EnemyDropType, effects: DropRewardEffects): DropRewardOutcome {
  if (dropType === 'health' || dropType === 'health_large') {
    const healed = effects.heal(DROP_HEAL[dropType])
    if (healed > 0) return { sfx: 'pickup_health', message: `HP +${healed}` }
    const ammo = effects.restoreEnergy(4)
    if (ammo.restored > 0) return { sfx: 'pickup_ammo', message: energyMessage(ammo) }
    return { sfx: 'pickup_bonus', message: 'SYSTEM OK' }
  }
  if (dropType === 'ammo') {
    const ammo = effects.restoreEnergy(6)
    if (ammo.restored > 0) return { sfx: 'pickup_ammo', message: energyMessage(ammo) }
    const healed = effects.heal(1)
    if (healed > 0) return { sfx: 'pickup_health', message: `HP +${healed}` }
    return { sfx: 'pickup_bonus', message: 'ENERGY MAX' }
  }
  const healed = effects.heal(1)
  const ammo = effects.restoreEnergy(3)
  if (healed > 0 && ammo.restored > 0) return { sfx: 'pickup_bonus', message: `HP +${healed} • ${energyMessage(ammo)}` }
  if (healed > 0) return { sfx: 'pickup_health', message: `HP +${healed}` }
  if (ammo.restored > 0) return { sfx: 'pickup_ammo', message: energyMessage(ammo) }
  return { sfx: 'pickup_bonus', message: 'BONUS SECURED' }
}
