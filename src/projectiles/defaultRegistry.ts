import { ProjectileRegistry } from './ProjectileRegistry'
import { createCoreProjectileDefinitions } from './definitions/coreProjectiles'

export function createDefaultProjectileRegistry(): ProjectileRegistry {
  const registry = new ProjectileRegistry()
  registry.registerAll(createCoreProjectileDefinitions())
  return registry
}
