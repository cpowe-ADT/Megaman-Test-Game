export interface CooldownConfig {
  cooldownMs: number
  cadenceMultiplier?: number
  minMs?: number
  maxMs?: number
  firstAttackDelayMs?: number
}

const DEFAULT_MIN = 120
const DEFAULT_MAX = 6000

export function clampCooldown(value: number, minMs = DEFAULT_MIN, maxMs = DEFAULT_MAX): number {
  return Math.min(Math.max(value, minMs), maxMs)
}

export function computeNextAvailable(
  lastFireAt: number | undefined,
  now: number,
  config: CooldownConfig
): number {
  const { cooldownMs, cadenceMultiplier = 1, firstAttackDelayMs = cooldownMs } = config
  const appliedCooldown = clampCooldown(cooldownMs * cadenceMultiplier, config.minMs, config.maxMs)
  if (lastFireAt == null) {
    return now + clampCooldown(firstAttackDelayMs, config.minMs, config.maxMs)
  }
  return lastFireAt + appliedCooldown
}

export function remainingCooldown(
  lastFireAt: number | undefined,
  now: number,
  config: CooldownConfig
): number {
  const nextAvailable = computeNextAvailable(lastFireAt, now, config)
  return Math.max(0, nextAvailable - now)
}

export function canFireNow(lastFireAt: number | undefined, now: number, config: CooldownConfig): boolean {
  return remainingCooldown(lastFireAt, now, config) <= 0
}
