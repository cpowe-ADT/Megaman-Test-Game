import { resolveDeveloperModeConfig } from '../config/developerMode'

export type PlayerFeatureFlags = {
  enableSword: boolean
  enableChargeShot: boolean
  enableAirDash: boolean
  enableWallSlideJump: boolean
  enableTouchControls: boolean
  enableHitstop: boolean
  enableDebugHitboxes: boolean
}

function readBool(raw: string | undefined, fallback: boolean): boolean {
  if (raw == null || raw.length === 0) {
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

export const DEFAULT_PLAYER_FEATURE_FLAGS: PlayerFeatureFlags = {
  enableSword: true,
  enableChargeShot: true,
  enableAirDash: true,
  enableWallSlideJump: true,
  enableTouchControls: true,
  enableHitstop: true,
  enableDebugHitboxes: false
}

export function resolvePlayerFeatureFlags(
  env: Record<string, string | boolean | undefined> = (import.meta.env ?? {}) as Record<
    string,
    string | boolean | undefined
  >
): PlayerFeatureFlags {
  const developerMode = resolveDeveloperModeConfig(env)
  const get = (key: string): string | undefined => {
    const value = env[key]
    if (typeof value === 'boolean') {
      return value ? 'true' : 'false'
    }
    if (typeof value === 'string') {
      return value
    }
    return undefined
  }

  return {
    enableSword: readBool(get('VITE_ENABLE_SWORD'), DEFAULT_PLAYER_FEATURE_FLAGS.enableSword),
    enableChargeShot: readBool(
      get('VITE_ENABLE_CHARGE_SHOT'),
      DEFAULT_PLAYER_FEATURE_FLAGS.enableChargeShot
    ),
    enableAirDash: readBool(get('VITE_ENABLE_AIR_DASH'), DEFAULT_PLAYER_FEATURE_FLAGS.enableAirDash),
    enableWallSlideJump: readBool(
      get('VITE_ENABLE_WALL_SLIDE_JUMP'),
      DEFAULT_PLAYER_FEATURE_FLAGS.enableWallSlideJump
    ),
    enableTouchControls: readBool(
      get('VITE_ENABLE_TOUCH_CONTROLS'),
      DEFAULT_PLAYER_FEATURE_FLAGS.enableTouchControls
    ),
    enableHitstop: readBool(get('VITE_ENABLE_HITSTOP'), DEFAULT_PLAYER_FEATURE_FLAGS.enableHitstop),
    enableDebugHitboxes:
      developerMode.showCombatDebugVisuals &&
      readBool(get('VITE_ENABLE_DEBUG_HITBOXES'), developerMode.showFrameData)
  }
}
