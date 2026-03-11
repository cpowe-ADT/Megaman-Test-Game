import test from 'node:test'
import assert from 'node:assert/strict'
import { CombatDebugBus } from '../src/tools/debug/CombatDebugBus'

test('CombatDebugBus enforces rolling capacity and keeps newest events', () => {
  const bus = new CombatDebugBus(3)

  bus.record({ source: 'player', target: 'enemy', amount: 1, kind: 'bullet', accepted: true, timeMs: 1 })
  bus.record({ source: 'enemy', target: 'player', amount: 1, kind: 'bullet', accepted: true, timeMs: 2 })
  bus.record({ source: 'player', target: 'boss', amount: 2, kind: 'direct', accepted: true, timeMs: 3 })
  bus.record({ source: 'hazard', target: 'player', amount: 1, kind: 'contact', accepted: false, timeMs: 4 })

  const recent = bus.getRecentHits(5)
  assert.equal(recent.length, 3)
  assert.equal(recent[0]?.timeMs, 2)
  assert.equal(recent[2]?.timeMs, 4)
})

test('CombatDebugBus totals summarize accepted/rejected and targets', () => {
  const bus = new CombatDebugBus(10)
  bus.record({ source: 'player', target: 'enemy', amount: 1, kind: 'bullet', accepted: true, timeMs: 10 })
  bus.record({ source: 'enemy', target: 'player', amount: 1, kind: 'bullet', accepted: true, timeMs: 11 })
  bus.record({ source: 'player', target: 'boss', amount: 2, kind: 'slash', accepted: false, timeMs: 12 })

  const totals = bus.getTotals()
  assert.equal(totals.total, 3)
  assert.equal(totals.accepted, 2)
  assert.equal(totals.rejected, 1)
  assert.equal(totals.byTarget.enemy, 1)
  assert.equal(totals.byTarget.player, 1)
  assert.equal(totals.byTarget.boss, 1)
})
