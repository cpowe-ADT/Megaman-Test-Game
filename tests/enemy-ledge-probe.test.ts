import test from 'node:test'
import assert from 'node:assert/strict'
import { hasFloorAt, isWalkBlocked, type SolidRect } from '../src/enemy/floorProbe.ts'
import { EnemyCatalog } from '../src/enemy/EnemyCatalog.ts'

// A 96px platform (a ledge with a pit on both sides) and a separate ground strip further right, floor
// top y 200, as `EnemyMotor.atLedge` reads from the stage's static group (`readSolidRects`).
const PLATFORM: SolidRect = { left: 100, right: 196, top: 200, bottom: 216 }
const FAR_GROUND: SolidRect = { left: 260, right: 400, top: 200, bottom: 216 }
const SOLIDS = [PLATFORM, FAR_GROUND]

function walkerProbe(x: number, facing: 1 | -1) {
  const { width, height } = EnemyCatalog.enemy_gunner_bot.collider
  return { x, halfWidth: width / 2, floorTop: 200, bodyHeight: height, facing }
}

test('EnemyMotor.atLedge: a walker on a platform is not blocked at its centre, but turns at the platform edge', () => {
  assert.equal(isWalkBlocked(SOLIDS, walkerProbe(148, 1)), false, 'clear in the middle of the platform')
  assert.equal(isWalkBlocked(SOLIDS, walkerProbe(190, 1)), true, 'the right edge: one more step leaves the floor')
  assert.equal(isWalkBlocked(SOLIDS, walkerProbe(106, -1)), true, 'the left edge, walking the other way')
})

test('EnemyMotor.atLedge: a walker beside a pit never steps into it, even with open floor beyond', () => {
  // The pit is the gap between the platform (ends at 196) and the far ground (starts at 260): a walker
  // at the platform's right edge is blocked even though solid ground exists further along the same row.
  assert.equal(hasFloorAt(SOLIDS, 220, 200), false, 'the gap really has no floor')
  assert.equal(isWalkBlocked(SOLIDS, walkerProbe(192, 1)), true)
  assert.equal(isWalkBlocked(SOLIDS, walkerProbe(268, 1)), false, 'on the far ground, clear of its own edges')
})

test('EnemyMotor.atLedge: patrol bounds stop it even on open floor', () => {
  const atBound = { ...walkerProbe(150, 1), bounds: { minX: 120, maxX: 150 } }
  assert.equal(isWalkBlocked(SOLIDS, atBound), true, 'reached its patrol bound, still well short of the platform edge')
  const shortOfBound = { ...walkerProbe(148, 1), bounds: { minX: 120, maxX: 150 } }
  assert.equal(isWalkBlocked(SOLIDS, shortOfBound), false, 'not there yet, and the floor ahead is clear')
})
