import test from 'node:test'
import assert from 'node:assert/strict'
import { STRICT_PIXEL_RENDER_POLICY } from '../src/config/renderPolicy'

test('strict pixel render policy is enforced', () => {
  assert.equal(STRICT_PIXEL_RENDER_POLICY.antialias, false)
  assert.equal(STRICT_PIXEL_RENDER_POLICY.pixelArt, true)
  assert.equal(STRICT_PIXEL_RENDER_POLICY.roundPixels, true)
  assert.equal(STRICT_PIXEL_RENDER_POLICY.resolution, 1)
})
