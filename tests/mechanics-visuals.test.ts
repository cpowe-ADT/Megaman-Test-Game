import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { getGameSceneAtlasEntries, getLoadableAtlasEntries } from '../src/assets/manifest'
import type { SpriteSheetManifestV1 } from '../src/assets/types'
import { validateSpriteManifest } from '../src/assets/validateManifest'
import { DEFAULT_BINDINGS } from '../src/input/ActionState'
import { applyBreakableWallHit, createBreakableWallState } from '../src/mechanics/breakableWall'
import {
  CRUMBLE_SLAB_TOP_ROW,
  GATE_SIGN_RANGE_PX,
  MECHANICS_ATLAS,
  MECHANICS_FRAME_SIZE,
  SLAG_SURFACE_FRAMES,
  bottomAlignedTileOffset,
  breakableWallFrameIndex,
  crumbleFrameIndex,
  energyGateFrameIndex,
  gateSignPosition,
  gateSignText,
  isGateSignShown,
  mechanicsFrame,
  scrapGateFrameIndex,
  slagFrameIndices,
  ventFlameFrameIndex,
  ventNozzleFrameIndex,
  wallTileLayout,
  type FrameIndex,
  type MechanicsGroup
} from '../src/mechanics/mechanicsVisuals'

const atlas = JSON.parse(fs.readFileSync(MECHANICS_ATLAS.data, 'utf8')).frames as Record<string, { frame: { w: number; h: number } }>
const manifest = JSON.parse(fs.readFileSync('assets/sprites/manifest.v1.json', 'utf8'))

test('every mechanics frame exists at its stated size', () => {
  for (const group of Object.keys(MECHANICS_FRAME_SIZE) as MechanicsGroup[]) {
    for (const index of [0, 1, 2, 3] as FrameIndex[]) {
      const frame = atlas[mechanicsFrame(group, index)]?.frame
      assert.ok(frame, mechanicsFrame(group, index))
      assert.deepEqual([frame.w, frame.h], [MECHANICS_FRAME_SIZE[group].width, MECHANICS_FRAME_SIZE[group].height], mechanicsFrame(group, index))
    }
  }
})

test('mechanics_v1 is a Game-scene atlas in the manifest, not preloaded', () => {
  const result = validateSpriteManifest(manifest as SpriteSheetManifestV1)
  assert.equal(result.valid, true, result.errors.join('; '))
  const entry = getGameSceneAtlasEntries(result.manifest!).find((candidate) => candidate.atlasKey === MECHANICS_ATLAS.key)
  assert.ok(entry, 'loadScope game')
  assert.equal(entry.runtimeImage, `/${MECHANICS_ATLAS.image}`)
  assert.equal(entry.runtimeData, `/${MECHANICS_ATLAS.data}`)
  assert.equal(getLoadableAtlasEntries(result.manifest!).some((candidate) => candidate.atlasKey === MECHANICS_ATLAS.key), false)
})

test('vent nozzle is cold, blinks dull/bright while arming, fires; the jet shows only while firing', () => {
  assert.equal(ventNozzleFrameIndex('idle', 0), 0)
  assert.deepEqual(new Set([0, 60, 120, 180].map((ms) => ventNozzleFrameIndex('arming', ms))), new Set([1, 2]))
  assert.equal(ventNozzleFrameIndex('firing', 0), 3)
  assert.equal(ventFlameFrameIndex('idle', 0), null)
  assert.equal(ventFlameFrameIndex('arming', 0), null)
  assert.equal(new Set([0, 70, 140, 210].map((ms) => ventFlameFrameIndex('firing', ms))).size, 4, 'four flicker frames')
})

test('slag cycles slowly, never through the offset surface frame 000', () => {
  const seen = new Set<number>()
  for (let ms = 0; ms < 5000; ms += 50) seen.add(slagFrameIndices(ms).surface)
  assert.deepEqual([...seen].sort(), [...SLAG_SURFACE_FRAMES].sort())
  assert.equal(slagFrameIndices(0).surface, slagFrameIndices(200).surface, 'slow: one frame lasts over 200ms')
})

