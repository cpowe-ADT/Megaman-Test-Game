import test from 'node:test'
import assert from 'node:assert/strict'
import { createDefaultProjectileRegistry } from '../src/projectiles/defaultRegistry'
import { resolvePlayerProjectileId } from '../src/projectiles/definitions/coreProjectiles'

test('default projectile registry includes buster, charge, and special weapon definitions', () => {
  const registry = createDefaultProjectileRegistry()

  assert.equal(registry.has('player_weapon_Buster'), true)
  assert.equal(registry.has('player_buster_charge_lv4'), true)
  assert.equal(registry.has('player_weapon_FlameSerpent'), true)
})

test('projectile definitions retain behavior metadata for special weapons', () => {
  const registry = createDefaultProjectileRegistry()
  const wave = registry.get('player_weapon_FlameSerpent')
  const lob = registry.get('player_weapon_QuakeKnuckle')
  const boomerang = registry.get('player_weapon_MagcutDisc')

  assert.equal(wave?.behavior.kind, 'wave')
  assert.equal(lob?.behavior.kind, 'lob')
  assert.equal(boomerang?.behavior.kind, 'boomerang')
})

test('resolvePlayerProjectileId maps charged buster separately from standard weapon shots', () => {
  assert.equal(resolvePlayerProjectileId('Buster', 0), 'player_weapon_Buster')
  assert.equal(resolvePlayerProjectileId('Buster', 3), 'player_buster_charge_lv3')
  assert.equal(resolvePlayerProjectileId('FlameSerpent', 0), 'player_weapon_FlameSerpent')
})
