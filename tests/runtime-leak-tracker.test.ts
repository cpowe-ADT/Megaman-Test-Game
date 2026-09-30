import test from 'node:test'
import assert from 'node:assert/strict'
import { createRuntimeLeakCounters } from '../src/perf/runtimeLeakTracker'

test('fresh counters start at zero', () => {
  assert.deepEqual(createRuntimeLeakCounters().snapshot(), { listeners: 0, timers: 0 })
})

test('listener and timer counts track add/remove and start/end independently', () => {
  const counters = createRuntimeLeakCounters()
  counters.addListener()
  counters.addListener()
  counters.startTimer()
  assert.deepEqual(counters.snapshot(), { listeners: 2, timers: 1 })
  counters.removeListener()
  counters.endTimer()
  assert.deepEqual(counters.snapshot(), { listeners: 1, timers: 0 })
})

test('a removal or end with no matching start never goes negative', () => {
  const counters = createRuntimeLeakCounters()
  counters.removeListener()
  counters.endTimer()
  assert.deepEqual(counters.snapshot(), { listeners: 0, timers: 0 })
})

test('snapshot returns an independent copy, not a live reference', () => {
  const counters = createRuntimeLeakCounters()
  const first = counters.snapshot()
  counters.addListener()
  assert.deepEqual(first, { listeners: 0, timers: 0 })
  assert.deepEqual(counters.snapshot(), { listeners: 1, timers: 0 })
})
