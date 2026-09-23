import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerCombat } from '../src/player/PlayerCombat'
import { PLAYER_GAMEPLAY_CONFIG } from '../src/player/config'
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

function createCombat(options: { chargeShot?: boolean } = {}) {
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
    PLAYER_GAMEPLAY_CONFIG.blaster,
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
  thresholds.forEach((threshold, index) => {
    player.scene.time.now = threshold
    const result = combat.update(createIntent({ shootHeld: true }), threshold, 16, 1, true, false)
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

  const active = combat.update(createIntent(), 100, PLAYER_GAMEPLAY_CONFIG.sword.windows.ground.e.startupFrames * frameMs, 1, true, false)
  assert.equal(active.snapshot.slashPhase, 'active')
  assert.equal(active.events.some((event) => event.type === 'hitbox'), true)

  const recovery = combat.update(createIntent(), 170, PLAYER_GAMEPLAY_CONFIG.sword.windows.ground.e.activeFrames * frameMs, 1, true, false)
  assert.equal(recovery.snapshot.slashPhase, 'recovery')

  const cleared = combat.update(createIntent(), 240, PLAYER_GAMEPLAY_CONFIG.sword.windows.ground.e.recoveryFrames * frameMs, 1, true, false)
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
  combat.update(createIntent({ shootPressed: true, shootHeld: true }), 900, 0, 1, true, false)
  const next = combat.update(createIntent({ shootReleased: true }), 950, 0, 1, true, false)
  assert.equal(projectileEvents(next.events).length, 1)
})
