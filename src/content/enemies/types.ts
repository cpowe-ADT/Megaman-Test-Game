import type { EnemyAnimationKeys, EnemyAttackConfig, EnemyMovementType } from '../../enemy/types'

export type PilotEnemyConfig = {
  schemaVersion: '1'
  id: string
  displayName: string
  hp: number
  traits: string[]
  movement: {
    profile:
      | 'ground_patrol'
      | 'chase'
      | 'hopper'
      | 'hover_strafe'
      | 'turret'
      | 'ricochet'
      | EnemyMovementType
    params?: {
      speed?: number
    }
  }
  combat: {
    contactDamage?: number
    iFrameMs?: number
    hitstunLightMs?: number
    hitstunHeavyMs?: number
    knockbackResist?: number
  }
  attack: EnemyAttackConfig
  animationKeys: EnemyAnimationKeys
}
