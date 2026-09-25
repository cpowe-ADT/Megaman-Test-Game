import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { CAMPAIGN_STAGES } from '../src/content/campaign'
import { STAGE_BACKGROUND_ASSETS } from '../src/content/stageBackgroundCatalog'
import {
  RESIDENT_BACKGROUND_KEYS,
  STAGE_SCOPED_ATLASES,
  backgroundKeysToEvict,
  residentBackgroundAssets,
  resolveGameStageId,
  stageBackgroundAssets,
  stageBackgroundKeys,
  resolveGameStageAndBoss,
  stageScopedAtlasKeysToEvict,
  stageScopedAtlases
} from '../src/scenes/game/stageBackgroundLoading'

test('every stage layer resolves to a catalog asset, so per-stage loading misses nothing', () => {
  for (const stageId of Object.keys(CAMPAIGN_STAGES)) {
    const keys = stageBackgroundKeys(stageId)
    assert.ok(keys.length > 0, `${stageId} draws background layers`)
    assert.deepEqual(stageBackgroundAssets(stageId).map((asset) => asset.key).sort(), [...new Set(keys)].sort(), `${stageId} layers`)
  }
  assert.deepEqual(residentBackgroundAssets().map((asset) => asset.key), [...RESIDENT_BACKGROUND_KEYS])
})

test('a stage loads a fraction of the catalog', () => {
  const most = Math.max(...Object.keys(CAMPAIGN_STAGES).map((stageId) => stageBackgroundAssets(stageId).length))
  assert.ok(most <= 10, `largest stage set is ${most} layers`)
  assert.ok(STAGE_BACKGROUND_ASSETS.length >= 25, 'the catalog is the full set Preload used to load')
})

test('entering a stage evicts other stages layers but keeps the resident set and non-background textures', () => {
  const loaded = ['atlas_player_main', 'bg_dock_0', 'bg_dock_2', 'bg_industrial_bg', 'bg_pyro_far', 'bg_snow_1', '__DEFAULT']
  const evicted = backgroundKeysToEvict(loaded, 'pyro_maw')
  assert.ok(!evicted.includes('atlas_player_main'), 'atlases are never touched')
  assert.ok(!evicted.includes('__DEFAULT'))
  assert.ok(!evicted.includes('bg_dock_0'), 'the prologue layer stays resident')
  assert.ok(!evicted.includes('bg_pyro_far'), 'Pyro Maw keeps its own layers (the Heat Works art since the finish plan)')
  assert.deepEqual(evicted.sort(), ['bg_dock_2', 'bg_industrial_bg', 'bg_snow_1'])
})

test('the stage id follows the same precedence Game.create uses', () => {
  assert.equal(resolveGameStageId({ stageId: 'tide_reaver', bossId: 'pyro_maw' }, { stageId: 'glacier_ronin' }), 'glacier_ronin')
  assert.equal(resolveGameStageId({ stageId: 'tide_reaver', bossId: 'pyro_maw' }, null), 'tide_reaver')
  assert.equal(resolveGameStageId({ bossId: 'volt_hopper' }, null), 'volt_hopper')
  assert.equal(resolveGameStageId(undefined, undefined), 'pyro_maw')
})

test('the stage-scoped atlas list matches the sprite manifest entries marked loadScope stage', () => {
  const manifest = JSON.parse(fs.readFileSync('assets/sprites/manifest.v1.json', 'utf8'))
  const fromManifest = manifest.entries
    .filter((entry: { loadScope?: string }) => entry.loadScope === 'stage')
    .map((entry: { id: string; atlasKey: string; source: { runtimeImage: string; runtimeData: string } }) => ({
      id: entry.id,
      atlasKey: entry.atlasKey,
      runtimeImage: entry.source.runtimeImage,
      runtimeData: entry.source.runtimeData
    }))
  const byId = (a: { id: string }, b: { id: string }) => a.id.localeCompare(b.id)
  assert.deepEqual([...STAGE_SCOPED_ATLASES].sort(byId), [...fromManifest].sort(byId))
})

test('a stage-scoped atlas loads only for the stages that place it or fight its boss, and is evicted elsewhere', () => {
  const keys = STAGE_SCOPED_ATLASES.map((entry) => entry.atlasKey)
  assert.ok(keys.includes('atlas_custodian_walker'), `the custodian walker is stage-scoped (${keys})`)
  assert.equal(keys.filter((key) => /^atlas_(sentinel_rook|pyro_maw|omega_core)$/.test(key)).length, 3, 'boss atlases are stage-scoped')
  assert.deepEqual(stageScopedAtlases('pyro_maw').map((entry) => entry.atlasKey), ['atlas_custodian_walker', 'atlas_pyro_maw'])
  assert.deepEqual(stageScopedAtlases('tutorial_sentinel').map((entry) => entry.atlasKey), ['atlas_sentinel_rook'])
  // Automation may run another boss in a stage: its atlas is the one queued.
  assert.deepEqual(stageScopedAtlases('tutorial_sentinel', 'volt_hopper').map((entry) => entry.atlasKey), ['atlas_volt_hopper'])
  assert.deepEqual(
    stageScopedAtlasKeysToEvict(['atlas_custodian_walker', 'atlas_pyro_maw', 'atlas_sentinel_rook', 'atlas_player_main'], 'tutorial_sentinel'),
    ['atlas_custodian_walker', 'atlas_pyro_maw']
  )
  assert.deepEqual(stageScopedAtlasKeysToEvict(['atlas_custodian_walker', 'atlas_pyro_maw'], 'pyro_maw'), [])
})

test('preload and create resolve the same stage and boss', () => {
  assert.deepEqual(resolveGameStageAndBoss({ stageId: 'pyro_maw' }, null, null), ['pyro_maw', 'pyro_maw'])
  assert.deepEqual(resolveGameStageAndBoss({ stageId: 'tutorial_sentinel', bossId: 'sentinel_rook' }, null, null), ['tutorial_sentinel', 'sentinel_rook'])
  assert.deepEqual(resolveGameStageAndBoss({ stageId: 'tutorial_sentinel' }, null, 'volt_hopper'), ['tutorial_sentinel', 'volt_hopper'])
  assert.deepEqual(resolveGameStageAndBoss({ stageId: 'tutorial_sentinel' }, { stageId: 'tide_reaver', bossId: 'tide_reaver' }, 'volt_hopper'), ['tide_reaver', 'tide_reaver'])
})

test('the mini-boss lab loads every mini-boss atlas and skin; Heat Works still loads only its walker; leaving the lab evicts them', () => {
  const families = ['custodian_walker', 'custodian_walker_basalt', 'custodian_walker_glacier', 'relay_turret_nest', 'relay_turret_nest_ferro', 'sentry_twin', 'sentry_twin_gale', 'drill_serpent']
  const lab = stageScopedAtlases('miniboss_lab').map((entry) => entry.atlasKey)
  assert.deepEqual([...lab].sort(), [...families.map((key) => `atlas_${key}`), 'atlas_pyro_maw'].sort())
  assert.deepEqual(stageScopedAtlases('pyro_maw').map((entry) => entry.atlasKey), ['atlas_custodian_walker', 'atlas_pyro_maw'])
  assert.deepEqual(stageScopedAtlasKeysToEvict(lab, 'pyro_maw').sort(), families.filter((key) => key !== 'custodian_walker').map((key) => `atlas_${key}`).sort())
})
