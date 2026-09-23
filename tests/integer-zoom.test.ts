import test from 'node:test'
import assert from 'node:assert/strict'
import { GAME_HEIGHT, GAME_WIDTH, resolveGameZoom } from '../src/config/renderPolicy'

test('game zoom is a whole number whenever 2x fits, else the exact ratio', () => {
  assert.equal(resolveGameZoom(1920, 1080), 4)
  assert.equal(resolveGameZoom(1280, 720), 2)
  assert.equal(resolveGameZoom(865, 800), Math.min(865 / GAME_WIDTH, 800 / GAME_HEIGHT))
  assert.equal(resolveGameZoom(GAME_WIDTH, GAME_HEIGHT), 1)
  assert.equal(resolveGameZoom(224, 126), 0.5)
  assert.equal(resolveGameZoom(0, 0), 1)
})
