// Pure alpha-box audit over a decoded RGBA atlas: no Phaser, no file IO, so it runs under a plain
// unit test as well as the `sprites:validate` CLI step (scripts/sprites/audit-player-frames.mjs).
import type { DecodedPng } from './pngDecode'

export type AtlasFrameRect = { x: number; y: number; w: number; h: number }

export type AlphaBox = { minX: number; minY: number; maxX: number; maxY: number }

export type FrameAuditIssue = { frame: string; reason: string }

export const MIN_ALPHA_BOX_HEIGHT = 22

// Bounding box of opaque pixels within a w x h region, addressed by a local (x, y) alpha getter.
export function alphaBoundingBox(getAlpha: (x: number, y: number) => number, width: number, height: number): AlphaBox | null {
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (getAlpha(x, y) > 0) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) {
    return null
  }
  return { minX, minY, maxX, maxY }
}

/** Effect frames whose blade or beam reaches the cell edge by design (the cut clips them, it never shrinks the body). */
/** death: the burst frames scatter fragments to the cell edge. */
export const EDGE_EXEMPT_FRAMES = /^player_main\/(slash_[a-z_]+|respawn|death)\//
/** Frames that are fragments or a beam by design, not a standing body. */
export const HEIGHT_EXEMPT_FRAMES = /^player_main\/(death|respawn)\//

// A frame fails if it has no content, its alpha box is under MIN_ALPHA_BOX_HEIGHT tall, or the box
// touches any edge of its own cell (the frame was cropped by the cell boundary, not by real content).
// Effect groups are exempt from the rule their effect breaks (EDGE_EXEMPT_FRAMES, HEIGHT_EXEMPT_FRAMES).
export function auditFrameAlphaBox(frame: string, box: AlphaBox | null, width: number, height: number): FrameAuditIssue | null {
  if (!box) {
    return { frame, reason: 'empty (no opaque pixels)' }
  }
  const boxHeight = box.maxY - box.minY + 1
  if (boxHeight < MIN_ALPHA_BOX_HEIGHT && !HEIGHT_EXEMPT_FRAMES.test(frame)) {
    return { frame, reason: `alpha box ${boxHeight}px tall, under ${MIN_ALPHA_BOX_HEIGHT}px` }
  }
  if ((box.minX === 0 || box.minY === 0 || box.maxX === width - 1 || box.maxY === height - 1) && !EDGE_EXEMPT_FRAMES.test(frame)) {
    return { frame, reason: `alpha box touches the ${width}x${height} cell edge` }
  }
  return null
}

function alphaGetterForRect(atlas: DecodedPng, rect: AtlasFrameRect): (x: number, y: number) => number {
  const stride = atlas.width * 4
  return (x: number, y: number) => {
    const px = rect.x + x
    const py = rect.y + y
    const offset = py * stride + px * 4 + 3
    return atlas.pixels[offset] ?? 0
  }
}

// Audits every named frame (the caller filters to the ones it cares about, e.g. `player_main/`).
export function auditAtlasFrames(atlas: DecodedPng, frames: Record<string, AtlasFrameRect>): FrameAuditIssue[] {
  const issues: FrameAuditIssue[] = []
  Object.entries(frames).forEach(([name, rect]) => {
    const box = alphaBoundingBox(alphaGetterForRect(atlas, rect), rect.w, rect.h)
    const issue = auditFrameAlphaBox(name, box, rect.w, rect.h)
    if (issue) {
      issues.push(issue)
    }
  })
  return issues
}
