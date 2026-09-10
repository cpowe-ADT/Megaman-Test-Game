import { FINAL_STAGE_ID, getCampaignStage, ROBOT_MASTER_STAGE_IDS, TUTORIAL_STAGE_ID } from '../content/campaign'
import { getWeaponConfig } from '../content/weapons'
import { generateProgressionWorld } from './seed'
import {
  ALL_UPGRADE_IDS,
  PROGRESSION_LOCATIONS,
  ROBOT_MASTER_ACCESS_IDS,
  ROBOT_MASTER_WEAPON_IDS,
  getLocationDefinition
} from './catalog'
import type {
  BossWeaknessProfile,
  FinalGateCategory,
  LocationCheckId,
  PendingProgressionItem,
  ProgressionConsumableId,
  ProgressionItemId,
  ProgressionSaveLike,
  ProgressionTransportPayload,
  ProgressionUpgradeId,
  ProgressionWorldSnapshot,
  WeaknessStrictness
} from './types'

const ARMOR_UPGRADES = new Set<ProgressionUpgradeId>([
  'armor_helmet',
  'armor_arms',
  'armor_body',
  'armor_legs'
])

const HP_ITEM_AMOUNT: Record<ProgressionConsumableId, number> = {
  hp_refill_small: 2,
  hp_refill_large: 6,
  weapon_refill_small: 2,
  weapon_refill_large: 6
}

const MAX_TRANSPORT_BYTES = 50_000
const MAX_SEED_LENGTH = 64
const MAX_GATE_RULE_REQUIREMENT = 8
const CAMPAIGN_STAGE_IDS = [TUTORIAL_STAGE_ID, ...ROBOT_MASTER_STAGE_IDS, FINAL_STAGE_ID] as const
const VALID_CAMPAIGN_STAGE_IDS = new Set<string>(CAMPAIGN_STAGE_IDS)
const VALID_LOCATION_IDS = new Set<string>(PROGRESSION_LOCATIONS.map((location) => location.id))
const VALID_PROGRESSION_ITEM_IDS = new Set<string>([
  ...ROBOT_MASTER_ACCESS_IDS,
  ...ROBOT_MASTER_WEAPON_IDS,
  ...ALL_UPGRADE_IDS,
  'heart_tank',
  'sub_tank',
  ...Object.keys(HP_ITEM_AMOUNT)
])
const VALID_CHECKPOINT_IDS_BY_STAGE = Object.fromEntries(
  CAMPAIGN_STAGE_IDS.map((stageId) => [
    stageId,
    new Set<string>(getCampaignStage(stageId).arena.checkpoints.map((checkpoint) => checkpoint.id))
  ])
) as Record<string, Set<string>>

type ProgressionCounts = {
  medals: number
  weapons: number
  armorUpgrades: number
  heartTanks: number
  subTanks: number
}

function uniqueStrings(values: unknown): string[] {
  return Array.isArray(values)
    ? values
        .map((value) => (typeof value === 'string' ? value : ''))
        .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
    : []
}

function uniqueAllowedStrings(values: unknown, allowed: Set<string>, limit = allowed.size): string[] {
  return uniqueStrings(values).filter((value) => allowed.has(value)).slice(0, limit)
}

function allowedStringsPreservingDuplicates(values: unknown, allowed: Set<string>, limit: number): string[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values
    .map((value) => (typeof value === 'string' ? value : ''))
    .filter((value) => value.length > 0 && allowed.has(value))
    .slice(0, limit)
}

function sanitizeCheckpointMap(values: unknown): Record<string, string[]> {
  if (!values || typeof values !== 'object') {
    return {}
  }

  return Object.fromEntries(
    Object.entries(values)
      .filter(([stageId]) => VALID_CAMPAIGN_STAGE_IDS.has(stageId))
      .map(([stageId, checkpointIds]) => [
        stageId,
        uniqueAllowedStrings(
          checkpointIds,
          VALID_CHECKPOINT_IDS_BY_STAGE[stageId] ?? new Set<string>()
        )
      ])
  )
}

