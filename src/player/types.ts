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
  slashReleased?: boolean
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
  /** Fall speed (px/s) of the landing reported by `justLanded`. */
  landingSpeed?: number
  /** `justLanded` above `HARD_LANDING_SPEED`: squash, dust and a short control lag follow. */
  hardLanding?: boolean
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
  /** Which swing is playing: ground combo hit 1-3, or the air spin. */
  slashMove?: SlashMove
  /** Present on every active frame (not only the first): the sword-hit path tests it each frame. */
  swordHitbox?: ResolvedHitbox
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
  weaponId?: 'ArcSlash'
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

export type SlashMove = 'combo1' | 'combo2' | 'combo3' | 'air_spin'

export type ResolvedHitbox = {
  shape: HitboxShape
  direction: Direction8
  grounded: boolean
  /** Hit-stop (60Hz frames) the sword-hit path emits when this hitbox touches a target; 0 when disabled. */
  hitstopFrames?: number
  /** Swing that owns the box; a new id starts each combo hit, and each target is hit once per id. */
  swingId?: number
  move?: SlashMove
  damage?: number
  /** Knockback for the target, x already signed by the swing's facing. */
  knockback?: { x: number; y: number }
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
