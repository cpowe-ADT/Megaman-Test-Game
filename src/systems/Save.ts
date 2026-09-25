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
import { IDENTITY, setHeroCallsignResolver } from '../content/identity'
import {
  buildProfileExport,
  DEFAULT_PILOT_NAME,
  exportFileName,
  isProfileSlot,
  loadProfiles,
  newProfileMeta,
  parseProfileExport,
  PROFILE_SLOTS,
  PROFILES_KEY,
  recordStageBest,
  serializeProfiles,
  slotSaveKey,
  summarizeSlot,
  validatePilotName,
  withSlot,
  withoutSlot,
  type LegacySaveHint,
  type ProfileMeta,
  type ProfileSlot,
  type ProfilesState,
  type SlotSummary,
  type StageRunResult
} from '../progression/profiles'

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

/** The active profile slot's key: slot 1 is the legacy `save.v1`, so every older save still loads. */
const activeKey = (): string => slotSaveKey(profilesState().activeSlot)
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

/** Per slot key, so switching profiles never serves another slot's campaign (the 5.6 memo's risk). */
const memoryCaches = new Map<string, SaveData>()

/**
 * The save shape version (EVAL-P12-002). Saves written before the field existed are dated by their
 * fields, one shape per era found in git history, and walked forward one step at a time, so an old
 * save loads instead of being dropped. A save from a newer build loads with the fields this build knows.
 */
export const SAVE_VERSION = 5
type RawSave = Record<string, unknown>
const SAVE_MIGRATIONS: ReadonlyArray<{ to: number; note: string; apply: (save: RawSave) => RawSave }> = [
  // v1 (cd18309): weapons and game-over counts only.
  { to: 2, note: 'boss clears, completion flags, the active run slot', apply: (save) => ({ clearedBosses: [], tutorialCleared: false, finalBossCleared: false, gameCompleted: false, activeRun: null, ...save }) },
  // v2 (34bde56): no progression world yet; the loader builds the default world, as it always has.
  { to: 3, note: 'progression world, checks, checkpoints, upgrades, tanks', apply: (save) => ({ progressionWorld: null, stageAccessUnlocked: [], collectedChecks: [], unlockedCheckpoints: {}, selectedCheckpointByStage: {}, upgradeUnlocks: [], heartTanks: 0, subTanks: 0, pendingProgressionItems: [], ...save }) },
  // v3 (35a1fba): progression without difficulty, statistics or story flags.
  { to: 4, note: 'difficulty, statistics, story flags', apply: (save) => ({ difficulty: 'normal', stats: freshStatistics(), storyFlags: [], ...save }) },
  // v4 (475ab82): sub tanks without a stored fill.
  { to: 5, note: 'sub tank fill', apply: (save) => ({ ...save, subTankFill: normalizeSubTankFill(save.subTankFill, Number(save.subTanks ?? 0)) }) }
]

export function detectSaveVersion(save: RawSave): number {
  const stamped = Number(save.saveVersion)
  if (Number.isInteger(stamped) && stamped >= 1) return stamped
  if (Array.isArray(save.subTankFill)) return 5
  if ('difficulty' in save || 'stats' in save || Array.isArray(save.storyFlags)) return 4
  if ('progressionWorld' in save || Array.isArray(save.collectedChecks) || Array.isArray(save.stageAccessUnlocked)) return 3
  if ('clearedBosses' in save || 'tutorialCleared' in save || 'activeRun' in save) return 2
  return 1
}

