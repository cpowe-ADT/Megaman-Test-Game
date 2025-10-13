import { canFireNow, CooldownConfig } from './cooldown'

export interface PatternStep {
  name: string
  cooldownMs: number
  lastFireAt?: number
  weight?: number
  enabled?: boolean
  firstAttackDelayMs?: number
}

export function shouldFireStep(step: PatternStep, now: number): boolean {
  if (step.enabled === false) {
    return false
  }
  const config: CooldownConfig = {
    cooldownMs: step.cooldownMs,
    firstAttackDelayMs: step.firstAttackDelayMs ?? step.cooldownMs
  }
  return canFireNow(step.lastFireAt, now, config)
}

export function selectNextPattern(steps: PatternStep[], now: number): PatternStep | undefined {
  const available = steps.filter((step) => shouldFireStep(step, now))
  if (available.length === 0) {
    return undefined
  }
  return available.sort((a, b) => {
    const weightA = a.weight ?? 1
    const weightB = b.weight ?? 1
    if (weightA !== weightB) {
      return weightB - weightA
    }
    const lastA = a.lastFireAt ?? -Infinity
    const lastB = b.lastFireAt ?? -Infinity
    return lastA - lastB
  })[0]
}

export function advancePatternIndex(
  currentIndex: number,
  steps: PatternStep[],
  options?: { wrap?: boolean }
): number {
  if (steps.length === 0) {
    return 0
  }
  const wrap = options?.wrap ?? true
  const total = steps.length
  for (let offset = 1; offset <= total; offset += 1) {
    let candidate = currentIndex + offset
    if (wrap) {
      candidate %= total
    } else if (candidate >= total) {
      return currentIndex
    }
    if (steps[candidate]?.enabled !== false) {
      return candidate
    }
  }
  return currentIndex
}
