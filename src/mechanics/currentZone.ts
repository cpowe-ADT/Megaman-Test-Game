/**
 * `current_zone` (prompt 12 part 12b; 02 §2.2): a water current that pushes the hero with a capped
 * force while the centre of its body is inside the rect (half as much on the ground). The tell is the
 * `current` art tiled over the rect, its bubbles drifting with the flow. Pure; the Phaser edge is
 * `adapters/MotionMechanicsAdapter.ts`.
 */
import type { Box } from './crumbleGroup'
import { heroInZone, type ZonePush, type ZoneRect } from './forceZone'

export type CurrentZoneDefinition = ZoneRect & {
  id: string
  /** Push, px/s^2; the sign is the direction (default forceX 420 to the right, forceY 0). */
  forceX?: number
  forceY?: number
  /** The push speed it builds to, px/s (default 80). */
  maxSpeed?: number
}

export const CURRENT_DEFAULTS = { forceX: 420, forceY: 0, maxSpeed: 80 } as const

function finiteOr(value: number | undefined, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

export function currentPush(definition: CurrentZoneDefinition): ZonePush {
  return {
    id: definition.id,
    forceX: finiteOr(definition.forceX, CURRENT_DEFAULTS.forceX),
    forceY: finiteOr(definition.forceY, CURRENT_DEFAULTS.forceY),
    cap: Math.max(0, finiteOr(definition.maxSpeed, CURRENT_DEFAULTS.maxSpeed))
  }
}

/** The current's push when the hero is inside, else null. */
export function currentPushOn(definition: CurrentZoneDefinition, hero: Box): ZonePush | null {
  return heroInZone(definition, hero) ? currentPush(definition) : null
}

/** Which way the bubbles drift (the art flips for a leftward flow); a purely vertical current reads as right. */
export function currentFlowDirection(definition: CurrentZoneDefinition): 1 | -1 {
  return currentPush(definition).forceX < 0 ? -1 : 1
}