/** Pure: upgrades a parsed `save.v1` value to the current shape; `normalize` then sanitizes it. */
export function migrateSave(raw: unknown): { save: RawSave; from: number; to: number; steps: string[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return { save: {}, from: 0, to: SAVE_VERSION, steps: [] }
  const from = detectSaveVersion(raw as RawSave)
  let save: RawSave = { ...(raw as RawSave) }
  const steps: string[] = []
  for (const step of SAVE_MIGRATIONS) {
    if (step.to <= from) continue
    save = step.apply(save)
    steps.push(`v${step.to - 1}->v${step.to}: ${step.note}`)
  }
  // An active run written without a version predates the version field; its fields are the v2 fields.
  const run = save.activeRun as RawSave | null | undefined
  if (run && typeof run === 'object' && (run.version === undefined || Number(run.version) === 1)) {
    save.activeRun = { ...run, version: 2 }
    steps.push('active run: unversioned -> v2')
  }
  delete save.saveVersion
  return { save, from, to: Math.max(from, SAVE_VERSION), steps }
}

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

const readKey = (key: string): SaveData => {
  const storage = getStorage()
  if (!storage) {
    const cached = memoryCaches.get(key)
    return normalize(cached ? { ...cached } : { ...FALLBACK })
  }

  try {
    const raw = storage.getItem(key)
    if (!raw) {
      return normalize({ ...FALLBACK })
    }
    const parsed = migrateSave(JSON.parse(raw)).save as unknown as SaveData
    const normalized = normalize(parsed)
    if (parsed.activeRun && !normalized.activeRun) {
      try {
        storage.setItem(key, JSON.stringify({ ...normalized, saveVersion: SAVE_VERSION }))
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
const read = (): SaveData => readKey(activeKey())

const persistKey = (key: string, data: SaveData): void => {
  const normalized = normalize(data)
  const storage = getStorage()
  memoryCaches.set(key, normalized)
  if (!storage) {
    return
  }
  try {
    storage.setItem(key, JSON.stringify({ ...normalized, saveVersion: SAVE_VERSION }))
  } catch (error) {
    console.warn('Failed to write save data', error)
  }
}
const persist = (data: SaveData): void => persistKey(activeKey(), data)

function importedState(state: SaveData, payload: ProgressionTransportPayload): SaveData {
  const imported = importProgressionTransport(state, payload)
  const storyFlags = sanitizeStoryFlags((payload as { storyFlags?: unknown }).storyFlags, DIALOGUE_REGISTRY.getRequiredStoryIds())
  return { ...imported, storyFlags, activeRun: null, stats: freshStatistics() }
}

export const Save = {
  load(): SaveData {
    return read()
  },
  exists(): boolean {
    const storage = getStorage()
    const key = activeKey()
    try { return storage ? storage.getItem(key) != null : memoryCaches.has(key) } catch { return memoryCaches.has(key) }
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
  /** Removes the active slot's campaign and pilot, so the slot is EMPTY and its next launch is a first launch. */
  deleteAll(): void {
    const slot = profilesState().activeSlot
    removeSlotSave(slot)
    if (profilesState().slots[slot]) writeProfiles(withoutSlot(profilesState(), slot))
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
    persist(importedState(read(), payload))
  }
}
// [REGION: SAVE-SYSTEM - END]

// [REGION: PROFILES - BEGIN] Three pilot slots (prompt 05 5.6, EVAL-P5-008); pure rules in progression/profiles.
const WARDEN_IDS = Object.keys(IDENTITY.WARDEN_NAMES)
let profilesCache: ProfilesState | null = null
let pendingProfile: { slot: ProfileSlot; pilotName: string } | null = null

function readStorageText(key: string): string | null {
  const storage = getStorage()
  try { return storage ? storage.getItem(key) : null } catch { return null }
}

type SlotSaveHint = LegacySaveHint & { difficulty?: string; stats?: { playTimeMs?: number } }
function rawSlotSave(slot: ProfileSlot): SlotSaveHint | null {
  const key = slotSaveKey(slot)
  if (!getStorage()) return memoryCaches.get(key) ?? null
  const text = readStorageText(key)
  if (!text) return null
  try {
    const parsed = JSON.parse(text) as unknown
    return parsed && typeof parsed === 'object' ? (parsed as SlotSaveHint) : null
  } catch {
    return null
  }
}

function profilesState(): ProfilesState {
  if (!profilesCache) profilesCache = loadProfiles(readStorageText(PROFILES_KEY), rawSlotSave(1), Date.now())
  return profilesCache
}

function writeProfiles(next: ProfilesState): ProfilesState {
  profilesCache = next
  try { getStorage()?.setItem(PROFILES_KEY, serializeProfiles(next)) } catch (error) { console.warn('Failed to write profiles', error) }
  return next
}

function removeSlotSave(slot: ProfileSlot): void {
  const key = slotSaveKey(slot)
  memoryCaches.delete(key)
  try { getStorage()?.removeItem(key) } catch (error) { console.warn('Failed to delete save data', error) }
}

function activeMeta(): ProfileMeta | undefined {
  const state = profilesState()
  return state.slots[state.activeSlot]
}

function updateActive(change: (meta: ProfileMeta) => ProfileMeta): void {
  const state = profilesState()
  writeProfiles(withSlot(state, change(state.slots[state.activeSlot] ?? newProfileMeta(state.activeSlot, DEFAULT_PILOT_NAME, Date.now()))))
}

function slotPlayTime(slot: ProfileSlot, meta: ProfileMeta | undefined): number {
  return Math.max(meta?.playTimeMs ?? 0, Number(rawSlotSave(slot)?.stats?.playTimeMs ?? 0) || 0)
}

function slotCard(slot: ProfileSlot): SlotSummary {
  const meta = profilesState().slots[slot]
  return summarizeSlot(slot, meta ? { ...meta, playTimeMs: slotPlayTime(slot, meta) } : undefined, rawSlotSave(slot), WARDEN_IDS)
}

// `{hero}` and the HUD label read the identity adapter, which asks the active profile (no Game code).
setHeroCallsignResolver(() => activeMeta()?.pilotName ?? null)

export type ProfileImportOutcome = { ok: true; pilotName: string } | { ok: false; reason: string }

export const Profiles = {
  activeSlot(): ProfileSlot {
    return profilesState().activeSlot
  },
  active(): ProfileMeta | undefined {
    return activeMeta()
  },
  /** The slot picker's three cards; wardens and play time come from each slot's own save. */
  cards(): SlotSummary[] {
    return PROFILE_SLOTS.map(slotCard)
  },
  /** LOAD on a used card: the slot becomes active and CONTINUE resumes it. */
  select(slot: ProfileSlot): void {
    writeProfiles({ ...profilesState(), activeSlot: slot })
  },
  /** Holds the named pilot until NEW CAMPAIGN starts; cancelling leaves the slot as it was. */
  beginNew(slot: ProfileSlot, pilotName: string): void {
    pendingProfile = { slot, pilotName }
  },
  cancelPending(): void {
    pendingProfile = null
  },
  pending(): { slot: ProfileSlot; pilotName: string } | null {
    return pendingProfile ? { ...pendingProfile } : null
  },
  /** NEW CAMPAIGN start: a pending pilot takes its slot (the old save there is removed); the campaign counts as started. */
  commitNewCampaign(): void {
    const now = Date.now()
    if (pendingProfile) {
      const { slot, pilotName } = pendingProfile
      pendingProfile = null
      removeSlotSave(slot)
      writeProfiles({ ...withSlot(profilesState(), { ...newProfileMeta(slot, pilotName, now), campaignStarted: true }), activeSlot: slot })
      return
    }
    updateActive((meta) => ({ ...meta, campaignStarted: true, lastPlayedAt: now }))
  },
  markControlsSeen(): void {
    updateActive((meta) => ({ ...meta, controlsSeen: true }))
  },
  /** CONTINUE: stamps the slot and folds the save's play time into the card. */
  touch(): void {
    const slot = profilesState().activeSlot
    if (activeMeta()) updateActive((meta) => ({ ...meta, lastPlayedAt: Date.now(), playTimeMs: slotPlayTime(slot, meta) }))
  },
  /** Written at stage results (prompt 08); the fields land here so 06 and 07 can write them. */
  recordStageBest(stageId: string, run: StageRunResult): void {
    updateActive((meta) => recordStageBest(meta, stageId, run))
  },
  exportSlot(slot: ProfileSlot): { fileName: string; text: string } | null {
    const meta = profilesState().slots[slot]
    if (!meta) return null
    const save = readKey(slotSaveKey(slot))
    const file = buildProfileExport({ ...meta, playTimeMs: slotPlayTime(slot, meta) }, exportProgressionTransport(save), save.difficulty)
    return { fileName: exportFileName(meta.pilotName), text: JSON.stringify(file, null, 2) }
  },
  /** Validated twice: the envelope in progression/profiles, the progression by the transport import. */
  importSlot(slot: ProfileSlot, text: string): ProfileImportOutcome {
    const parsed = parseProfileExport(text, slot, Date.now())
    if (!parsed.ok) return parsed
    const payload = parsed.progression as ProgressionTransportPayload
    const mode: ProgressionMode = payload.slotData?.progressionMode === 'classic' ? 'classic' : 'relay_randomizer'
    let next: SaveData
    try {
      const difficulty = (parsed.difficulty ?? 'normal') as Difficulty
      const base = normalize({ ...FALLBACK, stats: freshStatistics(), difficulty, ...createFreshProgressionState(mode === 'classic' ? 'classic' : String(payload.slotData?.seed ?? ''), mode) })
      next = importedState(base, payload)
    } catch (error) {
      return { ok: false, reason: error instanceof Error ? error.message : 'invalid progression' }
    }
    next.stats = { ...next.stats, playTimeMs: parsed.meta.playTimeMs }
    persistKey(slotSaveKey(slot), next)
    writeProfiles({ ...withSlot(profilesState(), parsed.meta), activeSlot: slot })
    return { ok: true, pilotName: parsed.meta.pilotName }
  },
  /** Automation (`stageDebug.setProfile`): makes `slot` active, creating or renaming its pilot. */
  debugSetProfile(options: { slot?: unknown; pilotName?: unknown } = {}): { ok: boolean; reason?: string } {
    if (!isProfileSlot(options.slot)) return { ok: false, reason: 'slot must be 1, 2 or 3' }
    const slot = options.slot
    const existing = profilesState().slots[slot]
    const checked = validatePilotName(options.pilotName ?? existing?.pilotName ?? DEFAULT_PILOT_NAME)
    if (!checked.ok) return { ok: false, reason: checked.reason }
    const meta = existing ? { ...existing, pilotName: checked.name } : { ...newProfileMeta(slot, checked.name, Date.now()), controlsSeen: true }
    writeProfiles({ ...withSlot(profilesState(), meta), activeSlot: slot })
    return { ok: true }
  },
  /** Payload `profiles` for `render_game_to_text`. */
  debugState(): { activeSlot: ProfileSlot; pending: { slot: ProfileSlot; pilotName: string } | null; active: Pick<ProfileMeta, 'pilotName' | 'campaignStarted' | 'controlsSeen'> | null; slots: SlotSummary[] } {
    const meta = activeMeta()
    return {
      activeSlot: profilesState().activeSlot,
      pending: pendingProfile ? { ...pendingProfile } : null,
      active: meta ? { pilotName: meta.pilotName, campaignStarted: meta.campaignStarted, controlsSeen: meta.controlsSeen } : null,
      slots: Profiles.cards()
    }
  }
}
// [REGION: PROFILES - END]
