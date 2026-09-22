export const STRICT_PIXEL_RENDER_POLICY = Object.freeze({
  antialias: false,
  pixelArt: true,
  roundPixels: true,
  resolution: 1
})

export const GAME_WIDTH = 448
export const GAME_HEIGHT = 252
/**
 * Layout size in game pixels. Scene cameras zoom by the render scale (config/hdRender.ts), so
 * `scene.scale.width/height` are canvas pixels (448*scale): laying out with them put menus off
 * centre at 2x and mostly off screen at 6x. Destructure this instead.
 */
export const GAME_SIZE = Object.freeze({ width: GAME_WIDTH, height: GAME_HEIGHT })

/**
 * Pixel art and 7px text only stay crisp at whole-number zoom. Use the largest integer zoom that
 * fits the parent; below 2x fall back to the exact ratio so a small window is not a 448px postage stamp.
 */
export function resolveGameZoom(parentWidth: number, parentHeight: number): number {
  const raw = Math.min(parentWidth / GAME_WIDTH, parentHeight / GAME_HEIGHT)
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const whole = Math.floor(raw)
  return whole >= 2 ? whole : Math.max(0.25, raw)
}
