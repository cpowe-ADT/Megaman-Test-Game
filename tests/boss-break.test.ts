import test from 'node:test'
import assert from 'node:assert/strict'
import { BOSS_BREAK, BossBreakLockout, bossRecoilFrame, breakDirection, breakKnockbackOffset, breakKnockbackX } from '../src/boss/bossBreak'
import { BossBase } from '../src/boss/framework/BossBase'
import { BossProjectileController } from '../src/boss/framework/BossProjectileController'
import type { BossAttackDefinition, BossDefinition } from '../src/boss/framework/types'
import { BOSS_HIT_FLASH_MS, BOSS_WEAK_HIT, bossHitPresentation, bossHitReaction } from '../src/scenes/game/combatRules'

// Part 12f wave 5 (EVAL-P7-002): a weakness hit breaks the boss. Boss time runs in 16 ms ticks here.
const TICK_MS = 16

test('the break timings: a 450 ms stun, a 1.5 s lockout, 24 px back over 180 ms with a 10 px hop', () => {
  assert.deepEqual(
    [BOSS_BREAK.stunMs, BOSS_BREAK.lockoutMs, BOSS_BREAK.knockbackPx, BOSS_BREAK.knockbackMs, BOSS_BREAK.hopPx],
    [450, 1500, 24, 180, 10]
  )
  const weak = bossHitReaction(2.5)
  assert.deepEqual([weak.breaks, weak.stunMs, weak.stunLockoutMs, weak.sfx], [true, 450, 1500, 'boss_hit_weak'])
  assert.equal(BOSS_WEAK_HIT.stunMs, BOSS_BREAK.stunMs)
  const plain = bossHitReaction(1)
  assert.deepEqual([plain.breaks, plain.stunMs, plain.flashMs, plain.whiteFlashMs], [false, undefined, BOSS_HIT_FLASH_MS, 0])
})

test('a break plays the weakness flash, sound and hit-stop; a weakness hit in the lockout blinks like a plain hit', () => {
  const weak = bossHitReaction(2.5)
  assert.deepEqual(bossHitPresentation(weak, { broke: true }), { flashMs: BOSS_HIT_FLASH_MS * 2, whiteFlashMs: BOSS_HIT_FLASH_MS * 2, sfx: 'boss_hit_weak', hitStop: true })
  const plainLook = { flashMs: BOSS_HIT_FLASH_MS, whiteFlashMs: 0, sfx: 'boss_hit', hitStop: false }
  assert.deepEqual(bossHitPresentation(weak, { broke: false }), plainLook, 'inside the lockout: damage and a blink, no break')
  assert.deepEqual(bossHitPresentation(bossHitReaction(1), {}), plainLook)
  assert.equal(bossHitPresentation(weak, { broke: false, defeated: true }).sfx, 'boss_hit_weak', 'a killing weakness blow keeps its sound')
})

test('the hop knockback pushes out fast, peaks 10 px up halfway and lands 24 px back at 180 ms', () => {
  assert.deepEqual(breakKnockbackOffset(0, 'hop'), { dx: 0, dy: -0, done: false })
  const peak = breakKnockbackOffset(BOSS_BREAK.knockbackMs / 2, 'hop')
  assert.equal(Math.round(peak.dy), -BOSS_BREAK.hopPx)
  assert.ok(peak.dx > BOSS_BREAK.knockbackPx / 2, `ease-out: past halfway at half time (${peak.dx})`)
  assert.deepEqual(breakKnockbackOffset(BOSS_BREAK.knockbackMs, 'hop'), { dx: 24, dy: 0, done: true })
  assert.deepEqual(breakKnockbackOffset(900, 'hop'), { dx: 24, dy: 0, done: true })
  let previous = 0
  for (let ms = 0; ms <= BOSS_BREAK.knockbackMs; ms += 5) {
    const { dx, dy } = breakKnockbackOffset(ms, 'hop')
    assert.ok(dx >= previous, `dx never goes back toward the hero (${ms} ms)`)
    assert.ok(dy <= 0 && dy >= -BOSS_BREAK.hopPx, `the hop stays between the start and 10 px up (${ms} ms: ${dy})`)
    previous = dx
  }
})

test('a hover boss drifts 24 px back and bobs instead of hopping, never into the floor it stands on', () => {
  const end = breakKnockbackOffset(BOSS_BREAK.knockbackMs, 'hover')
  assert.deepEqual(end, { dx: 24, dy: 0, done: true })
  let standingLift = 0
  let afloatSink = 0
  for (let ms = 0; ms <= BOSS_BREAK.knockbackMs; ms += 5) {
    const standing = breakKnockbackOffset(ms, 'hover', true)
    const afloat = breakKnockbackOffset(ms, 'hover', false)
    assert.ok(standing.dy <= 0, `standing, the bob lifts (${ms} ms)`)
    assert.ok(afloat.dy >= 0, `afloat, the bob sinks (${ms} ms)`)
    standingLift = Math.max(standingLift, -standing.dy)
    afloatSink = Math.max(afloatSink, afloat.dy)
  }
  assert.equal(Math.round(standingLift), BOSS_BREAK.bobPx)
  assert.equal(Math.round(afloatSink), BOSS_BREAK.bobPx)
  assert.ok(BOSS_BREAK.bobPx < BOSS_BREAK.hopPx, 'a bob, not a hop')
  assert.ok(breakKnockbackOffset(45, 'hover').dx < breakKnockbackOffset(45, 'hop').dx, 'a drift starts slower than a knock')
})

