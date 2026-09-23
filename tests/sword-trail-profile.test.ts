import test from 'node:test'
import assert from 'node:assert/strict'
import {
  SWORD_TRAIL_DIRECTIONS,
  resolveSwordTrailPose
} from '../src/player/SwordTrailProfile'

test('sword trail defines one rooted pose for all eight attack directions', () => {
  assert.deepEqual(
    new Set(SWORD_TRAIL_DIRECTIONS),
    new Set(['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw'])
  )
  for (const direction of SWORD_TRAIL_DIRECTIONS) {
    const pose = resolveSwordTrailPose(direction)
    assert.ok(Number.isFinite(pose.angle), direction)
    assert.ok(Math.abs(pose.anchorX) <= 5, `${direction} x anchor detached from player`)
    assert.ok(pose.anchorY >= -14 && pose.anchorY <= 2, `${direction} y anchor detached from player`)
    assert.ok(pose.sweepEnd > pose.sweepStart, direction)
  }
})

test('east and west sword roots mirror without reversing their attack direction', () => {
  const east = resolveSwordTrailPose('e')
  const west = resolveSwordTrailPose('w')

  assert.equal(east.anchorX, -west.anchorX)
  assert.equal(east.anchorY, west.anchorY)
  assert.equal(west.angle - east.angle, Math.PI)
})

test('unknown sword directions safely resolve to east', () => {
  assert.deepEqual(resolveSwordTrailPose('invalid'), resolveSwordTrailPose('e'))
})
