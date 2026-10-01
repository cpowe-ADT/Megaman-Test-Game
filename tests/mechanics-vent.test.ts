import test from 'node:test'
import assert from 'node:assert/strict'
import {
  advanceStageClock,
  isHazardLive,
  resolveHazard,
  SPIKE_DEFAULTS,
  VENT_ARM_MS,
  ventCycleAt,
  ventPhaseAt
} from '../src/mechanics/hazards.ts'

const TIMING = { onMs: 1000, offMs: 1600, phaseMs: 0 }

test('spikes keep 28x10 for 1 by default; a definition sets its own box and damage', () => {
  const plain = resolveHazard({ id: 's', x: 10, y: 230 })
  assert.deepEqual([plain.kind, plain.width, plain.height, plain.damage, plain.timing], ['spikes', SPIKE_DEFAULTS.width, SPIKE_DEFAULTS.height, 1, null])
  const wide = resolveHazard({ id: 'w', x: 10, y: 230, width: 40, height: 12, damage: 3 })
  assert.deepEqual([wide.width, wide.height, wide.damage], [40, 12, 3])
  const vent = resolveHazard({ id: 'v', kind: 'vent', x: 0, y: 0, width: 20, height: 60, timing: { onMs: 500, offMs: 900 } })
  assert.deepEqual([vent.width, vent.height, vent.damage, vent.timing], [20, 60, 2, { onMs: 500, offMs: 900, phaseMs: 0 }])
})

test('a vent is quiet, arms for the last 300ms, then fires for onMs, and cycles', () => {
  assert.equal(ventPhaseAt(TIMING, 0), 'idle')
  assert.equal(ventPhaseAt(TIMING, 1600 - VENT_ARM_MS - 1), 'idle')
  assert.equal(ventPhaseAt(TIMING, 1600 - VENT_ARM_MS), 'arming')
  assert.equal(ventPhaseAt(TIMING, 1599), 'arming')
  assert.equal(ventPhaseAt(TIMING, 1600), 'firing')
  assert.equal(ventPhaseAt(TIMING, 2599), 'firing')
  assert.equal(ventPhaseAt(TIMING, 2600), 'idle')
  assert.equal(ventCycleAt(TIMING, 1400).untilFireMs, 200)
  assert.equal(ventCycleAt(TIMING, 2000).untilFireMs, 0)
})

test('vents on one clock fire together; phaseMs offsets one of them', () => {
  const offset = { ...TIMING, phaseMs: 1300 }
  for (let clock = 0; clock < 6000; clock += 50) {
    assert.equal(ventPhaseAt(TIMING, clock), ventPhaseAt({ ...TIMING }, clock))
  }
  assert.equal(ventPhaseAt(offset, 300), 'firing')
  assert.equal(ventPhaseAt(TIMING, 300), 'idle')
})

test('damage only while firing; spikes always live', () => {
  const vent = resolveHazard({ id: 'v', kind: 'vent', x: 0, y: 0, timing: TIMING })
  assert.equal(isHazardLive(vent, 1500), false, 'arming never hurts')
  assert.equal(isHazardLive(vent, 1700), true)
  assert.equal(isHazardLive(resolveHazard({ id: 's', x: 0, y: 0 }), 1500), true)
})

test('the stage clock holds while the world is paused and caps a long frame', () => {
  assert.equal(advanceStageClock(500, 16, true), 500)
  assert.equal(advanceStageClock(500, 16, false), 516)
  assert.equal(advanceStageClock(500, 5000, false), 600)
  assert.equal(advanceStageClock(500, Number.NaN, false), 500)
})
