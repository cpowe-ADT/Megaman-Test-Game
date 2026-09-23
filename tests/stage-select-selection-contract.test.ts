import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSlotClick, truncateLabel } from '../src/scenes/stage-select/selectionContract'

test('resolveSlotClick selects new slot without confirming', () => {
  const result = resolveSlotClick(0, 3)

  assert.equal(result.nextIndex, 3)
  assert.equal(result.shouldConfirm, false)
})

test('resolveSlotClick confirms when clicking already-selected slot', () => {
  const result = resolveSlotClick(4, 4)

  assert.equal(result.nextIndex, 4)
  assert.equal(result.shouldConfirm, true)
})

test('truncateLabel appends ellipsis for long labels', () => {
  const value = truncateLabel('SENTINEL ROOK EXTENDED', 12)
  assert.equal(value, 'SENTINEL RO…')
})

test('truncateLabel keeps short labels unchanged', () => {
  const value = truncateLabel('PYRO MAW', 12)
  assert.equal(value, 'PYRO MAW')
})
