/**
 * Save profiles (prompt 05 §5.6, EVAL-P5-008): three slots, a pilot name, per-stage bests.
 *
 * Storage stays backward compatible: slot 1's save is the existing `save.v1` key, slots 2 and 3 are
 * `save.v1.slot2` and `save.v1.slot3`, so every existing save (and every smoke scenario that seeds
 * `save.v1`) keeps working without a copy. `profiles.v1` holds only the metadata below. Pure: no
 * storage access here; `Save` and the scenes own the adapters.
 */

export const PROFILES_KEY = 'profiles.v1'
export const PROFILE_SLOTS = [1, 2, 3] as const
export type ProfileSlot = (typeof PROFILE_SLOTS)[number]

export const DEFAULT_PILOT_NAME = 'WREN'
export const PILOT_NAME_MIN = 2
export const PILOT_NAME_MAX = 10
const PILOT_NAME_PATTERN = /^[A-Z0-9 ]+$/

export type StageBest = {
  bestTimeMs: number | null
  fewestDeaths: number | null
  secretsFound: number
  /** S, A, B, C or D; written at stage results (prompt 08). */
  rank: string | null
}

export type ProfileMeta = {
  slot: ProfileSlot
  pilotName: string
  createdAt: number
  lastPlayedAt: number
  playTimeMs: number
  /** Title chooses CONTINUE from this, not from whether a save key exists (an Options visit writes one). */
  campaignStarted: boolean
  /** The first-run controls page shows once per profile. */
  controlsSeen: boolean
  stageBests: Record<string, StageBest>
}

export type ProfilesState = {
  version: 1
  activeSlot: ProfileSlot
  /** One entry per used slot; an absent slot is EMPTY. */
  slots: Partial<Record<ProfileSlot, ProfileMeta>>
}

export function slotSaveKey(slot: ProfileSlot): string {
  return slot === 1 ? 'save.v1' : `save.v1.slot${slot}`
}

export function isProfileSlot(value: unknown): value is ProfileSlot {
  return value === 1 || value === 2 || value === 3
}

export type PilotNameResult = { ok: true; name: string } | { ok: false; reason: string }

/** Upper-cases, trims and collapses spaces; 2 to 10 characters of A-Z, 0-9 and space. */
export function validatePilotName(raw: unknown): PilotNameResult {
  if (typeof raw !== 'string') return { ok: false, reason: 'not text' }
  const name = raw.toUpperCase().replace(/\s+/g, ' ').trim()
  if (name.length < PILOT_NAME_MIN) return { ok: false, reason: `at least ${PILOT_NAME_MIN} characters` }
  if (name.length > PILOT_NAME_MAX) return { ok: false, reason: `at most ${PILOT_NAME_MAX} characters` }
  if (!PILOT_NAME_PATTERN.test(name)) return { ok: false, reason: 'letters, digits and spaces only' }
  return { ok: true, name }
}

export function emptyProfiles(): ProfilesState {
  return { version: 1, activeSlot: 1, slots: {} }
}

export function newProfileMeta(slot: ProfileSlot, pilotName: string, now: number): ProfileMeta {
  const checked = validatePilotName(pilotName)
  return {
    slot,
    pilotName: checked.ok ? checked.name : DEFAULT_PILOT_NAME,
    createdAt: now,
    lastPlayedAt: now,
    playTimeMs: 0,
    campaignStarted: false,
    controlsSeen: false,
    stageBests: {}
  }
}

/** What a legacy `save.v1` tells us about a campaign in progress (enough to show CONTINUE). */
export type LegacySaveHint = {
  tutorialCleared?: boolean
  clearedBosses?: readonly string[]
  storyFlags?: readonly string[]
  activeRun?: unknown
}

export function legacySaveStarted(save: LegacySaveHint | null): boolean {
  if (!save) return false
  return Boolean(save.tutorialCleared) || (save.clearedBosses?.length ?? 0) > 0 || (save.storyFlags?.length ?? 0) > 0 || Boolean(save.activeRun)
}

