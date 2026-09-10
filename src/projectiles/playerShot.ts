import type { UpgradeModifiers } from '../progression/upgrades'
import { getWeaponConfig, type WeaponRuntimeConfig } from '../content/weapons'
import { PLAYER_GAMEPLAY_CONFIG } from '../player/config'
import { resolvePlayerProjectileId } from './definitions/coreProjectiles'
import type { ProjectileSpawnRequest } from './types'

export type PlayerShotIntent = {
  chargeLevel: 0 | 1 | 2 | 3 | 4
  facing: 1 | -1
}

export type ResolvedPlayerShot = {
  projectileId: string
  weapon: WeaponRuntimeConfig
  chargeLevel: 0 | 1 | 2 | 3 | 4
  energyCost: number
  impactFxKey: string
  spawnRequest: ProjectileSpawnRequest
}

export function resolvePlayerShot(options: {
  weaponId: string
  modifiers?: UpgradeModifiers
  intent: PlayerShotIntent
  x: number
  y: number
}): ResolvedPlayerShot {
  const weapon = getWeaponConfig(options.weaponId)
  const chargeLevel = weapon.allowCharge ? options.intent.chargeLevel : 0
  const projectileId = resolvePlayerProjectileId(weapon.id, chargeLevel)
  const impactFxKey =
    weapon.id === 'Buster' && chargeLevel > 0
      ? PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[chargeLevel as 1 | 2 | 3 | 4].impactFxKey
      : 'fx_impact_small'

  return {
    projectileId,
    weapon,
    chargeLevel,
    energyCost: weapon.energyCost > 0 ? Math.max(1, weapon.energyCost - (options.modifiers?.specialEnergyDiscount ?? 0)) : 0,
    impactFxKey,
    spawnRequest: {
      id: projectileId,
      ...(weapon.id === 'Buster' && chargeLevel === 0 && options.modifiers ? { damage: options.modifiers.busterPelletDamage } : {}),
      x: options.x,
      y: options.y,
      direction: options.intent.facing,
      chargeLevel,
      metadata: {
        weaponId: weapon.id,
        weaponElement: weapon.element,
        projectileId,
        chargeLevel,
        impactFxKey,
        source: 'player'
      }
    }
  }
}

export function canAffordPlayerShot(availableEnergy: number, energyCost: number): boolean {
  return energyCost <= 0 || availableEnergy >= energyCost
}

export function energyAfterPlayerShot(
  availableEnergy: number,
  energyCost: number,
  projectileSpawned: boolean
): number {
  if (!projectileSpawned || energyCost <= 0) {
    return availableEnergy
  }
  return Math.max(0, availableEnergy - energyCost)
}
