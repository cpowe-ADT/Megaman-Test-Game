import { BOSS_ROSTER } from '../bosses/roster'
import type { BossId } from '../bosses/types'
import type { ActiveRunSaveData } from '../systems/Save'
import { CAMPAIGN_STAGES, FINAL_STAGE_ID, ROBOT_MASTER_STAGE_IDS } from './campaign'
import {
  OMEGA_ARCHIVE_CHECKPOINT_ID,
  OMEGA_CHECKPOINTS,
  OMEGA_CHECKPOINT_ACTS,
  OMEGA_CORE_GATE_CHECKPOINT_ID,
  OMEGA_DOOR_XS,
  type OmegaAct
} from './stages/omegaFortress'

/**
 * The Central Core's acts and the Warden Archive's rules (prompt 02 phase 2.6, prompt 12 part 12e, EVAL-P6-011).
 * Pure: the save validation, the hub adapter (`src/scenes/game/OmegaActs.ts`) and the tests read these.
 *
 * - Acts follow the checkpoints: the archive's door opens act 2, the Core's approach act 3.
 * - Eight doors, one per warden, labelled by element only (no weakness hint). A door starts a rematch: `Game` is
 *   re-entered with the door index and the run in memory (scene data `omega`), and the warden fights in the Core's
 *   room (`src/content/omegaRematch.ts`: full profile, phase-two cadence, maxHp x0.7). Doors open in any order.
 * - A clear re-enters the hub at its door with a large HP refill and a full weapon-energy refill beside it.
 * - After every second clear the hub re-entry is a checkpoint: the run is saved with its clears (and the sub
 *   tanks). A save between checkpoints keeps the clears of the last one, as a checkpoint keeps its position.
 * - The archive's exit opens when all eight are cleared.
 */

export type { OmegaAct }

export type OmegaDoor = { index: number; bossId: BossId; label: string; x: number }

/** Half the width of a door's entry zone, px: the hero's centre within it and grounded, then Up. */
export const OMEGA_DOOR_REACH = 14

export const OMEGA_DOORS: readonly OmegaDoor[] = ROBOT_MASTER_STAGE_IDS.map((stageId, index) => {
  const bossId = CAMPAIGN_STAGES[stageId].bossId
  return { index, bossId, label: String(BOSS_ROSTER[bossId]?.element ?? 'Normal').toUpperCase(), x: OMEGA_DOOR_XS[index] }
})

export const OMEGA_REMATCH_BOSS_IDS: readonly BossId[] = OMEGA_DOORS.map((door) => door.bossId)

const ARCHIVE_INDEX = OMEGA_CHECKPOINTS.findIndex((entry) => entry.id === OMEGA_ARCHIVE_CHECKPOINT_ID)
const CORE_GATE = OMEGA_CHECKPOINTS.find((entry) => entry.id === OMEGA_CORE_GATE_CHECKPOINT_ID)
/** Where a rematch starts: the Core's door, so the fight is in the Core's room (a small locked arena). */
export const OMEGA_REMATCH_START_X = CORE_GATE?.x ?? 0

/** The act a checkpoint belongs to (1 for an unknown id: a run that cannot be placed starts the fortress over). */
export function omegaActOfCheckpoint(checkpointId: string | null | undefined): OmegaAct {
  return (checkpointId ? OMEGA_CHECKPOINT_ACTS[checkpointId] : undefined) ?? 1
}

/** A rematch list, cleaned: known warden ids once each, in door order. */
export function normalizeRematchCleared(value: unknown): BossId[] {
  const listed = new Set(Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : [])
  return OMEGA_REMATCH_BOSS_IDS.filter((bossId) => listed.has(bossId))
}

/**
 * `validateActiveRun`'s rule for the two Central Core fields. The checkpoint places the hero, so it decides the
 * act; a run in act 1 has no clears. Other stages always carry act 1 and no clears.
 */
export function normalizeOmegaRunFields(
  stageId: string,
  checkpointId: string | undefined,
  raw: { omegaAct?: unknown; rematchCleared?: unknown }
): { omegaAct: OmegaAct; rematchCleared: BossId[] } {
  if (stageId !== FINAL_STAGE_ID) return { omegaAct: 1, rematchCleared: [] }
  const omegaAct = omegaActOfCheckpoint(checkpointId)
  return { omegaAct, rematchCleared: omegaAct === 1 ? [] : normalizeRematchCleared(raw.rematchCleared) }
}

export function recordRematchClear(cleared: readonly BossId[], bossId: BossId): BossId[] {
  return normalizeRematchCleared([...cleared, bossId])
}

/** The hub re-entry after clears 2, 4, 6 and 8 is a checkpoint. */
export function isRematchCheckpoint(clearedCount: number): boolean {
  return clearedCount > 0 && clearedCount % 2 === 0
}

export function isArchiveExitOpen(cleared: readonly BossId[]): boolean {
  return OMEGA_REMATCH_BOSS_IDS.every((bossId) => cleared.includes(bossId))
}

/** The uncleared door whose entry zone holds `x`, if any. */
export function doorAt(x: number, cleared: readonly BossId[]): OmegaDoor | null {
  return OMEGA_DOORS.find((door) => Math.abs(x - door.x) <= OMEGA_DOOR_REACH && !cleared.includes(door.bossId)) ?? null
}

