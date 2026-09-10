import {
  createFreshProgressionState,
  ensureProgressionState,
  evaluateFinalGate,
  exportProgressionTransport,
  importProgressionTransport,
  markCheckpointUnlocked,
  setSelectedCheckpoint,
  getPlayerMaxHpFromSave,
  getWeaponMaxEnergy,
  type PendingProgressionItem,
  type ProgressionTransportPayload,
  type ProgressionWorldSnapshot
} from '../progression/index'
import { freshStatistics, normalizeStatistics, type CampaignStatistics } from '../progression/statistics'
import type { Difficulty, ProgressionMode } from '../progression/types'
import { CAMPAIGN_STAGES, type CampaignStageId } from '../content/campaign'
import { buildWeaponOrder } from '../content/weapons'
import { DIALOGUE_REGISTRY } from '../content/dialogue/index'
import { markStorySeen, sanitizeStoryFlags } from '../narrative/storyFlags'
import { normalizeSubTankFill } from './subTanks'

// [REGION: SAVE-SYSTEM - BEGIN]
export type SaveData = {
  difficulty: Difficulty
  stats: CampaignStatistics
  storyFlags: string[]
  /** 0 to 1 fill per owned sub tank; length always equals `subTanks`. */
  subTankFill: number[]
  weaponsUnlocked: string[]
  gameOverCounts: Record<string, number>
  clearedBosses: string[]
  tutorialCleared: boolean
  finalBossCleared: boolean
  gameCompleted: boolean
  progressionWorld: ProgressionWorldSnapshot | null
  stageAccessUnlocked: string[]
  collectedChecks: string[]
  unlockedCheckpoints: Record<string, string[]>
  selectedCheckpointByStage: Record<string, string>
  upgradeUnlocks: string[]
  heartTanks: number
  subTanks: number
  pendingProgressionItems: PendingProgressionItem[]
  activeRun?: ActiveRunSaveData | null
}

export type ActiveRunSaveData = {
  version: 2
  stageElapsedMs?: number
  savedAt: number
  stageId: string
  bossId: string
  playerHp: number
  playerMaxHp: number
  playerLives: number
  currentWeaponIndex: number
  currentWeaponId?: string
  weaponEnergyById?: Record<string, number>
  checkpointIndex?: number
  checkpointId?: string
}

export type ActiveRunValidationReason =
  | 'missing_run'
  | 'invalid_version'
  | 'invalid_stage'
  | 'boss_stage_mismatch'

export type ActiveRunValidationResult =
  | { valid: true; run: ActiveRunSaveData; reason: null }
  | { valid: false; run: null; reason: ActiveRunValidationReason }

const KEY = 'save.v1'
const FALLBACK_PROGRESSION = createFreshProgressionState('classic', 'classic')
const FALLBACK: SaveData = {
  difficulty: 'normal', stats: freshStatistics(), storyFlags: [], subTankFill: [],
  weaponsUnlocked: [],
  gameOverCounts: {},
  clearedBosses: [],
  tutorialCleared: false,
  finalBossCleared: false,
  gameCompleted: false,
  progressionWorld: FALLBACK_PROGRESSION.progressionWorld ?? null,
  stageAccessUnlocked: [...(FALLBACK_PROGRESSION.stageAccessUnlocked ?? [])],
  collectedChecks: [...(FALLBACK_PROGRESSION.collectedChecks ?? [])],
  unlockedCheckpoints: { ...FALLBACK_PROGRESSION.unlockedCheckpoints },
  selectedCheckpointByStage: { ...FALLBACK_PROGRESSION.selectedCheckpointByStage },
  upgradeUnlocks: [...(FALLBACK_PROGRESSION.upgradeUnlocks ?? [])],
  heartTanks: FALLBACK_PROGRESSION.heartTanks ?? 0,
  subTanks: FALLBACK_PROGRESSION.subTanks ?? 0,
  pendingProgressionItems: [...(FALLBACK_PROGRESSION.pendingProgressionItems ?? [])],
  activeRun: null
}

const getStorage = (): Storage | null => {
  try {
    if (typeof window !== 'undefined' && 'localStorage' in window) {
      return window.localStorage
    }
  } catch (error) {
    console.warn('Save storage unavailable', error)
  }
  return null
}

let memoryCache: SaveData | null = null

const uniqueStrings = (values: unknown): string[] =>
  Array.isArray(values)
    ? values
        .map((value) => (typeof value === 'string' ? value : ''))
        .filter((value, index, array) => value.length > 0 && array.indexOf(value) === index)
    : []