function sanitizeStageBest(raw: unknown): StageBest | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : null)
  const rank = typeof value.rank === 'string' && /^[SABCD]$/.test(value.rank) ? value.rank : null
  return { bestTimeMs: num(value.bestTimeMs), fewestDeaths: num(value.fewestDeaths), secretsFound: num(value.secretsFound) ?? 0, rank }
}

function sanitizeMeta(slot: ProfileSlot, raw: unknown, now: number): ProfileMeta | null {
  if (!raw || typeof raw !== 'object') return null
  const value = raw as Record<string, unknown>
  const name = validatePilotName(value.pilotName)
  const num = (v: unknown, fallback: number) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? v : fallback)
  const bests: Record<string, StageBest> = {}
  if (value.stageBests && typeof value.stageBests === 'object') {
    for (const [stageId, best] of Object.entries(value.stageBests as Record<string, unknown>)) {
      const clean = sanitizeStageBest(best)
      if (clean) bests[stageId] = clean
    }
  }
  return {
    slot,
    pilotName: name.ok ? name.name : DEFAULT_PILOT_NAME,
    createdAt: num(value.createdAt, now),
    lastPlayedAt: num(value.lastPlayedAt, now),
    playTimeMs: num(value.playTimeMs, 0),
    campaignStarted: Boolean(value.campaignStarted),
    controlsSeen: Boolean(value.controlsSeen),
    stageBests: bests
  }
}

/**
 * Reads `profiles.v1` defensively. With no profiles yet and a legacy `save.v1`, slot 1 becomes WREN's
 * profile (started if the save shows progress). Nothing is deleted or copied.
 */
export function loadProfiles(raw: string | null, legacySave: LegacySaveHint | null, now: number): ProfilesState {
  let parsed: unknown = null
  if (raw) {
    try {
      parsed = JSON.parse(raw)
    } catch {
      parsed = null
    }
  }
  if (parsed && typeof parsed === 'object' && (parsed as { version?: unknown }).version === 1) {
    const value = parsed as { activeSlot?: unknown; slots?: unknown }
    const slots: Partial<Record<ProfileSlot, ProfileMeta>> = {}
    const rawSlots = value.slots && typeof value.slots === 'object' ? (value.slots as Record<string, unknown>) : {}
    for (const slot of PROFILE_SLOTS) {
      const meta = sanitizeMeta(slot, rawSlots[String(slot)], now)
      if (meta) slots[slot] = meta
    }
    return { version: 1, activeSlot: isProfileSlot(value.activeSlot) ? value.activeSlot : 1, slots }
  }
  const state = emptyProfiles()
  if (legacySave) {
    const meta = newProfileMeta(1, DEFAULT_PILOT_NAME, now)
    meta.campaignStarted = legacySaveStarted(legacySave)
    meta.controlsSeen = meta.campaignStarted
    state.slots[1] = meta
  }
  return state
}

export function serializeProfiles(state: ProfilesState): string {
  return JSON.stringify(state)
}

export type SlotSummary = {
  slot: ProfileSlot
  empty: boolean
  pilotName: string
  wardensCleared: number
  wardensTotal: number
  playTime: string
  difficulty: string | null
}

