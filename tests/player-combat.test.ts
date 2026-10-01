import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerCombat } from '../src/player/PlayerCombat'
import { FEEL_FRAME_MS, PLAYER_GAMEPLAY_CONFIG } from '../src/player/config'
import { iFrameBlinkAlpha, IFRAME_BLINK_ALPHA } from '../src/player/hitFeel'
import { DEFAULT_PLAYER_FEATURE_FLAGS } from '../src/player/featureFlags'
import type { PlayerIntent, PlayerRuntimeEvent } from '../src/player/types'

function createIntent(overrides: Partial<PlayerIntent> = {}): PlayerIntent {
  return {
    moveAxis: 0,
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
    dashPressed: false,
    dashHeld: false,
    dashReleased: false,
    shootPressed: false,
    shootHeld: false,
    shootReleased: false,
    slashPressed: false,
    crouchHeld: false,
    aim: { x: 1, y: 0 },
    ...overrides
  }
}

function createCombat(options: { chargeShot?: boolean; fireRateMs?: number } = {}) {
  const emitted: PlayerRuntimeEvent[][] = []
  const damageAccepted: number[] = []
  const knockbacks: Array<{ x: number; y: number }> = []
  const player = {
    scene: {
      time: { now: 0 },
      events: {
        emit: (_name: string, events: PlayerRuntimeEvent[]) => emitted.push(events)
      }
    },
    setFlipX: () => {}
  } as any
  const combat = new PlayerCombat(
    player,
    {
      ...DEFAULT_PLAYER_FEATURE_FLAGS,
      enableChargeShot: options.chargeShot ?? false
    },
    { ...PLAYER_GAMEPLAY_CONFIG.blaster, fireRateMs: options.fireRateMs ?? PLAYER_GAMEPLAY_CONFIG.blaster.fireRateMs },
    PLAYER_GAMEPLAY_CONFIG.sword,
    PLAYER_GAMEPLAY_CONFIG.damage,
    {
      onDamageAccepted: (damage) => damageAccepted.push(damage),
      onKnockback: (x, y) => knockbacks.push({ x, y })
    }
  )
  return { combat, player, emitted, damageAccepted, knockbacks }
}

function projectileEvents(events: PlayerRuntimeEvent[]): Extract<PlayerRuntimeEvent, { type: 'projectile' }>[] {
  return events.filter((event): event is Extract<PlayerRuntimeEvent, { type: 'projectile' }> => event.type === 'projectile')
}

test('PlayerCombat enforces projectile fire-rate cadence', () => {
  const { combat, player } = createCombat()

  const first = combat.update(createIntent({ shootPressed: true }), 0, 16, 1, true, false)
  assert.equal(projectileEvents(first.events).length, 1)

  player.scene.time.now = PLAYER_GAMEPLAY_CONFIG.blaster.fireRateMs - 1
  const blocked = combat.update(createIntent({ shootPressed: true }), player.scene.time.now, 16, 1, true, false)
  assert.equal(projectileEvents(blocked.events).length, 0)

  player.scene.time.now = PLAYER_GAMEPLAY_CONFIG.blaster.fireRateMs
  const second = combat.update(createIntent({ shootPressed: true }), player.scene.time.now, 16, 1, true, false)
  assert.equal(projectileEvents(second.events).length, 1)
})

test('PlayerCombat reports charge thresholds and releases matching charge projectile', () => {
  const { combat, player } = createCombat({ chargeShot: true })
  combat.update(createIntent({ shootPressed: true, shootHeld: true }), 0, 0, 1, true, false)

  const thresholds = PLAYER_GAMEPLAY_CONFIG.blaster.chargeThresholdsMs
  let held = 0
  thresholds.forEach((threshold, index) => {
    player.scene.time.now = threshold
    const result = combat.update(createIntent({ shootHeld: true }), threshold, threshold - held, 1, true, false)
    held = threshold
    assert.equal(result.snapshot.chargeLevel, index + 1)
  })

  player.scene.time.now = thresholds[3]
  const released = combat.update(createIntent({ shootReleased: true }), thresholds[3], 16, 1, true, false)
  const projectile = projectileEvents(released.events)[0]
  assert.equal(projectile?.request.type, 'charge')
  assert.equal(projectile?.request.chargeLevel, 4)
  assert.equal(released.snapshot.chargeReleased, true)
  assert.equal(released.snapshot.releasedChargeLevel, 4)
})

