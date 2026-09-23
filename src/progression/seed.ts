import { WeaknessTable } from '../bosses/types'
import { BOSS_ROSTER } from '../bosses/roster'
import { getWeaponConfig } from '../content/weapons'
import { getRobotMasterStages, ROBOT_MASTER_STAGE_IDS, TUTORIAL_STAGE_ID, type CampaignStageId } from '../content/campaign'
import {
  ALL_UPGRADE_IDS,
  createBossWeaknessProfile,
  getLocationCheckId,
  getStageAccessItemId,
  NON_FINAL_PROGRESSION_LOCATIONS,
  PROGRESSION_SEED_DEFAULT,
  ROBOT_MASTER_WEAPON_IDS
} from './catalog'
import type {
  FinalGateCategory,
  LocationCheckId,
  ProgressionItemId,
  ProgressionWorldSnapshot
} from './types'

function hashSeed(input: string): number {
  let hash = 2166136261
  for (let index = 0; index < input.length; index += 1) {
    hash ^= input.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  return hash >>> 0
}

function createRng(seed: string): () => number {
  let state = hashSeed(seed) || 0x12345678
  return () => {
    state = Math.imul(state ^ (state >>> 15), 1 | state)
    state ^= state + Math.imul(state ^ (state >>> 7), 61 | state)
    return ((state ^ (state >>> 14)) >>> 0) / 4294967296
  }
}

function shuffleInPlace<T>(items: T[], rng: () => number): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(rng() * (index + 1))
    ;[items[index], items[swapIndex]] = [items[swapIndex], items[index]]
  }
  return items
}

function chooseFinalGateRules(rng: () => number) {
  const secondaryCategories: FinalGateCategory[] = ['weapons', 'armorUpgrades', 'heartTanks', 'subTanks']
  const secondary = secondaryCategories[Math.floor(rng() * secondaryCategories.length)] ?? 'weapons'
  const ranges: Record<FinalGateCategory, [number, number]> = {
    medals: [6, 8],
    weapons: [4, 6],
    armorUpgrades: [2, 4],
    heartTanks: [4, 8],
    subTanks: [2, 4]
  }
  const roll = (category: FinalGateCategory) => {
    const [min, max] = ranges[category]
    return min + Math.floor(rng() * (max - min + 1))
  }
  return {
    rules: [
      { category: 'medals' as const, required: roll('medals') },
      { category: secondary, required: roll(secondary) }
    ]
  }
}

