import { ProjectileRegistry } from './ProjectileRegistry'

export { ProjectileRegistry } from './ProjectileRegistry'
export { ProjectileSystem } from './ProjectileSystem'
export { ProjectileCollisionRouter } from './collision'
export { createDefaultProjectileRegistry } from './defaultRegistry'
export {
  getLatestActiveProjectile,
  spawnDebugProjectileClash,
  summarizeProjectilePool
} from './diagnostics/ProjectileDevTools'
export {
  ENEMY_BULLET_FRAME,
  PLAYER_BULLET_FRAME,
  PROJECTILES_ATLAS_KEY,
  resolvePlayerProjectileId
} from './definitions/coreProjectiles'
export {
  canAffordPlayerShot,
  energyAfterPlayerShot,
  resolvePlayerShot
} from './playerShot'
export type { PlayerShotIntent, ResolvedPlayerShot } from './playerShot'
export type {
  ProjectileBehavior,
  ProjectileDefinition,
  ProjectileHitPolicy,
  ProjectileOwner,
  ProjectilePoolKey,
  ProjectileSpawnRequest,
  ProjectileVisualConfig
} from './types'
