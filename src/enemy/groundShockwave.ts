import { hasFloorAt, hasWallAt, rectsOverlap, type RectLike, type SolidRect } from './floorProbe'

/**
 * A ground shockwave (the custodian walker's stomp): a low flame that runs along the floor both ways
 * from the stomp and dies at a wall, at the end of its floor or at its range. It is 16px tall, so a
 * jump clears it. Not a `ProjectileSystem` shot: it follows the floor, never reflects, and the enemy
 * that launched it owns it (drawn and hit-tested by `CustodianWalkerBrain`).
 */
export interface GroundShockwaveDefinition {
  key: string
  /** px/s along the floor. */
  speed: number
  width: number
  height: number
  damage: number
  maxRange: number
  /** Each wave starts this far from the stomp's centre, just past the feet. */
  spawnOffsetX: number
}

export const CUSTODIAN_SHOCKWAVE: GroundShockwaveDefinition = {
  key: 'custodian_shockwave',
  speed: 150,
  width: 14,
  height: 16,
  damage: 2,
  maxRange: 448,
  spawnOffsetX: 18
}

export interface GroundWave {
  x: number
  dir: 1 | -1
  limitX: number
  floorTop: number
  alive: boolean
}

/**
 * How far a wave's centre can run each way from `originX` before a wall, a ledge end, its range or the
 * edge of its arena (a locked room's floor runs on under the gate; the wave stops at the room).
 */
export function resolveShockwaveSpan(
  solids: readonly SolidRect[],
  originX: number,
  floorTop: number,
  def: GroundShockwaveDefinition = CUSTODIAN_SHOCKWAVE,
  options: { step?: number; arena?: { minX: number; maxX: number } } = {}
): { minX: number; maxX: number } {
  const step = options.step ?? 2
  const run = (dir: 1 | -1): number => {
    let x = originX
    const reach = originX + dir * def.maxRange
    const arenaEdge = dir > 0 ? options.arena?.maxX : options.arena?.minX
    const limit = arenaEdge === undefined ? reach : dir > 0 ? Math.min(reach, arenaEdge) : Math.max(reach, arenaEdge)
    while (dir > 0 ? x < limit : x > limit) {
      const next = x + dir * step
      const lead = next + (dir * def.width) / 2
      if (!hasFloorAt(solids, next, floorTop) || hasWallAt(solids, lead, floorTop, def.height)) {
        break
      }
      x = next
    }
    return dir > 0 ? Math.min(x, limit) : Math.max(x, limit)
  }
  return { minX: run(-1), maxX: run(1) }
}

/** The two waves of one stomp; a side with no room to start is born dead. */
export function launchShockwaves(
  originX: number,
  floorTop: number,
  span: { minX: number; maxX: number },
  def: GroundShockwaveDefinition = CUSTODIAN_SHOCKWAVE
): GroundWave[] {
  return ([-1, 1] as const).map((dir) => {
    const limitX = dir > 0 ? span.maxX : span.minX
    const x = originX + dir * def.spawnOffsetX
    const alive = dir > 0 ? x < limitX : x > limitX
    return { x: alive ? x : limitX, dir, limitX, floorTop, alive }
  })
}

export function stepGroundWave(
  wave: GroundWave,
  dtMs: number,
  def: GroundShockwaveDefinition = CUSTODIAN_SHOCKWAVE
): GroundWave {
  if (!wave.alive) {
    return wave
  }
  const x = wave.x + (wave.dir * def.speed * dtMs) / 1000
  const reached = wave.dir > 0 ? x >= wave.limitX : x <= wave.limitX
  return reached ? { ...wave, x: wave.limitX, alive: false } : { ...wave, x }
}

export function groundWaveRect(wave: GroundWave, def: GroundShockwaveDefinition = CUSTODIAN_SHOCKWAVE): RectLike {
  return {
    left: wave.x - def.width / 2,
    right: wave.x + def.width / 2,
    top: wave.floorTop - def.height,
    bottom: wave.floorTop
  }
}

/** A live wave overlapping the hero's body hurts; a hero whose feet are above the wave's top is clear. */
export function groundWaveHits(wave: GroundWave, hero: RectLike, def: GroundShockwaveDefinition = CUSTODIAN_SHOCKWAVE): boolean {
  return wave.alive && rectsOverlap(groundWaveRect(wave, def), hero)
}
