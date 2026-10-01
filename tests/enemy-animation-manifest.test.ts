import test from 'node:test'
import assert from 'node:assert/strict'
import { EnemyAnimationManifest } from '../src/enemy/EnemyAnimationManifest.ts'
import { EnemyCatalog, EnemyTypeKeys } from '../src/enemy/EnemyCatalog.ts'

function suffixesOf(typeKey: string): string[] {
  return EnemyAnimationManifest[typeKey].map((entry) => entry.key.slice(typeKey.length + 1))
}

test('the manifest is per family: every catalog entry carries the six required keys', () => {
  const required = ['idle', 'move', 'attack_windup', 'attack_active', 'hurt', 'death']
  for (const typeKey of EnemyTypeKeys) {
    const suffixes = suffixesOf(typeKey)
    for (const suffix of required) {
      assert.ok(suffixes.includes(suffix), `${typeKey}: missing required '${suffix}'`)
    }
  }
})

test('hover is per family: only carried by the families whose move slot actually names it', () => {
  assert.ok(EnemyCatalog.enemy_frost_turret.animations.move.endsWith('_hover'))
  assert.ok(suffixesOf('enemy_frost_turret').includes('hover'))

  assert.ok(EnemyCatalog.enemy_gunner_bot.animations.move.endsWith('_move'))
  assert.equal(suffixesOf('enemy_gunner_bot').includes('hover'), false, 'a walker never referenced hover: dropped')
})

test('stunned is per family: carried only by the families with a dedicated stunned pose', () => {
  assert.ok(EnemyCatalog.enemy_gunner_bot.animations.stunned)
  assert.ok(suffixesOf('enemy_gunner_bot').includes('stunned'))

  assert.equal(EnemyCatalog.enemy_rocket_bot.animations.stunned, undefined)
  assert.equal(suffixesOf('enemy_rocket_bot').includes('stunned'), false, 'no stunned pose named: dropped')
})

test('spawn, turn and explode are dropped everywhere: no family names them yet', () => {
  for (const typeKey of EnemyTypeKeys) {
    const suffixes = suffixesOf(typeKey)
    assert.equal(suffixes.includes('spawn'), false, `${typeKey}: spawn`)
    assert.equal(suffixes.includes('turn'), false, `${typeKey}: turn`)
    assert.equal(suffixes.includes('explode'), false, `${typeKey}: explode`)
  }
})

test('every animation a definition actually points at resolves to a manifest entry (unchanged contract)', () => {
  for (const typeKey of EnemyTypeKeys) {
    const definition = EnemyCatalog[typeKey]
    const manifestKeys = EnemyAnimationManifest[typeKey].map((entry) => entry.key)
    for (const animation of Object.values(definition.animations)) {
      assert.ok(manifestKeys.includes(animation), `${typeKey}: ${animation}`)
    }
  }
})