export function formatPlayTime(ms: number): string {
  const totalMinutes = Math.floor(Math.max(0, ms) / 60000)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

/** A card on the slot picker. `wardensCleared` is derived from the slot's save, never stored. */
export function summarizeSlot(
  slot: ProfileSlot,
  meta: ProfileMeta | undefined,
  save: { clearedBosses?: readonly string[]; difficulty?: string } | null,
  wardenIds: readonly string[]
): SlotSummary {
  if (!meta) {
    return { slot, empty: true, pilotName: 'EMPTY', wardensCleared: 0, wardensTotal: wardenIds.length, playTime: '0:00', difficulty: null }
  }
  const cleared = new Set(save?.clearedBosses ?? [])
  return {
    slot,
    empty: false,
    pilotName: meta.pilotName,
    wardensCleared: wardenIds.filter((id) => cleared.has(id)).length,
    wardensTotal: wardenIds.length,
    playTime: formatPlayTime(meta.playTimeMs),
    difficulty: save?.difficulty ?? null
  }
}

export function withSlot(state: ProfilesState, meta: ProfileMeta): ProfilesState {
  return { ...state, slots: { ...state.slots, [meta.slot]: meta } }
}

export function withoutSlot(state: ProfilesState, slot: ProfileSlot): ProfilesState {
  const slots = { ...state.slots }
  delete slots[slot]
  return { ...state, slots }
}

export type StageRunResult = { timeMs: number; deaths: number; secretsFound: number; rank: string | null }

/** Keeps the best of each field independently (fastest clear, fewest deaths, most secrets). */
export function recordStageBest(meta: ProfileMeta, stageId: string, run: StageRunResult): ProfileMeta {
  const previous = meta.stageBests[stageId]
  const better = (a: number | null, b: number) => (a == null ? b : Math.min(a, b))
  const rankOrder = ['S', 'A', 'B', 'C', 'D']
  const bestRank =
    previous?.rank && run.rank
      ? rankOrder.indexOf(previous.rank) <= rankOrder.indexOf(run.rank) ? previous.rank : run.rank
      : previous?.rank ?? run.rank
  const best: StageBest = {
    bestTimeMs: better(previous?.bestTimeMs ?? null, run.timeMs),
    fewestDeaths: better(previous?.fewestDeaths ?? null, run.deaths),
    secretsFound: Math.max(previous?.secretsFound ?? 0, run.secretsFound),
    rank: bestRank
  }
  return { ...meta, stageBests: { ...meta.stageBests, [stageId]: best } }
}

export const PROFILE_EXPORT_KIND = 'omega-relay-profile'

export type ProfileExport = {
  kind: typeof PROFILE_EXPORT_KIND
  version: 1
  profile: Omit<ProfileMeta, 'slot'>
  /** The transport does not carry difficulty; the envelope does. */
  difficulty?: string
  /** The slot's save, in the progression transport shape `Save.exportProgression()` writes. */
  progression: unknown
}

export function exportFileName(pilotName: string): string {
  const safe = pilotName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'pilot'
  return `omega-relay-${safe}.json`
}

export function buildProfileExport(meta: ProfileMeta, progression: unknown, difficulty?: string): ProfileExport {
  const { slot: _slot, ...profile } = meta
  return { kind: PROFILE_EXPORT_KIND, version: 1, profile, ...(difficulty ? { difficulty } : {}), progression }
}

export type ProfileImportResult =
  | { ok: true; meta: ProfileMeta; progression: unknown; difficulty: string | null }
  | { ok: false; reason: string }

/** Validates the envelope and the profile; the progression payload is validated by the transport import in `Save`. */
export function parseProfileExport(text: string, slot: ProfileSlot, now: number): ProfileImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(text)
  } catch {
    return { ok: false, reason: 'not JSON' }
  }
  if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'not an object' }
  const value = parsed as Partial<ProfileExport>
  if (value.kind !== PROFILE_EXPORT_KIND || value.version !== 1) return { ok: false, reason: 'not an OMEGA Relay profile file' }
  if (!value.progression || typeof value.progression !== 'object') return { ok: false, reason: 'no progression' }
  const meta = sanitizeMeta(slot, value.profile, now)
  if (!meta) return { ok: false, reason: 'no profile' }
  const difficulty = value.difficulty === 'assist' || value.difficulty === 'normal' || value.difficulty === 'veteran' ? value.difficulty : null
  return { ok: true, meta: { ...meta, lastPlayedAt: now }, progression: value.progression, difficulty }
}