test('the knockback goes away from the hero and stops at the arena safe bounds', () => {
  assert.equal(breakDirection(300, 200, -1), 1)
  assert.equal(breakDirection(100, 200, 1), -1)
  assert.equal(breakDirection(200, 200, 1), -1, 'a hero in the column: back from the facing')
  assert.equal(breakDirection(200, 200, -1), 1)
  const bounds = { minX: 20, maxX: 400 }
  assert.equal(breakKnockbackX(300, 1, 24, bounds), 324)
  assert.equal(breakKnockbackX(390, 1, 24, bounds), 400, 'clamped at the right wall')
  assert.equal(breakKnockbackX(30, -1, 24, bounds), 20, 'clamped at the left wall')
})

test('the recoil pose is the first defeat frame; an atlas of numbered frames holds a hit frame or its last', () => {
  const grouped = { idle: ['pyro_maw/idle/000'], defeat: ['pyro_maw/defeat/000', 'pyro_maw/defeat/001'] }
  assert.equal(bossRecoilFrame(grouped, ['pyro_maw/idle/000', 'pyro_maw/defeat/000', 'pyro_maw/defeat/001']), 'pyro_maw/defeat/000')
  const legacy = Array.from({ length: 12 }, (_, index) => `atlas_sentinel_rook_${String(index).padStart(2, '0')}`)
  assert.equal(bossRecoilFrame({}, legacy), 'atlas_sentinel_rook_11')
  assert.equal(bossRecoilFrame({}, ['rook_idle_0', 'rook_hit_0', 'rook_walk_0']), 'rook_hit_0')
})

test('the lockout lets one break through, then none until 1.5 s of boss time has run', () => {
  const lockout = new BossBreakLockout()
  assert.equal(lockout.tryStart(), true)
  assert.equal(lockout.tryStart(), false)
  lockout.tick(BOSS_BREAK.lockoutMs - 1)
  assert.equal(lockout.ready, false)
  lockout.tick(1)
  assert.equal(lockout.tryStart(), true)
  lockout.reset()
  assert.equal(lockout.ready, true)
})

function breakTestDefinition(): BossDefinition {
  const attack: BossAttackDefinition = {
    id: 'long_swing',
    type: 'melee',
    windupTime: 400,
    activeTime: 400,
    recoveryTime: 400,
    cooldown: 5000,
    rangeMin: 0,
    rangeMax: 999,
    weight: 1,
    hit: { damageAmount: 2, damageType: 'normal' }
  }
  return { boss_id: 'break_test', displayName: 'Break Test', maxHP: 400, contactDamage: 2, introLockMs: 0, phases: [{ threshold: 1 }], attacks: [attack] }
}

function breakHarness() {
  const events: string[] = []
  const brain: BossBase = new BossBase(breakTestDefinition(), {
    onAttackInterrupted: (attack) => events.push(`interrupted:${attack.id}`),
    // The hook runs once the boss is broken, so the controller can show the recoil pose under the hit-stop.
    onBroken: ({ stunMs, interruptedAttack }) => events.push(`broken:${stunMs}:${interruptedAttack?.id ?? '-'}:${brain.isBroken}`)
  })
  brain.OnFightStart()
  brain.unlockIntro()
  const tick = (frames = 1) => {
    for (let frame = 0; frame < frames; frame += 1) {
      brain.TickAI({ nowMs: 0, dtMs: TICK_MS, bossPosition: { x: 0, y: 0 }, playerPosition: { x: 100, y: 0 }, distanceToPlayer: 100, lineOfSight: true, rng: () => 0.5, phaseIndex: 0, speedMultiplier: 1, thinkTimeMultiplier: 1, bossGrounded: true })
    }
  }
  const weakHit = () => brain.ApplyDamage({ amount: 5, type: 'normal', source: 'player', iFrameMs: 120, stunMs: BOSS_WEAK_HIT.stunMs, stunLockoutMs: BOSS_WEAK_HIT.stunLockoutMs, breaks: true })
  const plainHit = () => brain.ApplyDamage({ amount: 2, type: 'normal', source: 'player', iFrameMs: 120 })
  const tickUntil = (lifecycle: string) => {
    for (let guard = 0; guard < 400 && brain.activeAttackLifecycle !== lifecycle; guard += 1) tick()
    assert.equal(brain.activeAttackLifecycle, lifecycle)
  }
  return { brain, events, tick, weakHit, plainHit, tickUntil }
}

