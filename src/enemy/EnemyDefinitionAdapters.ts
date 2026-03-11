import { EnemyCatalog } from './EnemyCatalog'
import type { EnemyDefinition } from './types'
import type { PilotEnemyConfig } from '../content/enemies'

function profileToMovementType(profile: PilotEnemyConfig['movement']['profile']): EnemyDefinition['movementType'] {
  switch (profile) {
    case 'ground_patrol':
      return 'walker'
    case 'hover_strafe':
      return 'flyer'
    case 'ricochet':
      return 'crawler'
    case 'chase':
      return 'walker'
    default:
      return profile as EnemyDefinition['movementType']
  }
}

export function applyPilotEnemyOverride(baseTypeKey: string, pilot: PilotEnemyConfig): EnemyDefinition | undefined {
  const base = EnemyCatalog[baseTypeKey]
  if (!base) {
    return undefined
  }

  return {
    ...base,
    typeKey: pilot.id,
    movementType: profileToMovementType(pilot.movement.profile),
    stats: {
      ...base.stats,
      hp: pilot.hp,
      damage: pilot.combat.contactDamage ?? base.stats.damage,
      speed: pilot.movement.params?.speed ?? base.stats.speed,
      knockbackResist: pilot.combat.knockbackResist ?? base.stats.knockbackResist,
      hitstunLightMs: pilot.combat.hitstunLightMs ?? base.stats.hitstunLightMs,
      hitstunHeavyMs: pilot.combat.hitstunHeavyMs ?? base.stats.hitstunHeavyMs,
      invulnerabilityMs: pilot.combat.iFrameMs ?? base.stats.invulnerabilityMs
    },
    attack: {
      ...base.attack,
      ...pilot.attack
    },
    animations: {
      ...base.animations,
      ...pilot.animationKeys
    }
  }
}
