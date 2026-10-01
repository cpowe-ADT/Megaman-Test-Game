/**
 * Floor and wall probes over the stage's solid rectangles (ground segments, blocks, walls; one-way
 * catwalks are not solids). Pure: the adapter reads the rectangles once from the static group.
 */
export interface SolidRect {
  left: number
  right: number
  top: number
  bottom: number
}

export interface RectLike {
  left: number
  right: number
  top: number
  bottom: number
}

/** Solid ground under `x` whose walking surface is `floorTop` (within 2px). */
export function hasFloorAt(solids: readonly SolidRect[], x: number, floorTop: number): boolean {
  return solids.some((rect) => x >= rect.left && x <= rect.right && Math.abs(rect.top - floorTop) <= 2)
}

/** A solid rising through the band `height` px over `floorTop` at `x` (a block face, a wall). */
export function hasWallAt(solids: readonly SolidRect[], x: number, floorTop: number, height: number): boolean {
  return solids.some(
    (rect) => x >= rect.left && x <= rect.right && rect.top < floorTop - 1 && rect.bottom > floorTop - height
  )
}

export interface WalkProbe {
  x: number
  halfWidth: number
  floorTop: number
  bodyHeight: number
  facing: 1 | -1
  bounds?: { minX: number; maxX: number }
}

/** True when one more step in `facing` would leave the floor, meet a wall or cross the patrol bounds. */
export function isWalkBlocked(solids: readonly SolidRect[], probe: WalkProbe): boolean {
  const { x, halfWidth, floorTop, bodyHeight, facing, bounds } = probe
  if (bounds && (facing > 0 ? x >= bounds.maxX : x <= bounds.minX)) {
    return true
  }
  const lead = x + facing * (halfWidth + 4)
  return !hasFloorAt(solids, lead, floorTop) || hasWallAt(solids, lead, floorTop, bodyHeight)
}

export function rectsOverlap(a: RectLike, b: RectLike): boolean {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
}