for (const lifecycle of ['windup', 'active', 'recovery']) {
  test(`a break in the attack's ${lifecycle} cancels it and holds the boss for 450 ms`, () => {
    const { brain, events, tick, weakHit, tickUntil } = breakHarness()
    tickUntil(lifecycle)
    const hit = weakHit()
    assert.equal(hit.broke, true)
    assert.equal(hit.interruptedAttackId, 'long_swing')
    assert.deepEqual(events, ['interrupted:long_swing', `broken:${BOSS_BREAK.stunMs}:long_swing:true`])
    assert.equal(brain.activeAttackId, undefined)
    assert.equal(brain.state, 'HURT_INVULN')
    assert.equal(brain.isBroken, true)
    tick(28)
    assert.equal(brain.isBroken, true, 'still broken at 448 ms')
    assert.equal(brain.activeAttackId, undefined, 'the cancelled attack does not come back during the stun')
    tick()
    assert.equal(brain.isBroken, false, 'the stun ends after 450 ms')
    assert.notEqual(brain.state, 'HURT_INVULN')
    tick(60)
    assert.equal(brain.activeAttackId, undefined, 'the cancelled attack cools down as if it had played')
  })
}

test('a break lands outside an attack too, and a plain hit inside it never cuts the stun short', () => {
  const { brain, events, tick, weakHit, plainHit } = breakHarness()
  tick(2)
  assert.equal(brain.activeAttackId, undefined)
  assert.equal(weakHit().broke, true)
  assert.deepEqual(events, [`broken:${BOSS_BREAK.stunMs}:-:true`])
  tick(10)
  const pellet = plainHit()
  assert.equal(pellet.accepted, true, 'past the 120 ms i-frames')
  assert.equal(pellet.broke, undefined, 'a plain hit never asks to break')
  tick(17)
  assert.equal(brain.isBroken, true, 'still broken at 432 ms: the pellet kept the break stun')
  tick(2)
  assert.equal(brain.isBroken, false)
})

test('inside the 1.5 s lockout a weakness hit damages but does not break; after it, one breaks again', () => {
  const { brain, events, tick, weakHit } = breakHarness()
  tick(2)
  assert.equal(weakHit().broke, true)
  tick(40)
  const hpBefore = brain.hpSnapshot.current
  const second = weakHit()
  assert.equal(second.accepted, true)
  assert.equal(second.broke, false)
  assert.equal(brain.hpSnapshot.current, hpBefore - 5, 'the weakness damage still lands')
  assert.equal(brain.isBroken, false, 'a plain flinch, not the recoil pose')
  assert.equal(events.filter((entry) => entry.startsWith('broken')).length, 1)
  assert.ok(brain.breakLockoutRemainingMs > 0)
  tick(Math.ceil(brain.breakLockoutRemainingMs / TICK_MS))
  assert.equal(brain.breakLockoutRemainingMs, 0)
  assert.equal(weakHit().broke, true, 'the lockout ran out')
  assert.equal(events.filter((entry) => entry.startsWith('broken')).length, 2)
})

test('a break cancels the shots of a volley still to fire, with its pending spawn and tell', () => {
  let now = 0
  const requests: unknown[] = []
  const members: unknown[] = []
  const controller = new BossProjectileController({
    projectileSystem: { spawn: (request: unknown) => (requests.push(request), members.push({}), {}) } as any,
    projectileGroup: { getTotalUsed: () => members.length, getLength: () => 80, children: { iterate: () => undefined } } as any,
    getNow: () => now,
    isEncounterActive: () => true,
    isControllerDriven: () => true,
    getPlayerPosition: () => ({ x: 24, y: 64 }),
    getBossOrigin: () => ({ x: 96, y: 64, active: true }) as any,
    getBossMovementBody: () => ({ setVelocityX: () => undefined }) as any,
    getTrailTint: () => 0x55ccff,
    createTrailEmitter: () => null,
    spawnGroundSlamHazard: () => undefined
  })
  const volley = () =>
    controller.onBossAttack(
      { name: 'lance volley', state: 'shoot', description: 'Volley', spawns: ['water_lance'], telegraph: { telegraphMs: 100, warningFx: 'glow', anchor: 'self' }, executeMs: 900, cooldownMs: 0 } as any,
      { id: 'lance_volley', hit: { damageAmount: 1 } }
    )
  controller.startLoop()
  volley()
  assert.equal(controller.cancelPendingAttack('lance_volley'), 1, 'a break in the wind-up drops the pending spawn (and its tell)')
  now = 2000
  controller.update(now, 16)
  assert.equal(requests.length, 0)

  volley()
  now = 2100
  controller.update(now, 16)
  assert.equal(requests.length, 1, 'the first lance flies at once; the second waits its interval')
  assert.equal(controller.cancelPendingAttack('lance_volley'), 1, 'a break mid-volley drops the lance still to fire')
  now = 4000
  controller.update(now, 16)
  assert.equal(requests.length, 1, 'no lance after the break')
})
