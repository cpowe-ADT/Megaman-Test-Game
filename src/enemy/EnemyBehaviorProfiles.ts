import type { EnemyAttackType, EnemyDefinition, EnemyMovementType } from './types'

export type EnemyEngagementRole =
  | 'suppressor'
  | 'artillery'
  | 'ambusher'
  | 'bruiser'
  | 'harrier'
  | 'sentinel'
  | 'hazard'

export interface EnemyBehaviorProfile {
  role: EnemyEngagementRole
  preferredMinRange: number
  preferredMaxRange: number
  verticalAggroTolerance: number
  verticalAttackTolerance: number
  hoverDeadzoneY: number
  hoverAnchorOffsetY: number
  backoffSpeedScale: number
  offscreenAttackMargin: number
}

type EnemyBehaviorProfileOverride = Partial<EnemyBehaviorProfile> & Pick<EnemyBehaviorProfile, 'role'>

const DEFAULT_PROFILE_BY_MOVEMENT: Record<
  EnemyMovementType,
  Omit<EnemyBehaviorProfile, 'role' | 'preferredMinRange' | 'preferredMaxRange'>
> = {
  walker: {
    verticalAggroTolerance: 42,
    verticalAttackTolerance: 28,
    hoverDeadzoneY: 0,
    hoverAnchorOffsetY: 0,
    backoffSpeedScale: 0.7,
    offscreenAttackMargin: 24
  },
  hopper: {
    verticalAggroTolerance: 56,
    verticalAttackTolerance: 34,
    hoverDeadzoneY: 0,
    hoverAnchorOffsetY: 0,
    backoffSpeedScale: 0.45,
    offscreenAttackMargin: 24
  },
  flyer: {
    verticalAggroTolerance: 96,
    verticalAttackTolerance: 58,
    hoverDeadzoneY: 10,
    hoverAnchorOffsetY: -12,
    backoffSpeedScale: 0.55,
    offscreenAttackMargin: 32
  },
  turret: {
    verticalAggroTolerance: 44,
    verticalAttackTolerance: 26,
    hoverDeadzoneY: 0,
    hoverAnchorOffsetY: 0,
    backoffSpeedScale: 0,
    offscreenAttackMargin: 18
  },
  drone: {
    verticalAggroTolerance: 84,
    verticalAttackTolerance: 54,
    hoverDeadzoneY: 8,
    hoverAnchorOffsetY: -10,
    backoffSpeedScale: 0.6,
    offscreenAttackMargin: 28
  },
  crawler: {
    verticalAggroTolerance: 28,
    verticalAttackTolerance: 20,
    hoverDeadzoneY: 0,
    hoverAnchorOffsetY: 0,
    backoffSpeedScale: 0.35,
    offscreenAttackMargin: 22
  }
}

const PROFILE_OVERRIDES: Record<string, EnemyBehaviorProfileOverride> = {
  enemy_gunner_bot: {
    role: 'suppressor',
    preferredMinRange: 74,
    preferredMaxRange: 148,
    verticalAggroTolerance: 40,
    verticalAttackTolerance: 22,
    backoffSpeedScale: 0.65
  },
  enemy_rocket_bot: {
    role: 'artillery',
    preferredMinRange: 96,
    preferredMaxRange: 178,
    verticalAggroTolerance: 52,
    verticalAttackTolerance: 34,
    backoffSpeedScale: 0.5
  },
  enemy_slicer_bot: {
    role: 'ambusher',
    preferredMinRange: 0,
    preferredMaxRange: 42,
    verticalAggroTolerance: 34,
    verticalAttackTolerance: 26,
    backoffSpeedScale: 0.12
  },
  enemy_armored_bot: {
    role: 'bruiser',
    preferredMinRange: 48,
    preferredMaxRange: 112,
    verticalAggroTolerance: 30,
    verticalAttackTolerance: 24,
    backoffSpeedScale: 0.28
  },
  enemy_shock_hopper: {
    role: 'ambusher',
    preferredMinRange: 6,
    preferredMaxRange: 46,
    verticalAggroTolerance: 64,
    verticalAttackTolerance: 34,
    backoffSpeedScale: 0.16
  },
  enemy_bouncer: {
    role: 'ambusher',
    preferredMinRange: 0,
    preferredMaxRange: 62,
    verticalAggroTolerance: 68,
    verticalAttackTolerance: 38,
    backoffSpeedScale: 0.1
  },
  enemy_mine_bot: {
    role: 'hazard',
    preferredMinRange: 54,
    preferredMaxRange: 98,
    verticalAggroTolerance: 26,
    verticalAttackTolerance: 20,
    backoffSpeedScale: 0.22
  },
  enemy_frost_turret: {
    role: 'suppressor',
    preferredMinRange: 122,
    preferredMaxRange: 210,
    verticalAggroTolerance: 48,
    verticalAttackTolerance: 30
  },
  enemy_laser_eye: {
    role: 'sentinel',
    preferredMinRange: 138,
    preferredMaxRange: 236,
    verticalAggroTolerance: 26,
    verticalAttackTolerance: 16
  },
  enemy_drone: {
    role: 'harrier',
    preferredMinRange: 82,
    preferredMaxRange: 148,
    verticalAggroTolerance: 88,
    verticalAttackTolerance: 50,
    hoverAnchorOffsetY: -18,
    backoffSpeedScale: 0.46
  },
  enemy_shield_drone: {
    role: 'harrier',
    preferredMinRange: 90,
    preferredMaxRange: 162,
    verticalAggroTolerance: 72,
    verticalAttackTolerance: 44,
    hoverAnchorOffsetY: -14,
    backoffSpeedScale: 0.42
  },
  enemy_fly_trap: {
    role: 'hazard',
    preferredMinRange: 0,
    preferredMaxRange: 32,
    verticalAggroTolerance: 28,
    verticalAttackTolerance: 20,
    backoffSpeedScale: 0
  }
}

