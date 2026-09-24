import type { PlatformDefinition } from '../physics/PlatformCollisionSystem'
import type { BreakableWallDefinition } from './breakableWall'
import { CRUMBLE_DEFAULT_HEIGHT, type CrumbleGroupDefinition } from './crumbleGroup'

/** The stage mechanics that stand in the platform list (so every actor and shot collides with them). */
export type StageMechanicPlatformSource = {
  crumbleGroups?: readonly CrumbleGroupDefinition[]
  breakableWalls?: readonly BreakableWallDefinition[]
}

export const CRUMBLE_COLOR = 0x7a4a2c
export const BREAKABLE_WALL_COLOR = 0x6b5a48

/**
 * Crumble platforms and breakable walls as platform definitions for `PlatformCollisionSystem.rebuild`:
 * crumbles keep their group's type (one-way by default), walls are `wall` blocks (solid, kickable).
 * The mechanics adapter finds them again by id to shake, drop, restore or break them.
 */
export function stageMechanicPlatforms(source: StageMechanicPlatformSource): PlatformDefinition[] {
  const crumbles = (source.crumbleGroups ?? []).flatMap((group) =>
    group.platforms.map((platform) => ({
      id: platform.id,
      x: platform.x,
      y: platform.y,
      width: platform.width,
      height: platform.height ?? CRUMBLE_DEFAULT_HEIGHT,
      type: group.type ?? ('oneWay' as const),
      color: group.color ?? CRUMBLE_COLOR
    }))
  )
  const walls = (source.breakableWalls ?? []).map((wall) => ({
    id: wall.id,
    x: wall.x,
    y: wall.y,
    width: wall.width,
    height: wall.height,
    type: 'wall' as const,
    color: wall.color ?? BREAKABLE_WALL_COLOR
  }))
  return [...crumbles, ...walls]
}
