import test from 'node:test'
import assert from 'node:assert/strict'
import { DEATH_TIMELINE, freezeHitstopFrames, planDeathBeats } from '../src/scenes/game/DeathSequence'
import { SHAKES, SHAKE_INTENSITY_CAP } from '../src/player/hitFeel'

/** Pure timing of the death sequence (prompt 05 §5.2 item 5); the host wiring is in game-host-seams. */

test('5.2-5 death beats run freeze, burst, fade, respawn in order', () => {
  assert.deepEqual(
    planDeathBeats().map((beat) => beat.beat),
    ['freeze', 'burst', 'fadeOut', 'respawn']
  )
})

test('5.2-5 the world freezes 250ms, eight orbs burst as it ends, respawn is at 900ms with a 600ms READY', () => {
  assert.equal(DEATH_TIMELINE.freezeMs, 250)
  assert.equal(DEATH_TIMELINE.burstAtMs, DEATH_TIMELINE.freezeMs)
  assert.equal(DEATH_TIMELINE.orbCount, 8)
  assert.ok(DEATH_TIMELINE.respawnAtMs >= 900)
  assert.equal(DEATH_TIMELINE.readyMs, 600)
  assert.ok(DEATH_TIMELINE.fadeOutAtMs + DEATH_TIMELINE.fadeOutMs <= DEATH_TIMELINE.respawnAtMs, 'the fade completes before respawn')
})

test('5.2-5 the 250ms freeze is 15 hit-stop frames at 60Hz', () => {
  assert.equal(freezeHitstopFrames(), 15)
})

test('5.2-6 the heavy death shake is inside the shake budget', () => {
  assert.ok(SHAKES.heavy.intensity <= SHAKE_INTENSITY_CAP)
  assert.equal(SHAKE_INTENSITY_CAP, 0.016)
})
