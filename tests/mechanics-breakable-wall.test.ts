import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyBreakableWallHit,
  breakableWallCrackStage,
  createBreakableWallState,
  isSaberReachingWall,
  shotReachesWall,
  wallBox
} from '../src/mechanics/breakableWall.ts'

const WALL = { id: 'w', x: 500, y: 118, width: 16, height: 236 }
const BOX = wallBox(WALL)

test('three saber cuts by default; each cracks it further', () => {
  let state = createBreakableWallState(WALL)
  assert.deepEqual([state.phase, state.hitsRequired, breakableWallCrackStage(state)], ['intact', 3, 0])
  state = applyBreakableWallHit(WALL, state, { kind: 'saber' })
  assert.deepEqual([state.phase, state.hits, breakableWallCrackStage(state)], ['cracked', 1, 1])
  state = applyBreakableWallHit(WALL, state, { kind: 'saber' })
  state = applyBreakableWallHit(WALL, state, { kind: 'saber' })
  assert.deepEqual([state.phase, breakableWallCrackStage(state)], ['broken', 3])
  assert.equal(applyBreakableWallHit(WALL, state, { kind: 'saber' }), state, 'broken stays broken')
})

test('a charged shot breaks it outright; a pellet or a shot under minChargeLevel does nothing', () => {
  const state = createBreakableWallState(WALL)
  assert.equal(applyBreakableWallHit(WALL, state, { kind: 'shot', chargeLevel: 0 }), state)
  assert.equal(applyBreakableWallHit(WALL, state, { kind: 'shot', chargeLevel: 1 }).phase, 'broken')
  const heavy = { ...WALL, minChargeLevel: 3 }
  assert.equal(applyBreakableWallHit(heavy, createBreakableWallState(heavy), { kind: 'shot', chargeLevel: 2 }).phase, 'intact')
  assert.equal(createBreakableWallState({ ...WALL, hitsRequired: 1 }).hitsRequired, 1)
})

test('a cut reaches the near face within 44px, facing it, at the wall height', () => {
  const hero = { x: 470, top: 204, bottom: 236 }
  assert.equal(isSaberReachingWall(hero, 1, BOX), true)
  assert.equal(isSaberReachingWall(hero, -1, BOX), false, 'facing away')
  assert.equal(isSaberReachingWall({ ...hero, x: 440 }, 1, BOX), false, 'out of reach')
  assert.equal(isSaberReachingWall({ x: 530, top: 204, bottom: 236 }, -1, BOX), true, 'from the far side')
  assert.equal(isSaberReachingWall({ x: 470, top: 240, bottom: 270 }, 1, BOX), false, 'below it')
})

test('a shot counts one frame before the platform collider would recycle it', () => {
  const shot = { left: 478, right: 490, top: 214, bottom: 220, velocityX: 360 }
  assert.equal(shotReachesWall(shot, BOX, 17), true)
  assert.equal(shotReachesWall({ ...shot, left: 440, right: 452 }, BOX, 17), false)
  assert.equal(shotReachesWall({ ...shot, velocityX: -360 }, BOX, 17), false, 'moving away')
})
