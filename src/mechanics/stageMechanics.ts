import type { PlatformDefinition } from '../physics/PlatformCollisionSystem'
import type { BreakableWallDefinition } from './breakableWall'
import { CONVEYOR_DEFAULT_HEIGHT, type ConveyorDefinition } from './conveyor'
import { CRUMBLE_DEFAULT_HEIGHT, type CrumbleGroupDefinition } from './crumbleGroup'
import { ICE_FLOOR_DEFAULT_HEIGHT, type IceFloorDefinition } from './iceFloor'

/** The stage mechanics that stand in the platform list (so every actor and shot collides with them). */
export type StageMechanicPlatformSource = {
  crumbleGroups?: readonly CrumbleGroupDefinition[]
  breakableWalls?: readonly BreakableWallDefinition[]
  conveyors?: readonly ConveyorDefinition[]
  iceFloors?: readonly IceFloorDefinition[]
}

export const CRUMBLE_COLOR = 0x7a4a2c
export const BREAKABLE_WALL_COLOR = 0x6b5a48
export const CONVEYOR_COLOR = 0x3a3f4a
export const ICE_FLOOR_COLOR = 0x9fd8ff

/**
 * Crumble platforms and breakable walls as platform definitions for `PlatformCollisionSystem.rebuild`:
 * crumbles keep their group's type (one-way by default), walls are `wall` blocks (solid, kickable),
 * belts and ice floors are solid unless they say one-way (12b). The mechanics adapters find them again by
 * id to shake, drop, restore, break or draw them.
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
  const surface = (kind: 'belt' | 'ice') => (definition: ConveyorDefinition | IceFloorDefinition) => ({
    id: definition.id,
    x: definition.x,
    y: definition.y,
    width: definition.width,
    height: definition.height ?? (kind === 'belt' ? CONVEYOR_DEFAULT_HEIGHT : ICE_FLOOR_DEFAULT_HEIGHT),
    type: definition.type ?? ('solid' as const),
    color: definition.color ?? (kind === 'belt' ? CONVEYOR_COLOR : ICE_FLOOR_COLOR)
  })
  const belts = (source.conveyors ?? []).map(surface('belt'))
  const ice = (source.iceFloors ?? []).map(surface('ice'))
  return [...crumbles, ...walls, ...belts, ...ice]
}
