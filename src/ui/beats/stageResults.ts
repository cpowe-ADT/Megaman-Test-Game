import { getStageLocationDefinitions } from '../../progression/catalog'

// Stage results (prompt 04 phase 4.2 item 5, part 12i, EVAL-P8-004): time, secrets found, lives used and difficulty,
// all derived from the save as the stage was entered and as it was cleared. No save field is added.

/** Results hold this long, then the victory return runs on its own (Enter returns at once). */
export const RESULTS_HOLD_MS = 4000

/** The save as the stage was entered: what the clear is compared against. */
export type StageEntrySnapshot = { collectedChecks: readonly string[]; deaths: number }

type SaveLike = {
  collectedChecks?: readonly string[]
  stats?: { deaths?: number }
  difficulty?: string
  progressionWorld?: { placements?: Readonly<Record<string, string | undefined>> } | null
}

export type StageResults = {
  stageId: string
  timeMs: number
  timeLabel: string
  /** Heart and sub tank checks of this stage collected between entry and clear. */
  secretsFound: number
  /** The stage's heart and sub tank checks (two per warden stage, none on the tutorial or the Core). */
  secretsTotal: number
  /** Deaths between entry and clear (the save's `stats.deaths` delta). */
  livesUsed: number
  difficulty: string
}

const count = (value: unknown): number => (typeof value === 'number' && Number.isFinite(value) ? Math.max(0, Math.floor(value)) : 0)

export function stageEntrySnapshot(save: SaveLike): StageEntrySnapshot {
  return { collectedChecks: [...(save.collectedChecks ?? [])], deaths: count(save.stats?.deaths) }
}

/** The stage's secret locations: its `heart_tank` and `sub_tank` checks. */
export function stageSecretLocationIds(stageId: string): string[] {
  return getStageLocationDefinitions(stageId)
    .filter((location) => location.category === 'heart_tank' || location.category === 'sub_tank')
    .map((location) => location.id)
}

/** `MM:SS.cc`; an hour or more reads as minutes past 59 (`75:02.40`). */
export function formatStageTime(ms: number): string {
  const centis = Math.floor(Math.max(0, Number.isFinite(ms) ? ms : 0) / 10)
  const minutes = Math.floor(centis / 6000)
  const seconds = Math.floor((centis % 6000) / 100)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(minutes)}:${pad(seconds)}.${pad(centis % 100)}`
}

export function computeStageResults(input: { stageId: string; entry: StageEntrySnapshot; clear: SaveLike; elapsedMs: number }): StageResults {
  const secrets = stageSecretLocationIds(input.stageId)
  const cleared = input.clear.collectedChecks ?? []
  const timeMs = Math.max(0, Number.isFinite(input.elapsedMs) ? input.elapsedMs : 0)
  return {
    stageId: input.stageId,
    timeMs: Math.round(timeMs),
    timeLabel: formatStageTime(timeMs),
    secretsFound: secrets.filter((id) => cleared.includes(id) && !input.entry.collectedChecks.includes(id)).length,
    secretsTotal: secrets.length,
    livesUsed: Math.max(0, count(input.clear.stats?.deaths) - input.entry.deaths),
    difficulty: String(input.clear.difficulty ?? 'normal').toUpperCase()
  }
}

/**
 * The item a first clear's claim gave (the location's placement: the stage weapon in Classic, whatever the seed put
 * there in the randomizer); null when the check was already collected before the claim (a replay gains nothing).
 */
export function clearRewardItemId(before: SaveLike, after: SaveLike, locationId: string): string | null {
  if ((before.collectedChecks ?? []).includes(locationId)) return null
  return after.progressionWorld?.placements?.[locationId] ?? null
}
