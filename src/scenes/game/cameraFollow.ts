import { clampScroll } from '../../config/hdRenderMath'
import {
  CAMERA_FOLLOW_ANCHOR_FLIP_SPEED_PX_PER_MS,
  CAMERA_FOLLOW_BOUNDS_EASE_SPEED_PX_PER_MS,
  CAMERA_FOLLOW_LOOK_AHEAD_PX,
  CAMERA_FOLLOW_LOOK_AHEAD_TWEEN_MS,
  CAMERA_FOLLOW_TRAILING_WINDOW_PX,
  CAMERA_FOLLOW_VERTICAL_WINDOW_PX
} from '../../config/gameplayLayout'

/**
 * The camera's follow math, pure and Phaser-free (prompt 05 §5.3b/c, EVAL-P5-004 fix). Phaser's
 * own `startFollow`/`setDeadzone`/`setFollowOffset` compute the deadzone rectangle in canvas
 * pixels once a render scale is applied, which put the hero outside the frame at scale 2 (review
 * BLOCK, commit 610fe2c); `CameraDirector` now calls `stepCameraFollow` every tick and writes
 * whole game pixels to `camera.scrollX`/`scrollY`, so scale cannot skew it and sub-pixel scroll
 * cannot blend the wrong row into the frame at 1x (5.3b/c review, the smoke 40 regression).
 *
 * Horizontal tracking is rigid in the facing direction (the anchor equals the hero exactly while
 * running forward) with a trailing window behind it, and a respawn/back-step snap is intentional
 * (no long pan back to the hero). Two things must NOT snap, so they ease at a capped px/ms instead
 * of assigning: the anchor on a facing flip (turning while the hero sits behind it no longer jumps
 * up to a trailing-window's width in one frame), and the written scroll when `bounds` itself
 * changes shape (a room lock opening or closing) rather than the hero simply moving.
 */

export const VERTICAL_LERP_PER_FRAME = 0.08
const FRAME_MS = 1000 / 60
/** Below this, an eased scroll/anchor is considered caught up (game px); ends the easing mode. */
const CAUGHT_UP_EPSILON_PX = 0.1

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
  /** Capped anchor speed on a facing flip (game px per ms), so turning never snaps the camera. */
  anchorFlipSpeedPxPerMs: number
  /** Capped scroll speed while easing into a new `bounds` shape (game px per ms). */
  boundsEaseSpeedPxPerMs: number
}

