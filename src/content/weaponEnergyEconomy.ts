export const SABER_WEAPON_RECHARGE_AMOUNT = 2
export const SABER_WEAPON_RECHARGE_COOLDOWN_MS = 320
export const PASSIVE_WEAPON_RECHARGE_AMOUNT = 1
export const PASSIVE_WEAPON_RECHARGE_INTERVAL_MS = 1500

export function resolveBalancedWeaponEnergyCost(authoredCost: number): number {
  if (!Number.isFinite(authoredCost) || authoredCost <= 0) {
    return 0
  }
  return Math.max(1, Math.min(3, Math.ceil(authoredCost / 2)))
}

export function rechargeWeaponEnergyValue(
  current: number,
  max: number,
  amount: number
): { next: number; restored: number } {
  const safeMax = Math.max(0, max)
  const safeCurrent = Math.max(0, Math.min(safeMax, current))
  const next = Math.max(0, Math.min(safeMax, safeCurrent + Math.max(0, amount)))
  return { next, restored: next - safeCurrent }
}

export function getHolsteredWeaponRechargeTargets(weaponIds: string[], selectedWeaponId: string): string[] {
  return weaponIds.filter(
    (weaponId, index) =>
      weaponId !== 'Buster' &&
      weaponId !== selectedWeaponId &&
      weaponIds.indexOf(weaponId) === index
  )
}
