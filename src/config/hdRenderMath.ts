/**
 * Pure math for HD rendering (no Phaser import so unit tests can load it). See hdRender.ts.
 */
import { resolveGameZoom } from './renderPolicy'

export interface RenderScale {
  /** Whole-number (or, under 2x, fractional) game zoom chosen for the window. */
  zoom: number
  /** Device pixel ratio actually used (1 under automation). */
  dpr: number
  /** Canvas pixels per game pixel: zoom * dpr, snapped to a whole number when it is within 2%. */
  scale: number
}

export function resolveRenderScale(
  parentWidth: number,
  parentHeight: number,
  devicePixelRatio: number,
  forceDprOne = false
): RenderScale {
  const zoom = resolveGameZoom(parentWidth, parentHeight)
  const rawDpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1
  const dpr = forceDprOne ? 1 : Math.min(3, Math.max(1, rawDpr))
  let scale = zoom * dpr
  const rounded = Math.round(scale)
  if (rounded >= 1 && Math.abs(scale - rounded) < 0.02) scale = rounded
  return { zoom, dpr, scale }
}

/** Scroll value that keeps a top-left-origin camera inside its bounds. */
export function clampScroll(value: number, boundsStart: number, boundsSize: number, displaySize: number): number {
  const min = boundsStart
  const max = Math.max(min, boundsStart + boundsSize - displaySize)
  if (value < min) return min
  if (value > max) return max
  return value
}

/** Scroll value that centres `center` in a top-left-origin camera. */
export function centerScroll(center: number, displaySize: number): number {
  return center - displaySize / 2
}

/** World rectangle a top-left-origin camera shows. */
export function worldViewFor(scrollX: number, scrollY: number, width: number, height: number, zoomX: number, zoomY: number) {
  return { x: scrollX, y: scrollY, width: width / zoomX, height: height / zoomY }
}

