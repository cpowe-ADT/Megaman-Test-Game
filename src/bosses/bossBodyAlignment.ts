/**
 * Boss body alignment.
 *
 * A boss is a Phaser Container holding one sprite. Arcade positions a container's body at
 * `container.y + offset.y - displayOriginY` (display origin is half the container size), so the
 * body offset has to be derived from where the artwork's feet actually are, not from the sprite
 * origin alone. Before this module the body hung about 20px below the drawn feet, so every boss
 * rested its invisible body on the floor while the art floated above it.
 *
 * The contact row is measured from the atlas (lowest opaque row of the first idle frame), which
 * keeps the alignment correct for any art pass without hand-tuned numbers per boss.
 */

export interface BossBodyAlignmentInput {
  /** Physics body size from the blueprint sprite plan. */
  bodyWidth: number
  bodyHeight: number
  /** Container size (Phaser containers use origin 0.5, so display origin is half of this). */
  containerWidth: number
  containerHeight: number
  /** Feet row relative to the container origin; positive means below the origin. */
  contactOffsetY: number
}

export interface BossBodyOffset {
  x: number
  y: number
}

/** Body offset that centres the body on the container x and puts the body bottom on the feet. */
export function computeBossBodyOffset(input: BossBodyAlignmentInput): BossBodyOffset {
  const displayOriginX = input.containerWidth * 0.5
  const displayOriginY = input.containerHeight * 0.5
  return {
    x: displayOriginX - input.bodyWidth * 0.5,
    y: displayOriginY + input.contactOffsetY - input.bodyHeight
  }
}

/** Where the body bottom lands relative to the container origin for a given offset. */
export function bodyBottomFromOffset(input: BossBodyAlignmentInput, offset: BossBodyOffset): number {
  return offset.y - input.containerHeight * 0.5 + input.bodyHeight
}

/**
 * Feet row relative to the sprite origin. `lowestOpaqueRow` is the index of the last row with
 * visible pixels (its bottom edge is `row + 1`); `originY` is the sprite origin fraction.
 */
export function contactOffsetFromFrame(frameHeight: number, originY: number, lowestOpaqueRow: number): number {
  return lowestOpaqueRow + 1 - originY * frameHeight
}

/**
 * Scan a frame from the bottom up and return the last row that has any pixel with alpha at or
 * above `threshold`, or null for a fully transparent frame.
 */
export function findLowestOpaqueRow(
  alphaAt: (x: number, y: number) => number,
  width: number,
  height: number,
  threshold = 8
): number | null {
  for (let y = height - 1; y >= 0; y -= 1) {
    for (let x = 0; x < width; x += 1) {
      if (alphaAt(x, y) >= threshold) return y
    }
  }
  return null
}

const contactRowCache = new Map<string, number>()

/**
 * Measure the feet row of a texture frame once per atlas and cache it. Falls back to the frame
 * bottom when the texture cannot be read (headless canvas without pixel access).
 */
export function measureContactOffset(
  textures: Phaser.Textures.TextureManager,
  atlasKey: string,
  frameName: string,
  originY: number
): number {
  const frame = textures.getFrame(atlasKey, frameName)
  const frameHeight = frame?.height ?? 0
  if (!frame || frameHeight <= 0) return 0
  const cacheKey = `${atlasKey}:${frameName}`
  let row = contactRowCache.get(cacheKey)
  if (row == null) {
    let measured: number | null = null
    try {
      measured = findLowestOpaqueRow(
        (x, y) => textures.getPixelAlpha(x, y, atlasKey, frameName) ?? 0,
        frame.width,
        frameHeight
      )
    } catch {
      measured = null
    }
    row = measured ?? frameHeight - 1
    contactRowCache.set(cacheKey, row)
  }
  return contactOffsetFromFrame(frameHeight, originY, row)
}

/** Test seam: clear the measured contact rows (atlases are immutable at runtime). */
export function resetContactRowCache(): void {
  contactRowCache.clear()
}
