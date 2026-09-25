import test from 'node:test'
import assert from 'node:assert/strict'
import { CONVEYOR_DEFAULT_SPEED, conveyorBox, conveyorCarryAt, conveyorCarryDeltaX, conveyorSpeed } from '../src/mechanics/conveyor.ts'
import { resolveHeroEnvironment } from '../src/mechanics/heroEnvironment.ts'
import { conveyorFrameIndex, conveyorFrameMs, conveyorTileLayout } from '../src/mechanics/mechanicsV2Visuals.ts'
import { stageMechanicPlatforms } from '../src/mechanics/stageMechanics.ts'

const belt = { id: 'b', x: 100, y: 242, width: 112, speed: 60 }
const standingAt = (x: number) => ({ left: x - 8, right: x + 8, top: 206, bottom: 236 })

test('conveyor: a grounded actor on the belt gets its speed; airborne or beside it gets none', () => {
  assert.deepEqual(conveyorBox(belt), { left: 44, right: 156, top: 236, bottom: 248 })
  assert.deepEqual(conveyorCarryAt([belt], standingAt(100), true), { id: 'b', speed: 60 })
  assert.deepEqual(conveyorCarryAt([belt], standingAt(100), false), { id: null, speed: 0 })
  assert.deepEqual(conveyorCarryAt([belt], standingAt(200), true), { id: null, speed: 0 })
  assert.deepEqual(conveyorCarryAt([belt], { ...standingAt(100), bottom: 230 }, true), { id: null, speed: 0 }, 'feet above the belt')
  assert.equal(conveyorSpeed({ ...belt, speed: undefined }), CONVEYOR_DEFAULT_SPEED)
})

test('conveyor: other bodies move by speed x time; the hero gets it as carry; the belt is a solid 12px platform', () => {
  assert.equal(conveyorCarryDeltaX(60, 500), 30)
  assert.equal(conveyorCarryDeltaX(-60, 1000), -60)
  assert.equal(conveyorCarryDeltaX(60, -5), 0)
  const env = resolveHeroEnvironment({ hero: standingAt(100), grounded: true, clockMs: 0, conveyors: [{ ...belt, speed: -45 }], iceFloors: [], currents: [], winds: [] })
  assert.deepEqual([env.environment.carryVelocityX, env.beltId, env.environment.surface], [-45, 'b', 'ground'])
  const [platform] = stageMechanicPlatforms({ conveyors: [belt] })
  assert.deepEqual([platform.id, platform.type, platform.height, platform.y], ['b', 'solid', 12, 242])
})

test('conveyor art: the chevrons step faster on a faster belt, a stopped belt holds 000, segments tile the length', () => {
  assert.deepEqual([conveyorFrameMs(60), conveyorFrameMs(240), conveyorFrameMs(10)], [80, 40, 240])
  assert.deepEqual([conveyorFrameIndex(0, 999), conveyorFrameIndex(60, 0), conveyorFrameIndex(60, 80), conveyorFrameIndex(-60, 250), conveyorFrameIndex(60, 330)], [0, 0, 1, 3, 0])
  assert.deepEqual(conveyorTileLayout(168), { tiles: 3, scaleX: 1 })
  assert.deepEqual(conveyorTileLayout(100), { tiles: 2, scaleX: 100 / 112 })
})
