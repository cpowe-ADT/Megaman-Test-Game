import type { UpgradeModifiers } from '../progression/upgrades'
import { resolvePlayerShot, canAffordPlayerShot, energyAfterPlayerShot, type ResolvedPlayerShot } from './playerShot'
import type { ProjectileSpawnRequest } from './types'
import type { SpawnProjectileRequest } from '../player/types'

/**
 * Allocation and affordability are one boundary; failed allocation never spends energy. A fan (AeroDarts) spawns
 * every dart for one cost; the first dart is the receipt's projectile.
 */
export function firePlayerShot<T>(options: {
  request: SpawnProjectileRequest; equippedWeaponId: string; availableEnergy: number
  x: number; y: number; activeBusterCount: number; modifiers: UpgradeModifiers
  /** HydroLance aim (-1 up, 1 down) and FlameSerpent's held-stream flames. */
  aim?: -1 | 0 | 1; sustain?: boolean
  spawn: (request: ProjectileSpawnRequest) => T | null | undefined
}): { projectile: T; projectiles: T[]; shot: ResolvedPlayerShot; remainingEnergy: number } | null {
  const weaponId = options.request.weaponId ?? options.equippedWeaponId
  if (weaponId === 'Buster' && options.activeBusterCount >= 3) return null
  if (weaponId === 'ArcSlash' && !options.modifiers.arcSlash) return null
  const intent = { chargeLevel: options.request.chargeLevel, facing: options.request.facing, aim: options.aim, sustain: options.sustain }
  const shot = resolvePlayerShot({ weaponId, intent, x: options.x, y: options.y, modifiers: options.modifiers })
  // The tutorial ability is tied to saber release, with no cycling slot or energy bank.
  if (weaponId === 'ArcSlash') shot.energyCost = 0
  if (!canAffordPlayerShot(options.availableEnergy, shot.energyCost)) return null
  const projectiles = shot.spawnRequests.map((request) => options.spawn(request)).filter((projectile): projectile is T => projectile != null)
  const projectile = projectiles[0]
  return projectile ? { projectile, projectiles, shot, remainingEnergy: energyAfterPlayerShot(options.availableEnergy, shot.energyCost, true) } : null
}

// Game's shot-versus-platform colliders read this rule (one import line in the scene).
export { shotPlatformProcess } from './platformContact'
