import test from 'node:test'
import assert from 'node:assert/strict'
import { CombatantRegistry } from '../src/combat/Combatant'
import { HitResolver } from '../src/combat/HitResolver'
import { IFrameController } from '../src/combat/IFrameController'

function createTarget(id: string, hp: number) {
  let currentHp = hp
  return {
    id,
    iFrames: new IFrameController(),
    getHp: () => currentHp,
    getMaxHp: () => hp,
    setHp: (next: number) => {
      currentHp = next
    }
  }
}

test('HitResolver applies damage and can defeat target', () => {
  const registry = new CombatantRegistry()
  const target = createTarget('enemy_1', 3)
  registry.register(target)

  const resolver = new HitResolver(registry)
  const first = resolver.resolve({
    sourceId: 'player',
    targetId: 'enemy_1',
    amount: 1,
    kind: 'bullet',
    nowMs: 100
  })

  const second = resolver.resolve({
    sourceId: 'player',
    targetId: 'enemy_1',
    amount: 2,
    kind: 'bullet',
    nowMs: 120
  })

  assert.equal(first.accepted, true)
  assert.equal(first.remainingHp, 2)
  assert.equal(second.accepted, true)
  assert.equal(second.remainingHp, 0)
  assert.equal(second.defeated, true)
})

test('HitResolver rejects hits during i-frames', () => {
  const registry = new CombatantRegistry()
  const target = createTarget('boss_1', 10)
  registry.register(target)

  const resolver = new HitResolver(registry)
  const applied = resolver.resolve({
    sourceId: 'player',
    targetId: 'boss_1',
    amount: 3,
    kind: 'direct',
    nowMs: 100,
    iFrameMs: 200
  })

  const blocked = resolver.resolve({
    sourceId: 'player',
    targetId: 'boss_1',
    amount: 3,
    kind: 'direct',
    nowMs: 180
  })

  const afterWindow = resolver.resolve({
    sourceId: 'player',
    targetId: 'boss_1',
    amount: 3,
    kind: 'direct',
    nowMs: 340
  })

  assert.equal(applied.accepted, true)
  assert.equal(blocked.accepted, false)
  assert.equal(blocked.reason, 'invulnerable')
  assert.equal(afterWindow.accepted, true)
  assert.equal(afterWindow.remainingHp, 4)
})
