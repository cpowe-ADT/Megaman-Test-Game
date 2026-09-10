import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { mergeSpriteManifest, countSpriteManifestOverrides } from '../src/assets/privateSpriteManifest'
import type { SpriteSheetManifestV1 } from '../src/assets/types'

function makeManifest(entries: SpriteSheetManifestV1['entries']): SpriteSheetManifestV1 {
  return {
    version: '1',
    generatedAt: '2026-03-11',
    entries
  }
}

test('mergeSpriteManifest replaces matching atlas entries and preserves stable atlas keys', () => {
  const base = makeManifest([
    {
      id: 'player-player_main',
      atlasKey: 'atlas_player_main',
      frame: { width: 48, height: 48 },
      status: 'ready',
      source: {
        runtimeImage: '/assets/sprites/player/main/player_main.png',
        runtimeData: '/assets/sprites/player/main/player_main.atlas.json'
      }
    }
  ])

  const override = makeManifest([
    {
      id: 'private-player-player_main',
      atlasKey: 'atlas_player_main',
      frame: { width: 48, height: 48 },
      status: 'ready',
      source: {
        runtimeImage: '/assets/private/runtime/player_main.png',
        runtimeData: '/assets/private/runtime/player_main.atlas.json'
      }
    }
  ])

  const merged = mergeSpriteManifest(base, override)
  assert.equal(merged.entries.length, 1)
  assert.equal(merged.entries[0]?.atlasKey, 'atlas_player_main')
  assert.equal(merged.entries[0]?.source.runtimeImage, '/assets/private/runtime/player_main.png')
  assert.equal(countSpriteManifestOverrides(base, merged), 1)
})

test('mergeSpriteManifest appends private-only entries that do not exist in the base manifest', () => {
  const base = makeManifest([])
  const override = makeManifest([
    {
      id: 'boss-private-demo',
      atlasKey: 'atlas_private_demo',
      frame: { width: 64, height: 64 },
      status: 'ready',
      source: {
        runtimeImage: '/assets/private/runtime/demo.png',
        runtimeData: '/assets/private/runtime/demo.json'
      }
    }
  ])

  const merged = mergeSpriteManifest(base, override)
  assert.equal(merged.entries.length, 1)
  assert.equal(merged.entries[0]?.atlasKey, 'atlas_private_demo')
})

test('private player combat override spec maps attack groups to source frames instead of base fallback', () => {
  const specPath = path.resolve('scripts/sprites/private_megaman_override_spec.json')
  const spec = JSON.parse(fs.readFileSync(specPath, 'utf8'))
  const groups = spec.player.groups as Record<string, { mode: string; sourceId?: string }>
  const swordFx = spec.player.swordFx as { sourceId: string; indices: number[] }
  const combatKeys = [
    'shoot_air',
    'dash_shoot',
    'charge_start',
    'charge_hold',
    'charge_release_lv1',
    'charge_release_lv2',
    'charge_release_lv3',
    'charge_release_lv4',
    'hurt_light',
    'hurt_heavy',
    'knockdown',
    'getup',
    'death',
    'respawn',
    'slash_ground_e',
    'slash_ground_ne',
    'slash_ground_n',
    'slash_ground_se',
    'slash_ground_s',
    'slash_air_e',
    'slash_air_ne',
    'slash_air_n',
    'slash_air_se',
    'slash_air_s'
  ]

  combatKeys.forEach((key) => {
    assert.equal(groups[key]?.mode, 'source', `${key} should use a source mapping`)
  })

  ;[
    'slash_ground_e',
    'slash_ground_ne',
    'slash_ground_n',
    'slash_ground_se',
    'slash_ground_s',
    'slash_air_e',
    'slash_air_ne',
    'slash_air_n',
    'slash_air_se',
    'slash_air_s'
  ].forEach((key) => {
    assert.equal(
      groups[key]?.sourceId,
      undefined,
      `${key} should stay on the player-scale primary X sheet; the separate sword FX supplies the blade`
    )
    assert.equal(Array.isArray((spec.player.groups as Record<string, { indices?: number[] }>)[key]?.indices), true)
    assert.equal(((spec.player.groups as Record<string, { indices?: number[] }>)[key]?.indices?.length ?? 0) >= 4, true)
  })

  assert.equal(swordFx?.sourceId, 'x_command_mission_ps1style')
  assert.equal(Array.isArray(swordFx?.indices), true)
  assert.equal((swordFx?.indices?.length ?? 0) >= 4, true)
})
