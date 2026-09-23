export const GAMEPLAY_VIEWPORT_TOP = 58
// Player frames extend up to 32px above their compact Arcade body. Keeping the
// body below this ceiling preserves the full sprite beneath the fixed HUD.
export const GAMEPLAY_ACTOR_CEILING = 90

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
