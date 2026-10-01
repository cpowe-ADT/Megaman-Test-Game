import test from 'node:test'
import assert from 'node:assert/strict'
import { resolvePlayerDamageAmount } from '../src/scenes/game/combatRules'
import { DIFFICULTY_TABLE } from '../src/progression/difficulty'

/**
 * Part 13h.3a (EVAL-P6-012): `HitWires.requestPlayerDamage` scales a boss's contact and attack damage by
 * the difficulty table's `bossDamageMultiplier`, the way a regular enemy's damage already scales at spawn.
 * `resolvePlayerDamageAmount` is the pure decision `requestPlayerDamage` calls, so this runs without a scene.
 */

test('a boss contact hit scales by the difficulty table, one case per difficulty', () => {
  ;(['assist', 'normal', 'veteran'] as const).forEach((difficulty) => {
    const expected = Math.max(0, Math.round(4 * DIFFICULTY_TABLE[difficulty].bossDamageMultiplier))
    assert.equal(resolvePlayerDamageAmount('boss_contact', 4, difficulty), expected)
  })
})

test('a boss projectile hit scales the same way as a boss contact hit', () => {
  ;(['assist', 'normal', 'veteran'] as const).forEach((difficulty) => {
    const expected = Math.max(0, Math.round(3 * DIFFICULTY_TABLE[difficulty].bossDamageMultiplier))
    assert.equal(resolvePlayerDamageAmount('boss_projectile', 3, difficulty), expected)
  })
})

test('Assist halves a boss hit (4 -> 2); Veteran raises it (4 -> 6)', () => {
  assert.equal(resolvePlayerDamageAmount('boss_contact', 4, 'assist'), 2)
  assert.equal(resolvePlayerDamageAmount('boss_contact', 4, 'normal'), 4)
  assert.equal(resolvePlayerDamageAmount('boss_contact', 4, 'veteran'), 6)
})

test('a non-boss source passes through unscaled on every difficulty (already scaled at enemy spawn, or not a difficulty axis)', () => {
  ;(['assist', 'normal', 'veteran'] as const).forEach((difficulty) => {
    assert.equal(resolvePlayerDamageAmount('enemy_contact', 2, difficulty), 2)
    assert.equal(resolvePlayerDamageAmount('hazard', 1, difficulty), 1)
    assert.equal(resolvePlayerDamageAmount('fall', 5, difficulty), 5)
  })
})
