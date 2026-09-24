import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveSwordReflect, type ReflectCandidate, type SwordReflectInput } from '../src/combat/reflect'
import { PLAYER_GAMEPLAY_CONFIG } from '../src/player/config'
import { createDefaultProjectileRegistry } from '../src/projectiles/defaultRegistry'
// The EnemyProjectileCatalog keys (src/enemy/EnemyProjectiles.ts imports Phaser, so they are listed here).
const ENEMY_CATALOG_KEYS = ['enemy_shot_basic', 'enemy_shot_frost', 'enemy_shot_shield', 'enemy_rocket_lob', 'enemy_mine_drop', 'enemy_beam_pulse']

const hit1 = PLAYER_GAMEPLAY_CONFIG.sword.combo.ground[0]
const sword = (overrides: Partial<SwordReflectInput> = {}): SwordReflectInput => ({
  phase: 'active',
  hitbox: { shape: hit1.hitbox, direction: 'e', grounded: true },
  playerX: 100,
  playerY: 100,
  facing: 1,
  ...overrides
})
const orb = (overrides: Partial<ReflectCandidate> = {}): ReflectCandidate => ({
  x: 122, y: 94, width: 10, height: 12, vx: -200, vy: 10, damage: 1, reflectable: true, owner: 'enemy', ...overrides
})

test('an incoming reflectable shot inside the active box goes straight back at 1.25x, owned by the player, damage max(2, original)', () => {
  const result = resolveSwordReflect(sword(), orb())
  assert.deepEqual(result, { reflected: true, velocity: { x: 250, y: -12.5 }, owner: 'player', damage: 2 })
  const heavy = resolveSwordReflect(sword(), orb({ damage: 3 }))
  assert.equal(heavy.reflected && heavy.damage, 3)
})

test('only active frames reflect, only enemy shots, only reflectable ones with a velocity, only incoming, only inside the box', () => {
  assert.equal(resolveSwordReflect(sword({ phase: 'startup' }), orb()).reflected, false)
  assert.equal(resolveSwordReflect(sword({ phase: 'recovery' }), orb()).reflected, false)
  assert.equal(resolveSwordReflect(sword({ hitbox: null }), orb()).reflected, false)
  assert.deepEqual(resolveSwordReflect(sword(), orb({ owner: 'player' })), { reflected: false, reason: 'not_enemy' })
  assert.deepEqual(resolveSwordReflect(sword(), orb({ reflectable: false })), { reflected: false, reason: 'not_reflectable' })
  assert.deepEqual(resolveSwordReflect(sword(), orb({ vx: 0, vy: 0 })), { reflected: false, reason: 'no_velocity' })
  assert.deepEqual(resolveSwordReflect(sword(), orb({ vx: 200 })), { reflected: false, reason: 'outgoing' })
  assert.deepEqual(resolveSwordReflect(sword(), orb({ x: 200 })), { reflected: false, reason: 'miss' })
})

test('every enemy projectile definition states reflectable; orbs, pellets and missiles yes, beams and boomerangs no', () => {
  const registry = createDefaultProjectileRegistry()
  const enemyIds = [...ENEMY_CATALOG_KEYS, 'enemy_basic_shot', 'boss_fire_orb', 'boss_water_lance', 'boss_arc_shard', 'boss_acid_glob', 'boss_static_orb', 'boss_mag_disc']
  for (const id of enemyIds) {
    const definition = registry.get(id)
    assert.ok(definition, `${id} is registered`)
    assert.equal(typeof definition!.reflectable, 'boolean', `${id} states reflectable`)
  }
  for (const id of ['enemy_shot_basic', 'enemy_basic_shot', 'enemy_rocket_lob', 'boss_static_orb']) assert.equal(registry.get(id)!.reflectable, true, id)
  for (const id of ['enemy_beam_pulse', 'boss_mag_disc']) assert.equal(registry.get(id)!.reflectable, false, id)
})
