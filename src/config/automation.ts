export type AutomationConfig = {
  enabled: boolean
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

function readQueryFlag(search: string | undefined): boolean {
  if (!search) {
    return false
  }
  const params = new URLSearchParams(search)
  return params.get('automation') === '1'
}

export function resolveAutomationConfig(
  env: Record<string, string | boolean | undefined> = (import.meta.env ?? {}) as Record<
    string,
    string | boolean | undefined
  >,
  search = typeof window !== 'undefined' ? window.location.search : ''
): AutomationConfig {
  return {
    enabled:
      readQueryFlag(search) ||
      readBool(env.VITE_AUTOMATION, false) ||
      readBool(env.VITE_SMOKE, false)
  }
}

export const AUTOMATION = resolveAutomationConfig()
