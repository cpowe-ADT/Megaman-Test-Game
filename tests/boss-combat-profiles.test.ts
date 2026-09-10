import test from 'node:test'
import assert from 'node:assert/strict'
import { BOSS_ROSTER } from '../src/bosses/roster'
import {
  BOSS_COMBAT_PROFILES,
  getBossAttackCombatProfile,
  resolveBossAnchorX,
  resolveBossAttackLifecycle
} from '../src/bosses/bossCombatProfiles'
import { BossMotionController } from '../src/bosses/BossMotionController'
import type { BossAttackDefinition } from '../src/boss/framework/types'

test('every authored boss attack has a typed movement, facing, and action-animation contract', () => {
  Object.values(BOSS_ROSTER).forEach((boss) => {
    const profile = BOSS_COMBAT_PROFILES[boss.id]
    assert.ok(profile, `${boss.id} should have a combat profile`)
    boss.attacks.forEach((attack) => {
      const attackId = attack.name.toLowerCase().replace(/[^a-z0-9]+/g, '_')
      const contract = getBossAttackCombatProfile(boss.id, attackId)
      assert.ok(contract, `${boss.id}.${attackId} should have a combat contract`)
      assert.equal(contract.attackId, attackId)
      assert.ok(contract.motion.kind)
      assert.ok(contract.animation.windup)
      assert.ok(contract.animation.active)
      assert.ok(contract.animation.recovery)
      assert.ok(contract.strategyTags.length > 0)
    })
  })
})

test('boss action lifecycle exposes windup, active, recovery, landing, and done', () => {
  const timing = { windupTime: 100, activeTime: 200, recoveryTime: 300 }
  assert.equal(resolveBossAttackLifecycle(0, timing, 80), 'windup')
  assert.equal(resolveBossAttackLifecycle(100, timing, 80), 'active')
  assert.equal(resolveBossAttackLifecycle(300, timing, 80), 'recovery')
  assert.equal(resolveBossAttackLifecycle(600, timing, 80), 'landing')
  assert.equal(resolveBossAttackLifecycle(680, timing, 80), 'done')
})

test('safe anchor resolution remains inside the room and can choose the far side', () => {
  assert.equal(resolveBossAnchorX([0.2, 0.5, 0.8], 100, 300, 115, true), 260)
  assert.equal(resolveBossAnchorX([], 100, 300, 115, true), 200)
})

test('pilot fights and finale preserve their authored combat identities', () => {
  assert.equal(getBossAttackCombatProfile('sentinel_rook', 'giga_hop')?.motion.kind, 'jump_to')
  assert.equal(getBossAttackCombatProfile('pyro_maw', 'ignition_dash')?.motion.kind, 'dash_through')
  assert.equal(getBossAttackCombatProfile('tide_reaver', 'riptide_crash')?.motion.kind, 'dive_to')
  assert.equal(getBossAttackCombatProfile('ferro_blade', 'vector_slice')?.motion.kind, 'teleport_to')
  assert.equal(getBossAttackCombatProfile('basalt_titan', 'crustquake')?.motion.kind, 'slam_to_floor')
  assert.deepEqual(BOSS_COMBAT_PROFILES.omega_core.deterministicDeck?.map((deck) => deck.length), [2, 3, 4])
})

const attackDefinition: BossAttackDefinition = {
  id: 'ignition_dash',
  type: 'dash',
  windupTime: 100,
  activeTime: 200,
  recoveryTime: 100,
  cooldown: 500,
  rangeMin: 0,
  rangeMax: 300,
  weight: 1,
  hit: { damageAmount: 2, damageType: 'fire' }
}

test('dash waits for active frames and keeps the windup facing after crossing the player', () => {
  const profile = getBossAttackCombatProfile('pyro_maw', 'ignition_dash')!
  const controller = new BossMotionController(BOSS_COMBAT_PROFILES.pyro_maw.room)
  controller.beginAttack(1000, attackDefinition, profile, 200, 100, 210)

  const windup = controller.update({
    nowMs: 1050,
    x: 200,
    y: 210,
    velocityX: 0,
    velocityY: 0,
    grounded: true,
    playerX: 100,
    playerY: 210,
    groundY: 210,
    bounds: { minX: 40, maxX: 400 }
  })!
  assert.equal(windup.phase, 'windup')
  assert.equal(windup.velocityX, 0)
  assert.equal(windup.facing, -1)

  const activeAfterCross = controller.update({
    nowMs: 1120,
    x: 80,
    y: 210,
    velocityX: -286,
    velocityY: 0,
    grounded: true,
    playerX: 120,
    playerY: 210,
    groundY: 210,
    bounds: { minX: 40, maxX: 400 }
  })!
  assert.equal(activeAfterCross.phase, 'active')
  assert.equal(activeAfterCross.facing, -1)
  assert.equal(activeAfterCross.velocityX, -286)
})

test('jump, hover, dive, teleport, and slam commands produce bounded authored motion', () => {
  const room = BOSS_COMBAT_PROFILES.ferro_blade.room
  const input = {
    nowMs: 1120,
    x: 200,
    y: 210,
    velocityX: 0,
    velocityY: 0,
    grounded: true,
    playerX: 100,
    playerY: 210,
    groundY: 210,
    bounds: { minX: 40, maxX: 400 }
  }

  ;(['giga_hop', 'jet_levitate', 'riptide_crash', 'vector_slice', 'crustquake'] as const).forEach(
    (attackId) => {
      const bossId =
        attackId === 'giga_hop'
          ? 'sentinel_rook'
          : attackId === 'jet_levitate' || attackId === 'riptide_crash'
            ? 'tide_reaver'
            : attackId === 'vector_slice'
              ? 'ferro_blade'
              : 'basalt_titan'
      const contract = getBossAttackCombatProfile(bossId, attackId)!
      const controller = new BossMotionController(room)
      controller.beginAttack(
        1000,
        { ...attackDefinition, id: attackId, windupTime: attackId === 'crustquake' ? 200 : 100 },
        contract,
        200,
        100,
        210
      )
      const frame = controller.update(input)!
      assert.equal(frame.intent, contract.motion.kind)
      if (frame.setX != null) {
        assert.ok(frame.setX >= input.bounds.minX && frame.setX <= input.bounds.maxX)
      }
    }
  )
})