export const DEFAULT_CAMERA_FOLLOW_CONSTANTS: CameraFollowConstants = {
  trailingWindowPx: CAMERA_FOLLOW_TRAILING_WINDOW_PX,
  verticalWindowPx: CAMERA_FOLLOW_VERTICAL_WINDOW_PX,
  lookAheadPx: CAMERA_FOLLOW_LOOK_AHEAD_PX,
  lookAheadTweenMs: CAMERA_FOLLOW_LOOK_AHEAD_TWEEN_MS,
  verticalLerpPerFrame: VERTICAL_LERP_PER_FRAME,
  anchorFlipSpeedPxPerMs: CAMERA_FOLLOW_ANCHOR_FLIP_SPEED_PX_PER_MS,
  boundsEaseSpeedPxPerMs: CAMERA_FOLLOW_BOUNDS_EASE_SPEED_PX_PER_MS
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
  /** Fractional game pixels: the adapter rounds only what it writes to the camera. */
  scrollX: number
  scrollY: number
  facing: 1 | -1
  bounds: CameraFollowBounds
  /** True while scrollX/scrollY are still catching up to a `bounds` shape change. */
  easingBounds: boolean
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

function boundsEqual(a: CameraFollowBounds, b: CameraFollowBounds): boolean {
  return a.x === b.x && a.y === b.y && a.width === b.width && a.height === b.height
}

/** A fresh state centred on the hero, offset already at the resting look-ahead for `facing`. A
 *  fresh follow (stage load, respawn re-seed) is a deliberate snap, so `easingBounds` starts false. */
export function initialCameraFollowState(
  heroX: number,
  heroY: number,
  facing: 1 | -1,
  scrollX: number,
  scrollY: number,
  bounds: CameraFollowBounds,
  constants: CameraFollowConstants = DEFAULT_CAMERA_FOLLOW_CONSTANTS
): CameraFollowState {
  return {
    anchorX: heroX,
    anchorY: heroY,
    lookAheadOffset: facing * constants.lookAheadPx,
    scrollX,
    scrollY,
    facing,
    bounds,
    easingBounds: false
  }
}

/** Rounds to a whole game pixel and re-clamps, so rounding never pushes the result out of bounds
 *  (the smoke 40 regression: a fractional scroll blended the wrong row into the 1x frame). */
export function snapScrollToGamePixel(scroll: number, boundsStart: number, boundsSize: number, viewSize: number): number {
  // `|| 0` folds a rounded -0 (e.g. Math.round(-0.4)) back to 0, so this never writes a negative
  // zero to the camera.
  return clampScroll(Math.round(scroll) || 0, boundsStart, boundsSize, viewSize)
}

/**
 * One tick of camera follow. Horizontal: the anchor tracks the hero 1:1 while it moves in the
 * facing direction, conceding ground within `trailingWindowPx` on a back-step (a snap, same as a
 * respawn: no long pan). A facing flip instead eases the anchor toward that same target at a
 * capped speed, so turning around never jumps the camera. Vertical: locked to `bounds.y` while the
 * stage fits in one screen; once bounds are taller, a symmetric window plus a time-based lerp
 * (ready for prompt 06). Whenever `bounds` itself changes shape (not just the hero moving), the
 * written scroll eases toward the new clamped target at a capped speed instead of snapping.
 */
export function stepCameraFollow(
  state: CameraFollowState,
  input: CameraFollowInput,
  constants: CameraFollowConstants = DEFAULT_CAMERA_FOLLOW_CONSTANTS
): CameraFollowState {
  const { heroX, heroY, facing, dtMs, viewWidth, viewHeight, bounds } = input
  const dt = Math.max(0, dtMs)
  const boundsChanged = !boundsEqual(state.bounds, bounds)
  const easing = state.easingBounds || boundsChanged

  const targetAnchorX =
    facing >= 0
      ? heroX > state.anchorX
        ? heroX
        : heroX < state.anchorX - constants.trailingWindowPx
          ? heroX + constants.trailingWindowPx
          : state.anchorX
      : heroX < state.anchorX
        ? heroX
        : heroX > state.anchorX + constants.trailingWindowPx
          ? heroX - constants.trailingWindowPx
          : state.anchorX
  const flipped = facing !== state.facing
  const anchorX = flipped ? moveToward(state.anchorX, targetAnchorX, constants.anchorFlipSpeedPxPerMs * dt) : targetAnchorX

  const targetOffset = facing * constants.lookAheadPx
  const fullRangePx = 2 * constants.lookAheadPx
  const lookAheadMaxStep = constants.lookAheadTweenMs > 0 ? (fullRangePx / constants.lookAheadTweenMs) * dt : fullRangePx
  const lookAheadOffset = moveToward(state.lookAheadOffset, targetOffset, lookAheadMaxStep)

  const centreX = anchorX + lookAheadOffset
  const targetScrollX = clampScroll(centreX - viewWidth / 2, bounds.x, bounds.width, viewWidth)
  const scrollMaxStep = constants.boundsEaseSpeedPxPerMs * dt
  const scrollX = easing ? moveToward(state.scrollX, targetScrollX, scrollMaxStep) : targetScrollX

  let anchorY = state.anchorY
  let scrollY: number
  const verticalLocked = bounds.height <= viewHeight
  if (verticalLocked) {
    anchorY = heroY
    scrollY = easing ? moveToward(state.scrollY, bounds.y, scrollMaxStep) : bounds.y
  } else {
    // This branch's own time-based lerp already eases (untouched by the 5.3c review); it never
    // fully converges on a moving anchor, so it must not keep `easingBounds` on forever and cap
    // ordinary horizontal movement once a taller-than-one-screen stage (prompt 06) is scrolling.
    const half = constants.verticalWindowPx / 2
    if (heroY > anchorY + half) anchorY = heroY - half
    else if (heroY < anchorY - half) anchorY = heroY + half
    const targetScrollY = clampScroll(anchorY - viewHeight / 2, bounds.y, bounds.height, viewHeight)
    const factor = timeScaledFactor(constants.verticalLerpPerFrame, dtMs)
    scrollY = state.scrollY + (targetScrollY - state.scrollY) * factor
  }

  const horizontalCaughtUp = Math.abs(targetScrollX - scrollX) <= CAUGHT_UP_EPSILON_PX
  const verticalCaughtUp = !verticalLocked || Math.abs(bounds.y - scrollY) <= CAUGHT_UP_EPSILON_PX
  const easingBounds = easing && !(horizontalCaughtUp && verticalCaughtUp)

  return { anchorX, anchorY, lookAheadOffset, scrollX, scrollY, facing, bounds, easingBounds }
}
