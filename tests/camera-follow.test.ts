import test from 'node:test'
import assert from 'node:assert/strict'
import {
  stepCameraFollow,
  initialCameraFollowState,
  snapScrollToGamePixel,
  DEFAULT_CAMERA_FOLLOW_CONSTANTS,
  type CameraFollowState,
  type CameraFollowBounds
} from '../src/scenes/game/cameraFollow'

/**
 * `stepCameraFollow` pure-function scenarios (prompt 05 §5.3b/c, EVAL-P5-004 fix, review of
 * commits 610fe2c and 4eff688). No scene: this is the module responsible for both the hero
 * leaving the frame at render scale 2 (5.3b) and the sub-pixel scroll that blended the wrong
 * ground row into the 1x frame (5.3c, smoke 40), so every case is expressed as produced scroll.
 */

const FRAME_MS = 1000 / 60
const WIDE_BOUNDS: CameraFollowBounds = { x: 0, y: 0, width: 4000, height: 252 }
const VIEW_W = 448
const VIEW_H = 252

function step(state: CameraFollowState, heroX: number, heroY: number, facing: 1 | -1, dtMs = FRAME_MS, bounds = WIDE_BOUNDS) {
  return stepCameraFollow(state, { heroX, heroY, facing, dtMs, viewWidth: VIEW_W, viewHeight: VIEW_H, bounds })
}

test('5.3b-1 a still hero produces an unchanged state', () => {
  // Seed with one step so scrollX/scrollY are the values the function itself would produce
  // (the raw seed's 0,0 is arbitrary), then prove a second still step changes nothing.
  const seeded = step(initialCameraFollowState(600, 100, 1, 0, 0, WIDE_BOUNDS), 600, 100, 1)
  const next = step(seeded, 600, 100, 1)
  assert.deepEqual(next, seeded)
})

test('5.3b-2 a 40px back-step (under the 64px window) never moves the anchor', () => {
  const state = initialCameraFollowState(600, 100, 1, 0, 0, WIDE_BOUNDS)
  const next = step(state, 560, 100, 1)
  assert.equal(next.anchorX, 600)
})

test('5.3b-3 an 80px back-step (past the 64px window) moves the anchor by 16', () => {
  const state = initialCameraFollowState(600, 100, 1, 0, 0, WIDE_BOUNDS)
  const next = step(state, 520, 100, 1)
  assert.equal(next.anchorX, 584)
})

test('5.3b-4 60 frames running right at 220px/s from x 600 settles a 40px lead, scroll inside bounds', () => {
  let state = initialCameraFollowState(600, 100, 1, 0, 0, WIDE_BOUNDS)
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
  let state = initialCameraFollowState(600, 100, 1, 0, 0, WIDE_BOUNDS)
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
  const bounds: CameraFollowBounds = { x: 0, y: 0, width: 448, height: 252 }
  const state = initialCameraFollowState(20, 100, -1, 0, 0, bounds)
  const next = step(state, 20, 100, -1, FRAME_MS, bounds)
  assert.equal(next.scrollX, 0)
})

test('5.3b-7 vertical is locked to bounds.y at one screen tall', () => {
  const bounds: CameraFollowBounds = { x: 0, y: 0, width: 4000, height: 252 }
  const state = initialCameraFollowState(600, 10, 1, 0, 0, bounds)
  const next = step(state, 600, 240, 1, FRAME_MS, bounds)
  assert.equal(next.scrollY, 0)
})

test('5.3b-8 taller bounds let scrollY follow the vertical window over several ticks', () => {
  const bounds: CameraFollowBounds = { x: 0, y: 0, width: 4000, height: 600 }
  let state: CameraFollowState = initialCameraFollowState(600, 100, 1, 0, 0, bounds)
  for (let i = 0; i < 30; i += 1) {
    state = step(state, 600, 300, 1, FRAME_MS, bounds)
  }
  assert.ok(state.scrollY > 0, `expected scrollY to move toward the lower hero, got ${state.scrollY}`)
  assert.ok(state.scrollY <= bounds.height - VIEW_H, 'scroll stays inside vertical bounds')
})

test('5.3c-1 a facing flip after knockback eases the anchor at a capped speed instead of snapping', () => {
  let state = initialCameraFollowState(600, 100, 1, 0, 0, WIDE_BOUNDS)
  state = step(state, 600, 100, 1) // settle: anchorX tracks the hero rigidly
  assert.equal(state.anchorX, 600)
  state = step(state, 560, 100, 1) // knocked back 40px, still facing right: under the window, unchanged
  assert.equal(state.anchorX, 600)

  const cap = DEFAULT_CAMERA_FOLLOW_CONSTANTS.anchorFlipSpeedPxPerMs * FRAME_MS
  const before = state.anchorX
  state = step(state, 560, 100, -1) // turn to face the hero
  const movedBy = before - state.anchorX
  assert.ok(movedBy > 0 && movedBy <= cap + 1e-6, `expected a capped first-frame step (<= ${cap}), got ${movedBy}`)
  assert.ok(movedBy < 40, `the naive instant jump would have been 40px, got ${movedBy}`)
})

test('5.3c-2 a bounds change eases scroll at a capped speed on the first frame; steady running still settles the 40px lead', () => {
  // Mirrors the review's cited numbers: a 448px room at x 800, hero at room x + 300 (x 1100), the
  // lock opens and bounds widen to the full stage: scroll should jump from room.x (800) toward
  // hero + 40 - 224 (916), about 116px, but capped on the very first frame.
  const room: CameraFollowBounds = { x: 800, y: 0, width: 448, height: 252 }
  let state = initialCameraFollowState(1100, 100, 1, 0, 0, room)
  state = step(state, 1100, 100, 1, FRAME_MS, room)
  assert.equal(state.scrollX, 800, 'pinned at the room bound before the lock opens')

  const stage: CameraFollowBounds = { x: 0, y: 0, width: 4000, height: 252 }
  const cap = DEFAULT_CAMERA_FOLLOW_CONSTANTS.boundsEaseSpeedPxPerMs * FRAME_MS
  const beforeScrollX = state.scrollX
  state = step(state, 1100, 100, 1, FRAME_MS, stage)
  const movedBy = state.scrollX - beforeScrollX
  assert.ok(movedBy > 0 && movedBy <= cap + 1e-6, `expected a capped first-frame move (<= ${cap}), got ${movedBy}`)
  assert.ok(movedBy < 116, `the naive instant jump would have been ~116px, got ${movedBy}`)

  let heroX = 1100
  for (let i = 0; i < 120; i += 1) {
    heroX += (220 * FRAME_MS) / 1000
    state = step(state, heroX, 100, 1, FRAME_MS, stage)
  }
  const lead = state.anchorX + state.lookAheadOffset - heroX
  assert.ok(Math.abs(lead - 40) <= 1, `expected the lead to settle near 40 once caught up, got ${lead}`)
})

test('5.3c-3 snapScrollToGamePixel rounds to a whole game pixel and never rounds outside the clamp', () => {
  assert.equal(snapScrollToGamePixel(15.6, 0, 4000, 448), 16)
  assert.equal(snapScrollToGamePixel(15.4, 0, 4000, 448), 15)
  assert.equal(snapScrollToGamePixel(3551.6, 0, 4000, 448), 3552)
  assert.equal(snapScrollToGamePixel(-0.4, 0, 4000, 448), 0)
})