test('PlayerCombat fires a non-chargeable weapon once on press and not again on release', () => {
  const { combat, player } = createCombat({ chargeShot: true })

  const pressed = combat.update(createIntent({ shootPressed: true, shootHeld: true }), 0, 16, 1, true, false, false)
  assert.equal(projectileEvents(pressed.events).length, 1)
  assert.equal(pressed.snapshot.charging, false)

  player.scene.time.now = PLAYER_GAMEPLAY_CONFIG.blaster.fireRateMs
  const released = combat.update(
    createIntent({ shootReleased: true }),
    player.scene.time.now,
    16,
    1,
    true,
    false,
    false
  )
  assert.equal(projectileEvents(released.events).length, 0)
})

test('PlayerCombat advances slash startup, active, recovery, and clear windows', () => {
  const { combat } = createCombat()
  const frameMs = 1000 / 60

  const started = combat.update(createIntent({ slashPressed: true }), 0, 0, 1, true, false)
  assert.equal(started.snapshot.slashPhase, 'startup')

  // Combo hit 1 owns the timing now (config.ts sword.combo.ground[0]).
  const hit1 = PLAYER_GAMEPLAY_CONFIG.sword.combo.ground[0]
  const active = combat.update(createIntent(), 100, hit1.startupFrames * frameMs, 1, true, false)
  assert.equal(active.snapshot.slashPhase, 'active')
  assert.equal(active.events.some((event) => event.type === 'hitbox'), true)

  const recovery = combat.update(createIntent(), 170, hit1.activeFrames * frameMs, 1, true, false)
  assert.equal(recovery.snapshot.slashPhase, 'recovery')

  const cleared = combat.update(createIntent(), 240, hit1.recoveryFrames * frameMs, 1, true, false)
  assert.equal(cleared.snapshot.slashPhase, undefined)
  assert.equal(cleared.snapshot.slashActive, false)
})

test('PlayerCombat accepts one directional hit and rejects repeats during i-frames', () => {
  const { combat, damageAccepted, knockbacks } = createCombat({ chargeShot: true })

  const first = combat.receiveDamage(2, true, 1, 'heavy')
  const repeated = combat.receiveDamage(2, true, -1, 'heavy')

  assert.equal(first.accepted, true)
  assert.equal(first.events.some((event) => event.type === 'hitstop' && event.frames === 10), true)
  assert.equal(repeated.accepted, false)
  assert.deepEqual(damageAccepted, [2])
  assert.deepEqual(knockbacks, [
    {
      x: PLAYER_GAMEPLAY_CONFIG.damage.knockback.ground.x,
      y: PLAYER_GAMEPLAY_CONFIG.damage.knockback.ground.y
    }
  ])
})

test('PlayerCombat accepts damage after i-frames expire and supports fatal bypass', () => {
  const { combat, damageAccepted } = createCombat()
  assert.equal(combat.receiveDamage(1, false, -1, 'light').accepted, true)

  combat.update(
    createIntent(),
    PLAYER_GAMEPLAY_CONFIG.damage.iFramesMs,
    PLAYER_GAMEPLAY_CONFIG.damage.iFramesMs,
    1,
    false,
    false
  )
  assert.equal(combat.receiveDamage(1, false, -1, 'light').accepted, true)
  assert.equal(
    combat.receiveDamage(8, false, 1, 'heavy', {
      bypassIFrames: true,
      knockback: { x: 0, y: 0 }
    }).accepted,
    true
  )
  assert.deepEqual(damageAccepted, [1, 1, 8])
})

