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

/** The Options `Pixel scaling` choice (prompt 04 §4.3, prompt 08 §8.4). */
export type PixelScaling = 'smooth' | 'integer'
export const PIXEL_SCALING_MODES: readonly PixelScaling[] = Object.freeze(['smooth', 'integer'])
let pixelScalingSource: () => PixelScaling = () => 'smooth'
/** The settings store says where the player's choice lives; this module stays free of imports. */
export function setPixelScalingSource(source: () => PixelScaling): void {
  pixelScalingSource = source
}
export function currentPixelScaling(): PixelScaling {
  try {
    const mode = pixelScalingSource()
    return mode === 'integer' ? 'integer' : 'smooth'
  } catch {
    return 'smooth'
  }
}

/**
 * Pixel art and 7px text only stay crisp at whole-number zoom, so both modes use the largest integer
 * zoom that fits. Below 2x, `smooth` falls back to the exact ratio so a small window is not a 448px
 * postage stamp; `integer` keeps `floor(min(w/448, h/252))` (at least 1) and letterboxes.
 */
export function resolveGameZoom(parentWidth: number, parentHeight: number, pixelScaling: PixelScaling = currentPixelScaling()): number {
  const raw = Math.min(parentWidth / GAME_WIDTH, parentHeight / GAME_HEIGHT)
  if (!Number.isFinite(raw) || raw <= 0) return 1
  const whole = Math.floor(raw)
  if (pixelScaling === 'integer') return Math.max(1, whole)
  return whole >= 2 ? whole : Math.max(0.25, raw)
}