test('breakable wall frame steps with hits over hitsRequired and collapses when broken', () => {
  const def = { id: 'w', x: 0, y: 0, width: 16, height: 56, hitsRequired: 3 }
  let state = createBreakableWallState(def)
  const frames = [breakableWallFrameIndex(state)]
  for (let hit = 0; hit < 3; hit += 1) {
    state = applyBreakableWallHit(def, state, { kind: 'saber' })
    frames.push(breakableWallFrameIndex(state))
  }
  assert.deepEqual(frames, [0, 1, 2, 3])
})

test('wall tiles fill the height with whole tiles at no less than the minimum width', () => {
  const heatWorks = wallTileLayout(16, 56)
  assert.equal(heatWorks.drawWidth, 28)
  assert.ok(Math.abs(heatWorks.tiles * 52 * heatWorks.tileScaleY - 56) < 1e-9)
  assert.equal(wallTileLayout(48, 20).tiles, 1)
})

test('crumble: intact, cracked then breaking through the shake, falling, intact again', () => {
  assert.equal(crumbleFrameIndex({ phase: 'solid', timerMs: 0 }, 400), 0)
  assert.equal(crumbleFrameIndex({ phase: 'shaking', timerMs: 50 }, 400), 1)
  assert.equal(crumbleFrameIndex({ phase: 'shaking', timerMs: 350 }, 400), 2)
  assert.equal(crumbleFrameIndex({ phase: 'fallen', timerMs: 0 }, 400), 3)
  assert.ok(Object.values(CRUMBLE_SLAB_TOP_ROW).every((row) => row >= 0 && row < MECHANICS_FRAME_SIZE.crumble.height))
})

test('gates: the scrap gate steps by cuts over hitsRequired, the energy gate shimmers, tiles end on the floor', () => {
  assert.deepEqual([0, 1, 2].map((progress) => scrapGateFrameIndex({ phase: 'locked', progress, hitsRequired: 3 })), [0, 1, 2])
  assert.equal(scrapGateFrameIndex({ phase: 'open', progress: 3, hitsRequired: 3 }), 3)
  assert.equal(new Set([0, 110, 220, 330].map(energyGateFrameIndex)).size, 4)
  for (const height of [236, 488, 64, 30]) assert.equal((height + bottomAlignedTileOffset(height, 64)) % 64, 0, `height ${height}`)
})

test('gate signs read the live bindings and show only near a closed verb gate', () => {
  assert.equal(gateSignText('saber', DEFAULT_BINDINGS), 'C  SLASH')
  assert.equal(gateSignText('charge', DEFAULT_BINDINGS), 'HOLD X  CHARGE')
  assert.equal(gateSignText('dash', DEFAULT_BINDINGS), 'Z  DASH')
  assert.equal(gateSignText('jump', DEFAULT_BINDINGS), 'SPACE  JUMP')
  assert.equal(gateSignText('wall_jump', DEFAULT_BINDINGS), 'WALL  KICK')
  assert.equal(gateSignText('saber', { ...DEFAULT_BINDINGS, saber: ['KeyV'] }), 'V  SLASH', 'rebinding changes the sign')
  const locked = { phase: 'locked' as const, requiredInput: 'saber' as const }
  assert.equal(isGateSignShown(locked, 2240 - GATE_SIGN_RANGE_PX, 2240), true)
  assert.equal(isGateSignShown(locked, 2240 - GATE_SIGN_RANGE_PX - 1, 2240), false)
  assert.equal(isGateSignShown({ ...locked, phase: 'open' }, 2230, 2240), false)
  assert.equal(isGateSignShown({ phase: 'locked', requiredInput: null }, 2230, 2240), false, 'no sign on a fight gate')
})

test('a sign on the room edge stays inside the view and below the HUD band', () => {
  const view = { x: 1792, y: 0, width: 448, height: 252 }
  const at = gateSignPosition({ gateX: 2240, floorY: 236, signWidth: 60, signHeight: 12, view, hudBandPx: 58 })
  assert.ok(at.x + 30 <= view.x + view.width && at.x - 30 >= view.x, `x ${at.x}`)
  assert.ok(at.y - 6 >= view.y + 58 && at.y + 6 <= view.y + view.height, `y ${at.y}`)
  const high = gateSignPosition({ gateX: 1344, floorY: 236, signWidth: 60, signHeight: 12, view: { x: 896, y: -200, width: 448, height: 252 }, hudBandPx: 58 })
  assert.ok(high.y + 6 <= 52 && high.y - 6 >= -200 + 58, `clamped into a raised view (${high.y})`)
})