test('modal charge cancellation leaves invulnerability intact and produces no deferred shot', () => {
  const { combat } = createCombat({ chargeShot: true })
  combat.grantInvulnerability(1000)
  combat.update(createIntent({ shootPressed: true, shootHeld: true }), 0, 0, 1, true, false)
  combat.cancelPendingCharge()
  const resumed = combat.update(createIntent({ shootReleased: true }), 800, 0, 1, true, false)
  assert.equal(resumed.snapshot.charging, false)
  assert.equal(resumed.snapshot.iFramesRemainingMs, 1000)
  assert.equal(projectileEvents(resumed.events).length, 0)
  const pressed = combat.update(createIntent({ shootPressed: true, shootHeld: true }), 900, 0, 1, true, false)
  assert.equal(projectileEvents(pressed.events).length, 1, 'the pellet fires on press')
  const next = combat.update(createIntent({ shootReleased: true }), 950, 50, 1, true, false)
  assert.equal(projectileEvents(next.events).length, 0, 'a release below level 1 fires nothing more')
})

// ---- prompt 05 §5.2 items 1 to 3 ----

function slashThroughWindow(combat: PlayerCombat, grounded: boolean): PlayerRuntimeEvent[] {
  const all: PlayerRuntimeEvent[] = []
  all.push(...combat.update(createIntent({ slashPressed: true }), 0, FEEL_FRAME_MS, 1, grounded, false).events)
  for (let frame = 1; frame < 30; frame += 1) {
    all.push(...combat.update(createIntent(), frame * FEEL_FRAME_MS, FEEL_FRAME_MS, 1, grounded, false).events)
  }
  return all
}

test('5.2-1 a whiffed slash emits no hit-stop or shake; the hitbox carries hit 1 (ground) / air spin hit-stop for the hit path', () => {
  const ground = slashThroughWindow(createCombat().combat, true)
  assert.equal(ground.filter((event) => event.type === 'hitstop').length, 0)
  assert.equal(ground.filter((event) => event.type === 'vfx' && event.key.startsWith('fx_shake_camera')).length, 0)
  const groundHitbox = ground.find((event) => event.type === 'hitbox')
  assert.equal(groundHitbox?.type === 'hitbox' ? groundHitbox.request.hitstopFrames : -1, PLAYER_GAMEPLAY_CONFIG.sword.combo.ground[0].hitstopFrames)
  const air = slashThroughWindow(createCombat().combat, false)
  const airHitbox = air.find((event) => event.type === 'hitbox')
  assert.equal(airHitbox?.type === 'hitbox' ? airHitbox.request.hitstopFrames : -1, PLAYER_GAMEPLAY_CONFIG.sword.combo.air.hitstopFrames)
})

test('5.2-2 hitstun is exposed for the motor hurt lock and counts down by frame time', () => {
  const { combat } = createCombat()
  combat.receiveDamage(1, true, 1, 'light')
  assert.equal(combat.getHitstunRemainingMs(), PLAYER_GAMEPLAY_CONFIG.damage.hitstunMs.light)
  combat.update(createIntent(), 100, 100, 1, true, false)
  assert.equal(combat.getHitstunRemainingMs(), PLAYER_GAMEPLAY_CONFIG.damage.hitstunMs.light - 100)
})

test('5.2-2 hurt blink toggles alpha every 4 frames while i-frames remain', () => {
  const four = 4 * FEEL_FRAME_MS
  assert.equal(iFrameBlinkAlpha(0, 500), IFRAME_BLINK_ALPHA)
  assert.equal(iFrameBlinkAlpha(four - 1, 500), IFRAME_BLINK_ALPHA)
  assert.equal(iFrameBlinkAlpha(four + 1, 500), 1)
  assert.equal(iFrameBlinkAlpha(2 * four + 1, 500), IFRAME_BLINK_ALPHA)
  assert.equal(iFrameBlinkAlpha(2 * four + 1, 0), 1)
})