export function generateProgressionWorld(seed = PROGRESSION_SEED_DEFAULT): ProgressionWorldSnapshot {
  const rng = createRng(seed)
  const robotMasterStages = [...ROBOT_MASTER_STAGE_IDS]
  const firstStage = robotMasterStages[0]
  const tail = shuffleInPlace(robotMasterStages.slice(1), rng)
  const stageChain = [firstStage, ...tail]
  const bossLocations = [
    getLocationCheckId(TUTORIAL_STAGE_ID, 'boss_clear'),
    ...stageChain.slice(0, 6).map((stageId) => getLocationCheckId(stageId, 'boss_clear'))
  ] as LocationCheckId[]

  const stageAccessItems = stageChain.slice(1).map((stageId) => getStageAccessItemId(stageId))
  const placements: Partial<Record<LocationCheckId, ProgressionItemId>> = {}
  bossLocations.forEach((locationId, index) => {
    placements[locationId] = stageAccessItems[index]
  })

  const remainingLocations = shuffleInPlace(
    NON_FINAL_PROGRESSION_LOCATIONS.map((location) => location.id).filter((locationId) => !(locationId in placements)),
    rng
  )

  const remainingItems: ProgressionItemId[] = [
    ...ROBOT_MASTER_WEAPON_IDS,
    ...ALL_UPGRADE_IDS,
    ...Array.from({ length: 8 }, () => 'heart_tank' as const),
    ...Array.from({ length: 4 }, () => 'sub_tank' as const),
    ...Array.from({ length: 4 }, () => 'hp_refill_small' as const),
    ...Array.from({ length: 2 }, () => 'hp_refill_large' as const),
    ...Array.from({ length: 4 }, () => 'weapon_refill_small' as const),
    ...Array.from({ length: 2 }, () => 'weapon_refill_large' as const)
  ]

  if (remainingItems.length > remainingLocations.length) {
    remainingItems.splice(remainingLocations.length)
  } else if (remainingItems.length < remainingLocations.length) {
    while (remainingItems.length < remainingLocations.length) {
      remainingItems.push('hp_refill_small')
    }
  }

  remainingLocations.forEach((locationId, index) => {
    placements[locationId] = remainingItems[index]
  })

  const stageById = new Map(getRobotMasterStages().map((stage) => [stage.id, stage]))
  const weaknessProfiles = stageChain.reduce<Record<string, ReturnType<typeof createBossWeaknessProfile>>>(
    (acc, stageId, index) => {
      const stage = stageById.get(stageId)
      const weaknessSourceStageId = stageChain[(index - 1 + stageChain.length) % stageChain.length]
      const weaknessSource = stageById.get(weaknessSourceStageId)
      if (stage?.bossId && weaknessSource?.rewardWeaponId) {
        acc[stage.bossId] = createBossWeaknessProfile(stage.bossId, weaknessSource.rewardWeaponId)
      }
      return acc
    },
    {}
  )

  return {
    version: 1,
    progressionMode: 'relay_randomizer',
    seed,
    startingStageIds: [TUTORIAL_STAGE_ID, firstStage],
    stageChain,
    placements,
    weaknessStrictness: 'weakness_and_buster',
    weaknessProfiles,
    finalGate: chooseFinalGateRules(rng)
  }
}

/** Authored campaign: stageChain is presentation order, never an access chain. */
export function generateClassicWorld(): ProgressionWorldSnapshot {
  const stages = getRobotMasterStages()
  const capsules: ProgressionItemId[] = ['chip_buster_plus', 'chip_quick_charge', 'armor_legs', 'armor_body', 'armor_arms', 'chip_weapon_plus', 'chip_speedster', 'armor_helmet']
  const placements: ProgressionWorldSnapshot['placements'] = {
    [getLocationCheckId(TUTORIAL_STAGE_ID, 'boss_clear')]: 'arc_slash',
    [getLocationCheckId(TUTORIAL_STAGE_ID, 'capsule')]: 'hp_refill_large',
    [getLocationCheckId(TUTORIAL_STAGE_ID, 'pickup_bonus')]: 'hp_refill_large'
  }
  const weaknessProfiles: ProgressionWorldSnapshot['weaknessProfiles'] = {}
  stages.forEach((stage, index) => {
    const stageId = stage.id as CampaignStageId
    placements[getLocationCheckId(stageId, 'boss_clear')] = stage.rewardWeaponId!
    placements[getLocationCheckId(stageId, 'capsule')] = capsules[index]
    placements[getLocationCheckId(stageId, 'heart_tank')] = 'heart_tank'
    placements[getLocationCheckId(stageId, 'sub_tank')] = index % 2 ? 'sub_tank' : 'hp_refill_large'
    placements[getLocationCheckId(stageId, 'pickup_bonus')] = 'hp_refill_large'
    const weakElement = WeaknessTable[BOSS_ROSTER[stage.bossId].element]
    const weapon = stages.find(candidate => getWeaponConfig(candidate.rewardWeaponId!).element === weakElement)!.rewardWeaponId!
    weaknessProfiles[stage.bossId] = createBossWeaknessProfile(stage.bossId, weapon)
  })
  return { version: 1, progressionMode: 'classic', seed: 'classic', startingStageIds: [TUTORIAL_STAGE_ID, ...ROBOT_MASTER_STAGE_IDS], stageChain: [...ROBOT_MASTER_STAGE_IDS], placements, weaknessStrictness: 'weakness_and_buster', weaknessProfiles, finalGate: { rules: [{ category: 'medals', required: 8 }] } }
}
