export type OneWayCollisionProbe = {
  actorPrevBottom: number
  actorBottom: number
  actorVelocityY: number
  actorLeft: number
  actorRight: number
  platformTop: number
  platformLeft: number
  platformRight: number
  dropThroughActive: boolean
}

const ONE_WAY_TOP_TOLERANCE = 3
const ONE_WAY_MIN_FALL_SPEED = -2

export function shouldCollideWithOneWayPlatform(probe: OneWayCollisionProbe): boolean {
  if (probe.dropThroughActive) {
    return false
  }
  if (probe.actorVelocityY < ONE_WAY_MIN_FALL_SPEED) {
    return false
  }

  const horizontalOverlap =
    probe.actorRight > probe.platformLeft + 1 && probe.actorLeft < probe.platformRight - 1
  if (!horizontalOverlap) {
    return false
  }

  const fromAbove = probe.actorPrevBottom <= probe.platformTop + ONE_WAY_TOP_TOLERANCE
  const crossingTop = probe.actorBottom >= probe.platformTop - ONE_WAY_TOP_TOLERANCE
  return fromAbove && crossingTop
}
