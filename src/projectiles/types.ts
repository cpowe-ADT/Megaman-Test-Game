export type ProjectileOwner = 'player' | 'enemy'

export type ProjectilePoolKey = 'player' | 'enemy'

export type ProjectileBehavior =
  | { kind: 'standard' }
  | { kind: 'wave'; amplitude: number; periodMs: number }
  | { kind: 'lob'; gravityY: number; initialVelocityY: number }
  | { kind: 'boomerang'; returnAfterMs: number; returnSpeed: number; homeOffsetY: number }

export type ProjectileHitPolicy = {
  hitsEnvironment: boolean
  collidesWithWorldBounds: boolean
  pierce: number
}

export type ProjectileVisualConfig = {
  textureKey: string
  frame: string
  depth: number
  alpha?: number
  scale: number
  tint?: number
  blendMode?: string | number
  flipXWithDirection?: boolean
  /** Frames cycled while the shot flies (replaces the old spin for directional art). */
  animationFrames?: readonly string[]
  animationFrameMs?: number
}

export type ProjectileHitboxConfig = {
  width: number
  height: number
}

export type ProjectileDefinition = {
  id: string
  owner: ProjectileOwner
  pool: ProjectilePoolKey
  speed: number
  damage: number
  lifetimeMs: number
  maxVelocityX: number
  maxVelocityY: number
  visual: ProjectileVisualConfig
  hitbox?: ProjectileHitboxConfig
  /** Enemy shots only: the saber sends it back (orbs, pellets, missiles); beams, lasers, flames and boomerangs do not. */
  reflectable?: boolean
  behavior: ProjectileBehavior
  hitPolicy: ProjectileHitPolicy
}

export type ProjectileSpawnRequest = {
  id: string
  x: number
  y: number
  direction: 1 | -1
  speed?: number
  velocity?: { x: number; y: number }
  damage?: number
  scale?: number
  tint?: number
  chargeLevel?: 0 | 1 | 2 | 3 | 4
  /** Floor the shooter stands on: the shot is lifted so its body and drawing start above it. */
  clearFloorY?: number
  metadata?: Record<string, unknown>
}
