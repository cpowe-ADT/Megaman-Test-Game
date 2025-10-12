// [REGION: SAVE-SYSTEM - BEGIN]
export type SaveData = {
  weaponsUnlocked: string[]
  gameOverCounts: Record<string, number>
}

const KEY = 'save.v1'
const FALLBACK: SaveData = { weaponsUnlocked: [], gameOverCounts: {} }

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
      weaponsUnlocked: Array.isArray(parsed.weaponsUnlocked) ? [...parsed.weaponsUnlocked] : [],
      gameOverCounts: parsed.gameOverCounts ? { ...parsed.gameOverCounts } : {}
    }
  } catch (error) {
    console.warn('Failed to parse save data', error)
    return { ...FALLBACK }
  }
}

const persist = (data: SaveData): void => {
  const storage = getStorage()
  memoryCache = { ...data }
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
      weaponsUnlocked: [...data.weaponsUnlocked],
      gameOverCounts: { ...data.gameOverCounts }
    })
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
  }
}
// [REGION: SAVE-SYSTEM - END]
