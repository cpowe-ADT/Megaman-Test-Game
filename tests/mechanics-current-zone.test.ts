import test from 'node:test'
import assert from 'node:assert/strict'
import { currentFlowDirection, currentPush, currentPushOn } from '../src/mechanics/currentZone.ts'
import { combineZonePushes, heroInZone } from '../src/mechanics/forceZone.ts'
import { resolveHeroEnvironment } from '../src/mechanics/heroEnvironment.ts'
import { flowFrameIndex, flowTileOffsetX } from '../src/mechanics/mechanicsV2Visuals.ts'

const current = { id: 'c', x: 0, y: 100, width: 100, height: 100, forceX: -420, maxSpeed: 80 }
const heroAt = (x: number, y: number) => ({ left: x - 8, right: x + 8, top: y - 15, bottom: y + 15 })

test('current zone: pushes while the centre of the hero is inside, with its force and cap', () => {
  assert.deepEqual(currentPushOn(current, heroAt(50, 150)), { id: 'c', forceX: -420, forceY: 0, cap: 80 })
  assert.equal(currentPushOn(current, heroAt(104, 150)), null, 'a toe in the edge does not count')
  assert.equal(heroInZone(current, heroAt(50, 90)), false)
  assert.deepEqual(currentPush({ id: 'd', x: 0, y: 0, width: 10, height: 10 }), { id: 'd', forceX: 420, forceY: 0, cap: 80 })
  assert.deepEqual([currentFlowDirection(current), currentFlowDirection({ ...current, forceX: 10 })], [-1, 1])
})

test('current zone: overlapping pushes add and keep the strongest cap; the hero environment carries them', () => {
  assert.deepEqual(combineZonePushes([{ id: 'a', forceX: 100, forceY: 0, cap: 50 }, { id: 'b', forceX: -30, forceY: 20, cap: 90 }]), { forceX: 70, forceY: 20, cap: 90 })
  assert.deepEqual(combineZonePushes([]), { forceX: 0, forceY: 0, cap: undefined })
  const env = resolveHeroEnvironment({ hero: heroAt(50, 150), grounded: false, clockMs: 0, conveyors: [], iceFloors: [], currents: [current], winds: [] })
  assert.deepEqual([env.environment.forceX, env.environment.pushCap, env.zoneIds], [-420, 80, ['c']])
  const outside = resolveHeroEnvironment({ hero: heroAt(300, 150), grounded: false, clockMs: 0, conveyors: [], iceFloors: [], currents: [current], winds: [] })
  assert.deepEqual([outside.environment.forceX, outside.environment.pushCap], [0, undefined])
})

test('current art: bubbles drift with the flow (the offset falls over time) and the frames loop', () => {
  assert.deepEqual([flowTileOffsetX(0, 36, 48), flowTileOffsetX(1000, 36, 48), flowTileOffsetX(2000, 36, 48)], [0, -36, -24])
  assert.deepEqual([flowFrameIndex(0), flowFrameIndex(120), flowFrameIndex(480)], [0, 1, 0])
})
