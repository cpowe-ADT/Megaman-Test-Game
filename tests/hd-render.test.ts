import test from 'node:test'
import assert from 'node:assert/strict'
import { centerScroll, clampScroll, resolveRenderScale, worldViewFor } from '../src/config/hdRenderMath'

test('render scale multiplies the integer zoom by the device pixel ratio and snaps near-integers', () => {
  assert.deepEqual(resolveRenderScale(1920, 1080, 2), { zoom: 4, dpr: 2, scale: 8 })
  assert.deepEqual(resolveRenderScale(1280, 720, 1), { zoom: 2, dpr: 1, scale: 2 })
  // 1.5x window zoom on a 2x display lands on an exact 3x canvas.
  const small = resolveRenderScale(672, 378, 2)
  assert.equal(small.scale, 3)
  // Automation forces dpr 1 so 448x252 viewports render exactly as before.
  assert.deepEqual(resolveRenderScale(448, 252, 2, true), { zoom: 1, dpr: 1, scale: 1 })
  assert.equal(resolveRenderScale(1920, 1080, Number.NaN).dpr, 1)
  assert.equal(resolveRenderScale(1920, 1080, 4).dpr, 3)
})

test('top-left camera scroll clamps to the bounds without a centre offset', () => {
  // World 1400 wide, view 448 wide: scroll runs 0..952.
  assert.equal(clampScroll(-40, 0, 1400, 448), 0)
  assert.equal(clampScroll(500, 0, 1400, 448), 500)
  assert.equal(clampScroll(2000, 0, 1400, 448), 952)
  // Bounds narrower than the view pin to the bounds start.
  assert.equal(clampScroll(30, 100, 200, 448), 100)
})

test('centering and world view use the display size, not the canvas size', () => {
  assert.equal(centerScroll(224, 448), 0)
  assert.equal(centerScroll(900, 448), 676)
  assert.deepEqual(worldViewFor(676, 0, 1792, 1008, 4, 4), { x: 676, y: 0, width: 448, height: 252 })
})