function clonePending(values: unknown): PendingProgressionItem[] {
  if (!Array.isArray(values)) {
    return []
  }
  return values
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }
      return {
        itemId: String((entry as { itemId?: string }).itemId ?? '') as PendingProgressionItem['itemId'],
        amount: Number((entry as { amount?: number }).amount ?? 0)
      }
    })
    .filter((entry): entry is PendingProgressionItem => entry != null && Boolean(entry.itemId) && entry.amount > 0)
}

function cloneActiveRun(run: ActiveRunSaveData | null | undefined): ActiveRunSaveData | null {
  if (!run) {
    return null
  }
  return {
    version: 2,
    stageElapsedMs: Math.max(0, finiteNumber(run.stageElapsedMs, 0)),
    savedAt: Number(run.savedAt ?? Date.now()),
    stageId: String(run.stageId ?? ''),
    bossId: String(run.bossId ?? ''),
    playerHp: Number(run.playerHp ?? 0),
    playerMaxHp: Number(run.playerMaxHp ?? 0),
    playerLives: Number(run.playerLives ?? 0),
    currentWeaponIndex: Number(run.currentWeaponIndex ?? 0),
    currentWeaponId:
      typeof run.currentWeaponId === 'string' && run.currentWeaponId.length > 0
        ? run.currentWeaponId
        : undefined,
    checkpointIndex: Number(run.checkpointIndex ?? 0),
    checkpointId:
      typeof run.checkpointId === 'string' && run.checkpointId.length > 0 ? run.checkpointId : undefined,
    weaponEnergyById:
      run.weaponEnergyById && typeof run.weaponEnergyById === 'object'
        ? Object.fromEntries(
            Object.entries(run.weaponEnergyById).map(([weaponId, energy]) => [
              String(weaponId),
              Number(energy ?? 0)
            ])
          )
        : {}
  }
}

function finiteNumber(value: unknown, fallback: number): number {
  const numeric = Number(value)
  return Number.isFinite(numeric) ? numeric : fallback
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  return Math.max(min, Math.min(max, Math.round(finiteNumber(value, fallback))))
}

export function validateActiveRun(save: SaveData, raw: unknown): ActiveRunValidationResult {
  if (!raw || typeof raw !== 'object') {
    return { valid: false, run: null, reason: 'missing_run' }
  }

  const candidate = raw as Partial<ActiveRunSaveData>
  if (Number(candidate.version) !== 2) {
    return { valid: false, run: null, reason: 'invalid_version' }
  }

  const stageId = typeof candidate.stageId === 'string' ? candidate.stageId : ''
  if (!Object.prototype.hasOwnProperty.call(CAMPAIGN_STAGES, stageId)) {
    return { valid: false, run: null, reason: 'invalid_stage' }
  }

  const stage = CAMPAIGN_STAGES[stageId as CampaignStageId]
  const candidateBossId =
    stageId === 'omega_fortress' && candidate.bossId === 'volt_hopper'
      ? 'omega_core'
      : candidate.bossId
  if (candidateBossId !== stage.bossId) {
    return { valid: false, run: null, reason: 'boss_stage_mismatch' }
  }

  const playerMaxHp = getPlayerMaxHpFromSave(save)
  const weaponOrder = buildWeaponOrder(save.weaponsUnlocked)
  const rawWeaponIndex = clampInteger(candidate.currentWeaponIndex, 0, weaponOrder.length - 1, 0)
  const requestedWeaponId = typeof candidate.currentWeaponId === 'string' ? candidate.currentWeaponId : null
  const currentWeaponId =
    requestedWeaponId && weaponOrder.includes(requestedWeaponId as any)
      ? requestedWeaponId
      : requestedWeaponId
        ? 'Buster'
        : weaponOrder[rawWeaponIndex] ?? 'Buster'
  const currentWeaponIndex = Math.max(0, weaponOrder.indexOf(currentWeaponId as any))

  const rawEnergy =
    candidate.weaponEnergyById && typeof candidate.weaponEnergyById === 'object'
      ? candidate.weaponEnergyById
      : {}
  const weaponEnergyById = Object.fromEntries(
    weaponOrder.map((weaponId) => {
      const maxEnergy = getWeaponMaxEnergy(weaponId)
      return [weaponId, clampInteger(rawEnergy[weaponId], 0, maxEnergy, maxEnergy)]
    })
  )

  const checkpoints = stage.arena.checkpoints
  const requestedCheckpointId =
    typeof candidate.checkpointId === 'string' && checkpoints.some((entry) => entry.id === candidate.checkpointId)
      ? candidate.checkpointId
      : null
  const checkpointIndexFromId = requestedCheckpointId
    ? checkpoints.findIndex((entry) => entry.id === requestedCheckpointId)
    : -1
  const checkpointIndex =
    checkpointIndexFromId >= 0
      ? checkpointIndexFromId
      : typeof candidate.checkpointId === 'string'
        ? 0
        : clampInteger(candidate.checkpointIndex, 0, Math.max(0, checkpoints.length - 1), 0)
  const checkpointId = checkpoints[checkpointIndex]?.id

  return {
    valid: true,
    reason: null,
    run: {
      version: 2,
      stageElapsedMs: Math.max(0, finiteNumber(candidate.stageElapsedMs, 0)),
      savedAt: Math.max(0, Math.round(finiteNumber(candidate.savedAt, 0))),
      stageId: stage.id,
      bossId: stage.bossId,
      playerHp: finiteNumber(candidate.playerHp, playerMaxHp) > 0 ? Math.min(playerMaxHp, finiteNumber(candidate.playerHp, playerMaxHp)) : 1,
      playerMaxHp,
      playerLives: clampInteger(candidate.playerLives, 0, 9, 3),
      currentWeaponIndex,
      currentWeaponId,
      weaponEnergyById,
      checkpointIndex,
      checkpointId
    }
  }
}