function clonePendingItems(values: unknown): PendingProgressionItem[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      const itemId = String((entry as { itemId?: string }).itemId ?? '') as ProgressionConsumableId
      const amount = Number((entry as { amount?: number }).amount ?? 0)
      if (!(itemId in HP_ITEM_AMOUNT) || amount <= 0) {
        return null
      }
      return { itemId, amount }
    })
    .filter((entry): entry is PendingProgressionItem => Boolean(entry))
}

function cloneWorld(world: ProgressionWorldSnapshot | null | undefined): ProgressionWorldSnapshot | null {
  if (!world) {
    return null
  }
  return {
    version: 1,
    seed: String(world.seed ?? ''),
    startingStageIds: [...(world.startingStageIds ?? [])],
    stageChain: [...(world.stageChain ?? [])],
    placements: { ...(world.placements ?? {}) },
    weaknessStrictness: (world.weaknessStrictness ?? 'weakness_and_buster') as WeaknessStrictness,
    weaknessProfiles: { ...(world.weaknessProfiles ?? {}) },
    finalGate: {
      rules: Array.isArray(world.finalGate?.rules)
        ? world.finalGate.rules.map((rule) => ({
            category: rule.category,
            required: Number(rule.required ?? 0)
          }))
        : []
    }
  }
}

export function ensureProgressionState<T extends ProgressionSaveLike>(
  save: T,
  seed = 'local-default'
): T {
  const world = cloneWorld(save.progressionWorld) ?? generateProgressionWorld(seed)
  const stageAccessUnlocked = uniqueStrings(save.stageAccessUnlocked)
  const collectedChecks = uniqueStrings(save.collectedChecks)
  const clearedBosses = uniqueStrings(save.clearedBosses)
  let tutorialCleared = Boolean(save.tutorialCleared)
  let finalBossCleared = Boolean(save.finalBossCleared)
  let gameCompleted = Boolean(save.gameCompleted)

  for (const locationId of collectedChecks) {
    const location = getLocationDefinition(locationId)
    if (location?.category !== 'boss_clear') {
      continue
    }
    if (location.stageId === TUTORIAL_STAGE_ID) {
      tutorialCleared = true
    } else if (location.stageId === FINAL_STAGE_ID) {
      finalBossCleared = true
      gameCompleted = true
    } else if (
      ROBOT_MASTER_STAGE_IDS.includes(location.stageId as any) &&
      !clearedBosses.includes(location.stageId)
    ) {
      clearedBosses.push(location.stageId)
    }
  }
  world.startingStageIds.forEach((stageId) => {
    if (!stageAccessUnlocked.includes(stageId)) {
      stageAccessUnlocked.push(stageId)
    }
  })
  const unlockedCheckpoints = { ...(save.unlockedCheckpoints ?? {}) }
  for (const stageId of [TUTORIAL_STAGE_ID, ...ROBOT_MASTER_STAGE_IDS, FINAL_STAGE_ID]) {
    if (!Array.isArray(unlockedCheckpoints[stageId])) {
      unlockedCheckpoints[stageId] = []
    }
  }
  return {
    ...save,
    clearedBosses,
    tutorialCleared,
    finalBossCleared,
    gameCompleted,
    progressionWorld: world,
    stageAccessUnlocked,
    collectedChecks,
    unlockedCheckpoints,
    selectedCheckpointByStage: { ...(save.selectedCheckpointByStage ?? {}) },
    upgradeUnlocks: uniqueStrings(save.upgradeUnlocks),
    heartTanks: Math.max(0, Math.min(8, Number(save.heartTanks ?? 0))),
    subTanks: Math.max(0, Math.min(4, Number(save.subTanks ?? 0))),
    pendingProgressionItems: clonePendingItems(save.pendingProgressionItems)
  }
}

export function createFreshProgressionState(seed = 'local-default'): Pick<
  ProgressionSaveLike,
  | 'progressionWorld'
  | 'stageAccessUnlocked'
  | 'collectedChecks'
  | 'unlockedCheckpoints'
  | 'selectedCheckpointByStage'
  | 'upgradeUnlocks'
  | 'heartTanks'
  | 'subTanks'
  | 'pendingProgressionItems'
