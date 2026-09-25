import { CustodianWalkerBrain } from './CustodianWalkerBrain'
import type { EnemyBrain } from './types'
import type { EnemyEntity } from './EnemyEntity'

/** The dedicated behaviour a definition names in `brain`, or none (the generic `EnemyAI` runs). */
export function createEnemyBrain(entity: EnemyEntity, enabled: boolean): EnemyBrain | undefined {
  switch (entity.definition.brain) {
    case 'custodian_walker':
      return new CustodianWalkerBrain(entity, enabled)
    default:
      return undefined
  }
}
