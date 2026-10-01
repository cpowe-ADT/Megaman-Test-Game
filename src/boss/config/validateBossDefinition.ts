import type { BossDefinition } from '../framework/types'

export function validateBossDefinition(definition: BossDefinition): string[] {
  const errors: string[] = []
  const label = definition?.boss_id || 'unknown'
  if (!definition?.boss_id || !definition.displayName) {
    errors.push(`[${label}] boss_id and displayName are required`)
  }
  if (!Number.isFinite(definition?.maxHP) || definition.maxHP <= 0) {
    errors.push(`[${label}] maxHP must be positive`)
  }
  if (!Array.isArray(definition?.phases) || definition.phases.length === 0) {
    errors.push(`[${label}] at least one phase is required`)
  }
  if (!Array.isArray(definition?.attacks) || definition.attacks.length === 0) {
    errors.push(`[${label}] at least one attack is required`)
  }

  const attackIds = new Set<string>()
  for (const attack of definition?.attacks ?? []) {
    if (!attack.id || attackIds.has(attack.id)) {
      errors.push(`[${label}] attack ids must be present and unique (${attack.id || 'missing'})`)
    }
    attackIds.add(attack.id)
    if (
      [attack.windupTime, attack.activeTime, attack.recoveryTime, attack.cooldown].some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      errors.push(`[${label}:${attack.id}] attack timing values must be non-negative`)
    }
    if (attack.rangeMin < 0 || attack.rangeMax < attack.rangeMin) {
      errors.push(`[${label}:${attack.id}] attack range is invalid`)
    }
    if (!Number.isFinite(attack.hit?.damageAmount) || attack.hit.damageAmount <= 0) {
      errors.push(`[${label}:${attack.id}] attack damage must be positive`)
    }
    if (
      !['glow', 'fan-lines', 'reticle', 'wave'].includes(String(attack.telegraph?.warningFx)) ||
      !['self', 'target', 'projectile'].includes(String(attack.telegraph?.anchor))
    ) {
      errors.push(`[${label}:${attack.id}] attack telegraph needs an authored warningFx and anchor`)
    }
  }

  const sortedThresholds = [...(definition?.phases ?? [])].map((phase) => phase.threshold)
  sortedThresholds.forEach((threshold, index) => {
    if (!Number.isFinite(threshold) || threshold <= 0 || threshold > 1) {
      errors.push(`[${label}] phase threshold ${threshold} must be within (0, 1]`)
    }
    if (index > 0 && threshold >= sortedThresholds[index - 1]) {
      errors.push(`[${label}] phase thresholds must descend from 1`)
    }
  })

  for (const phase of definition?.phases ?? []) {
    for (const attackId of phase.unlockAttacks ?? []) {
      if (!attackIds.has(attackId)) {
        errors.push(`[${label}] phase unlock references unknown attack '${attackId}'`)
      }
    }
  }
  return errors
}

export function assertValidBossDefinition(definition: BossDefinition): BossDefinition {
  const errors = validateBossDefinition(definition)
  if (errors.length > 0) {
    throw new Error(`Invalid boss definition:\n${errors.join('\n')}`)
  }
  return definition
}