function normalize(data: SaveData): SaveData {
  const normalizedProgression = ensureProgressionState({
    difficulty: (data.difficulty === 'assist' || data.difficulty === 'veteran' ? data.difficulty : 'normal') as Difficulty,
    stats: normalizeStatistics(data.stats),
    storyFlags: uniqueStrings(data.storyFlags).filter(id => id.length <= 120).slice(0, 512),
    subTankFill: normalizeSubTankFill(data.subTankFill, Number(data.subTanks ?? 0)),
    weaponsUnlocked: uniqueStrings(data.weaponsUnlocked),
    gameOverCounts: data.gameOverCounts ? { ...data.gameOverCounts } : {},
    clearedBosses: uniqueStrings(data.clearedBosses),
    tutorialCleared: Boolean(data.tutorialCleared),
    finalBossCleared: Boolean(data.finalBossCleared),
    gameCompleted: Boolean(data.gameCompleted),
    progressionWorld: data.progressionWorld ?? null,
    stageAccessUnlocked: uniqueStrings(data.stageAccessUnlocked),
    collectedChecks: uniqueStrings(data.collectedChecks),
    unlockedCheckpoints:
      data.unlockedCheckpoints && typeof data.unlockedCheckpoints === 'object'
        ? Object.fromEntries(
            Object.entries(data.unlockedCheckpoints).map(([stageId, checkpointIds]) => [
              String(stageId),
              uniqueStrings(checkpointIds)
            ])
          )
        : {},
    selectedCheckpointByStage:
      data.selectedCheckpointByStage && typeof data.selectedCheckpointByStage === 'object'
        ? Object.fromEntries(
            Object.entries(data.selectedCheckpointByStage).map(([stageId, checkpointId]) => [
              String(stageId),
              String(checkpointId ?? '')
            ])
          )
        : {},
    upgradeUnlocks: uniqueStrings(data.upgradeUnlocks),
    heartTanks: Number(data.heartTanks ?? 0),
    subTanks: Number(data.subTanks ?? 0),
    pendingProgressionItems: clonePending(data.pendingProgressionItems),
    activeRun: null
  })
  const activeRun = validateActiveRun(normalizedProgression, data.activeRun)
  return {
    ...normalizedProgression,
    subTankFill: normalizeSubTankFill(data.subTankFill, Number(normalizedProgression.subTanks ?? 0)),
    activeRun: activeRun.valid ? activeRun.run : null
  }
}

const read = (): SaveData => {
  const storage = getStorage()
  if (!storage) {
    return normalize(memoryCache ? { ...memoryCache } : { ...FALLBACK })
  }

  try {
    const raw = storage.getItem(KEY)
    if (!raw) {
      return normalize({ ...FALLBACK })
    }
    const parsed = JSON.parse(raw) as SaveData
    const normalized = normalize(parsed)
    if (parsed.activeRun && !normalized.activeRun) {
      try {
        storage.setItem(KEY, JSON.stringify(normalized))
      } catch (error) {
        console.warn('Failed to clear invalid active run', error)
      }
    }
    return normalized
  } catch (error) {
    console.warn('Failed to parse save data', error)
    return normalize({ ...FALLBACK })
  }
}

