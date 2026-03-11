import { isFinalRouteUnlocked as computeFinalRouteUnlocked } from '../content/campaign'

// [REGION: SAVE-SYSTEM - BEGIN]
export type SaveData = {
  weaponsUnlocked: string[]
  gameOverCounts: Record<string, number>
  clearedBosses: string[]
  tutorialCleared: boolean
  finalBossCleared: boolean
  gameCompleted: boolean
  activeRun?: ActiveRunSaveData | null
}

export type ActiveRunSaveData = {
  version: 2
  savedAt: number
  stageId: string
  bossId: string
  playerHp: number
  playerMaxHp: number
  playerLives: number
  currentWeaponIndex: number
  currentWeaponId?: string
  weaponEnergyById?: Record<string, number>
}

const KEY = 'save.v1'
const FALLBACK: SaveData = {
  weaponsUnlocked: [],
  gameOverCounts: {},
  clearedBosses: [],
  tutorialCleared: false,
  finalBossCleared: false,
  gameCompleted: false,
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

function cloneActiveRun(run: ActiveRunSaveData | null | undefined): ActiveRunSaveData | null {
  if (!run) {
    return null
  }
  return {
    version: 2,
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

const read = (): SaveData => {
  const storage = getStorage()
  if (!storage) {
    return memoryCache ? { ...memoryCache } : { ...FALLBACK }
  }

  try {
    const raw = storage.getItem(KEY)
    if (!raw) {
      return { ...FALLBACK }
    }
    const parsed = JSON.parse(raw) as SaveData
    return {
      weaponsUnlocked: uniqueStrings(parsed.weaponsUnlocked),
      gameOverCounts: parsed.gameOverCounts ? { ...parsed.gameOverCounts } : {},
      clearedBosses: uniqueStrings(parsed.clearedBosses),
      tutorialCleared: Boolean(parsed.tutorialCleared),
      finalBossCleared: Boolean(parsed.finalBossCleared),
      gameCompleted: Boolean(parsed.gameCompleted),
      activeRun: cloneActiveRun(parsed.activeRun)
    }
  } catch (error) {
    console.warn('Failed to parse save data', error)
    return { ...FALLBACK }
  }
}

const persist = (data: SaveData): void => {
  const storage = getStorage()
  memoryCache = {
    weaponsUnlocked: uniqueStrings(data.weaponsUnlocked),
    gameOverCounts: { ...data.gameOverCounts },
    clearedBosses: uniqueStrings(data.clearedBosses),
    tutorialCleared: Boolean(data.tutorialCleared),
    finalBossCleared: Boolean(data.finalBossCleared),
    gameCompleted: Boolean(data.gameCompleted),
    activeRun: cloneActiveRun(data.activeRun)
  }
  if (!storage) {
    return
  }
  try {
    storage.setItem(KEY, JSON.stringify(data))
  } catch (error) {
    console.warn('Failed to write save data', error)
  }
}

export const Save = {
  load(): SaveData {
    return read()
  },
  save(data: SaveData): void {
    persist({
      weaponsUnlocked: uniqueStrings(data.weaponsUnlocked),
      gameOverCounts: { ...data.gameOverCounts },
      clearedBosses: uniqueStrings(data.clearedBosses),
      tutorialCleared: Boolean(data.tutorialCleared),
      finalBossCleared: Boolean(data.finalBossCleared),
      gameCompleted: Boolean(data.gameCompleted),
      activeRun: cloneActiveRun(data.activeRun)
    })
  },
  saveActiveRun(run: ActiveRunSaveData): void {
    const state = read()
    state.activeRun = cloneActiveRun(run)
    persist(state)
  },
  loadActiveRun(): ActiveRunSaveData | null {
    const state = read()
    return cloneActiveRun(state.activeRun)
  },
  clearActiveRun(): void {
    const state = read()
    state.activeRun = null
    persist(state)
  },
  hasActiveRun(): boolean {
    return Boolean(read().activeRun)
  },
  clearAll(): void {
    persist({ ...FALLBACK })
  },
  startNewCampaign(): void {
    persist({ ...FALLBACK })
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
    const state = read()
    return computeFinalRouteUnlocked(state)
  }
}
// [REGION: SAVE-SYSTEM - END]