/** Stage Select's line under a cleared warden: `BEST 3:20`, or null before prompt 08 writes a best. */
export function formatBestTime(best: StageBest | undefined): string | null {
  if (!best || best.bestTimeMs == null) return null
  const totalSeconds = Math.floor(best.bestTimeMs / 1000)
  return `BEST ${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`
}

/**
 * The name entry grid (Title -> slot picker -> name). The cursor starts on END so Enter keeps the
 * default; the arrows or the touch pad move it; typed keys edit the name directly.
 */
export const NAME_GRID: readonly (readonly string[])[] = [
  ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'],
  ['K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T'],
  ['U', 'V', 'W', 'X', 'Y', 'Z', '0', '1', '2', '3'],
  ['4', '5', '6', '7', '8', '9', 'SPACE', 'DEL', 'END']
]

export type NameEntryState = { name: string; pristine: boolean; row: number; col: number }
export type NameEntryResult = { kind: 'edit'; state: NameEntryState } | { kind: 'confirm'; name: string } | { kind: 'invalid'; state: NameEntryState; reason: string }

export function startNameEntry(defaultName: string = DEFAULT_PILOT_NAME): NameEntryState {
  const last = NAME_GRID.length - 1
  return { name: defaultName, pristine: true, row: last, col: NAME_GRID[last]!.length - 1 }
}

export function nameEntryCell(state: NameEntryState): string {
  return NAME_GRID[state.row]?.[state.col] ?? 'END'
}

export function moveNameCursor(state: NameEntryState, dx: number, dy: number): NameEntryState {
  const row = (state.row + dy + NAME_GRID.length) % NAME_GRID.length
  const width = NAME_GRID[row]!.length
  const col = dy !== 0 ? Math.min(state.col, width - 1) : (state.col + dx + width) % width
  return { ...state, row, col }
}

/** Appends one character (A-Z, 0-9 or a single inner space); the first edit replaces the default name. */
export function typeNameChar(state: NameEntryState, raw: string): NameEntryState {
  const ch = raw.toUpperCase()
  if (!/^[A-Z0-9 ]$/.test(ch)) return state
  const base = state.pristine ? '' : state.name
  if (base.length >= PILOT_NAME_MAX) return { ...state, name: base, pristine: false }
  if (ch === ' ' && (base.length === 0 || base.endsWith(' '))) return { ...state, name: base, pristine: false }
  return { ...state, name: base + ch, pristine: false }
}

export function eraseNameChar(state: NameEntryState): NameEntryState {
  return { ...state, name: state.pristine ? '' : state.name.slice(0, -1), pristine: false }
}

function confirmNameEntry(state: NameEntryState): NameEntryResult {
  const checked = validatePilotName(state.name)
  return checked.ok ? { kind: 'confirm', name: checked.name } : { kind: 'invalid', state, reason: checked.reason }
}

/** The pad path: the highlighted cell types, erases or confirms. */
export function activateNameCell(state: NameEntryState): NameEntryResult {
  const cell = nameEntryCell(state)
  if (cell === 'END') return confirmNameEntry(state)
  if (cell === 'DEL') return { kind: 'edit', state: eraseNameChar(state) }
  return { kind: 'edit', state: typeNameChar(state, cell === 'SPACE' ? ' ' : cell) }
}

/** The keyboard path (`KeyboardEvent.key`): letters, digits and space type, Backspace erases, Enter confirms. */
export function nameEntryKey(state: NameEntryState, key: string): NameEntryResult | null {
  if (key === 'Enter') return confirmNameEntry(state)
  if (key === 'Backspace') return { kind: 'edit', state: eraseNameChar(state) }
  if (key.length === 1 && /^[a-zA-Z0-9 ]$/.test(key)) return { kind: 'edit', state: typeNameChar(state, key) }
  return null
}
