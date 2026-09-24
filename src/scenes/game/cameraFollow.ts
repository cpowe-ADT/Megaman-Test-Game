import { clampScroll } from '../../config/hdRenderMath'
import {
  CAMERA_FOLLOW_LOOK_AHEAD_PX,
  CAMERA_FOLLOW_LOOK_AHEAD_TWEEN_MS,
  CAMERA_FOLLOW_TRAILING_WINDOW_PX,
  CAMERA_FOLLOW_VERTICAL_WINDOW_PX
} from '../../config/gameplayLayout'

/**
 * The camera's follow math, pure and Phaser-free (prompt 05 §5.3b, EVAL-P5-004 fix). Phaser's own
 * `startFollow`/`setDeadzone`/`setFollowOffset` compute the deadzone rectangle in canvas pixels
 * once a render scale is applied, which put the hero outside the frame at scale 2 (review BLOCK,
 * commit 610fe2c); `CameraDirector` now calls `stepCameraFollow` every tick and writes
 * `camera.scrollX`/`scrollY` directly, entirely in game pixels, so scale cannot skew it.
 *
 * Horizontal tracking is rigid in the facing direction (the anchor equals the hero exactly while
 * running forward, so a per-frame lerp never eats into the look-ahead) with a trailing window
 * behind it; the look-ahead offset is the only tweened quantity, so a symmetric deadzone can never
 * cancel it out the way the previous design did (measured lead ~8px instead of 24+).
 */

export const VERTICAL_LERP_PER_FRAME = 0.08
const FRAME_MS = 1000 / 60

export interface CameraFollowConstants {
  /** Trailing window width: a back-step under this never moves the horizontal anchor (game px). */
  trailingWindowPx: number
  /** Vertical window width (±half each side) the anchor rides before it moves (game px). */
  verticalWindowPx: number
  /** How far ahead of facing the camera settles (game px). */
  lookAheadPx: number
  /** Time to sweep the full look-ahead range (-lookAheadPx to +lookAheadPx), ms. */
  lookAheadTweenMs: number
  /** Per-60Hz-frame lerp factor for the vertical scroll once bounds scroll vertically. */
  verticalLerpPerFrame: number
}

export const DEFAULT_CAMERA_FOLLOW_CONSTANTS: CameraFollowConstants = {
  trailingWindowPx: CAMERA_FOLLOW_TRAILING_WINDOW_PX,
  verticalWindowPx: CAMERA_FOLLOW_VERTICAL_WINDOW_PX,
  lookAheadPx: CAMERA_FOLLOW_LOOK_AHEAD_PX,
  lookAheadTweenMs: CAMERA_FOLLOW_LOOK_AHEAD_TWEEN_MS,
  verticalLerpPerFrame: VERTICAL_LERP_PER_FRAME
}

export interface CameraFollowBounds {
  x: number
  y: number
  width: number
  height: number
}

export interface CameraFollowState {
  anchorX: number
  anchorY: number
  lookAheadOffset: number
  scrollX: number
  scrollY: number
}

export interface CameraFollowInput {
  heroX: number
  heroY: number
  facing: 1 | -1
  dtMs: number
  viewWidth: number
  viewHeight: number
  bounds: CameraFollowBounds
}

/** Time-scaled lerp factor: compounding this per-frame converges the same as one big step (the
 *  exponential's multiplicative property), so a fixed-rate tween and a per-frame one agree. */
function timeScaledFactor(perFrame: number, dtMs: number): number {
  const factor = Math.min(1, Math.max(0, perFrame))
  if (factor >= 1) return 1
  return 1 - Math.pow(1 - factor, Math.max(0, dtMs) / FRAME_MS)
}

function moveToward(value: number, target: number, maxStep: number): number {
  if (value < target) return Math.min(target, value + maxStep)
  if (value > target) return Math.max(target, value - maxStep)
  return value
}

/** A fresh state centred on the hero, offset already at the resting look-ahead for `facing`. */
export function initialCameraFollowState(
  heroX: number,
  heroY: number,
  facing: 1 | -1,
  scrollX: number,
  scrollY: number,
  constants: CameraFollowConstants = DEFAULT_CAMERA_FOLLOW_CONSTANTS
): CameraFollowState {
  return { anchorX: heroX, anchorY: heroY, lookAheadOffset: facing * constants.lookAheadPx, scrollX, scrollY }
}

/**
 * One tick of camera follow. Horizontal: the anchor tracks the hero 1:1 while it moves in the
 * facing direction, and only concedes ground within `trailingWindowPx` on a back-step, so running
 * never lags and a small retreat never jitters the camera. Vertical: locked to `bounds.y` while
 * the stage fits in one screen; once bounds are taller, a symmetric window plus a time-based lerp
 * (ready for prompt 06).
 */
export function stepCameraFollow(
  state: CameraFollowState,
  input: CameraFollowInput,
  constants: CameraFollowConstants = DEFAULT_CAMERA_FOLLOW_CONSTANTS
): CameraFollowState {
  const { heroX, heroY, facing, dtMs, viewWidth, viewHeight, bounds } = input

  let anchorX = state.anchorX
  if (facing >= 0) {
    if (heroX > anchorX) anchorX = heroX
    else if (heroX < anchorX - constants.trailingWindowPx) anchorX = heroX + constants.trailingWindowPx
  } else {
    if (heroX < anchorX) anchorX = heroX
    else if (heroX > anchorX + constants.trailingWindowPx) anchorX = heroX - constants.trailingWindowPx
  }

  const targetOffset = facing * constants.lookAheadPx
  const fullRangePx = 2 * constants.lookAheadPx
  const maxStep = constants.lookAheadTweenMs > 0 ? (fullRangePx / constants.lookAheadTweenMs) * Math.max(0, dtMs) : fullRangePx
  const lookAheadOffset = moveToward(state.lookAheadOffset, targetOffset, maxStep)

  const centreX = anchorX + lookAheadOffset
  const scrollX = clampScroll(centreX - viewWidth / 2, bounds.x, bounds.width, viewWidth)

  let anchorY = state.anchorY
  let scrollY: number
  if (bounds.height <= viewHeight) {
    anchorY = heroY
    scrollY = bounds.y
  } else {
    const half = constants.verticalWindowPx / 2
    if (heroY > anchorY + half) anchorY = heroY - half
    else if (heroY < anchorY - half) anchorY = heroY + half
    const targetScrollY = clampScroll(anchorY - viewHeight / 2, bounds.y, bounds.height, viewHeight)
    const factor = timeScaledFactor(constants.verticalLerpPerFrame, dtMs)
    scrollY = state.scrollY + (targetScrollY - state.scrollY) * factor
  }

  return { anchorX, anchorY, lookAheadOffset, scrollX, scrollY }
}
