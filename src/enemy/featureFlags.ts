import { resolveDeveloperModeConfig } from '../config/developerMode'

export type EnemyFeatureFlags = {
  enableEnemyAI: boolean
  enableEnemyProjectiles: boolean
  enableEnemyDrops: boolean
  enableEnemyDebug: boolean
}

const DEFAULT_FLAGS: EnemyFeatureFlags = {
  enableEnemyAI: true,
  enableEnemyProjectiles: true,
  enableEnemyDrops: true,
  enableEnemyDebug: false
}

function readBool(raw: string | boolean | undefined, fallback: boolean): boolean {
  if (typeof raw === 'boolean') {
    return raw
  }
  if (typeof raw !== 'string' || raw.length === 0) {
    return fallback
  }
  const value = raw.trim().toLowerCase()
  if (value === '1' || value === 'true' || value === 'yes' || value === 'on') {
    return true
  }
  if (value === '0' || value === 'false' || value === 'no' || value === 'off') {
    return false
  }
  return fallback
}

export function resolveEnemyFeatureFlags(
  env: Record<string, string | boolean | undefined> = (import.meta.env ?? {}) as Record<
    string,
    string | boolean | undefined
  >
): EnemyFeatureFlags {
  const developerMode = resolveDeveloperModeConfig(env)
  return {
    enableEnemyAI: readBool(env.VITE_ENABLE_ENEMY_AI, DEFAULT_FLAGS.enableEnemyAI),
    enableEnemyProjectiles: readBool(env.VITE_ENABLE_ENEMY_PROJECTILES, DEFAULT_FLAGS.enableEnemyProjectiles),
    enableEnemyDrops: readBool(env.VITE_ENABLE_ENEMY_DROPS, DEFAULT_FLAGS.enableEnemyDrops),
    enableEnemyDebug:
      developerMode.showCombatDebugVisuals &&
      readBool(env.VITE_ENABLE_ENEMY_DEBUG, developerMode.showFrameData)
  }
}

export const DEFAULT_ENEMY_FEATURE_FLAGS = DEFAULT_FLAGS
