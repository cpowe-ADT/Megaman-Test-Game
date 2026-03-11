export type DeveloperModeConfig = {
  enabled: boolean
  showCombatDebugVisuals: boolean
  showFrameData: boolean
  showUiDebug: boolean
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

export function resolveDeveloperModeConfig(
  env: Record<string, string | boolean | undefined> = (import.meta.env ?? {}) as Record<
    string,
    string | boolean | undefined
  >
): DeveloperModeConfig {
  const enabled = readBool(env.VITE_DEVELOPER_MODE, false)
  const showCombatDebugVisuals = enabled
    ? readBool(env.VITE_SHOW_COMBAT_DEBUG_VISUALS, false)
    : false
  const showFrameData = enabled ? readBool(env.VITE_SHOW_FRAME_DATA, showCombatDebugVisuals) : false
  const showUiDebug = enabled ? readBool(env.VITE_DEBUG_UI, false) : false

  return {
    enabled,
    showCombatDebugVisuals,
    showFrameData,
    showUiDebug
  }
}

export const DEVELOPER_MODE = resolveDeveloperModeConfig()
