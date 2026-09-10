import type { Direction8 } from './config'

export type SwordTrailPose = {
  angle: number
  anchorX: number
  anchorY: number
  sweepStart: number
  sweepEnd: number
}

const QUARTER_TURN = Math.PI / 4

const DIRECTION_ANGLES: Record<Direction8, number> = {
  e: 0,
  ne: -QUARTER_TURN,
  n: -Math.PI / 2,
  nw: -3 * QUARTER_TURN,
  w: Math.PI,
  sw: 3 * QUARTER_TURN,
  s: Math.PI / 2,
  se: QUARTER_TURN
}

const DIRECTION_ANCHORS: Record<Direction8, { x: number; y: number }> = {
  e: { x: 5, y: -7 },
  ne: { x: 4, y: -11 },
  n: { x: 0, y: -14 },
  nw: { x: -4, y: -11 },
  w: { x: -5, y: -7 },
  sw: { x: -4, y: -2 },
  s: { x: 0, y: 2 },
  se: { x: 4, y: -2 }
}

export const SWORD_TRAIL_DIRECTIONS = Object.freeze(
  Object.keys(DIRECTION_ANGLES) as Direction8[]
)

export function isSlashDirection(value: string): value is Direction8 {
  return value in DIRECTION_ANGLES
}

export function resolveSwordTrailPose(direction: string): SwordTrailPose {
  const resolvedDirection: Direction8 = isSlashDirection(direction) ? direction : 'e'
  const anchor = DIRECTION_ANCHORS[resolvedDirection]
  const angle = DIRECTION_ANGLES[resolvedDirection]
  return {
    angle,
    anchorX: anchor.x,
    anchorY: anchor.y,
    sweepStart: angle - 0.5,
    sweepEnd: angle + 0.24
  }
}
