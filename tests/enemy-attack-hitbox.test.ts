import test from 'node:test'
import assert from 'node:assert/strict'
import { computeHitboxRect, resolveAttackPhase, resolveHitboxKey } from '../src/enemy/attackHitbox.ts'
import { EnemyCatalog } from '../src/enemy/EnemyCatalog.ts'

test('beam is a timed line hitbox with a 400 ms telegraph (laser_eye)', () => {
  const laserEye = EnemyCatalog.enemy_laser_eye
  assert.equal(laserEye.attack.type, 'beam')
  assert.equal(laserEye.attack.windupMs, 400, 'the telegraph before the beam goes active')
  assert.ok(laserEye.hitboxes.beam, 'the beam has its own named hitbox')
  assert.deepEqual(laserEye.hitboxes.beam, { width: 48, height: 6, offsetX: 10, offsetY: 6 })

  const attack = laserEye.attack
  assert.equal(resolveAttackPhase(attack, -1), 'none')
  assert.equal(resolveAttackPhase(attack, 0), 'windup')
  assert.equal(resolveAttackPhase(attack, 399), 'windup')
  assert.equal(resolveAttackPhase(attack, 400), 'active', 'the line hitbox goes active exactly at the telegraph')
  assert.equal(resolveAttackPhase(attack, 400 + attack.activeMs - 1), 'active')
  assert.equal(resolveAttackPhase(attack, 400 + attack.activeMs), 'recover')
  assert.equal(resolveAttackPhase(attack, 400 + attack.activeMs + attack.recoveryMs), 'none', 'the timed window closes')
})

test('resolveHitboxKey reaches for a beam attack\'s own box only when the family has one; every other attack uses melee', () => {
  const beamBoxes = EnemyCatalog.enemy_laser_eye.hitboxes
  assert.equal(resolveHitboxKey('beam', beamBoxes), 'beam')
  assert.equal(resolveHitboxKey('beam', { melee: beamBoxes.melee }), 'melee', 'no beam box: falls back to melee')
  assert.equal(resolveHitboxKey('melee', beamBoxes), 'melee')
  assert.equal(resolveHitboxKey('charge', EnemyCatalog.enemy_armored_bot.hitboxes), 'melee')
})

test('computeHitboxRect mirrors the box across facing, from the shooter\'s centre', () => {
  const box = { width: 48, height: 6, offsetX: 10, offsetY: 6 }
  const right = computeHitboxRect(100, 50, 1, box)
  assert.deepEqual(right, { x: 110, y: 53, width: 48, height: 6 })
  const left = computeHitboxRect(100, 50, -1, box)
  assert.deepEqual(left, { x: 100 - 10 - 48, y: 53, width: 48, height: 6 })
})
