import test from 'node:test'
import assert from 'node:assert/strict'
import { getWeaponConfig, SPECIAL_WEAPON_ORDER } from '../src/content/weapons'
import {
  canAffordPlayerShot,
  energyAfterPlayerShot,
  resolvePlayerShot
} from '../src/projectiles/playerShot'
import { createDefaultProjectileRegistry } from '../src/projectiles/defaultRegistry'

test('resolvePlayerShot builds canonical Buster pellet and max-charge commands', () => {
  const pellet = resolvePlayerShot({
    weaponId: 'Buster',
    intent: { chargeLevel: 0, facing: 1 },
    x: 10,
    y: 20
  })
  const charged = resolvePlayerShot({
    weaponId: 'Buster',
    intent: { chargeLevel: 4, facing: -1 },
    x: 30,
    y: 40
  })

  assert.equal(pellet.projectileId, 'player_weapon_Buster')
  assert.equal(pellet.chargeLevel, 0)
  assert.equal(pellet.spawnRequest.metadata?.weaponId, 'Buster')
  assert.equal(charged.projectileId, 'player_buster_charge_lv4')
  assert.equal(charged.chargeLevel, 4)
  assert.equal(charged.impactFxKey, 'fx_impact_charge_lv4')
  assert.equal(charged.spawnRequest.metadata?.chargeLevel, 4)
})

test('every special weapon resolves without charge and retains its configured energy cost', () => {
  for (const weaponId of SPECIAL_WEAPON_ORDER) {
    const weapon = getWeaponConfig(weaponId)
    const shot = resolvePlayerShot({
      weaponId,
      intent: { chargeLevel: 4, facing: 1 },
      x: 0,
      y: 0
    })

    assert.equal(shot.projectileId, `player_weapon_${weaponId}`)
    assert.equal(shot.chargeLevel, 0)
    assert.equal(shot.energyCost, weapon.energyCost)
    assert.equal(shot.spawnRequest.metadata?.weaponElement, weapon.element)
  }
})

test('weapon energy commits only after a successful projectile spawn', () => {
  assert.equal(canAffordPlayerShot(4, 4), true)
  assert.equal(canAffordPlayerShot(3, 4), false)
  assert.equal(energyAfterPlayerShot(10, 4, false), 10)
  assert.equal(energyAfterPlayerShot(10, 4, true), 6)
  assert.equal(energyAfterPlayerShot(2, 0, true), 2)
})

test('every Buster charge tier has a muzzle-height combat sensor', () => {
  const registry = createDefaultProjectileRegistry()
  const ids = [
    'player_weapon_Buster',
    'player_buster_charge_lv1',
    'player_buster_charge_lv2',
    'player_buster_charge_lv3',
    'player_buster_charge_lv4'
  ]

  for (const id of ids) {
    const hitbox = registry.get(id)?.hitbox
    assert.ok(hitbox, `${id} should define a combat hitbox`)
    assert.ok(hitbox.height >= 54, `${id} should reach short ground-enemy hurtboxes`)
  }
})
