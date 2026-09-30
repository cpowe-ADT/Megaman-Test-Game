import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DIFFICULTY_TABLE,
  resolveDifficultyModifiers,
  scaleBossDamage,
  scaleBossMaxHp,
  scaleEnemyDamage
} from '../src/progression/difficulty'

test('Normal keeps every multiplier at x1 (today\'s numbers, except Rook\'s own 13c rebalance)', () => {
  assert.deepEqual(resolveDifficultyModifiers('normal'), { bossHpMultiplier: 1, bossDamageMultiplier: 1, enemyDamageMultiplier: 1 })
  assert.equal(scaleBossMaxHp(60, 'normal'), 60)
  assert.equal(scaleBossMaxHp(120, 'normal'), 120)
  assert.equal(scaleBossDamage(1, 'normal'), 1)
  assert.equal(scaleEnemyDamage(2, 'normal'), 2)
})

test('Assist: boss HP x0.85, damage taken x0.5 (prompt 02 phase 2.7)', () => {
  assert.equal(DIFFICULTY_TABLE.assist.bossHpMultiplier, 0.85)
  assert.equal(DIFFICULTY_TABLE.assist.bossDamageMultiplier, 0.5)
  assert.equal(DIFFICULTY_TABLE.assist.enemyDamageMultiplier, 0.5)
  assert.equal(scaleBossMaxHp(100, 'assist'), 85)
  assert.equal(scaleBossMaxHp(60, 'assist'), 51, "Rook's own 60 HP, then Assist's 0.85")
  assert.equal(scaleEnemyDamage(2, 'assist'), 1)
})

test('Veteran: boss HP x1.25, damage taken x1.5 (prompt 02 phase 2.7)', () => {
  assert.equal(DIFFICULTY_TABLE.veteran.bossHpMultiplier, 1.25)
  assert.equal(DIFFICULTY_TABLE.veteran.bossDamageMultiplier, 1.5)
  assert.equal(DIFFICULTY_TABLE.veteran.enemyDamageMultiplier, 1.5)
  assert.equal(scaleBossMaxHp(100, 'veteran'), 125)
  assert.equal(scaleBossMaxHp(60, 'veteran'), 75, "Rook's own 60 HP, then Veteran's 1.25")
  assert.equal(scaleEnemyDamage(2, 'veteran'), 3)
})

test('boss damage and enemy damage always move together: both read prompt 02\'s single "Damage taken" row', () => {
  ;(['assist', 'normal', 'veteran'] as const).forEach((difficulty) => {
    assert.equal(DIFFICULTY_TABLE[difficulty].bossDamageMultiplier, DIFFICULTY_TABLE[difficulty].enemyDamageMultiplier)
  })
})

test('every scaler floors instead of going negative or to zero HP', () => {
  assert.equal(scaleBossMaxHp(1, 'assist'), 1)
  assert.equal(scaleBossDamage(0, 'assist'), 0)
  assert.equal(scaleEnemyDamage(0, 'veteran'), 0)
})

test('an unrecognized difficulty value falls back to Normal (a malformed save)', () => {
  assert.deepEqual(resolveDifficultyModifiers('nonsense' as never), DIFFICULTY_TABLE.normal)
})
