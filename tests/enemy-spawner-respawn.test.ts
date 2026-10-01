import test from 'node:test'
import assert from 'node:assert/strict'
import {
  cameraEdgeDistance,
  createMarkerStreamState,
  nextMarkerStreamState,
  type MarkerStreamState
} from '../src/enemy/markerStreaming'

/**
 * Prompt 06 phase 6.1's "Camera-relative spawn and respawn" bullet (`EVAL-P6-006`), pulled forward as a
 * 13h leftover: a marker spawns when the camera edge is within one screen, respawns once the camera has
 * left its window by a further screen and re-entered, mini-boss and `room_lock` waves (and a `persistent:
 * false` marker) never respawn once cleared, and death resets every marker except those cleared locks
 * (`EnemySpawner.resetForRespawn`, exercised at the adapter edge by smoke 9 and 23).
 */

const SCREEN = 448

test('cameraEdgeDistance is 0 inside the view, and the gap to the nearer edge outside it', () => {
  assert.equal(cameraEdgeDistance(0, 448, 200), 0)
  assert.equal(cameraEdgeDistance(0, 448, 448), 0)
  assert.equal(cameraEdgeDistance(0, 448, 600), 152)
  assert.equal(cameraEdgeDistance(500, 948, 100), 400)
})

test('a fresh marker spawns once the camera edge is within one screen, not before', () => {
  const far = nextMarkerStreamState(createMarkerStreamState(), SCREEN + 1, false, true, SCREEN)
  assert.equal(far.phase, 'pending')

  const near = nextMarkerStreamState(createMarkerStreamState(), SCREEN, false, true, SCREEN)
  assert.equal(near.phase, 'active')
})

test('an active marker despawns when its entity dies, even with the camera still on it', () => {
  const active: MarkerStreamState = { phase: 'active', readyToSpawn: false }
  const next = nextMarkerStreamState(active, 0, false, true, SCREEN)
  assert.equal(next.phase, 'pending')
  assert.equal(next.readyToSpawn, false, 'not armed yet: the camera has not left by a screen')
})

test('an active marker despawns when the camera leaves it a screen behind, even if still alive', () => {
  const active: MarkerStreamState = { phase: 'active', readyToSpawn: false }
  const next = nextMarkerStreamState(active, SCREEN + 1, true, true, SCREEN)
  assert.equal(next.phase, 'pending')
})

test('a retired marker does not respawn just because the camera is back on its spot; it must leave by a further screen first', () => {
  let state: MarkerStreamState = { phase: 'pending', readyToSpawn: false }
  // Still close (distance 0): not armed, stays pending no matter how many ticks pass.
  state = nextMarkerStreamState(state, 0, false, true, SCREEN)
  assert.deepEqual(state, { phase: 'pending', readyToSpawn: false })

  // Short of "left by a screen" (must exceed 2 screens, not just 1): still not armed.
  state = nextMarkerStreamState(state, SCREEN * 2, false, true, SCREEN)
  assert.equal(state.readyToSpawn, false)

  // Past two screens: armed, but still outside the one-screen window, so it waits rather than spawning.
  state = nextMarkerStreamState(state, SCREEN * 2 + 1, false, true, SCREEN)
  assert.deepEqual(state, { phase: 'pending', readyToSpawn: true })

  // The camera comes back within one screen: respawns.
  state = nextMarkerStreamState(state, SCREEN, false, true, SCREEN)
  assert.equal(state.phase, 'active')
})

test('persistent: false opts a marker out of respawn: it clears instead of going back to pending', () => {
  const active: MarkerStreamState = { phase: 'active', readyToSpawn: false }
  const next = nextMarkerStreamState(active, 0, false, false, SCREEN)
  assert.equal(next.phase, 'cleared')
})

test('a cleared marker (mini-boss or room_lock wave) never spawns again, however the camera moves', () => {
  const cleared: MarkerStreamState = { phase: 'cleared', readyToSpawn: false }
  const stillFar = nextMarkerStreamState(cleared, SCREEN * 10, false, false, SCREEN)
  const backOnTop = nextMarkerStreamState(stillFar, 0, false, true, SCREEN)
  assert.equal(stillFar.phase, 'cleared')
  assert.equal(backOnTop.phase, 'cleared', 'canRespawn flipping true afterwards still does not revive a cleared marker')
})
