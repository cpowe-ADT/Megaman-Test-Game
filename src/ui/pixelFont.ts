/**
 * OmegaPixel, the bundled pixel font (part 12i, EVAL-P8-003): drawn in assets/fonts/source/omega-pixel.glyphs.txt,
 * built by scripts/fonts/build-pixel-font.py and loaded in Preload before any Text is measured. Its em is 8 font
 * pixels, so 8, 16, 24 and 32px put every glyph pixel on whole game pixels (docs/architecture/rendering.md).
 */
export const PIXEL_FONT_FAMILY = 'OmegaPixel'
/** For `fontFamily`; the fallback shows only if the font failed to load. */
export const PIXEL_FONT = `${PIXEL_FONT_FAMILY}, monospace`
export const PIXEL_FONT_PX = 8
export type PixelFontScale = 1 | 2 | 3 | 4

export function pixelFontSize(scale: PixelFontScale = 1): string {
  return `${PIXEL_FONT_PX * scale}px`
}

/** For the `font` shorthand, which Phaser splits on spaces into one size and one family token (so no fallback list). */
export function pixelFont(scale: PixelFontScale = 1): string {
  return `${pixelFontSize(scale)} ${PIXEL_FONT_FAMILY}`
}

/** The whole-pixel scale that replaced a smooth font size: up to 12px reads as 8px, then 16, 24 and 32px. */
export function pixelScaleFor(px: number): PixelFontScale {
  return px >= 28 ? 4 : px >= 20 ? 3 : px >= 13 ? 2 : 1
}
