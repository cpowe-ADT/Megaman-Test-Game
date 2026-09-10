import { BOSS_ROSTER } from '../bosses/roster'
import type { Element, WeaponId } from '../bosses/types'
import { resolveBalancedWeaponEnergyCost } from './weaponEnergyEconomy'

export type WeaponRuntimeId = 'Buster' | WeaponId

export type WeaponProjectileStyle = 'standard' | 'wave' | 'lob' | 'boomerang'

export type WeaponProjectileConfig = {
  style: WeaponProjectileStyle
  lifetimeMs: number
  pierce: number
  gravityY?: number
  waveAmplitude?: number
  wavePeriodMs?: number
  returnAfterMs?: number
  returnSpeed?: number
}

export type WeaponRuntimeConfig = {
  id: WeaponRuntimeId
  displayName: string
  element: Element
  energyCost: number
  maxEnergy: number
  damage: number
  speed: number
  scale: number
  tint?: number
  allowCharge: boolean
  projectile: WeaponProjectileConfig
}

const SPECIAL_WEAPON_OVERRIDES: Partial<Record<WeaponRuntimeId, Partial<WeaponRuntimeConfig>>> = {
  ArcSlash: {
    damage: 2,
    speed: 260,
    scale: 1.15,
    tint: 0xd9d9ff,
    allowCharge: false,
    projectile: { style: 'standard', lifetimeMs: 600, pierce: 0 }
  },
  FlameSerpent: {
    damage: 3,
    speed: 260,
    scale: 1.2,
    tint: 0xff9040,
    allowCharge: false,
    projectile: { style: 'wave', lifetimeMs: 900, pierce: 0, waveAmplitude: 12, wavePeriodMs: 150 }
  },
  HydroLance: {
    damage: 3,
    speed: 320,
    scale: 1.1,
    tint: 0x66d6ff,
    allowCharge: false,
    projectile: { style: 'standard', lifetimeMs: 860, pierce: 1 }
  },
  ThunderSpike: {
    damage: 4,
    speed: 340,
    scale: 1.15,
    tint: 0xfff066,
    allowCharge: false,
    projectile: { style: 'standard', lifetimeMs: 760, pierce: 0 }
  },
  QuakeKnuckle: {
    damage: 4,
    speed: 250,
    scale: 1.35,
    tint: 0xd29f68,
    allowCharge: false,
    projectile: { style: 'lob', lifetimeMs: 960, pierce: 0, gravityY: 760 }
  },
  MagcutDisc: {
    damage: 3,
    speed: 330,
    scale: 1.1,
    tint: 0xc3d6ff,
    allowCharge: false,
    projectile: { style: 'boomerang', lifetimeMs: 980, pierce: 1, returnAfterMs: 220, returnSpeed: 270 }
  },
  AcidGlob: {
    damage: 3,
    speed: 250,
    scale: 1.2,
    tint: 0x8cff84,
    allowCharge: false,
    projectile: { style: 'lob', lifetimeMs: 880, pierce: 0, gravityY: 560 }
  },
  AeroDarts: {
    damage: 2,
    speed: 360,
    scale: 1.05,
    tint: 0xd0f2ff,
    allowCharge: false,
    projectile: { style: 'standard', lifetimeMs: 700, pierce: 0 }
  },
  FrostShatter: {
    damage: 4,
    speed: 300,
    scale: 1.25,
    tint: 0xc7f2ff,
    allowCharge: false,
    projectile: { style: 'standard', lifetimeMs: 920, pierce: 1 }
  }
}

export const BUSTER_WEAPON_CONFIG: WeaponRuntimeConfig = {
  id: 'Buster',
  displayName: 'Buster',
  element: 'Normal',
  energyCost: 0,
  maxEnergy: 28,
  damage: 1,
  speed: 260,
  scale: 1,
  allowCharge: true,
  projectile: {
    style: 'standard',
    lifetimeMs: 720,
    pierce: 0
  }
}

export const SPECIAL_WEAPON_ORDER: WeaponRuntimeId[] = Object.values(BOSS_ROSTER)
  .map((blueprint) => blueprint.weaponReward?.id)
  .filter((id): id is WeaponId => Boolean(id))
  .filter((id) => id !== 'ArcSlash') as WeaponRuntimeId[]

const SPECIAL_WEAPONS = Object.values(BOSS_ROSTER).reduce<Partial<Record<WeaponRuntimeId, WeaponRuntimeConfig>>>((acc, blueprint) => {
  const reward = blueprint.weaponReward
  if (!reward) {
    return acc
  }
  const overrides = SPECIAL_WEAPON_OVERRIDES[reward.id] ?? {}
  acc[reward.id] = {
    id: reward.id,
    displayName: reward.displayName,
    element: reward.element,
    energyCost: resolveBalancedWeaponEnergyCost(reward.energyCost),
    maxEnergy: reward.maxEnergy,
    damage: overrides.damage ?? 2,
    speed: overrides.speed ?? 300,
    scale: overrides.scale ?? 1.1,
    tint: overrides.tint,
    allowCharge: overrides.allowCharge ?? false
    ,
    projectile: overrides.projectile ?? {
      style: 'standard',
      lifetimeMs: 820,
      pierce: 0
    }
  }
  return acc
}, { Buster: BUSTER_WEAPON_CONFIG })

export function getWeaponConfig(id: string): WeaponRuntimeConfig {
  return SPECIAL_WEAPONS[id as WeaponRuntimeId] ?? BUSTER_WEAPON_CONFIG
}

export function getWeaponDisplayName(id: string): string {
  return getWeaponConfig(id).displayName
}

export function buildWeaponOrder(unlocked: string[]): WeaponRuntimeId[] {
  const result: WeaponRuntimeId[] = ['Buster']
  for (const weaponId of SPECIAL_WEAPON_ORDER) {
    if (unlocked.includes(weaponId)) {
      result.push(weaponId)
    }
  }
  return result
}

export function buildWeaponEnergySnapshot(unlocked: string[]): Record<string, number> {
  const energy: Record<string, number> = { Buster: BUSTER_WEAPON_CONFIG.maxEnergy }
  for (const weaponId of buildWeaponOrder(unlocked)) {
    const config = getWeaponConfig(weaponId)
    energy[weaponId] = config.maxEnergy
  }
  return energy
}
