import type { ProgressionSaveLike } from './types'

export type UpgradeModifiers = Readonly<{
  contactHitstun: boolean
  damageTakenMultiplier: number
  maxChargeLevel: 3 | 4
  hasArmsUpgrade: boolean
  allowAirDash: boolean
  chargeTimeMultiplier: number
  movementSpeedMultiplier: number
  wallJumpSpeedMultiplier: number
  specialEnergyDiscount: number
  busterPelletDamage: number
  arcSlash: boolean
}>

/** Legacy extras stay at their original adapters; Classic uses only the authored effects. */
export function resolveUpgradeModifiers(save: Pick<ProgressionSaveLike, 'progressionWorld' | 'upgradeUnlocks'>): UpgradeModifiers {
  const classic = save.progressionWorld?.progressionMode === 'classic'
  const has = (id: string) => Boolean(save.upgradeUnlocks?.includes(id))
  const speed = has('chip_speedster') ? (classic ? 1.12 : 1.15) : 1
  return Object.freeze({
    contactHitstun: !(classic && has('armor_helmet')),
    damageTakenMultiplier: classic && has('armor_body') ? .75 : 1,
    maxChargeLevel: !classic || has('armor_arms') ? 4 : 3,
    hasArmsUpgrade: has('armor_arms'),
    allowAirDash: !classic || has('armor_legs'),
    chargeTimeMultiplier: classic && has('chip_quick_charge') ? .7 : 1,
    movementSpeedMultiplier: speed,
    wallJumpSpeedMultiplier: classic ? 1 : speed,
    specialEnergyDiscount: classic && has('chip_weapon_plus') ? 1 : 0,
    busterPelletDamage: classic && has('chip_buster_plus') ? 2 : 1,
    arcSlash: has('arc_slash')
  })
}

export function upgradeEffectLabel(itemId: string, classic = true): string | null {
  const labels: Record<string, string> = {
    armor_helmet: classic ? 'CONTACT HITSTUN BLOCKED' : 'ALL CHECKPOINTS AVAILABLE',
    armor_body: classic ? 'DAMAGE TAKEN −25%' : 'MAX HP +2',
    armor_arms: 'CHARGE TIER 4', armor_legs: 'AIR DASH',
    chip_quick_charge: classic ? 'CHARGE TIME −30%' : 'QUICK CHARGE CHIP',
    chip_speedster: classic ? 'RUN / DASH SPEED +12%' : 'MOVEMENT SPEED +15%',
    chip_weapon_plus: classic ? 'SPECIAL ENERGY COST −1' : 'SPECIAL BOSS DAMAGE +1',
    chip_buster_plus: classic ? 'PELLET DAMAGE 2' : 'BUSTER BOSS DAMAGE +1',
    arc_slash: 'SABER RELEASE FIRES AN ARC'
  }
  return labels[itemId] ?? null
}
