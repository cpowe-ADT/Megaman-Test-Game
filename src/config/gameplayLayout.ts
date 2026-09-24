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
