import test from 'node:test'
import assert from 'node:assert/strict'
import { EnemyCatalog } from '../src/enemy/EnemyCatalog'
import {
  resolveEnemyBehaviorProfile,
  resolveHorizontalBandIntent,
  shouldEnemyAttackNow
} from '../src/enemy/EnemyBehaviorProfiles'

test('behavior profiles expose distinct tactical bands for representative enemies', () => {
  const gunner = resolveEnemyBehaviorProfile(EnemyCatalog.enemy_gunner_bot)
  const armored = resolveEnemyBehaviorProfile(EnemyCatalog.enemy_armored_bot)
  const drone = resolveEnemyBehaviorProfile(EnemyCatalog.enemy_drone)

  assert.equal(gunner.role, 'suppressor')
  assert.equal(armored.role, 'bruiser')
  assert.equal(drone.role, 'harrier')
  assert.ok(gunner.preferredMinRange > armored.preferredMinRange)
  assert.ok(drone.verticalAggroTolerance > gunner.verticalAggroTolerance)
})

test('horizontal band intent advances when target is far and backs off when target is too close', () => {
  const gunner = resolveEnemyBehaviorProfile(EnemyCatalog.enemy_gunner_bot)

  assert.equal(resolveHorizontalBandIntent(gunner, 180), 1)
  assert.equal(resolveHorizontalBandIntent(gunner, 24), 0)
  assert.ok(resolveHorizontalBandIntent(gunner, 52) < 0)
  assert.equal(resolveHorizontalBandIntent(gunner, 96), 0)
})

test('attack gate requires on-screen targets inside the tactical band', () => {
  const laserEye = resolveEnemyBehaviorProfile(EnemyCatalog.enemy_laser_eye)

  assert.equal(shouldEnemyAttackNow(laserEye, 180, 10, true), true)
  assert.equal(shouldEnemyAttackNow(laserEye, 180, 30, true), false)
  assert.equal(shouldEnemyAttackNow(laserEye, 240, 10, false), false)
})
