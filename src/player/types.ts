import type { Direction8, HitboxShape } from './config'

export type PlayerIntent = {
  moveAxis: -1 | 0 | 1
  jumpPressed: boolean
  jumpHeld: boolean
  jumpReleased: boolean
  dashPressed: boolean
  dashHeld: boolean
  dashReleased: boolean
  shootPressed: boolean
  shootHeld: boolean
  shootReleased: boolean
  slashPressed: boolean
  crouchHeld: boolean
  aim: { x: number; y: number }
}

export type LocomotionState =
  | 'idle'
  | 'run'
  | 'turn'
  | 'crouch'
  | 'jump_start'
  | 'jump_rise'
  | 'jump_apex'
  | 'fall'
  | 'land'
  | 'dash'
  | 'air_dash'
  | 'wall_slide'
  | 'wall_jump'
  | 'hurt'

export type ActionState =
  | 'none'
  | 'shoot'
  | 'charge_start'
  | 'charge_hold'
  | 'charge_release'
  | 'slash'
  | 'hurt_light'
  | 'hurt_heavy'

export type MotorSnapshot = {
  grounded: boolean
  justLanded: boolean
  justJumped: boolean
  jumpSource: 'none' | 'ground' | 'coyote' | 'wall'
  dashing: boolean
  dashStarted: boolean
  dashEnded: boolean
  airDashing: boolean
  wallSliding: boolean
  wallSide: -1 | 0 | 1
  wallJumping: boolean
  facing: 1 | -1
  turnRequested: boolean
  velocityX: number
  velocityY: number
  coyoteRemainingMs: number
  jumpBufferRemainingMs: number
  dashRemainingMs: number
  dashCooldownRemainingMs: number
  isGravityInverted: boolean
}

export type CombatSnapshot = {
  shotFired: boolean
  chargeLevel: 0 | 1 | 2 | 3 | 4
  chargeElapsedMs: number
  charging: boolean
  chargeReleased: boolean
  releasedChargeLevel: 0 | 1 | 2 | 3 | 4
  slashActive: boolean
  slashGrounded?: boolean
  slashDirection?: Direction8
  slashPhase?: 'startup' | 'active' | 'recovery'
  hitstunRemainingMs: number
  iFramesRemainingMs: number
  hitstopRemainingFrames: number
  pendingDamageTier?: 'light' | 'heavy'
}

export type PlayerResolvedState = {
  locomotion: LocomotionState
  action: ActionState
  facing: 1 | -1
  slashDirection?: Direction8
  chargeLevel?: 0 | 1 | 2 | 3 | 4
  isGravityInverted: boolean
}

export type SpawnProjectileRequest = {
  type: 'pellet' | 'charge'
  chargeLevel: 0 | 1 | 2 | 3 | 4
  facing: 1 | -1
}

export type ProjectileSpawnReceipt = {
  source: 'player'
  projectileId: string
  weaponId: string
  weaponElement: string
  chargeLevel: 0 | 1 | 2 | 3 | 4
  damage: number
  speed: number
  scale: number
  pierce: number
  impactFxKey: string
  energyCost: number
  energyRemaining: number
}

export type ResolvedHitbox = {
  shape: HitboxShape
  direction: Direction8
  grounded: boolean
}

export type PlayerRuntimeEvent =
  | { type: 'vfx'; key: string }
  | { type: 'sfx'; key: string }
  | { type: 'projectile'; request: SpawnProjectileRequest }
  | { type: 'hitbox'; request: ResolvedHitbox }
  | { type: 'hitstop'; frames: number }

export type HitTier = 'light' | 'heavy'

export type PlayerDamageSourceType =
  | 'enemy_contact'
  | 'enemy_melee'
  | 'enemy_projectile'
  | 'boss_contact'
  | 'boss_projectile'
  | 'hazard'
  | 'fall'
  | 'system'

export type PlayerDamageRequest = {
  amount: number
  tier?: HitTier
  sourceType: PlayerDamageSourceType
  sourceId: string
  direction?: -1 | 1
  knockback?: { x: number; y: number }
  element?: string
  bypassIFrames?: boolean
}

export type PlayerDamageResult = {
  accepted: boolean
  reason: 'accepted' | 'iframes' | 'inactive'
  amount: number
  request: PlayerDamageRequest
}
