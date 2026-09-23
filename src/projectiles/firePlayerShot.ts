import type { UpgradeModifiers } from '../progression/upgrades'
import { resolvePlayerShot, canAffordPlayerShot, energyAfterPlayerShot, type ResolvedPlayerShot } from './playerShot'
import type { ProjectileSpawnRequest } from './types'
import type { SpawnProjectileRequest } from '../player/types'

/** Allocation and affordability are one boundary; failed allocation never spends energy. */
export function firePlayerShot<T>(options: {
  request: SpawnProjectileRequest; equippedWeaponId: string; availableEnergy: number
  x: number; y: number; activeBusterCount: number; modifiers: UpgradeModifiers
  spawn: (request: ProjectileSpawnRequest) => T | null | undefined
}): { projectile: T; shot: ResolvedPlayerShot; remainingEnergy: number } | null {
  const weaponId = options.request.weaponId ?? options.equippedWeaponId
  if (weaponId === 'Buster' && options.activeBusterCount >= 3) return null
  if (weaponId === 'ArcSlash' && !options.modifiers.arcSlash) return null
  const shot = resolvePlayerShot({ weaponId, intent: options.request, x: options.x, y: options.y, modifiers: options.modifiers })
  // The tutorial ability is tied to saber release, with no cycling slot or energy bank.
  if (weaponId === 'ArcSlash') shot.energyCost = 0
  if (!canAffordPlayerShot(options.availableEnergy, shot.energyCost)) return null
  const projectile = options.spawn(shot.spawnRequest)
  return projectile ? { projectile, shot, remainingEnergy: energyAfterPlayerShot(options.availableEnergy, shot.energyCost, true) } : null
}
