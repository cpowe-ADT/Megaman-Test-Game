import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_RENDER_SCALE, centerScroll, clampScroll, resolveRenderScale, worldViewFor } from '../src/config/hdRenderMath'

test('render scale multiplies the integer zoom by the device pixel ratio and snaps near-integers', () => {
  assert.deepEqual(resolveRenderScale(1512, 860, 2), { zoom: 3, dpr: 2, scale: 6, cssZoom: 0.5 })
  assert.deepEqual(resolveRenderScale(1280, 720, 1), { zoom: 2, dpr: 1, scale: 2, cssZoom: 1 })
  // 1.5x window zoom on a 2x display lands on an exact 3x canvas.
  const small = resolveRenderScale(672, 378, 2)
  assert.equal(small.scale, 3)
  assert.equal(small.cssZoom, 0.5)
  // Automation forces dpr 1 so 448x252 viewports render exactly as before.
  assert.deepEqual(resolveRenderScale(448, 252, 2, true), { zoom: 1, dpr: 1, scale: 1, cssZoom: 1 })
  assert.equal(resolveRenderScale(1920, 1080, Number.NaN).dpr, 1)
  assert.equal(resolveRenderScale(1920, 1080, 4).dpr, 3)
})

test('render scale stops at the cap and the CSS zoom keeps the on-screen size', () => {
  assert.equal(MAX_RENDER_SCALE, 6)
  for (const [width, height, dpr] of [
    [1920, 1080, 2],
    [2560, 1440, 2],
    [1920, 1080, 3],
    [3840, 2160, 1]
  ]) {
    const view = resolveRenderScale(width, height, dpr)
    assert.ok(view.scale <= MAX_RENDER_SCALE, `${width}x${height}@${dpr}x scale ${view.scale}`)
    // The canvas still covers 448*zoom CSS pixels: canvas width times CSS zoom.
    assert.ok(Math.abs(448 * view.scale * view.cssZoom - 448 * view.zoom) < 1e-9, `${width}x${height}@${dpr}x on-screen width`)
    // Each game pixel is still a whole number of device pixels, so pixel art stays square.
    assert.equal(Number.isInteger(view.zoom * view.dpr), true)
  }
  assert.deepEqual(resolveRenderScale(2560, 1440, 2), { zoom: 5, dpr: 2, scale: 6, cssZoom: 5 / 6 })
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