/** The scene data `Game` is re-entered with inside act 2 (never saved): the door, and the run carried in memory. */
export type OmegaEntry = {
  mode: 'rematch' | 'return'
  door: number
  /** HP, lives, weapon energy and the session's clears; `bossId` is the rematch warden in a rematch. */
  run: ActiveRunSaveData
  /** The clears the last checkpoint saved. */
  saved: BossId[]
}

export function readOmegaEntry(data: unknown): OmegaEntry | null {
  const entry = (data as { omega?: Partial<OmegaEntry> } | null | undefined)?.omega
  if (!entry || (entry.mode !== 'rematch' && entry.mode !== 'return') || !entry.run || typeof entry.run !== 'object') return null
  const door = Number(entry.door)
  if (!Number.isInteger(door) || door < 0 || door >= OMEGA_DOORS.length) return null
  return { mode: entry.mode, door, run: entry.run, saved: normalizeRematchCleared(entry.saved) }
}

/** The run `Game.create` resumes from: an act-2 re-entry's run in memory, else null (then the save, as before). */
export function resolveOmegaEntryRun(data: unknown): ActiveRunSaveData | null {
  return readOmegaEntry(data)?.run ?? null
}

/** The session state the hub adapter keeps per scene. */
export type OmegaRunState = { cleared: BossId[]; saved: BossId[]; entry: OmegaEntry | null }

export function isOmegaRematch(state: OmegaRunState | null | undefined): boolean {
  return state?.entry?.mode === 'rematch'
}

/**
 * The run a save writes inside the Central Core. A rematch saves as the archive (its door is the checkpoint), with
 * the Core as the stage's boss; the clears are the last checkpoint's. Other stages pass through unchanged.
 */
export function omegaRunSnapshot(run: ActiveRunSaveData, state: OmegaRunState | null | undefined): ActiveRunSaveData {
  if (run.stageId !== FINAL_STAGE_ID) return run
  const inRematch = isOmegaRematch(state)
  const checkpointId = inRematch ? OMEGA_ARCHIVE_CHECKPOINT_ID : run.checkpointId
  const omegaAct = omegaActOfCheckpoint(checkpointId)
  return {
    ...run,
    bossId: CAMPAIGN_STAGES[FINAL_STAGE_ID].bossId,
    checkpointId,
    checkpointIndex: inRematch ? ARCHIVE_INDEX : run.checkpointIndex,
    omegaAct,
    rematchCleared: omegaAct === 1 ? [] : [...(state?.saved ?? [])]
  }
}

/** The scene data for entering door `door` from the hub. */
export function buildRematchEntry(run: ActiveRunSaveData, state: OmegaRunState, door: number, runtimeBossConfigId: string) {
  const warden = OMEGA_DOORS[door]
  return {
    stageId: FINAL_STAGE_ID,
    bossId: warden.bossId,
    runtimeBossConfigId,
    omega: {
      mode: 'rematch',
      door,
      run: { ...run, stageId: FINAL_STAGE_ID, bossId: warden.bossId, checkpointId: OMEGA_ARCHIVE_CHECKPOINT_ID, checkpointIndex: ARCHIVE_INDEX, omegaAct: 2, rematchCleared: [...state.cleared] },
      saved: [...state.saved]
    } satisfies OmegaEntry
  }
}

/** The scene data for the hub after door `door`'s warden falls: the clear is recorded in the session. */
export function buildReturnEntry(run: ActiveRunSaveData, state: OmegaRunState, door: number) {
  const stage = CAMPAIGN_STAGES[FINAL_STAGE_ID]
  const cleared = recordRematchClear(state.cleared, OMEGA_DOORS[door].bossId)
  return {
    stageId: FINAL_STAGE_ID,
    bossId: stage.bossId,
    runtimeBossConfigId: stage.runtimeBossConfigId,
    omega: {
      mode: 'return',
      door,
      run: { ...run, stageId: FINAL_STAGE_ID, bossId: stage.bossId, checkpointId: OMEGA_ARCHIVE_CHECKPOINT_ID, checkpointIndex: ARCHIVE_INDEX, omegaAct: 2, rematchCleared: cleared },
      saved: [...state.saved]
    } satisfies OmegaEntry
  }
}

/**
 * The session state at scene start. A re-entry carries it; a resumed save or a fresh entry at an act-2 or act-3
 * checkpoint (a continue, the stage select) takes the saved run's clears; act 1 starts with none.
 */
export function initialOmegaRunState(
  entry: OmegaEntry | null,
  savedRun: Pick<ActiveRunSaveData, 'stageId' | 'rematchCleared'> | null,
  checkpointId: string | null
): OmegaRunState {
  if (entry) return { cleared: normalizeRematchCleared(entry.run.rematchCleared), saved: entry.saved, entry }
  const saved = savedRun?.stageId === FINAL_STAGE_ID && omegaActOfCheckpoint(checkpointId) >= 2 ? normalizeRematchCleared(savedRun.rematchCleared) : []
  return { cleared: saved, saved: [...saved], entry: null }
}
