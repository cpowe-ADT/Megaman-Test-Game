import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveProjectileClashResult } from '../src/projectiles/collision/projectileClash'

test('projectile clash fails when player shot is weak, uncharged, and has no pierce', () => {
  const result = resolveProjectileClashResult({
    playerDamage: 1,
    enemyDamage: 2,
    chargeLevel: 0,
    pierceRemaining: 0
  })

  assert.equal(result.playerSurvives, false)
  assert.equal(result.nextPierceRemaining, 0)
})

test('projectile clash succeeds when charge level is high enough', () => {
  const result = resolveProjectileClashResult({
    playerDamage: 1,
    enemyDamage: 3,
    chargeLevel: 2,
    pierceRemaining: 0
  })

  assert.equal(result.playerSurvives, true)
  assert.equal(result.nextPierceRemaining, 0)
})

test('projectile clash consumes one pierce charge on punch-through', () => {
  const result = resolveProjectileClashResult({
    playerDamage: 1,
    enemyDamage: 3,
    chargeLevel: 0,
    pierceRemaining: 2
  })

  assert.equal(result.playerSurvives, true)
  assert.equal(result.nextPierceRemaining, 1)
})
