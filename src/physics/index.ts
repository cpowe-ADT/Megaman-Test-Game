export type CollisionQuery = {
  fromX: number
  fromY: number
  toX: number
  toY: number
}

export type CollisionResult = {
  hit: boolean
  x?: number
  y?: number
}

export {
  PlatformCollisionSystem,
} from './PlatformCollisionSystem'
export { shouldCollideWithOneWayPlatform } from './platformCollisionRules'
export type {
  PlatformActorOptions,
  PlatformDefinition,
  PlatformType
} from './PlatformCollisionSystem'
export type { OneWayCollisionProbe } from './platformCollisionRules'
