import test from 'node:test'
import assert from 'node:assert/strict'
import {
  PROJECTILE_STALL_WATCHDOG_MS,
  resolveProjectileStall
} from '../src/projectiles/projectileLifecycle'

test('moving standard projectiles clear the stall watchdog', () => {
  assert.deepEqual(
    resolveProjectileStall({
      kind: 'standard',
      now: 500,
      stalledSince: 100,
      expectedVelocityX: 260,
      expectedVelocityY: 0,
      actualVelocityX: 260,
      actualVelocityY: 0
    }),
    { stalledSince: null, shouldRecycle: false }
  )
})

test('stopped standard and wave projectiles recycle after the watchdog window', () => {
  for (const kind of ['standard', 'wave'] as const) {
    const started = resolveProjectileStall({
      kind,
      now: 500,
      stalledSince: null,
      expectedVelocityX: 260,
      expectedVelocityY: 0,
      actualVelocityX: 0,
      actualVelocityY: 0
    })
    assert.deepEqual(started, { stalledSince: 500, shouldRecycle: false })

    const expired = resolveProjectileStall({
      kind,
      now: 500 + PROJECTILE_STALL_WATCHDOG_MS,
      stalledSince: started.stalledSince,
      expectedVelocityX: 260,
      expectedVelocityY: 0,
      actualVelocityX: 0,
      actualVelocityY: 0
    })
    assert.equal(expired.shouldRecycle, true)
  }
})

test('lob and boomerang behavior can stop briefly without watchdog recycling', () => {
  for (const kind of ['lob', 'boomerang'] as const) {
    assert.deepEqual(
      resolveProjectileStall({
        kind,
        now: 900,
        stalledSince: 0,
        expectedVelocityX: 260,
        expectedVelocityY: 0,
        actualVelocityX: 0,
        actualVelocityY: 0
      }),
      { stalledSince: null, shouldRecycle: false }
    )
  }
})
