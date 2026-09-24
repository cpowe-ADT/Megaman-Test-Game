import test from 'node:test'
import assert from 'node:assert/strict'
import {
  stepCameraFollow,
  initialCameraFollowState,
  DEFAULT_CAMERA_FOLLOW_CONSTANTS,
  type CameraFollowState
} from '../src/scenes/game/cameraFollow'

/**
 * `stepCameraFollow` pure-function scenarios (prompt 05 §5.3b, EVAL-P5-004 fix, commit 610fe2c
 * review). No scene: this is the module the review found responsible for the hero leaving the
 * frame at render scale 2, so every case here is expressed as the scroll/anchor it must produce.
 */

const FRAME_MS = 1000 / 60
const WIDE_BOUNDS = { x: 0, y: 0, width: 4000, height: 252 }
const VIEW_W = 448
const VIEW_H = 252

function step(state: CameraFollowState, heroX: number, heroY: number, facing: 1 | -1, dtMs = FRAME_MS, bounds = WIDE_BOUNDS) {
  return stepCameraFollow(state, { heroX, heroY, facing, dtMs, viewWidth: VIEW_W, viewHeight: VIEW_H, bounds })
}

test('5.3b-1 a still hero produces an unchanged state', () => {
  // Seed with one step so scrollX/scrollY are the values the function itself would produce
  // (the raw seed's 0,0 is arbitrary), then prove a second still step changes nothing.
  const seeded = step(initialCameraFollowState(600, 100, 1, 0, 0), 600, 100, 1)
  const next = step(seeded, 600, 100, 1)
  assert.deepEqual(next, seeded)
})

test('5.3b-2 a 40px back-step (under the 64px window) never moves the anchor', () => {
  const state = initialCameraFollowState(600, 100, 1, 0, 0)
  const next = step(state, 560, 100, 1)
  assert.equal(next.anchorX, 600)
})

test('5.3b-3 an 80px back-step (past the 64px window) moves the anchor by 16', () => {
  const state = initialCameraFollowState(600, 100, 1, 0, 0)
  const next = step(state, 520, 100, 1)
  assert.equal(next.anchorX, 584)
})

test('5.3b-4 60 frames running right at 220px/s from x 600 settles a 40px lead, scroll inside bounds', () => {
  let state = initialCameraFollowState(600, 100, 1, 0, 0)
  let heroX = 600
  for (let i = 0; i < 60; i += 1) {
    heroX += (220 * FRAME_MS) / 1000
    state = step(state, heroX, 100, 1)
  }
  const lead = state.anchorX + state.lookAheadOffset - heroX
  assert.ok(Math.abs(lead - 40) <= 1, `expected lead near 40, got ${lead}`)
  assert.ok(state.scrollX > WIDE_BOUNDS.x && state.scrollX < WIDE_BOUNDS.x + WIDE_BOUNDS.width - VIEW_W, 'scroll strictly inside bounds')
})

test('5.3b-5 a facing flip crosses zero and reaches -40 within 300ms', () => {
  let state = initialCameraFollowState(600, 100, 1, 0, 0)
  state = step(state, 600, 100, 1) // settle at rest, offset already +40
  assert.equal(state.lookAheadOffset, 40)
  let sawNegative = false
  for (let elapsed = 0; elapsed < 300; elapsed += FRAME_MS) {
    state = step(state, 600, 100, -1)
    if (state.lookAheadOffset < 0) sawNegative = true
  }
  assert.ok(sawNegative, 'offset should cross zero before -40')
  assert.ok(Math.abs(state.lookAheadOffset - -40) < 0.5, `expected convergence near -40, got ${state.lookAheadOffset}`)
})

test('5.3b-6 scroll clamps inside the world bounds at the left edge', () => {
  const bounds = { x: 0, y: 0, width: 448, height: 252 }
  const state = initialCameraFollowState(20, 100, -1, 0, 0)
  const next = step(state, 20, 100, -1, FRAME_MS, bounds)
  assert.equal(next.scrollX, 0)
})

test('5.3b-7 vertical is locked to bounds.y at one screen tall', () => {
  const bounds = { x: 0, y: 0, width: 4000, height: 252 }
  const state = initialCameraFollowState(600, 10, 1, 0, 0)
  const next = step(state, 600, 240, 1, FRAME_MS, bounds)
  assert.equal(next.scrollY, 0)
})

test('5.3b-8 taller bounds let scrollY follow the vertical window over several ticks', () => {
  const bounds = { x: 0, y: 0, width: 4000, height: 600 }
  let state: CameraFollowState = { anchorX: 600, anchorY: 100, lookAheadOffset: 40, scrollX: 0, scrollY: 0 }
  for (let i = 0; i < 30; i += 1) {
    state = step(state, 600, 300, 1, FRAME_MS, bounds)
  }
  assert.ok(state.scrollY > 0, `expected scrollY to move toward the lower hero, got ${state.scrollY}`)
  assert.ok(state.scrollY <= bounds.height - VIEW_H, 'scroll stays inside vertical bounds')
})
