import voltGolemJson from './volt_golem.json' with { type: 'json' }
import { BossDefinition } from '../framework/types'
import { BOSS_ROSTER } from '../../bosses/roster'
import { toBossDefinition } from '../framework/bossDefinitionMapper'
import { assertValidBossDefinition } from './validateBossDefinition'

export const VOLT_GOLEM_BOSS_CONFIG = assertValidBossDefinition(voltGolemJson as BossDefinition)

export const BOSS_ROSTER_RUNTIME_CONFIGS = Object.fromEntries(
  Object.values(BOSS_ROSTER).map((blueprint) => {
    const definition = assertValidBossDefinition(toBossDefinition(blueprint))
    return [definition.boss_id, definition]
  })
) as Record<string, BossDefinition>

const builtInBossConfigs: Record<string, BossDefinition> = {
  ...BOSS_ROSTER_RUNTIME_CONFIGS,
  [VOLT_GOLEM_BOSS_CONFIG.boss_id]: VOLT_GOLEM_BOSS_CONFIG
}

export function getBossDefinitionById(id: string): BossDefinition | undefined {
  return builtInBossConfigs[id]
}

export { assertValidBossDefinition, validateBossDefinition } from './validateBossDefinition'
