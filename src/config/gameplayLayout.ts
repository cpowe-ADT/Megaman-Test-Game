export const GAMEPLAY_VIEWPORT_TOP = 58
// Player frames extend up to 32px above their compact Arcade body. Keeping the
// body below this ceiling preserves the full sprite beneath the fixed HUD.
export const GAMEPLAY_ACTOR_CEILING = 90

// Camera follow layout, game pixels (prompt 05 §5.3b, read by `cameraFollow.ts`'s pure step).
/** Trailing window width: a back-step under this never moves the horizontal anchor. */
export const CAMERA_FOLLOW_TRAILING_WINDOW_PX = 64
/** Vertical window width (±half each side) the anchor rides before it moves. */
export const CAMERA_FOLLOW_VERTICAL_WINDOW_PX = 24
/** How far ahead of the hero's facing direction the camera settles. */
export const CAMERA_FOLLOW_LOOK_AHEAD_PX = 40
/** Time to sweep the full look-ahead range (-40 to +40) on a facing flip, ms. */
export const CAMERA_FOLLOW_LOOK_AHEAD_TWEEN_MS = 250
/** Capped anchor speed on a facing flip (prompt 05 §5.3c): 40px takes 80ms, well under the
 *  up-to-64px instant jump the review found, but still much faster than any ordinary movement. */
export const CAMERA_FOLLOW_ANCHOR_FLIP_SPEED_PX_PER_MS = 0.5
/** Capped scroll speed while easing into a changed `bounds` shape (a room lock opening or
 *  closing): a 116px room-to-stage jump takes about 77ms, comfortably faster than steady running
 *  moves the target per frame, so normal play is never capped by this. */
export const CAMERA_FOLLOW_BOUNDS_EASE_SPEED_PX_PER_MS = 1.5

export type GameplayWorldBounds = {
  x: number
  y: number
  width: number
  height: number
}

export function getGameplayWorldBounds(worldWidth: number, screenHeight: number): GameplayWorldBounds {
  return {
    x: 0,
    y: GAMEPLAY_ACTOR_CEILING,
    width: Math.max(1, worldWidth),
    height: Math.max(1, screenHeight - GAMEPLAY_ACTOR_CEILING)
  }
}