> {
  const world = generateProgressionWorld(seed)
  const unlockedCheckpoints: Record<string, string[]> = {
    [TUTORIAL_STAGE_ID]: [],
    [FINAL_STAGE_ID]: []
  }
  ROBOT_MASTER_STAGE_IDS.forEach((stageId) => {
    unlockedCheckpoints[stageId] = []
  })
  return {
    progressionWorld: world,
    stageAccessUnlocked: [...world.startingStageIds],
    collectedChecks: [],
    unlockedCheckpoints,
    selectedCheckpointByStage: {},
    upgradeUnlocks: [],
    heartTanks: 0,
    subTanks: 0,
    pendingProgressionItems: []
  }
}

export function markCheckpointUnlocked<T extends ProgressionSaveLike>(
  save: T,
  stageId: string,
  checkpointId: string
): T {
  const next = ensureProgressionState(save)
  const stageEntries = uniqueStrings(next.unlockedCheckpoints?.[stageId] ?? [])
  if (!stageEntries.includes(checkpointId)) {
    stageEntries.push(checkpointId)
  }
  return {
    ...next,
    unlockedCheckpoints: {
      ...next.unlockedCheckpoints,
      [stageId]: stageEntries
    }
  }
}

export function setSelectedCheckpoint<T extends ProgressionSaveLike>(
  save: T,
  stageId: string,
  checkpointId: string
): T {
  const next = ensureProgressionState(save)
  return {
    ...next,
    selectedCheckpointByStage: {
      ...next.selectedCheckpointByStage,
      [stageId]: checkpointId
    }
  }
}

export function getSelectedCheckpointId(save: ProgressionSaveLike, stageId: string): string | null {
  const next = ensureProgressionState(save)
  return next.selectedCheckpointByStage?.[stageId] ?? null
}

export function getAccessibleCheckpointIds(
  save: ProgressionSaveLike,
  stageId: string,
  allCheckpointIds: string[]
): string[] {
  if (allCheckpointIds.length === 0) {
    return []
  }
  const next = ensureProgressionState(save)
  if (next.upgradeUnlocks?.includes('armor_helmet')) {
    return [...allCheckpointIds]
  }
  const unlocked = uniqueStrings(next.unlockedCheckpoints?.[stageId] ?? [])
  const starting = allCheckpointIds[0]
  const accessible = [starting, ...unlocked].filter(
    (checkpointId, index, array) =>
      Boolean(checkpointId) && array.indexOf(checkpointId) === index && allCheckpointIds.includes(checkpointId)
  )
  return accessible.length > 0 ? accessible : [starting]
}

function countProgression(save: ProgressionSaveLike): ProgressionCounts {
  const next = ensureProgressionState(save)
  const armorUpgrades = uniqueStrings(next.upgradeUnlocks).filter((itemId) =>
    ARMOR_UPGRADES.has(itemId as ProgressionUpgradeId)
  ).length
  return {
    medals: uniqueStrings(next.clearedBosses).filter((stageId) => ROBOT_MASTER_STAGE_IDS.includes(stageId as any)).length,
    weapons: uniqueStrings(next.weaponsUnlocked).filter((weaponId) => weaponId !== 'Buster').length,
    armorUpgrades,
    heartTanks: Math.max(0, Math.min(8, Number(next.heartTanks ?? 0))),
    subTanks: Math.max(0, Math.min(4, Number(next.subTanks ?? 0)))
  }
}

export function evaluateFinalGate(save: ProgressionSaveLike): {
  unlocked: boolean
  counts: ProgressionCounts
  rules: ProgressionWorldSnapshot['finalGate']['rules']
} {
  const next = ensureProgressionState(save)
  const counts = countProgression(next)
  const rules = next.progressionWorld?.finalGate.rules ?? []
  const fullBossClearUnlocked = Boolean(next.tutorialCleared) && counts.medals >= ROBOT_MASTER_STAGE_IDS.length
  const configuredRulesSatisfied =
    rules.length === 0 || rules.every((rule) => counts[rule.category as FinalGateCategory] >= rule.required)
  const unlocked =
    Boolean(next.finalBossCleared || next.gameCompleted) || (fullBossClearUnlocked && configuredRulesSatisfied)
  return { unlocked, counts, rules }
}

