import type { PilotEnemyConfig } from './types'

export type PilotEnemyConfigValidationResult =
  | { valid: true; data: PilotEnemyConfig; errors: [] }
  | { valid: false; errors: string[] }

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

export function validatePilotEnemyConfig(value: unknown): PilotEnemyConfigValidationResult {
  const errors: string[] = []
  if (!isObject(value)) {
    return { valid: false, errors: ['Pilot enemy config must be an object'] }
  }

  if (value.schemaVersion !== '1') {
    errors.push('schemaVersion must be "1"')
  }
  if (typeof value.id !== 'string' || value.id.length === 0) {
    errors.push('id must be a non-empty string')
  }
  if (typeof value.hp !== 'number' || !Number.isFinite(value.hp) || value.hp <= 0) {
    errors.push('hp must be a positive number')
  }
  if (!isObject(value.movement)) {
    errors.push('movement must be an object')
  }
  if (!isObject(value.attack)) {
    errors.push('attack must be an object')
  }
  if (!isObject(value.animationKeys)) {
    errors.push('animationKeys must be an object')
  }

  if (errors.length > 0) {
    return { valid: false, errors }
  }

  return { valid: true, data: value as PilotEnemyConfig, errors: [] }
}
