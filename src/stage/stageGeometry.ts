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