export function isStageAccessible(save: ProgressionSaveLike, stageId: string): boolean {
  const next = ensureProgressionState(save)
  if (stageId === FINAL_STAGE_ID) {
    return evaluateFinalGate(next).unlocked
  }
  if (stageId === TUTORIAL_STAGE_ID) {
    return true
  }
  return uniqueStrings(next.stageAccessUnlocked).includes(stageId)
}

export function claimLocationCheck<T extends ProgressionSaveLike>(
  save: T,
  locationId: LocationCheckId
): { nextSave: T; itemId: ProgressionItemId | null; duplicate: boolean } {
  const next = ensureProgressionState(save)
  const collectedChecks = uniqueStrings(next.collectedChecks)
  if (collectedChecks.includes(locationId)) {
    return { nextSave: next as T, itemId: null, duplicate: true }
  }
  collectedChecks.push(locationId)
  const itemId = next.progressionWorld?.placements?.[locationId] ?? null
  let updated = {
    ...next,
    collectedChecks
  } as T
  if (itemId) {
    updated = applyProgressionItem(updated, itemId)
  }
  return { nextSave: ensureProgressionState(updated) as T, itemId, duplicate: false }
}

export function applyProgressionItem<T extends ProgressionSaveLike>(
  save: T,
  itemId: ProgressionItemId
): T {
  const next = ensureProgressionState(save)

  const pushUnique = (values: string[], value: string): string[] =>
    values.includes(value) ? values : [...values, value]

  if (itemId.startsWith('access_')) {
    const stageId = itemId.replace(/^access_/, '')
    return {
      ...next,
      stageAccessUnlocked: pushUnique(uniqueStrings(next.stageAccessUnlocked), stageId)
    } as T
  }

  if (itemId in HP_ITEM_AMOUNT) {
    const queue = clonePendingItems(next.pendingProgressionItems)
    queue.push({ itemId: itemId as ProgressionConsumableId, amount: HP_ITEM_AMOUNT[itemId as ProgressionConsumableId] })
    return {
      ...next,
      pendingProgressionItems: queue
    } as T
  }

  if (itemId === 'heart_tank') {
    return {
      ...next,
      heartTanks: Math.min(8, Number(next.heartTanks ?? 0) + 1)
    } as T
  }

  if (itemId === 'sub_tank') {
    return {
      ...next,
      subTanks: Math.min(4, Number(next.subTanks ?? 0) + 1)
    } as T
  }

  if (itemId.startsWith('armor_') || itemId.startsWith('chip_')) {
    return {
      ...next,
      upgradeUnlocks: pushUnique(uniqueStrings(next.upgradeUnlocks), itemId)
    } as T
  }

  return {
    ...next,
    weaponsUnlocked: pushUnique(uniqueStrings(next.weaponsUnlocked), itemId)
  } as T
}

export function drainPendingConsumable<T extends ProgressionSaveLike>(
  save: T
): { nextSave: T; item: PendingProgressionItem | null } {
  const next = ensureProgressionState(save)
  const queue = clonePendingItems(next.pendingProgressionItems)
  const item = queue.shift() ?? null
  return {
    nextSave: {
      ...next,
      pendingProgressionItems: queue
    } as T,
    item
  }
}

export function exportProgressionTransport(save: ProgressionSaveLike): ProgressionTransportPayload {
  const next = ensureProgressionState(save)
  const checkedLocations = uniqueStrings(next.collectedChecks) as LocationCheckId[]
  const receivedItems = checkedLocations
    .map((locationId) => next.progressionWorld?.placements?.[locationId])
    .filter((itemId): itemId is ProgressionItemId => Boolean(itemId))
  return {
    version: 1,
    slotData: {
      seed: String(next.progressionWorld?.seed ?? ''),
      startingStageIds: [...(next.progressionWorld?.startingStageIds ?? [])],
      weaknessStrictness: next.progressionWorld?.weaknessStrictness ?? 'weakness_and_buster',
      finalGate: {
        rules: [...(next.progressionWorld?.finalGate.rules ?? [])]
      }
    },
    checkedLocations,
    receivedItems,
    checkpoints: { ...(next.unlockedCheckpoints ?? {}) }
  }
}

