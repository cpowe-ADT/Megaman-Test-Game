import test from 'node:test'
import assert from 'node:assert/strict'
import { BOSS_MUZZLE_ABOVE_FEET_PX, resolveBossMuzzleY } from '../src/boss/framework/BossProjectileController'
import { liftShotAboveFloor } from '../src/projectiles/projectileLifecycle'

// Measured on tutorial_sentinel (Rook): container y 233.6 on its feet, body 188-236, floor top 236,
// hero body 214-236. The old muzzle (origin.y - 6 = 228) put the 22px shot across the floor (217-239),
// so the bullet-vs-platform collider recycled every boss bullet on its first step.
test('a boss shot leaves at chest height, clear of the floor, and still meets a standing hero', () => {
  const y = resolveBossMuzzleY(233.6, { top: 188, bottom: 236 })
  assert.equal(y, 236 - BOSS_MUZZLE_ABOVE_FEET_PX)
  const half = 11
  assert.ok(y + half < 236, 'shot bottom above the floor')
  assert.ok(y + half > 214 && y - half < 236, 'shot overlaps the hero body')
  assert.equal(resolveBossMuzzleY(233.6, null), 233.6 - BOSS_MUZZLE_ABOVE_FEET_PX)
  assert.equal(resolveBossMuzzleY(100, { top: 90, bottom: 100 }), 96, 'never above the body top + 6')
})

test('liftShotAboveFloor only ever raises a shot, to 1px above the floor', () => {
  assert.equal(liftShotAboveFloor(228, 11, 236), 224)
  assert.equal(liftShotAboveFloor(200, 11, 236), 200)
  assert.equal(liftShotAboveFloor(230, 17, 236, 2), 217)
})
