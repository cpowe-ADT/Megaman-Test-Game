import test from 'node:test'
import assert from 'node:assert/strict'
import { validateSpriteManifest } from '../src/assets/validateManifest'

test('validateSpriteManifest accepts a planned entry', () => {
  const result = validateSpriteManifest({
    version: '1',
    generatedAt: '2026-02-08',
    entries: [
      {
        id: 'boss-sentinel-rook',
        bossId: 'sentinel_rook',
        atlasKey: 'atlas_sentinel_rook',
        frame: { width: 48, height: 48 },
        status: 'planned',
        source: {
          runtimeImage: '/assets/sprites/bosses/sentinel_rook.png',
          runtimeData: '/assets/sprites/bosses/sentinel_rook.json'
        }
      }
    ]
  })

  assert.equal(result.valid, true)
  if (result.valid) {
    assert.equal(result.manifest.entries.length, 1)
  }
})

test('validateSpriteManifest rejects a ready entry missing runtime paths', () => {
  const result = validateSpriteManifest({
    version: '1',
    generatedAt: '2026-02-08',
    entries: [
      {
        id: 'boss-pyro-maw',
        bossId: 'pyro_maw',
        atlasKey: 'atlas_pyro_maw',
        frame: { width: 56, height: 48 },
        status: 'ready',
        source: {}
      }
    ]
  })

  assert.equal(result.valid, false)
  if (!result.valid) {
    assert.ok(result.errors.some((error) => error.includes('requires source.runtimeImage and source.runtimeData')))
  }
})

test('validateSpriteManifest rejects non-positive frame sizes', () => {
  const result = validateSpriteManifest({
    version: '1',
    generatedAt: '2026-02-08',
    entries: [
      {
        id: 'boss-gale-vixen',
        bossId: 'gale_vixen',
        atlasKey: 'atlas_gale_vixen',
        frame: { width: 0, height: 46 },
        status: 'planned',
        source: {}
      }
    ]
  })

  assert.equal(result.valid, false)
})
