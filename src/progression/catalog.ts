import {
  FINAL_STAGE_ID,
  getCampaignStage,
  getRobotMasterStages,
  ROBOT_MASTER_STAGE_IDS,
  TUTORIAL_STAGE_ID,
  type CampaignStageId
} from '../content/campaign'
import type { BossId, WeaponId } from '../bosses/types'
import type {
  BossWeaknessProfile,
  LocationCheckCategory,
  LocationCheckId,
  ProgressionLocationDefinition,
  ProgressionUpgradeId,
  StageAccessItemId
} from './types'

export const PROGRESSION_SEED_DEFAULT = 'local-default'

export const ARMOR_UPGRADE_IDS = [
  'armor_helmet',
  'armor_arms',
  'armor_body',
  'armor_legs'
] as const satisfies readonly ProgressionUpgradeId[]

export const CHIP_UPGRADE_IDS = [
  'chip_quick_charge',
  'chip_speedster',
  'chip_weapon_plus',
  'chip_buster_plus'
] as const satisfies readonly ProgressionUpgradeId[]

export const ALL_UPGRADE_IDS = [...ARMOR_UPGRADE_IDS, ...CHIP_UPGRADE_IDS] as const

export const ROBOT_MASTER_ACCESS_IDS: StageAccessItemId[] = ROBOT_MASTER_STAGE_IDS.map(
  (stageId) => `access_${stageId}` as StageAccessItemId
)

export const ROBOT_MASTER_WEAPON_IDS: WeaponId[] = getRobotMasterStages()
  .map((stage) => stage.rewardWeaponId)
  .filter((weaponId): weaponId is WeaponId => Boolean(weaponId))

export function getStageAccessItemId(
  stageId: Exclude<CampaignStageId, 'tutorial_sentinel' | 'omega_fortress'>
): StageAccessItemId {
  return `access_${stageId}` as StageAccessItemId
}

export function getRobotMasterBossIds(): BossId[] {
  return getRobotMasterStages().map((stage) => stage.bossId)
}

export function getLocationCheckId(stageId: CampaignStageId, category: LocationCheckCategory): LocationCheckId {
  return `${stageId}:${category}` as LocationCheckId
}

function makePickupLocation(
  stageId: CampaignStageId,
  category: LocationCheckCategory,
  label: string
): ProgressionLocationDefinition {
  const stage = getCampaignStage(stageId)
  const checkpoints = stage.arena.checkpoints
  const middle = checkpoints[Math.min(1, checkpoints.length - 1)] ?? checkpoints[0]
  const late = checkpoints[Math.max(0, checkpoints.length - 2)] ?? checkpoints[checkpoints.length - 1]
  const start = checkpoints[0]

  // Only the tutorial falls through to these (every warden stage hands-places its own anchor below); both of
  // its categories rest on a real ledge (part 13e, EVAL-P13-010): the capsule on the dash bay's main ground
  // (x954 unchanged, y sits its art on surface top 236) and the bonus on tutorial_mid_1 (top 172).
  const positions: Record<LocationCheckCategory, { x: number | null; y: number | null; rest: 'ground' | 'float' }> = {
    boss_clear: { x: null, y: null, rest: 'float' },
    capsule: {
      x: Math.min(Number(stage.arena.width ?? 448) - 70, (middle?.x ?? 120) + 26),
      y: 227.5,
      rest: 'ground'
    },
    heart_tank: {
      x: Math.min(Number(stage.arena.width ?? 448) - 84, (middle?.x ?? 140) + 92),
      y: 132,
      rest: 'ground'
    },
    sub_tank: {
      x: Math.max(52, (late?.x ?? 240) - 14),
      y: 128,
      rest: 'ground'
    },
    pickup_bonus: {
      x: Math.min(Number(stage.arena.width ?? 448) - 72, (start?.x ?? 44) + 124),
      y: 163,
      rest: 'ground'
    },
    // Not exercised today: every robot-master stage hands-places its own extra_life anchor (part 13e,
    // EVAL-P13-010), and the tutorial never places one. Kept for type completeness if a future stage omits it.
    extra_life: {
      x: Math.min(Number(stage.arena.width ?? 448) - 72, (late?.x ?? 240) + 60),
      y: 228,
      rest: 'ground'
    }
  }

  // A stage's hand-placed anchor wins (Heat Works); the ids stay the same, so saves are unaffected.
  const anchor = category === 'boss_clear' ? undefined : stage.arena.locationAnchors?.[category]
  const position = anchor ?? positions[category]
  return {
    id: getLocationCheckId(stageId, category),
    stageId,
    category,
    x: position.x,
    y: position.y,
    rest: position.rest,
    label
  }
}

export const PROGRESSION_LOCATIONS: ProgressionLocationDefinition[] = [
  makePickupLocation(TUTORIAL_STAGE_ID, 'boss_clear', 'Tutorial Boss Clear'),
  makePickupLocation(TUTORIAL_STAGE_ID, 'capsule', 'Tutorial Capsule'),
  makePickupLocation(TUTORIAL_STAGE_ID, 'pickup_bonus', 'Tutorial Bonus'),
  ...getRobotMasterStages().flatMap((stage) => [
    makePickupLocation(stage.id as CampaignStageId, 'boss_clear', `${stage.title} Boss Clear`),
    makePickupLocation(stage.id as CampaignStageId, 'capsule', `${stage.title} Capsule`),
    makePickupLocation(stage.id as CampaignStageId, 'heart_tank', `${stage.title} Heart Tank`),
    makePickupLocation(stage.id as CampaignStageId, 'sub_tank', `${stage.title} Sub Tank`),
    makePickupLocation(stage.id as CampaignStageId, 'pickup_bonus', `${stage.title} Bonus Pickup`),
    makePickupLocation(stage.id as CampaignStageId, 'extra_life', `${stage.title} Extra Life`)
  ]),
  makePickupLocation(FINAL_STAGE_ID, 'boss_clear', 'Central Core Boss Clear')
]

export const NON_FINAL_PROGRESSION_LOCATIONS = PROGRESSION_LOCATIONS.filter(
  (location) => location.stageId !== FINAL_STAGE_ID
)

export function getLocationDefinition(locationId: string): ProgressionLocationDefinition | undefined {
  return PROGRESSION_LOCATIONS.find((location) => location.id === locationId)
}

export function getStageLocationDefinitions(stageId: string): ProgressionLocationDefinition[] {
  return PROGRESSION_LOCATIONS.filter((location) => location.stageId === stageId)
}

export function createBossWeaknessProfile(
  bossId: BossId,
  weaknessWeaponId: WeaponId
): BossWeaknessProfile {
  return {
    bossId,
    weaknessWeaponIds: [weaknessWeaponId]
  }
}
