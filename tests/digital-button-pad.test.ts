import test from 'node:test'
import assert from 'node:assert/strict'
import { DigitalButtonPad } from '../src/input/DigitalButtonPad'

test('DigitalButtonPad reports held, pressed, and released edges', () => {
  const pad = new DigitalButtonPad()

  pad.setHeld('jump', true)
  pad.setHeld('dash', true)
  assert.equal(pad.getHeldSnapshot().jump, true)
  const first = pad.sample()
  assert.equal(first.jump.held, true)
  assert.equal(first.jump.pressed, true)
  assert.equal(first.jump.released, false)
  assert.equal(first.dash.pressed, true)

  const second = pad.sample()
  assert.equal(second.jump.held, true)
  assert.equal(second.jump.pressed, false)
  assert.equal(second.dash.pressed, false)
  assert.equal(pad.getHeldSnapshot().dash, true)

  pad.setHeld('jump', false)
  pad.setHeld('dash', false)
  const third = pad.sample()
  assert.equal(third.jump.held, false)
  assert.equal(third.jump.released, true)
  assert.equal(third.dash.released, true)
})
