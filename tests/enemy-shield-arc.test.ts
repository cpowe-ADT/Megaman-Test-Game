import test from 'node:test'
import assert from 'node:assert/strict'
import { frontShieldGapSide, shieldBlocksShot, SHIELD_PUNCH_THROUGH_DAMAGE } from '../src/enemy/shieldArc.ts'
import { EnemyCatalog } from '../src/enemy/EnemyCatalog.ts'
import { resolveLevelEnemyMarkers } from '../src/enemy/EnemyLevelData.ts'

test('shield_drone carries a fixed front shield', () => {
  assert.equal(EnemyCatalog.enemy_shield_drone.shieldArc, true)
  assert.equal(EnemyCatalog.enemy_drone.shieldArc, undefined, 'the plain drone has no shield')
})

test('frontShieldGapSide covers the front: the gap is always behind the current facing', () => {
  assert.equal(frontShieldGapSide(1), -1)
  assert.equal(frontShieldGapSide(-1), 1)
})

test('shieldBlocksShot: a shot from the shielded side clashes; the same shot from the gap, or the buster punch-through rule, goes through', () => {
  const gapSide = frontShieldGapSide(1) // facing right: shield covers the right, gap on the left
  assert.equal(shieldBlocksShot(gapSide, { side: 1, amount: 1 }), true, 'a basic shot from the front')
  assert.equal(shieldBlocksShot(gapSide, { side: -1, amount: 1 }), false, 'the same shot from behind, through the gap')
  assert.equal(
    shieldBlocksShot(gapSide, { side: 1, amount: SHIELD_PUNCH_THROUGH_DAMAGE }),
    false,
    'a charged shot punches the front shield (the buster clash rule: chargeLevel >= 2)'
  )
  assert.equal(shieldBlocksShot(gapSide, { side: 1, amount: SHIELD_PUNCH_THROUGH_DAMAGE - 1 }), true)
})

test('12c mini-boss variants: the Tide nest carries the shield variant, the Glacier walker carries the slide variant', () => {
  const tideNest = resolveLevelEnemyMarkers('tide_reaver').find((marker) => marker.typeKey === 'relay_turret_nest')
  assert.equal(tideNest?.variant, 'tide_shield')

  const glacierWalker = resolveLevelEnemyMarkers('glacier_ronin').find((marker) => marker.typeKey === 'custodian_walker_glacier')
  assert.equal(glacierWalker?.variant, 'glacier_slide')
})
