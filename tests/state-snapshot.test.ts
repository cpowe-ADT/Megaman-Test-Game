import test from 'node:test'
import assert from 'node:assert/strict'
import { makeGameCombatSnapshot, summarizeSpriteKinematics } from '../src/tools/debug/StateSnapshot'

test('summarizeSpriteKinematics returns rounded kinematics', () => {
  const summary = summarizeSpriteKinematics({
    x: 10.7,
    y: 20.2,
    body: {
      velocity: {
        x: 2.9,
        y: -3.3
      }
    }
  })

  assert.deepEqual(summary, {
    x: 11,
    y: 20,
    vx: 3,
    vy: -3
  })
})

test('makeGameCombatSnapshot clamps timers and hp values', () => {
  const snapshot = makeGameCombatSnapshot({
    recentHits: [],
    totals: {
      total: 0,
      accepted: 0,
      rejected: 0,
      byTarget: {
        player: 0,
        enemy: 0,
        boss: 0,
        environment: 0
      }
    },
    player: {
      hp: -2,
      maxHp: 0,
      dashCooldownMs: -10,
      slideRemainingMs: -4,
      chargeMs: -1,
      iFramesMs: -20
    },
    boss: {
      hp: { current: -6, max: 0 },
      phase: 'PHASE_A'
    }
  })

  assert.equal(snapshot.player.hp, 0)
  assert.equal(snapshot.player.maxHp, 1)
  assert.equal(snapshot.player.dashCooldownMs, 0)
  assert.equal(snapshot.player.slideRemainingMs, 0)
  assert.equal(snapshot.player.chargeMs, 0)
  assert.equal(snapshot.player.iFramesMs, 0)
  assert.deepEqual(snapshot.boss.hp, { current: 0, max: 1 })
})
