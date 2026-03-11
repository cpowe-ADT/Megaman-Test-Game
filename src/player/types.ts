import type { Direction8, HitboxShape } from './config'

export type PlayerIntent = {
  moveAxis: -1 | 0 | 1
  jumpPressed: boolean
  jumpHeld: boolean
  jumpReleased: boolean
  dashPressed: boolean
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
  dashing: boolean
  airDashing: boolean
  facing: 1 | -1
  turnRequested: boolean
  velocityX: number
  velocityY: number
  coyoteRemainingMs: number
  jumpBufferRemainingMs: number
  dashRemainingMs: number
  dashCooldownRemainingMs: number
}

export type CombatSnapshot = {
  shotFired: boolean
  chargeLevel: 0 | 1 | 2 | 3 | 4
  charging: boolean
  chargeReleased: boolean
  slashActive: boolean
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
}

export type SpawnProjectileRequest = {
  type: 'pellet' | 'charge'
  chargeLevel: 0 | 1 | 2 | 3 | 4
  facing: 1 | -1
  speed: number
  damage: number
  scale: number
  pierce: number
  impactFxKey: string
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
