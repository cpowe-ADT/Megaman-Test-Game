import type { BossId, WeaponId } from '../bosses/types'
import type { CampaignStageId } from '../content/campaign'

export type ProgressionMode = 'classic' | 'relay_randomizer'
export type Difficulty = 'assist' | 'normal' | 'veteran'

export type StageAccessItemId = `access_${Exclude<CampaignStageId, 'tutorial_sentinel' | 'omega_fortress'>}`

export type ProgressionUpgradeId =
  | 'arc_slash'
  | 'armor_helmet'
  | 'armor_arms'
  | 'armor_body'
  | 'armor_legs'
  | 'chip_quick_charge'
  | 'chip_speedster'
  | 'chip_weapon_plus'
  | 'chip_buster_plus'

export type ProgressionConsumableId =
  | 'hp_refill_small'
  | 'hp_refill_large'
  | 'weapon_refill_small'
  | 'weapon_refill_large'

export type ProgressionItemId =
  | StageAccessItemId
  | WeaponId
  | ProgressionUpgradeId
  | 'heart_tank'
  | 'sub_tank'
  | ProgressionConsumableId

export type LocationCheckCategory =
  | 'boss_clear'
  | 'capsule'
  | 'heart_tank'
  | 'sub_tank'
  | 'pickup_bonus'

export type LocationCheckId = `${CampaignStageId}:${LocationCheckCategory}`

export type WeaknessStrictness =
  | 'permissive'
  | 'weakness_and_buster'
  | 'upgraded_buster_only'
  | 'only_weakness'

export type FinalGateCategory =
  | 'medals'
  | 'weapons'
  | 'armorUpgrades'
  | 'heartTanks'
  | 'subTanks'

export type PendingProgressionItem = {
  itemId: ProgressionConsumableId
  amount: number
}

export type ProgressionCheckpointSelection = Record<string, string>

export type BossWeaknessProfile = {
  bossId: BossId
  weaknessWeaponIds: WeaponId[]
}

export type FinalGateRule = {
  category: FinalGateCategory
  required: number
}

export type ProgressionLocationDefinition = {
  id: LocationCheckId
  stageId: CampaignStageId
  category: LocationCheckCategory
  x: number | null
  y: number | null
  label: string
}

export type ProgressionWorldSnapshot = {
  version: 1
  // Missing mode in v1 saves means the original seeded Randomizer.
  progressionMode?: ProgressionMode
  seed: string
  startingStageIds: CampaignStageId[]
  stageChain: Exclude<CampaignStageId, 'tutorial_sentinel' | 'omega_fortress'>[]
  placements: Partial<Record<LocationCheckId, ProgressionItemId>>
  weaknessStrictness: WeaknessStrictness
  weaknessProfiles: Record<string, BossWeaknessProfile>
  finalGate: {
    rules: FinalGateRule[]
  }
}

export type ProgressionTransportPayload = {
  version: 1
  slotData: {
    progressionMode?: ProgressionMode
    seed: string
    startingStageIds: CampaignStageId[]
    weaknessStrictness: WeaknessStrictness
    finalGate: {
      rules: FinalGateRule[]
    }
  }
  checkedLocations: LocationCheckId[]
  receivedItems: ProgressionItemId[]
  checkpoints: Record<string, string[]>
  /** Seen story ids; sanitized against the dialogue registry on import. */
  storyFlags?: string[]
}

export type ProgressionSaveLike = {
  storyFlags?: string[]
  weaponsUnlocked: string[]
  clearedBosses: string[]
  tutorialCleared: boolean
  finalBossCleared: boolean
  gameCompleted: boolean
  progressionWorld?: ProgressionWorldSnapshot | null
  stageAccessUnlocked?: string[]
  collectedChecks?: string[]
  unlockedCheckpoints?: Record<string, string[]>
  selectedCheckpointByStage?: Record<string, string>
  upgradeUnlocks?: string[]
  heartTanks?: number
  subTanks?: number
  pendingProgressionItems?: PendingProgressionItem[]
}
