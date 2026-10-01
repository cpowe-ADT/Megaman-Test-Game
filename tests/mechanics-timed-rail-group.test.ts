import test from 'node:test'
import assert from 'node:assert/strict'
import { RAIL_FOOT_ROW, railFrame } from '../src/mechanics/mechanicsV2Visuals.ts'
import { RAIL_DEFAULTS, railCycleAt, resolveRailGroup } from '../src/mechanics/timedRailGroup.ts'

const group = resolveRailGroup({ id: 'r', rails: [{ id: 'r1', x: 100, y: 236 }, { id: 'r2', x: 170, y: 236, width: 40 }], timing: { onMs: 1000, offMs: 1600 } })

test('timed rails: arc boxes rise from the rail line; defaults 56 wide, 26 tall, 2 damage', () => {
  assert.deepEqual(group.rails[0], { id: 'r1', x: 100, y: 223, width: 56, height: 26, floorY: 236 })
  assert.equal(group.rails[1].width, 40)
  assert.deepEqual([group.damage, group.timing], [2, { onMs: 1000, offMs: 1600, phaseMs: 0 }])
  assert.deepEqual(resolveRailGroup({ id: 'd', rails: [] }).timing, RAIL_DEFAULTS.timing)
})

test('timed rails: one shared timer: off, arming for the last 300ms, then arcing (the only live phase)', () => {
  assert.deepEqual(railCycleAt(group.timing, 0), { phase: 'off', untilArcMs: 1600 })
  assert.deepEqual(railCycleAt(group.timing, 1300), { phase: 'arming', untilArcMs: 300 })
  assert.deepEqual(railCycleAt(group.timing, 1600), { phase: 'arcing', untilArcMs: 0 })
  assert.equal(railCycleAt(group.timing, 2600).phase, 'off')
  assert.equal(railCycleAt({ ...group.timing, phaseMs: 1600 }, 0).phase, 'arcing')
})

test('rail art: off 000, arming blinks sparks 001/003, arcing 002 mirrored every other flicker; feet rows in frame', () => {
  assert.deepEqual(railFrame('off', 0), { index: 0, flipX: false })
  assert.deepEqual([railFrame('arming', 0).index, railFrame('arming', 60).index], [1, 3])
  assert.deepEqual([railFrame('arcing', 0), railFrame('arcing', 50)], [{ index: 2, flipX: false }, { index: 2, flipX: true }])
  for (const row of Object.values(RAIL_FOOT_ROW)) assert.ok(row < 28)
})