test('5.2-3 the pellet fires on press and charging starts on the same frame', () => {
  const { combat } = createCombat({ chargeShot: true })
  const pressed = combat.update(createIntent({ shootPressed: true, shootHeld: true }), 0, FEEL_FRAME_MS, 1, true, false)
  const shots = projectileEvents(pressed.events)
  assert.equal(shots.length, 1)
  assert.equal(shots[0].request.type, 'pellet')
  assert.equal(pressed.snapshot.charging, true)
  assert.equal(pressed.snapshot.chargeLevel, 0)
})

test('5.2-3 a release below level 1 fires nothing; at level 1 or above it fires the charge shot', () => {
  const { combat } = createCombat({ chargeShot: true })
  combat.update(createIntent({ shootPressed: true, shootHeld: true }), 0, 0, 1, true, false)
  const tap = combat.update(createIntent({ shootReleased: true }), 150, 150, 1, true, false)
  assert.equal(projectileEvents(tap.events).length, 0)

  combat.update(createIntent({ shootPressed: true, shootHeld: true }), 1000, 0, 1, true, false)
  combat.update(createIntent({ shootHeld: true }), 1200, 200, 1, true, false)
  const release = combat.update(createIntent({ shootReleased: true }), 1216, 16, 1, true, false)
  const shots = projectileEvents(release.events)
  assert.equal(shots.length, 1)
  assert.equal(shots[0].request.type, 'charge')
  assert.equal(shots[0].request.chargeLevel, 1)
})

test('5.2-3 a charged release inside the fire-rate window is deferred to nextFireAt, not dropped', () => {
  const { combat } = createCombat({ chargeShot: true, fireRateMs: 500 })
  combat.update(createIntent({ shootPressed: true, shootHeld: true }), 0, 0, 1, true, false)
  combat.update(createIntent({ shootHeld: true }), 200, 200, 1, true, false)
  const release = combat.update(createIntent({ shootReleased: true }), 216, 16, 1, true, false)
  assert.equal(projectileEvents(release.events).length, 0)
  assert.equal(projectileEvents(combat.update(createIntent(), 499, 16, 1, true, false).events).length, 0)
  const deferred = projectileEvents(combat.update(createIntent(), 500, 16, 1, true, false).events)
  assert.equal(deferred.length, 1)
  assert.equal(deferred[0].request.chargeLevel, 1)
  assert.equal(projectileEvents(combat.update(createIntent(), 520, 16, 1, true, false).events).length, 0)
})

test('5.2-3 the charge clock is accumulated frame time, so a hit-stop or dialogue gap does not charge', () => {
  const { combat } = createCombat({ chargeShot: true })
  combat.update(createIntent({ shootPressed: true, shootHeld: true }), 0, 0, 1, true, false)
  const afterGap = combat.update(createIntent({ shootHeld: true }), 2000, FEEL_FRAME_MS, 1, true, false)
  assert.equal(afterGap.snapshot.chargeLevel, 0)
  assert.ok(Math.abs(afterGap.snapshot.chargeElapsedMs - FEEL_FRAME_MS) < 0.001)
})

test('5.2-3 chargeCancelOnSlash drops the charge on the slash press', () => {
  const { combat } = createCombat({ chargeShot: true })
  assert.equal(PLAYER_GAMEPLAY_CONFIG.blaster.chargeCancelOnSlash, true)
  combat.update(createIntent({ shootPressed: true, shootHeld: true }), 0, 0, 1, true, false)
  combat.update(createIntent({ shootHeld: true }), 400, 400, 1, true, false)
  const slashed = combat.update(createIntent({ shootHeld: true, slashPressed: true }), 416, 16, 1, true, false)
  assert.equal(slashed.snapshot.charging, false)
  assert.equal(slashed.snapshot.chargeLevel, 0)
  const release = combat.update(createIntent({ shootReleased: true }), 432, 16, 1, true, false)
  assert.equal(projectileEvents(release.events).length, 0)
})
