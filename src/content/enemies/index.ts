import enemyGunnerBotJson from './enemy_gunner_bot.json'
import { validatePilotEnemyConfig } from './validatePilotEnemyConfig'
import type { PilotEnemyConfig } from './types'
export { getGeneratedEnemyDefinition, getGeneratedEnemyDefinitions, getGeneratedEnemyCount } from './catalog'

const pilotConfigs: Record<string, PilotEnemyConfig> = {}

const loaded = [enemyGunnerBotJson]
for (const item of loaded) {
  const result = validatePilotEnemyConfig(item)
  if (!result.valid) {
    console.warn('[content/enemies] invalid pilot config', result.errors)
    continue
  }
  pilotConfigs[result.data.id] = result.data
}

export function getPilotEnemyConfigById(id: string): PilotEnemyConfig | undefined {
  return pilotConfigs[id]
}

export function getPilotEnemyConfigs(): PilotEnemyConfig[] {
  return Object.values(pilotConfigs)
}

export type { PilotEnemyConfig }
