import {
  countClearedRobotMasters,
  FINAL_STAGE_ID,
  getCampaignStage,
  TUTORIAL_STAGE_ID,
  type CampaignStageId
} from '../content/campaign'
import { getWeaponDisplayName } from '../content/weapons'
import { getLocationCheckId } from './catalog'
import { ensureProgressionState, evaluateFinalGate, getBossWeaknessProfile } from './state'
import type {
  FinalGateCategory,
  ProgressionConsumableId,
  ProgressionItemId,
  ProgressionSaveLike,
  ProgressionUpgradeId
} from './types'

const UPGRADE_LABELS: Record<ProgressionUpgradeId, string> = {
  arc_slash: 'Arc Slash',
  armor_helmet: 'Helmet Armor',
  armor_arms: 'Arms Armor',
  armor_body: 'Body Armor',
  armor_legs: 'Legs Armor',
  chip_quick_charge: 'Quick Charge Chip',
  chip_speedster: 'Speedster Chip',
  chip_weapon_plus: 'Weapon Plus Chip',
  chip_buster_plus: 'Buster Plus Chip'
}

const CONSUMABLE_LABELS: Record<ProgressionConsumableId, string> = {
  hp_refill_small: 'Small Health Refill',
  hp_refill_large: 'Large Health Refill',
  weapon_refill_small: 'Small Weapon Refill',
  weapon_refill_large: 'Large Weapon Refill'
}

function titleizeSegment(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ')
}

export function getProgressionItemLabel(itemId: ProgressionItemId | string): string {
  if (!itemId) {
    return 'Unknown Item'
  }

  if (itemId.startsWith('access_')) {
    const stageId = itemId.replace(/^access_/, '') as CampaignStageId
    const stage = getCampaignStage(stageId)
    return `${stage?.title ?? titleizeSegment(stageId)} Access`
  }

  if (itemId === 'heart_tank') {
    return 'Heart Tank'
  }

  if (itemId === 'sub_tank') {
    return 'Sub Tank'
  }

  if (itemId in UPGRADE_LABELS) {
    return UPGRADE_LABELS[itemId as ProgressionUpgradeId]
  }

  if (itemId in CONSUMABLE_LABELS) {
    return CONSUMABLE_LABELS[itemId as ProgressionConsumableId]
  }

  return getWeaponDisplayName(itemId)
}

export function getStageAccessRequirementLabel(stageId: string): string {
  if (stageId === TUTORIAL_STAGE_ID) {
    return 'Tutorial Systems Check'
  }
  return getProgressionItemLabel(`access_${stageId}`)
}

export function getBossWeaknessLabel(
  save: ProgressionSaveLike,
  bossId: string,
  fallback = 'Unknown'
): string {
  const profile = getBossWeaknessProfile(save, bossId)
  if (save.progressionWorld?.progressionMode === 'classic' && profile && !profile.weaknessWeaponIds.some(id => save.weaponsUnlocked.includes(id))) return '???'
  const labels = profile?.weaknessWeaponIds
    .map((weaponId) => getWeaponDisplayName(weaponId))
    .filter((label, index, array) => label.length > 0 && array.indexOf(label) === index) ?? []
  return labels.length > 0 ? labels.join(' / ') : fallback
}

export function getStageBossRewardLabel(
  save: ProgressionSaveLike,
  stageId: string,
  fallback = 'Check Clear'
): string {
  const stage = getCampaignStage(stageId)
  const next = ensureProgressionState(save)
  const locationId = getLocationCheckId(stage.id as CampaignStageId, 'boss_clear')
  const itemId = next.progressionWorld?.placements?.[locationId]
  if (itemId) {
    return getProgressionItemLabel(itemId)
  }
  if (stage.id === FINAL_STAGE_ID) {
    return 'Campaign Complete'
  }
  return fallback
}

const FINAL_GATE_LABELS: Record<FinalGateCategory, string> = {
  medals: 'Medals',
  weapons: 'Weapons',
  armorUpgrades: 'Armor',
  heartTanks: 'Hearts',
  subTanks: 'Subs'
}

export function getFinalGateProgressLabel(save: ProgressionSaveLike): string {
  const gate = evaluateFinalGate(save)
  if (gate.rules.length === 0) {
    return gate.unlocked ? 'Gate Open' : 'Gate Locked'
  }
  return gate.rules
    .map((rule) => `${FINAL_GATE_LABELS[rule.category]} ${gate.counts[rule.category]}/${rule.required}`)
    .join(' • ')
}

export function getFinalGateStatusLabel(save: ProgressionSaveLike): string {
  if (save.gameCompleted) {
    return 'FINAL • COMPLETE'
  }
  const gate = evaluateFinalGate(save)
  if (gate.unlocked) {
    return 'FINAL • READY (F)'
  }
  return `FINAL • LOCKED ${countClearedRobotMasters(save)}/8 • ${getFinalGateProgressLabel(save)}`
}

export function formatCheckpointLabel(checkpointId: string | null | undefined): string {
  if (!checkpointId) {
    return 'Start'
  }

  const stripped = checkpointId.replace(/^[a-z]+_/, '')
  const normalized = stripped
    .replace(/boss_gate/g, 'boss gate')
    .replace(/_/g, ' ')

  return titleizeSegment(normalized)
}