export function serializeProgressionTransport(payload: ProgressionTransportPayload): string {
  return JSON.stringify(payload, null, 2)
}

export function parseProgressionTransport(raw: string): ProgressionTransportPayload {
  if (raw.length > MAX_TRANSPORT_BYTES) {
    throw new Error('Progression snapshot is too large.')
  }

  const parsed = JSON.parse(raw) as Partial<ProgressionTransportPayload> | null
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Progression snapshot must be a JSON object.')
  }

  if (Number(parsed.version ?? 0) !== 1) {
    throw new Error('Unsupported progression snapshot version.')
  }

  const slotData = parsed.slotData
  if (!slotData || typeof slotData !== 'object') {
    throw new Error('Progression snapshot is missing slotData.')
  }

  const seed = String((slotData as { seed?: unknown }).seed ?? '').trim().slice(0, MAX_SEED_LENGTH)
  if (!seed) {
    throw new Error('Progression snapshot is missing a seed.')
  }

  const startingStageIds = uniqueAllowedStrings(
    (slotData as { startingStageIds?: unknown }).startingStageIds,
    VALID_CAMPAIGN_STAGE_IDS
  )
  if (startingStageIds.length === 0) {
    startingStageIds.push(TUTORIAL_STAGE_ID)
  }
  const strictnessValue = String((slotData as { weaknessStrictness?: unknown }).weaknessStrictness ?? '')
  const weaknessStrictness: WeaknessStrictness =
    strictnessValue === 'permissive' ||
    strictnessValue === 'weakness_and_buster' ||
    strictnessValue === 'upgraded_buster_only' ||
    strictnessValue === 'only_weakness'
      ? strictnessValue
      : 'weakness_and_buster'

  const rawRules = Array.isArray((slotData as { finalGate?: { rules?: unknown } }).finalGate?.rules)
    ? ((slotData as { finalGate?: { rules?: unknown[] } }).finalGate?.rules ?? [])
    : []

  const allowedGateCategories = new Set<FinalGateCategory>([
    'medals',
    'weapons',
    'armorUpgrades',
    'heartTanks',
    'subTanks'
  ])

  const finalGateRules = rawRules
    .map((rule) => {
      if (!rule || typeof rule !== 'object') {
        return null
      }
      const category = String((rule as { category?: unknown }).category ?? '') as FinalGateCategory
      const required = Math.max(
        0,
        Math.min(MAX_GATE_RULE_REQUIREMENT, Number((rule as { required?: unknown }).required ?? 0))
      )
      if (!allowedGateCategories.has(category)) {
        return null
      }
      return { category, required }
    })
    .filter((rule): rule is { category: FinalGateCategory; required: number } => Boolean(rule))

  const checkpoints = sanitizeCheckpointMap(parsed.checkpoints)

  return {
    version: 1,
    slotData: {
      seed,
      startingStageIds: startingStageIds as any,
      weaknessStrictness,
      finalGate: {
        rules: finalGateRules
      }
    },
    checkedLocations: uniqueAllowedStrings(parsed.checkedLocations, VALID_LOCATION_IDS) as LocationCheckId[],
    receivedItems: allowedStringsPreservingDuplicates(
      parsed.receivedItems,
      VALID_PROGRESSION_ITEM_IDS,
      PROGRESSION_LOCATIONS.length
    ) as ProgressionItemId[],
    checkpoints
  }
}

function sanitizeProgressionTransportPayload(payload: ProgressionTransportPayload): ProgressionTransportPayload {
  return parseProgressionTransport(serializeProgressionTransport(payload))
}

