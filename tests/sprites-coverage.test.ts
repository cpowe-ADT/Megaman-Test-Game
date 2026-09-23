import test from 'node:test'
import assert from 'node:assert/strict'
import {
  REQUIRED_BOSS_IDS,
  REQUIRED_ENEMY_TYPE_KEYS,
  REQUIRED_MANIFEST_ENTRY_IDS,
  buildSpriteCoverageReport
} from '../src/assets/coverageRequirements'
import type { SpriteSheetManifestV1 } from '../src/assets/types'

function makeEntry(id: string) {
  return {
    id,
    atlasKey: `atlas_${id.replaceAll('-', '_')}`,
    frame: { width: 32, height: 32 },
    status: 'ready' as const,
    source: {
      runtimeImage: `/assets/${id}.png`,
      runtimeData: `/assets/${id}.json`
    }
  }
}

function makeCompleteManifest(): SpriteSheetManifestV1 {
  const entries = REQUIRED_MANIFEST_ENTRY_IDS.map((id) => makeEntry(id))
  entries.push(makeEntry('projectiles-core'))
  entries.push(makeEntry('effects-core'))
  return {
    version: '1',
    generatedAt: '2026-02-13T00:00:00.000Z',
    entries
  }
}

test('buildSpriteCoverageReport passes when required ids, groups, and source sheets exist', () => {
  const manifest = makeCompleteManifest()
  const enemySourceFiles = REQUIRED_ENEMY_TYPE_KEYS.map((id) => `${id}_sheet_v1_20260213_120000.png`)
  const bossSourceFiles = REQUIRED_BOSS_IDS.map((id) => `${id}_actions_sheet_v1_20260213_120000.png`)

  const report = buildSpriteCoverageReport(manifest, enemySourceFiles, bossSourceFiles)
  assert.equal(report.valid, true)
  assert.equal(report.missingManifestIds.length, 0)
  assert.equal(report.missingEnemySourceSheets.length, 0)
  assert.equal(report.missingBossSourceSheets.length, 0)
  assert.equal(report.missingPrefixGroups.length, 0)
})

test('buildSpriteCoverageReport reports missing required entries and source sheets', () => {
  const manifest = makeCompleteManifest()
  manifest.entries = manifest.entries.filter((entry) => entry.id !== 'enemies-enemy_drone')
  manifest.entries = manifest.entries.filter((entry) => entry.id !== 'projectiles-core')

  const enemySourceFiles = REQUIRED_ENEMY_TYPE_KEYS
    .filter((id) => id !== 'enemy_drone')
    .map((id) => `${id}_sheet_v1_20260213_120000.png`)
  const bossSourceFiles = REQUIRED_BOSS_IDS
    .filter((id) => id !== 'pyro_maw')
    .map((id) => `${id}_actions_sheet_v1_20260213_120000.png`)

  const report = buildSpriteCoverageReport(manifest, enemySourceFiles, bossSourceFiles)
  assert.equal(report.valid, false)
  assert.ok(report.missingManifestIds.includes('enemies-enemy_drone'))
  assert.ok(report.missingPrefixGroups.includes('projectiles'))
  assert.ok(report.missingEnemySourceSheets.includes('enemy_drone'))
  assert.ok(report.missingBossSourceSheets.includes('pyro_maw'))
})