const persist = (data: SaveData): void => {
  const normalized = normalize(data)
  const storage = getStorage()
  memoryCache = normalized
  if (!storage) {
    return
  }
  try {
    storage.setItem(KEY, JSON.stringify(normalized))
  } catch (error) {
    console.warn('Failed to write save data', error)
  }
}

export const Save = {
  load(): SaveData {
    return read()
  },
  exists(): boolean {
    const storage = getStorage()
    try { return storage ? storage.getItem(KEY) != null : memoryCache != null } catch { return memoryCache != null }
  },
  save(data: Omit<SaveData, 'difficulty' | 'stats' | 'storyFlags' | 'subTankFill'> & Partial<Pick<SaveData, 'difficulty' | 'stats' | 'storyFlags' | 'subTankFill'>>): void {
    persist(data as SaveData)
  },
  saveActiveRun(run: ActiveRunSaveData): boolean {
    const state = read()
    const validation = validateActiveRun(state, run)
    state.activeRun = validation.valid ? validation.run : null
    persist(state)
    return validation.valid
  },
  loadActiveRun(): ActiveRunSaveData | null {
    return cloneActiveRun(read().activeRun)
  },
  clearActiveRun(): void {
    if (!Save.exists()) return
    const state = read()
    state.activeRun = null
    persist(state)
  },
  hasActiveRun(): boolean {
    return Boolean(read().activeRun)
  },
  clearAll(): void {
    persist({ ...FALLBACK, ...createFreshProgressionState('classic', 'classic') })
  },
  startNewCampaign(options: { mode?: ProgressionMode; seed?: string; difficulty?: Difficulty } = {}): void {
    persist({ ...FALLBACK, stats: freshStatistics(), difficulty: options.difficulty ?? 'normal', ...createFreshProgressionState(options.seed ?? 'classic', options.mode ?? 'classic') })
  },
  addWeapon(weaponId: string): void {
    if (!weaponId) {
      return
    }
    const state = read()
    if (!state.weaponsUnlocked.includes(weaponId)) {
      state.weaponsUnlocked.push(weaponId)
    }
    persist(state)
  },
  addGameOver(stageId: string): void {
    if (!stageId) {
      return
    }
    const state = read()
    const next = (state.gameOverCounts[stageId] ?? 0) + 1
    state.gameOverCounts[stageId] = next
    persist(state)
  },
  markBossCleared(stageId: string): void {
    if (!stageId) {
      return
    }
    const state = read()
    if (!state.clearedBosses.includes(stageId)) {
      state.clearedBosses.push(stageId)
    }
    persist(state)
  },
  markTutorialCleared(): void {
    const state = read()
    state.tutorialCleared = true
    persist(state)
  },
  markFinalBossCleared(): void {
    const state = read()
    state.finalBossCleared = true
    persist(state)
  },
  markGameCompleted(): void {
    const state = read()
    state.gameCompleted = true
    persist(state)
  },
  isFinalRouteUnlocked(): boolean {
    return evaluateFinalGate(read()).unlocked
  },
  unlockCheckpoint(stageId: string, checkpointId: string): void {
    persist(markCheckpointUnlocked(read(), stageId, checkpointId))
  },
  setSelectedCheckpoint(stageId: string, checkpointId: string): void {
    persist(setSelectedCheckpoint(read(), stageId, checkpointId))
  },
  markStorySeen(...ids: string[]): void {
    const state = read()
    const next = markStorySeen(state.storyFlags, ...ids)
    if (next.length === state.storyFlags.length) return
    state.storyFlags = next
    persist(state)
  },
  setSubTankFill(fills: number[]): void {
    const state = read()
    state.subTankFill = normalizeSubTankFill(fills, state.subTanks)
    persist(state)
  },
  exportProgression(): ProgressionTransportPayload {
    return exportProgressionTransport(read())
  },
  importProgression(payload: ProgressionTransportPayload): void {
    const state = read()
    const imported = importProgressionTransport(state, payload)
    const storyFlags = sanitizeStoryFlags((payload as { storyFlags?: unknown }).storyFlags, DIALOGUE_REGISTRY.getRequiredStoryIds())
    persist({ ...imported, storyFlags, activeRun: null, stats: freshStatistics() })
  }
}
// [REGION: SAVE-SYSTEM - END]
