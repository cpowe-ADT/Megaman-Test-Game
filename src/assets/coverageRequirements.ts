import type { BossId } from '../bosses/types'
import type { SpriteSheetManifestEntry, SpriteSheetManifestV1 } from './types'

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
  bossSourceFiles: readonly string[]
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

  const valid =
    missingManifestIds.length === 0 &&
    nonReadyManifestIds.length === 0 &&
    missingRuntimePaths.length === 0 &&
    missingEnemySourceSheets.length === 0 &&
    missingBossSourceSheets.length === 0 &&
    missingPrefixGroups.length === 0

  return {
    valid,
    missingManifestIds,
    nonReadyManifestIds,
    missingRuntimePaths,
    missingEnemySourceSheets: [...missingEnemySourceSheets],
    missingBossSourceSheets: [...missingBossSourceSheets],
    missingPrefixGroups
  }
}
