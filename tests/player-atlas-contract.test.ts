import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { getRequiredPlayerAtlasPrefixes } from '../src/player/PlayerAtlasBindings'

test('player atlas contains required locomotion, charge, and slash frame groups', () => {
  const atlasData = JSON.parse(
    readFileSync(new URL('../assets/sprites/player/main/player_main.atlas.json', import.meta.url), 'utf8')
  ) as { frames: Record<string, unknown> }
  const frameNames = Object.keys((atlasData as { frames: Record<string, unknown> }).frames)
  const requiredPrefixes = getRequiredPlayerAtlasPrefixes()

  requiredPrefixes.forEach((prefix) => {
    assert.equal(
      frameNames.some((name) => name.startsWith(prefix)),
      true,
      `missing player atlas group for prefix '${prefix}'`
    )
  })
})
