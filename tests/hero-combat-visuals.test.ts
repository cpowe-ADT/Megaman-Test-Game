import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getGameSceneAtlasEntries, getLoadableAtlasEntries } from '../src/assets/manifest'
import type { SpriteSheetManifestV1 } from '../src/assets/types'
import { validateSpriteManifest } from '../src/assets/validateManifest'
import {
  BUSTER_SHOT_VISUALS,
  CHARGE_AURA,
  HERO_COMBAT_ATLASES,
  HERO_ENEMY_SHOT_VISUALS,
  HERO_HIT_FX,
  REFLECTED_SHOT_VISUAL,
  SHOT_IMPACT_FRAME,
  SLASH_ARC_OVERLAYS,
  muzzleFrameForLevel
} from '../src/combat/heroCombatVisuals'
import { PLAYER_GAMEPLAY_CONFIG } from '../src/player/config'
import { createDefaultProjectileRegistry } from '../src/projectiles/defaultRegistry'

const manifest = JSON.parse(fs.readFileSync('assets/sprites/manifest.v1.json', 'utf8'))
const atlasFrames = (path: string): Record<string, { frame: { w: number; h: number } }> => JSON.parse(fs.readFileSync(path, 'utf8')).frames

test('every hero combat frame named in heroCombatVisuals exists at the stated size', () => {
  const [projectiles, effects] = HERO_COMBAT_ATLASES.map((atlas) => atlasFrames(atlas.data))
  const strips = [
    ...Object.values(BUSTER_SHOT_VISUALS), REFLECTED_SHOT_VISUAL, ...Object.values(HERO_ENEMY_SHOT_VISUALS),
    CHARGE_AURA, ...Object.values(SLASH_ARC_OVERLAYS), ...Object.values(HERO_HIT_FX)
  ]
  for (const strip of strips) {
    for (const name of strip.frames) {
      const frame = (projectiles[name] ?? effects[name])?.frame
      assert.ok(frame, `${name} exists`)
      assert.deepEqual([frame.w, frame.h], [strip.width, strip.height], name)
    }
  }
  for (const name of [SHOT_IMPACT_FRAME, muzzleFrameForLevel(0), muzzleFrameForLevel(2), muzzleFrameForLevel(4)]) {
    assert.ok(projectiles[name], `${name} exists`)
  }
})

test('each slash arc is centred on its hit box, and the box covers at least 90% of the drawn arc', () => {
  const { ground, air } = PLAYER_GAMEPLAY_CONFIG.sword.combo
  const pairs = [[SLASH_ARC_OVERLAYS.combo1, ground[0]], [SLASH_ARC_OVERLAYS.combo2, ground[1]], [SLASH_ARC_OVERLAYS.combo3, ground[2]], [SLASH_ARC_OVERLAYS.air_spin, air]] as const
  for (const [arc, hit] of pairs) {
    assert.equal(hit.hitbox.kind, 'rect')
    if (hit.hitbox.kind !== 'rect') continue
    assert.deepEqual(arc.anchor, { x: hit.hitbox.offsetX, y: hit.hitbox.offsetY }, arc.frames[0])
    assert.ok(hit.hitbox.width >= arc.width * 0.9 && hit.hitbox.height >= arc.height * 0.9, `${arc.frames[0]} box ${hit.hitbox.width}x${hit.hitbox.height} vs art ${arc.width}x${arc.height}`)
  }
})

test('Buster shots draw from projectiles_hero with a body as wide as the drawing and the old sensor height', () => {
  const registry = createDefaultProjectileRegistry()
  const ids = ['player_weapon_Buster', 'player_buster_charge_lv1', 'player_buster_charge_lv2', 'player_buster_charge_lv3', 'player_buster_charge_lv4']
  const oldSensor = [54, ...([1, 2, 3, 4] as const).map((level) => (54 + level * 2) * PLAYER_GAMEPLAY_CONFIG.blaster.perLevelProjectile[level].size)]
  ids.forEach((id, level) => {
    const definition = registry.get(id)!
    const art = BUSTER_SHOT_VISUALS[level as 0 | 1 | 2 | 3 | 4]
    assert.equal(definition.visual.textureKey, 'atlas_projectiles_hero', id)
    assert.equal(definition.visual.frame, art.frames[0], id)
    assert.equal(definition.visual.scale, art.scale, id)
    assert.equal(definition.hitbox!.width * art.scale, art.width * art.scale, `${id} body width = drawn width`)
    assert.ok(Math.abs(definition.hitbox!.height * art.scale - oldSensor[level]) <= art.scale, `${id} sensor height kept`)
  })
})

test('hero combat atlases are manifest entries the Game scene loads, not Preload', () => {
  const result = validateSpriteManifest(manifest as SpriteSheetManifestV1)
  assert.equal(result.valid, true, result.errors.join('; '))
  const gameKeys = getGameSceneAtlasEntries(result.manifest!).map((entry) => entry.atlasKey).sort()
  assert.deepEqual(gameKeys, HERO_COMBAT_ATLASES.map((atlas) => atlas.key).sort())
  const preloadKeys = new Set(getLoadableAtlasEntries(result.manifest!).map((entry) => entry.atlasKey))
  gameKeys.forEach((key) => assert.equal(preloadKeys.has(key), false, `${key} is not preloaded`))
  for (const entry of getGameSceneAtlasEntries(result.manifest!)) {
    const atlas = HERO_COMBAT_ATLASES.find((candidate) => candidate.key === entry.atlasKey)!
    assert.equal(entry.runtimeImage, `/${atlas.image}`)
    assert.equal(entry.runtimeData, `/${atlas.data}`)
  }
})
