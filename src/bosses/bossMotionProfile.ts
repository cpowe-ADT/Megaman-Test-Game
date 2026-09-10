import type { BossBlueprint } from './types'

export type BossMotionProfile = {
  jumpIntervalMs: number
  jumpVelocityY: number
  airSpeedMultiplier: number
}

const MOTION_BY_WEIGHT: Record<BossBlueprint['movementProfile']['weight'], BossMotionProfile> = {
  light: { jumpIntervalMs: 1250, jumpVelocityY: -340, airSpeedMultiplier: 1.28 },
  medium: { jumpIntervalMs: 1650, jumpVelocityY: -300, airSpeedMultiplier: 1.12 },
  heavy: { jumpIntervalMs: 2300, jumpVelocityY: -250, airSpeedMultiplier: 0.92 }
}

export function getBossMotionProfile(blueprint: BossBlueprint): BossMotionProfile {
  return MOTION_BY_WEIGHT[blueprint.movementProfile.weight]
}

export function getBossJumpInterval(profile: BossMotionProfile, phaseIndex: number): number {
  return Math.max(760, profile.jumpIntervalMs - Math.max(0, phaseIndex) * 180)
}

