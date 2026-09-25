import { CustodianWalkerBrain } from './CustodianWalkerBrain'
import { DrillSerpentBrain } from './DrillSerpentBrain'
import { RelayTurretNestBrain } from './RelayTurretNestBrain'
import { SentryTwinsBrain } from './SentryTwinsBrain'
import type { EnemyBrain } from './types'
import type { EnemyEntity } from './EnemyEntity'

/** The dedicated behaviour a definition names in `brain`, or none (the generic `EnemyAI` runs). */
export function createEnemyBrain(entity: EnemyEntity, enabled: boolean): EnemyBrain | undefined {
  switch (entity.definition.brain) {
    case 'custodian_walker':
      return new CustodianWalkerBrain(entity, enabled)
    case 'relay_turret_nest':
      return new RelayTurretNestBrain(entity, enabled)
    case 'sentry_twins':
      return new SentryTwinsBrain(entity, enabled)
    case 'drill_serpent':
      return new DrillSerpentBrain(entity, enabled)
    default:
      return undefined
  }
}
