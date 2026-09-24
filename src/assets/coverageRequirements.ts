import type { BossId } from '../bosses/types'
import { getRequiredPlayerAtlasPrefixes } from '../player/PlayerAtlasBindings'
import type { SpriteSheetManifestEntry, SpriteSheetManifestV1 } from './types'

const PLAYER_MAIN_PREFIX = 'player_main/'

// Minimum frame count per hero group (binding `end` + 1), mirrored by hand from the `end` values in
// src/player/PlayerAtlasBindings.ts (DIRECT_BINDINGS, GROUND_SLASH_GROUPS, AIR_SLASH_GROUPS; ground/air
// slash directions n/ne/e/se/s each need SLASH_FRAME_END + 1 = 4 frames). getRequiredPlayerGroups()
// cross-checks this table's keys against getRequiredPlayerAtlasPrefixes() so the two files cannot drift
// silently: an unrecognised or missing group throws instead of passing coverage by accident.
const PLAYER_GROUP_MIN_COUNTS: Readonly<Record<string, number>> = {
  idle: 4,
  turn: 1,
  run: 6,
  crouch_in: 1,
  crouch_hold: 1,
  crouch_out: 1,
  jump_start: 1,
  jump_rise: 1,
  jump_apex: 1,
  fall: 1,
  wall_slide: 1,
  wall_jump: 1,
  land: 1,
  dash_start: 1,
  dash_loop: 1,
  dash_end: 1,
  airdash_start: 1,
  airdash_loop: 1,
  airdash_end: 1,
  shoot_ground: 2,
  shoot_run: 2,
  shoot_air: 1,
  dash_shoot: 1,
  charge_start: 1,
  charge_hold: 2,
  charge_release_lv1: 1,
  charge_release_lv2: 1,
  charge_release_lv3: 1,
  charge_release_lv4: 1,
  hurt_light: 1,
  hurt_heavy: 1,
  knockdown: 1,
  getup: 1,
  death: 2,
  respawn: 3,
  slash_ground_n: 4,
  slash_ground_ne: 4,
  slash_ground_e: 4,
  slash_ground_se: 4,
  slash_ground_s: 4,
  slash_air_n: 4,
  slash_air_ne: 4,
  slash_air_e: 4,
  slash_air_se: 4,
  slash_air_s: 4
}

export type PlayerGroupRequirement = { group: string; minCount: number }

export function getRequiredPlayerGroups(): PlayerGroupRequirement[] {
  return getRequiredPlayerAtlasPrefixes().map((prefix) => {
    if (!prefix.startsWith(PLAYER_MAIN_PREFIX) || !prefix.endsWith('/')) {
      throw new Error(`[coverageRequirements] Unexpected player atlas prefix shape: ${prefix}`)
    }
    const group = prefix.slice(PLAYER_MAIN_PREFIX.length, -1)
    const minCount = PLAYER_GROUP_MIN_COUNTS[group]
    if (minCount === undefined) {
      throw new Error(
        `[coverageRequirements] No minimum frame count recorded for hero group '${group}'; update PLAYER_GROUP_MIN_COUNTS.`
      )
    }
    return { group, minCount }
  })
}

function countPlayerFramesByGroup(playerAtlasFrameNames: readonly string[]): Map<string, number> {
  const counts = new Map<string, number>()
  playerAtlasFrameNames.forEach((name) => {
    if (!name.startsWith(PLAYER_MAIN_PREFIX)) {
      return
    }
    const rest = name.slice(PLAYER_MAIN_PREFIX.length)
    const slash = rest.indexOf('/')
    if (slash === -1) {
      return
    }
    const group = rest.slice(0, slash)
    counts.set(group, (counts.get(group) ?? 0) + 1)
  })
  return counts
}

export const REQUIRED_ENEMY_TYPE_KEYS = [
  'enemy_gunner_bot',
  'enemy_rocket_bot',
  'enemy_slicer_bot',
  'enemy_armored_bot',
  'enemy_shock_hopper',
  'enemy_bouncer',
  'enemy_mine_bot',
  'enemy_frost_turret',
  'enemy_laser_eye',
  'enemy_drone',
  'enemy_shield_drone',
  'enemy_fly_trap'
] as const

