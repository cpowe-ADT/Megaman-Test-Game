/**
 * Pure tile-placement math for the per-biome 16px tileset. Given a platform rect and its collision
 * type, returns which atlas frame goes at each 16px cell so an adapter (PlatformCollisionSystem, the
 * ground strip, spike hazards) can draw it with a Blitter or a baked RenderTexture. No Phaser here:
 * this is unit-tested without a scene.
 *
 * Odd-sized rects (not a multiple of 16) clip: the last column/row's placement keeps native 16px art
 * and just crops to the remaining space, rather than stretching every tile to fit evenly.
 */

export const TILE_SIZE = 16

/** `ground`: the full-width floor strip. `solid`/`passThrough` render as a floating ledge (capped sides). */
export type TileSkinKind = 'solid' | 'wall' | 'oneWay' | 'ground' | 'spike' | 'passThrough'

export type TileSkinRect = {
  /** Top-left origin, in the same local space the caller will draw into (world units or a texture's own space). */
  x: number
  y: number
  width: number
  height: number
}

export type TilePlacement = {
  frame: string
  x: number
  y: number
  /** Visible width/height for this cell: TILE_SIZE unless clipped at the rect's right/bottom edge. */
  width: number
  height: number
}

const GROUND_TOP_VARIANTS = 3
const GROUND_FILL_VARIANTS = 3

/** Deterministic from position (not Math.random): the same rect always tiles the same way, run to run. */
function variantIndex(worldX: number, worldY: number, count: number): number {
  if (count <= 1) {
    return 0
  }
  const cellX = Math.round(worldX / TILE_SIZE)
  const cellY = Math.round(worldY / TILE_SIZE)
  const seed = cellX * 31 + cellY * 17
  return ((seed % count) + count) % count
}

function edgeOf(col: number, cols: number): 'l' | 'm' | 'r' {
  if (cols === 1) {
    // No single-tile capped frame in the contract; the left cap reads better than a plain middle fill.
    return 'l'
  }
  if (col === 0) {
    return 'l'
  }
  if (col === cols - 1) {
    return 'r'
  }
  return 'm'
}

function clippedSpan(start: number, index: number, totalSize: number): number {
  const remaining = totalSize - index * TILE_SIZE
  return Math.max(0, Math.min(TILE_SIZE, remaining))
}

export function computeTilePlacements(rect: TileSkinRect, kind: TileSkinKind): TilePlacement[] {
  const cols = Math.max(1, Math.ceil(rect.width / TILE_SIZE))
  const rows = Math.max(1, Math.ceil(rect.height / TILE_SIZE))
  const placements: TilePlacement[] = []

  if (kind === 'spike') {
    const rowHeight = clippedSpan(rect.y, 0, rect.height)
    for (let col = 0; col < cols; col += 1) {
      const x = rect.x + col * TILE_SIZE
      placements.push({ frame: 'spike', x, y: rect.y, width: clippedSpan(rect.x, col, rect.width), height: rowHeight })
    }
    return placements
  }

  if (kind === 'oneWay') {
    const rowHeight = clippedSpan(rect.y, 0, rect.height)
    for (let col = 0; col < cols; col += 1) {
      const x = rect.x + col * TILE_SIZE
      const frame = `plank_${edgeOf(col, cols)}`
      placements.push({ frame, x, y: rect.y, width: clippedSpan(rect.x, col, rect.width), height: rowHeight })
    }
    return placements
  }

  const isGround = kind === 'ground'
  const isWall = kind === 'wall'

  for (let row = 0; row < rows; row += 1) {
    const y = rect.y + row * TILE_SIZE
    const height = clippedSpan(rect.y, row, rect.height)
    for (let col = 0; col < cols; col += 1) {
      const x = rect.x + col * TILE_SIZE
      const width = clippedSpan(rect.x, col, rect.width)
      const edge = edgeOf(col, cols)

      let frame: string
      if (isWall) {
        frame = edge === 'l' ? 'wall_face_l' : edge === 'r' ? 'wall_face_r' : 'wall_fill'
      } else if (row === 0) {
        frame = isGround ? `ground_top_${variantIndex(x, y, GROUND_TOP_VARIANTS)}` : `ledge_top_${edge}`
      } else {
        frame = isGround ? `ground_fill_${variantIndex(x, y, GROUND_FILL_VARIANTS)}` : `ledge_fill_${edge}`
      }

      placements.push({ frame, x, y, width, height })
    }
  }

  return placements
}
