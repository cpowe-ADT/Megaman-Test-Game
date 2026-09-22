import test from 'node:test'
import assert from 'node:assert/strict'
import { CAMPAIGN_STAGES } from '../src/content/campaign'
import { STAGE_BACKGROUND_ASSETS } from '../src/content/stageBackgroundCatalog'
import {
  RESIDENT_BACKGROUND_KEYS,
  backgroundKeysToEvict,
  residentBackgroundAssets,
  resolveGameStageId,
  stageBackgroundAssets,
  stageBackgroundKeys
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
  const loaded = ['atlas_player_main', 'bg_dock_0', 'bg_dock_2', 'bg_industrial_bg', 'bg_snow_1', '__DEFAULT']
  const evicted = backgroundKeysToEvict(loaded, 'pyro_maw')
  assert.ok(!evicted.includes('atlas_player_main'), 'atlases are never touched')
  assert.ok(!evicted.includes('__DEFAULT'))
  assert.ok(!evicted.includes('bg_dock_0'), 'the prologue layer stays resident')
  assert.ok(!evicted.includes('bg_industrial_bg'), 'Pyro Maw keeps its own layers')
  assert.deepEqual(evicted.sort(), ['bg_dock_2', 'bg_snow_1'])
})

test('the stage id follows the same precedence Game.create uses', () => {
  assert.equal(resolveGameStageId({ stageId: 'tide_reaver', bossId: 'pyro_maw' }, { stageId: 'glacier_ronin' }), 'glacier_ronin')
  assert.equal(resolveGameStageId({ stageId: 'tide_reaver', bossId: 'pyro_maw' }, null), 'tide_reaver')
  assert.equal(resolveGameStageId({ bossId: 'volt_hopper' }, null), 'volt_hopper')
  assert.equal(resolveGameStageId(undefined, undefined), 'pyro_maw')
})
