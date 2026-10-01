/**
 * Shared rules of the push zones (prompt 12 part 12b): `current_zone` (water) and `wind_zone` (gusts,
 * lifts, Ferro's magnet lift) are rects that push the hero with a capped force through the motor
 * environment (`src/player/environment.ts`). Pure.
 */
import type { Box } from './crumbleGroup'

/** Left, top, width, height, world px. */
export type ZoneRect = { x: number; y: number; width: number; height: number }

/** One zone's push on the hero this frame: force px/s^2 (y grows down) and the speed it builds to, px/s. */
export type ZonePush = { id: string; forceX: number; forceY: number; cap: number }

/** Inside when the centre of the hero's body is (a toe in the edge does not count). */
export function heroInZone(rect: ZoneRect, hero: Box): boolean {
  const centreX = (hero.left + hero.right) / 2
  const centreY = (hero.top + hero.bottom) / 2
  return centreX >= rect.x && centreX < rect.x + rect.width && centreY >= rect.y && centreY < rect.y + rect.height
}

/** Overlapping zones add their forces; the strongest cap holds. No push gives zero force and no cap. */
export function combineZonePushes(pushes: readonly ZonePush[]): { forceX: number; forceY: number; cap: number | undefined } {
  if (pushes.length === 0) return { forceX: 0, forceY: 0, cap: undefined }
  return {
    forceX: pushes.reduce((sum, push) => sum + push.forceX, 0),
    forceY: pushes.reduce((sum, push) => sum + push.forceY, 0),
    cap: Math.max(...pushes.map((push) => push.cap))
  }
}
