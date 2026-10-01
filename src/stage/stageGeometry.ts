/**
 * Stage geometry the scene only draws (EVAL-P6-009, Heat Works): floor gaps split the one main ground
 * strip into spans, and a stage's world reaches above the first screen when it authors a tall room.
 * Pure; `Game.buildStage` and `scenes/game/StageBackdrop.ts` are the Phaser edges.
 */

/** A pit in the main ground: left edge and width, world px. */
export type FloorGap = { x: number; width: number }
/** A piece of the main ground between pits: left edge and width, world px. */
export type GroundSpan = { x: number; width: number }

/** Main ground strip height (its top is the floor at `screenHeight - 16`). */
export const MAIN_GROUND_HEIGHT = 16

/** The main ground minus its gaps: clipped to the world, overlapping gaps merged, empty spans dropped. */
export function splitMainGround(worldWidth: number, gaps: readonly FloorGap[] = []): GroundSpan[] {
  const cuts = gaps
    .map((gap) => ({ start: Math.max(0, gap.x), end: Math.min(worldWidth, gap.x + gap.width) }))
    .filter((cut) => cut.end > cut.start)
    .sort((a, b) => a.start - b.start)
  const spans: GroundSpan[] = []
  let cursor = 0
  for (const cut of cuts) {
    if (cut.start > cursor) spans.push({ x: cursor, width: cut.start - cursor })
    cursor = Math.max(cursor, cut.end)
  }
  if (cursor < worldWidth) spans.push({ x: cursor, width: worldWidth - cursor })
  return spans
}

/** The main ground as platform definitions: one solid strip per span; the first keeps the old id. */
export function mainGroundPlatforms(stageId: string, worldWidth: number, screenHeight: number, gaps: readonly FloorGap[] = []) {
  return splitMainGround(worldWidth, gaps).map((span, index) => ({
    id: index === 0 ? `${stageId}_main_ground` : `${stageId}_main_ground_${index + 1}`,
    x: span.x + span.width / 2,
    y: screenHeight - MAIN_GROUND_HEIGHT / 2,
    width: span.width,
    height: MAIN_GROUND_HEIGHT,
    type: 'solid' as const,
    color: 0x1a2230,
    tileKind: 'ground' as const
  }))
}

/**
 * Top of the stage's world, game px: 0 for a one-screen-tall stage, and the top of its tallest room
 * (a `verticalScreens` segment or a room lock taller than the screen) otherwise, so the backdrop covers
 * everything the camera can scroll to.
 */
export function stageVerticalTop(
  arena: { verticalSegments?: readonly { verticalScreens: number }[]; roomLocks?: readonly { room: { y: number } }[] },
  screenHeight: number
): number {
  const segmentTops = (arena.verticalSegments ?? []).map((segment) => screenHeight - Math.max(1, Math.floor(segment.verticalScreens)) * screenHeight)
  const lockTops = (arena.roomLocks ?? []).map((lock) => lock.room.y)
  return Math.min(0, ...segmentTops, ...lockTops)
}

/**
 * The world-y spans a parallax layer tiles across (`StageBackdrop`, EVAL-P13-003): the first-screen
 * copy from the layer's authored y down to the floor, plus, in a room taller than one screen, an
 * upward copy that joins it with no gap below the gameplay viewport top. The first screen's look stays
 * exactly as authored (that strip sits under the HUD there); a tall room repeats it going up.
 */
export function backdropLayerSpans(
  layerY: number,
  top: number,
  height: number,
  gameplayViewportTop: number
): Array<{ y: number; height: number; tileY: number }> {
  const spans = [{ y: layerY, height: Math.max(16, height - layerY), tileY: 0 }]
  if (top < 0) {
    spans.push({ y: top, height: Math.min(layerY, gameplayViewportTop) - top, tileY: top - layerY })
  }
  return spans
}

/** The highest world-y these spans reach: for "the backdrop covers the camera's full vertical bounds". */
export function backdropCoverageTop(spans: readonly { y: number }[]): number {
  return Math.min(...spans.map((span) => span.y))
}

/**
 * The plain, opaque strip `StageBackdrop` repaints under the HUD (see its `hudMask`): a screen-fixed
 * band (`scrollFactor` 0), x and y in screen game px, an `margin` wider than the view each side so a
 * camera shake never shows its edge. It must be screen-fixed: the final-fixes lane (2026-10-01) found it
 * painted in world rows 0 to 58, which in a tall room slid a flat, layer-less band across the screen
 * whenever the camera scrolled up, even a jump's 20 px (Heat Works, the tutorial shaft): "the screen
 * disappears when jumping".
 */
export type FixedBackdropBand = { x: number; y: number; width: number; height: number; scrollFactor: 0 | 1 }

export function hudMaskBand(viewWidth: number, gameplayViewportTop: number, margin = 8): FixedBackdropBand {
  return { x: -margin, y: 0, width: viewWidth + 2 * margin, height: gameplayViewportTop, scrollFactor: 0 }
}

/** The world rows a band hides for a camera scroll: a screen-fixed band follows the camera, a world band stays put. */
export function bandWorldRows(band: FixedBackdropBand, scrollY: number): { top: number; bottom: number } {
  const offset = band.scrollFactor === 0 ? scrollY : 0
  return { top: offset + band.y, bottom: offset + band.y + band.height }
}

/** The camera's reachable vertical scroll, world px: from the stage's tallest room top down to the first screen (0). */
export function cameraScrollRange(top: number): { min: number; max: number } {
  return { min: Math.min(0, top), max: 0 }
}

/**
 * Alpha-composites `overlay` over `base` (both 0xRRGGBB) at `alpha` and returns an opaque 0xRRGGBB
 * result (`StageBackdrop.drawBand`, EVAL-P13-003 fix). The accent band's upward copy now joins the
 * first screen's band at the gameplay viewport top instead of world y 0 (13b.2), so it covers the strip
 * that sits under the HUD at rest; left as a live alpha fill there, Phaser's Canvas and WebGL renderers
 * round the blend a channel or two apart, which 40-hd-render reads as a 1x/2x pixel mismatch. Blending
 * once, here, in plain arithmetic, and filling opaque removes the renderer from the rounding.
 */
export function blendOpaqueColor(base: number, overlay: number, alpha: number): number {
  const mix = (shift: number) =>
    Math.round(((base >> shift) & 0xff) * (1 - alpha) + ((overlay >> shift) & 0xff) * alpha)
  return (mix(16) << 16) | (mix(8) << 8) | mix(0)
}
