import type { BossId } from '../bosses/types'
import { AnimationManifest } from '../player/AnimationManifest'
import { getRequiredPlayerAtlasPrefixes, resolvePlayerAtlasBinding } from '../player/PlayerAtlasBindings'
import type { SpriteSheetManifestEntry, SpriteSheetManifestV1 } from './types'

const PLAYER_MAIN_PREFIX = 'player_main/'

// Minimum frame count per hero group, derived from the bindings (5.5 code review: a hand-copied table could
// drift from a raised `end` and let a short atlas pass): for every animation the runtime builds, each prefix
// its binding resolves to needs `end + 1` frames. Cross-checked against getRequiredPlayerAtlasPrefixes().
export type PlayerGroupRequirement = { group: string; minCount: number }

export function getRequiredPlayerGroups(): PlayerGroupRequirement[] {
  const need = new Map<string, number>()
  for (const key of Object.keys(AnimationManifest.animations)) {
    const binding = resolvePlayerAtlasBinding(key)
    for (const prefix of binding.prefixes) {
      if (!prefix.startsWith(PLAYER_MAIN_PREFIX) || !prefix.endsWith('/')) {
        throw new Error(`[coverageRequirements] Unexpected player atlas prefix shape: ${prefix}`)
      }
      const group = prefix.slice(PLAYER_MAIN_PREFIX.length, -1)
      need.set(group, Math.max(need.get(group) ?? 0, (binding.end ?? 0) + 1))
    }
  }
  const expected = getRequiredPlayerAtlasPrefixes().map((prefix) => prefix.slice(PLAYER_MAIN_PREFIX.length, -1)).sort()
  const derived = [...need.keys()].sort()
  if (expected.join(',') !== derived.join(',')) {
    throw new Error(`[coverageRequirements] Hero groups from the animations (${derived.length}) differ from the bindings (${expected.length}).`)
  }
  return derived.map((group) => ({ group, minCount: need.get(group) ?? 1 }))
}

/** Pure form of Preload's dev check: required hero groups missing or short in a list of atlas frame names. */
export function findMissingPlayerGroups(frameNames: readonly string[]): PlayerGroupRequirement[] {
  const counts = countPlayerFramesByGroup(frameNames)
  return getRequiredPlayerGroups().filter(({ group, minCount }) => (counts.get(group) ?? 0) < minCount)
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
