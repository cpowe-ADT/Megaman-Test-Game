export const GAMEPLAY_VIEWPORT_TOP = 58
// Player frames extend up to 32px above their compact Arcade body. Keeping the
// body below this ceiling preserves the full sprite beneath the fixed HUD.
export const GAMEPLAY_ACTOR_CEILING = 90

// Camera follow layout, game pixels (prompt 05 §5.3, read by CameraDirector).
/** Horizontal deadzone half-extent stays fixed regardless of vertical follow mode. */
export const CAMERA_FOLLOW_DEADZONE_X = 64
/** Vertical deadzone while the stage fits in one screen (every stage today). */
export const CAMERA_FOLLOW_DEADZONE_Y_LOCKED = 40
/** Vertical deadzone once bounds are taller than one screen (prompt 06 stages). */
export const CAMERA_FOLLOW_DEADZONE_Y_SCROLLING = 24
/** How far ahead of the hero's facing direction the camera settles. */
export const CAMERA_FACING_LOOK_AHEAD_PX = 40

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