function buildDefaultRange(attackType: EnemyAttackType, range: number): Pick<
  EnemyBehaviorProfile,
  'role' | 'preferredMinRange' | 'preferredMaxRange'
> {
  switch (attackType) {
    case 'melee':
      return { role: 'ambusher', preferredMinRange: 0, preferredMaxRange: Math.max(32, range) }
    case 'charge':
      return {
        role: 'bruiser',
        preferredMinRange: Math.max(28, Math.round(range * 0.45)),
        preferredMaxRange: Math.max(64, range)
      }
    case 'lobbed':
      return {
        role: 'artillery',
        preferredMinRange: Math.max(72, Math.round(range * 0.55)),
        preferredMaxRange: Math.max(112, Math.round(range * 1.05))
      }
    case 'beam':
      return {
        role: 'sentinel',
        preferredMinRange: Math.max(96, Math.round(range * 0.55)),
        preferredMaxRange: Math.max(140, range)
      }
    case 'burst':
      return {
        role: 'harrier',
        preferredMinRange: Math.max(64, Math.round(range * 0.42)),
        preferredMaxRange: Math.max(110, range)
      }
    case 'projectile':
    default:
      return {
        role: 'suppressor',
        preferredMinRange: Math.max(56, Math.round(range * 0.42)),
        preferredMaxRange: Math.max(100, range)
      }
  }
}

export function resolveEnemyBehaviorProfile(definition: EnemyDefinition): EnemyBehaviorProfile {
  const fallbackRange = definition.attack.range ?? 46
  const movementDefaults = DEFAULT_PROFILE_BY_MOVEMENT[definition.movementType]
  const rangeDefaults = buildDefaultRange(definition.attack.type, fallbackRange)
  const override = PROFILE_OVERRIDES[definition.typeKey] ?? { role: rangeDefaults.role }

  return {
    ...movementDefaults,
    ...rangeDefaults,
    ...override
  }
}

export function shouldEnemyAttackNow(
  profile: EnemyBehaviorProfile,
  deltaX: number,
  deltaY: number,
  isOnscreen: boolean
): boolean {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)

  if (!isOnscreen) {
    return false
  }

  return (
    absX <= profile.preferredMaxRange &&
    absX >= Math.max(0, Math.round(profile.preferredMinRange * 0.55)) &&
    absY <= profile.verticalAttackTolerance
  )
}

export function resolveHorizontalBandIntent(
  profile: EnemyBehaviorProfile,
  deltaX: number
): number {
  const absX = Math.abs(deltaX)
  const pointBlankHoldDistance = Math.min(32, Math.round(profile.preferredMaxRange * 0.35))
  if (absX > profile.preferredMaxRange) {
    return Math.sign(deltaX)
  }
  if (absX <= pointBlankHoldDistance) {
    return 0
  }
  if (absX < profile.preferredMinRange) {
    return -Math.sign(deltaX) * profile.backoffSpeedScale
  }
  return 0
}
