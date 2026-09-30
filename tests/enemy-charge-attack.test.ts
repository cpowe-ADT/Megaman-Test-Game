import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveChargeVelocityX } from '../src/enemy/chargeAttack.ts'
import { EnemyCatalog } from '../src/enemy/EnemyCatalog.ts'

test('charge consumes chargeSpeed: holds through the telegraph, commits to chargeSpeed toward its facing while active, stops in recovery', () => {
  const armored = EnemyCatalog.enemy_armored_bot.attack
  assert.equal(armored.type, 'charge')
  assert.equal(armored.chargeSpeed, 150)

  assert.equal(resolveChargeVelocityX(armored, 'windup', 1), 0)
  assert.equal(resolveChargeVelocityX(armored, 'active', 1), 150)
  assert.equal(resolveChargeVelocityX(armored, 'active', -1), -150)
  assert.equal(resolveChargeVelocityX(armored, 'recover', 1), 0)
  assert.equal(resolveChargeVelocityX(armored, 'none', 1), null, 'no attack running: the caller keeps its own intent')
})

test('the bouncer charges faster than the armored bot, and a non-charge attack never returns a velocity', () => {
  const bouncer = EnemyCatalog.enemy_bouncer.attack
  assert.equal(bouncer.type, 'charge')
  assert.equal(resolveChargeVelocityX(bouncer, 'active', 1), bouncer.chargeSpeed)
  assert.ok((bouncer.chargeSpeed ?? 0) > 0)

  const gunner = EnemyCatalog.enemy_gunner_bot.attack
  assert.equal(gunner.type, 'projectile')
  for (const phase of ['windup', 'active', 'recover', 'none'] as const) {
    assert.equal(resolveChargeVelocityX(gunner, phase, 1), null)
  }
})

test('a charge attack with no chargeSpeed configured never overrides the caller intent', () => {
  assert.equal(resolveChargeVelocityX({ type: 'charge' }, 'active', 1), null)
})