export const REQUIRED_BOSS_IDS: readonly BossId[] = [
  'sentinel_rook',
  'pyro_maw',
  'tide_reaver',
  'volt_hopper',
  'basalt_titan',
  'ferro_blade',
  'mire_wraith',
  'gale_vixen',
  'glacier_ronin',
  'omega_core'
] as const

export const REQUIRED_MANIFEST_ENTRY_IDS = [
  'player-player_main',
  ...REQUIRED_ENEMY_TYPE_KEYS.map((typeKey) => `enemies-${typeKey}`),
  ...REQUIRED_BOSS_IDS.map((bossId) => `boss-${bossId.replace(/_/g, '-')}`)
] as const

export const REQUIRED_MANIFEST_PREFIX_GROUPS = [
  { name: 'projectiles', prefix: 'projectiles-' },
  { name: 'effects', prefix: 'effects-' }
] as const

export type SpriteCoverageReport = {
  valid: boolean
  missingManifestIds: string[]
  nonReadyManifestIds: string[]
  missingRuntimePaths: string[]
  missingEnemySourceSheets: string[]
  missingBossSourceSheets: string[]
  missingPrefixGroups: string[]
  missingPlayerGroups: string[]
}

function hasSourceSheet(files: readonly string[], requiredPrefix: string): boolean {
  return files.some((file) => file.startsWith(requiredPrefix) && file.endsWith('.png'))
}

function hasRuntimeSource(entry: SpriteSheetManifestEntry): boolean {
  return (
    typeof entry.source.runtimeImage === 'string' &&
    entry.source.runtimeImage.length > 0 &&
    typeof entry.source.runtimeData === 'string' &&
    entry.source.runtimeData.length > 0
  )
}

export function buildSpriteCoverageReport(
  manifest: SpriteSheetManifestV1,
  enemySourceFiles: readonly string[],
  bossSourceFiles: readonly string[],
  playerAtlasFrameNames: readonly string[] = []
): SpriteCoverageReport {
  const entryById = new Map<string, SpriteSheetManifestEntry>()
  manifest.entries.forEach((entry) => entryById.set(entry.id, entry))

  const missingManifestIds: string[] = []
  const nonReadyManifestIds: string[] = []
  const missingRuntimePaths: string[] = []

  REQUIRED_MANIFEST_ENTRY_IDS.forEach((requiredId) => {
    const entry = entryById.get(requiredId)
    if (!entry) {
      missingManifestIds.push(requiredId)
      return
    }
    if (entry.status !== 'ready') {
      nonReadyManifestIds.push(requiredId)
    }
    if (!hasRuntimeSource(entry)) {
      missingRuntimePaths.push(requiredId)
    }
  })

  const missingPrefixGroups = REQUIRED_MANIFEST_PREFIX_GROUPS.filter(({ prefix }) =>
    manifest.entries.every((entry) => !entry.id.startsWith(prefix))
  ).map(({ name }) => name)

  const missingEnemySourceSheets = REQUIRED_ENEMY_TYPE_KEYS.filter((typeKey) => {
    const prefix = `${typeKey}_sheet_`
    return !hasSourceSheet(enemySourceFiles, prefix)
  })

  const missingBossSourceSheets = REQUIRED_BOSS_IDS.filter((bossId) => {
    const prefix = `${bossId}_actions_sheet_`
    return !hasSourceSheet(bossSourceFiles, prefix)
  })

  const playerGroupCounts = countPlayerFramesByGroup(playerAtlasFrameNames)
  const missingPlayerGroups = getRequiredPlayerGroups()
    .filter(({ group, minCount }) => (playerGroupCounts.get(group) ?? 0) < minCount)
    .map(({ group, minCount }) => `${group} (have ${playerGroupCounts.get(group) ?? 0}, need ${minCount})`)

  const valid =
    missingManifestIds.length === 0 &&
    nonReadyManifestIds.length === 0 &&
    missingRuntimePaths.length === 0 &&
    missingEnemySourceSheets.length === 0 &&
    missingBossSourceSheets.length === 0 &&
    missingPrefixGroups.length === 0 &&
    missingPlayerGroups.length === 0

  return {
    valid,
    missingManifestIds,
    nonReadyManifestIds,
    missingRuntimePaths,
    missingEnemySourceSheets: [...missingEnemySourceSheets],
    missingBossSourceSheets: [...missingBossSourceSheets],
    missingPrefixGroups,
    missingPlayerGroups
  }
}