export function importProgressionTransport<T extends ProgressionSaveLike>(
  save: T,
  payload: ProgressionTransportPayload
): T {
  payload = sanitizeProgressionTransportPayload(payload)
  const generatedWorld = generateProgressionWorld(payload.slotData.seed)
  let next = ensureProgressionState({
    ...save,
    weaponsUnlocked: [],
    clearedBosses: [],
    tutorialCleared: false,
    finalBossCleared: false,
    gameCompleted: false,
    progressionWorld: {
      ...generatedWorld,
      startingStageIds: [...payload.slotData.startingStageIds],
      weaknessStrictness: payload.slotData.weaknessStrictness,
      finalGate: { rules: [...payload.slotData.finalGate.rules] }
    },
    stageAccessUnlocked: [],
    collectedChecks: [...payload.checkedLocations],
    unlockedCheckpoints: { ...(payload.checkpoints ?? {}) },
    selectedCheckpointByStage: {},
    upgradeUnlocks: [],
    heartTanks: 0,
    subTanks: 0,
    pendingProgressionItems: []
  } as T)

  for (const itemId of payload.receivedItems) {
    next = applyProgressionItem(next, itemId)
  }

  return ensureProgressionState(next) as T
}

export function resolveBossDamageMultiplier(options: {
  strictness: WeaknessStrictness
  profile: BossWeaknessProfile | null
  weaponId: string
  chargeLevel: number
  hasArmsUpgrade: boolean
}): number {
  const { strictness, profile, weaponId, chargeLevel, hasArmsUpgrade } = options
  const weaknessMatch = Boolean(profile?.weaknessWeaponIds.includes(weaponId as any))
  const isBuster = weaponId === 'Buster'
  const upgradedBusterUsable = isBuster && chargeLevel > 0 && hasArmsUpgrade

  if (strictness === 'permissive') {
    return weaknessMatch ? 1.75 : 1
  }
  if (strictness === 'weakness_and_buster') {
    if (weaknessMatch) {
      return 1.75
    }
    return isBuster ? 1 : 0
  }
  if (strictness === 'upgraded_buster_only') {
    if (weaknessMatch) {
      return 1.75
    }
    return upgradedBusterUsable ? 1 : 0
  }
  return weaknessMatch ? 1.75 : 0
}

export function getBossWeaknessProfile(save: ProgressionSaveLike, bossId: string): BossWeaknessProfile | null {
  const next = ensureProgressionState(save)
  return next.progressionWorld?.weaknessProfiles?.[bossId] ?? null
}

export function getWeaknessStrictness(save: ProgressionSaveLike): WeaknessStrictness {
  return ensureProgressionState(save).progressionWorld?.weaknessStrictness ?? 'weakness_and_buster'
}

export function getConsumableAmount(itemId: ProgressionConsumableId): number {
  return HP_ITEM_AMOUNT[itemId] ?? 0
}

export function getPlayerMaxHpFromSave(save: ProgressionSaveLike): number {
  const next = ensureProgressionState(save)
  const baseHp = 8
  const heartBonus = Math.max(0, Math.min(8, Number(next.heartTanks ?? 0))) * 2
  const bodyBonus = uniqueStrings(next.upgradeUnlocks).includes('armor_body') ? 2 : 0
  return baseHp + heartBonus + bodyBonus
}

export function getBusterDamageBonus(save: ProgressionSaveLike): number {
  return ensureProgressionState(save).upgradeUnlocks?.includes('chip_buster_plus') ? 1 : 0
}

export function getWeaponDamageBonus(save: ProgressionSaveLike): number {
  return ensureProgressionState(save).upgradeUnlocks?.includes('chip_weapon_plus') ? 1 : 0
}

export function getChargeTimeMultiplier(save: ProgressionSaveLike): number {
  return ensureProgressionState(save).upgradeUnlocks?.includes('chip_quick_charge') ? 0.75 : 1
}

export function getMovementSpeedMultiplier(save: ProgressionSaveLike): number {
  return ensureProgressionState(save).upgradeUnlocks?.includes('chip_speedster') ? 1.15 : 1
}

export function getWeaponMaxEnergy(weaponId: string): number {
  return getWeaponConfig(weaponId).maxEnergy
}
