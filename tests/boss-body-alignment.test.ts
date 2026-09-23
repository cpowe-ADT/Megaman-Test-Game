import test from 'node:test'
import assert from 'node:assert/strict'
import {
  bodyBottomFromOffset,
  computeBossBodyOffset,
  contactOffsetFromFrame,
  findLowestOpaqueRow
} from '../src/bosses/bossBodyAlignment'

test('body bottom lands exactly on the measured feet row', () => {
  const input = { bodyWidth: 52, bodyHeight: 50, containerWidth: 32, containerHeight: 32, contactOffsetY: 5 }
  const offset = computeBossBodyOffset(input)
  assert.equal(bodyBottomFromOffset(input, offset), 5)
  // Centered on the container x: position.x = x + offset.x - displayOriginX = x - 26.
  assert.equal(offset.x - input.containerWidth * 0.5, -26)
})

test('the previous origin-only offset left the body about 20px below the feet', () => {
  // The old code: offset.y = -frame.y * (1 - originY) with a 32px container.
  const input = { bodyWidth: 52, bodyHeight: 50, containerWidth: 32, containerHeight: 32, contactOffsetY: 5 }
  const legacyOffset = { x: -26, y: -50 * (1 - 0.86) }
  const legacyBottom = bodyBottomFromOffset(input, legacyOffset)
  assert.ok(legacyBottom - input.contactOffsetY > 18, `legacy gap was ${legacyBottom - input.contactOffsetY}`)
})

test('contact offset comes from the last opaque row and the sprite origin', () => {
  // 64px frame, art baseline on row 59 (bottom edge 60), origin 0.86 -> feet 4.96px below origin.
  assert.ok(Math.abs(contactOffsetFromFrame(64, 0.86, 59) - 4.96) < 1e-9)
  // Art that fills the frame with origin 1 has its feet on the origin.
  assert.equal(contactOffsetFromFrame(50, 1, 49), 0)
})

test('findLowestOpaqueRow scans from the bottom and ignores faint alpha', () => {
  const rows = [0, 0, 255, 255, 4, 0]
  const row = findLowestOpaqueRow((_x, y) => rows[y], 3, rows.length)
  assert.equal(row, 3)
  assert.equal(findLowestOpaqueRow(() => 0, 3, 3), null)
})
