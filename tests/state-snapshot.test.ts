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
      bodyProfileKey: 'dash',
      blocked: { down: 1 as unknown as boolean },
      touching: { left: 1 as unknown as boolean },
      dropThroughActive: 1 as unknown as boolean,
      coyoteMs: -5,
      jumpBufferMs: 12.6,
      dashRemainingMs: 33.4,
      dashCooldownMs: -10,
      dashStarted: 1 as unknown as boolean,
      dashEnded: 0 as unknown as boolean,
      slideRemainingMs: -4,
      wallSide: 1,
      lastLandingSpeed: 412.8,
      lastJumpSource: 'coyote',
      chargeMs: -1,
      shotsFiredTotal: -3,
      lastProjectileSpawnMs: -7,
      lastProjectileSpawnFrame: 18.2,
      lastProjectile: null,
      iFramesMs: -20,
      lastDamageSource: 'contact',
      lastDamageTier: 'heavy',
      knockback: { x: 125.8, y: -92.2 },
      wallSliding: 1 as unknown as boolean,
      touchButtons: { jump: 1, shoot: 0 },
      virtualControlsVisible: 0 as unknown as boolean
    },
    boss: {
      hp: { current: -6, max: 0 },
      phase: 'PHASE_A'
    }
  })

  assert.equal(snapshot.player.hp, 0)
  assert.equal(snapshot.player.maxHp, 1)
  assert.equal(snapshot.player.bodyProfileKey, 'dash')
  assert.deepEqual(snapshot.player.blocked, { up: false, down: true, left: false, right: false })
  assert.deepEqual(snapshot.player.touching, { up: false, down: false, left: true, right: false })
  assert.equal(snapshot.player.dropThroughActive, true)
  assert.equal(snapshot.player.coyoteMs, 0)
  assert.equal(snapshot.player.jumpBufferMs, 13)
  assert.equal(snapshot.player.dashRemainingMs, 33)
  assert.equal(snapshot.player.dashCooldownMs, 0)
  assert.equal(snapshot.player.dashStarted, true)
  assert.equal(snapshot.player.dashEnded, false)
  assert.equal(snapshot.player.slideRemainingMs, 0)
  assert.equal(snapshot.player.wallSide, 1)
  assert.equal(snapshot.player.lastLandingSpeed, 413)
  assert.equal(snapshot.player.lastJumpSource, 'coyote')
  assert.equal(snapshot.player.chargeMs, 0)
  assert.equal(snapshot.player.shotsFiredTotal, 0)
  assert.equal(snapshot.player.lastProjectileSpawnMs, 0)
  assert.equal(snapshot.player.lastProjectileSpawnFrame, 18)
  assert.equal(snapshot.player.lastProjectile, null)
  assert.equal(snapshot.player.iFramesMs, 0)
  assert.equal(snapshot.player.lastDamageSource, 'contact')
  assert.equal(snapshot.player.lastDamageTier, 'heavy')
  assert.deepEqual(snapshot.player.knockback, { x: 126, y: -92 })
  assert.equal(snapshot.player.wallSliding, true)
  assert.deepEqual(snapshot.player.touchButtons, { jump: true, shoot: false })
  assert.equal(snapshot.player.virtualControlsVisible, false)
  assert.deepEqual(snapshot.boss.hp, { current: 0, max: 1 })
})
