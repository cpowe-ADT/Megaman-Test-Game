import voltGolemJson from './volt_golem.json'
import { BossDefinition } from '../framework/types'

export const VOLT_GOLEM_BOSS_CONFIG = voltGolemJson as BossDefinition

const builtInBossConfigs: Record<string, BossDefinition> = {
  [VOLT_GOLEM_BOSS_CONFIG.boss_id]: VOLT_GOLEM_BOSS_CONFIG
}

export function getBossDefinitionById(id: string): BossDefinition | undefined {
  return builtInBossConfigs[id]
}
