import test from 'node:test'
import assert from 'node:assert/strict'
import { stepIceSlide } from '../src/enemy/iceSlide.ts'

test('stepIceSlide: a stop eases out instead of snapping ("it slides further than it means to")', () => {
  let velocity = 48 // walking at full speed
  const target = 0 // the pure state machine says stop now
  let ticks = 0
  let settled = false
  for (let t = 0; t < 800; t += 10) {
    velocity = stepIceSlide(velocity, target, 10)
    ticks += 1
    if (velocity === target) {
      settled = true
      break
    }
    // Still moving in the original direction while it eases down: it never reverses or overshoots past 0.
    assert.ok(velocity > 0, `still coasting forward at t=${t} (${velocity})`)
    assert.ok(velocity < 48, 'decaying, never above its starting speed')
  }
  assert.ok(settled, 'it eventually stops exactly at the target')
  assert.ok(ticks > 1, 'it took more than one tick: the stop overshot the instant the state machine called for')
})

test('stepIceSlide: no slide when already at the target, and it reaches a new target from rest the same way', () => {
  assert.equal(stepIceSlide(36, 36, 16), 36)
  let velocity = 0
  for (let t = 0; t < 1000; t += 10) {
    velocity = stepIceSlide(velocity, -48, 10)
  }
  assert.equal(velocity, -48)
})
