import Phaser from 'phaser'
import type { ProjectileSystem } from '../projectiles'
import type { PlayerDamageRequest, PlayerDamageResult } from '../player/types'

export type EnemyMovementType = 'walker' | 'hopper' | 'flyer' | 'turret' | 'drone' | 'crawler'

export type EnemyState =
  | 'idle'
  | 'patrol'
  | 'alert'
  | 'chase'
  | 'attack_windup'
  | 'attack_active'
  | 'attack_recover'
  | 'retreat'
  | 'stunned'
  | 'dead'

export type EnemyAttackType = 'melee' | 'projectile' | 'burst' | 'lobbed' | 'charge' | 'beam'

export type EnemyDeathBehavior = 'explode' | 'fall' | 'fade'

export interface EnemyColliderConfig {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

export interface EnemyBoxConfig {
  width: number
  height: number
  offsetX: number
  offsetY: number
}

export interface EnemyStatsConfig {
  hp: number
  damage: number
  speed: number
  gravityScale: number
  knockbackResist: number
  contactDamage?: number
  hitstunLightMs: number
  hitstunHeavyMs: number
  invulnerabilityMs?: number
  /** Super armour (mini-bosses): no hitstun, and only hits of `pushMinDamage` or more push it. */
  heavy?: EnemyHeavyConfig
}

export interface EnemyHeavyConfig {
  pushMinDamage: number
  pushSpeed: number
  pushMs: number
}

export interface EnemyAIConfig {
  sightRange: number
  aggroRange: number
  leashRange: number
  reactionTime: number
}

export interface EnemyAttackConfig {
  type: EnemyAttackType
  cooldownMs: number
  windupMs: number
  activeMs: number
  recoveryMs: number
  range?: number
  projectileKey?: string
  burstCount?: number
  burstSpacingMs?: number
  chargeSpeed?: number
}

export interface EnemyDropTable {
  healthChance: number
  ammoChance: number
  scoreChance: number
  scoreValue?: number
}

export interface EnemyAnimationKeys {
  idle: string
  move: string
  attackWindup: string
  attackActive: string
  hurt: string
  death: string
  /** Shown during `attack_recover`; the attack's active pose when absent. */
  attackRecover?: string
  spawn?: string
  turn?: string
  stunned?: string
  explode?: string
}

export interface EnemyDefinition {
  typeKey: string
  movementType: EnemyMovementType
  collider: EnemyColliderConfig
  hurtbox: EnemyBoxConfig
  hitboxes: Record<string, EnemyBoxConfig>
  stats: EnemyStatsConfig
  ai: EnemyAIConfig
  attack: EnemyAttackConfig
  drops?: EnemyDropTable
  deathBehavior: EnemyDeathBehavior
  animations: EnemyAnimationKeys
  /** When set, a kill plays the death frames for this long before the defeat (explosion, drop) lands. */
  deathSequenceMs?: number
  /** A dedicated behaviour in place of the generic `EnemyAI` (see `enemyBrains.ts`). */
  brain?: EnemyBrainKey
  /** A mini-boss (12c): its defeat forces a health drop (`minibossCatalog.ts`). */
  role?: 'miniboss'
}

export type EnemyBrainKey = 'custodian_walker' | 'relay_turret_nest' | 'sentry_twins' | 'drill_serpent'

/** A per-family behaviour the entity runs instead of `EnemyAI`; it owns the entity's state and facing. */
export interface EnemyBrain {
  update(now: number, deltaMs: number): void
  onHurt(now: number): void
  onDefeated(now: number): void
  destroy(): void
  /** True while nothing can hurt it (the drill serpent under the floor); the entity asks before any damage. */
  isInvulnerable?(): boolean
  /** An animation key that replaces the one its state maps to (frames the family's set does not name). */
  animationKey?(): string | undefined
}

export interface DamageEvent {
  amount: number
  type: 'bullet' | 'melee' | 'contact' | 'explosive' | 'beam'
  knockback?: Phaser.Math.Vector2
  hitstunMs?: number
  sourceId?: string
}

export interface EnemyRuntimeContext {
  scene: Phaser.Scene
  player: Phaser.Physics.Arcade.Sprite
  stageId: string
  enemyGroup: Phaser.Physics.Arcade.Group
  projectileGroup: Phaser.Physics.Arcade.Group
  projectileSystem: ProjectileSystem
  worldPlatforms?: Phaser.Physics.Arcade.StaticGroup
  applyDamageToPlayer: (request: PlayerDamageRequest) => PlayerDamageResult
  onEnemyDefeated: (sprite: Phaser.Physics.Arcade.Sprite) => void
  playAnimationSafe: (
    target: Phaser.GameObjects.Sprite | Phaser.Physics.Arcade.Sprite | undefined,
    key: string,
    ignoreIfPlaying?: boolean
  ) => void
}

export interface EnemyLevelMarker {
  id: string
  typeKey: string
  x: number
  y: number
  patrolMinX?: number
  patrolMaxX?: number
  spawnTriggerX?: number
  spawnLeadX?: number
  retireTriggerX?: number
  persistent?: boolean
}

export interface EnemyPatrolBounds {
  minX: number
  maxX: number
}

export interface EnemySpawnWave {
  id: string
  typeKey: string
  x: number
  y: number
  trigger: 'time' | 'distance' | 'camera'
  triggerValue: number
  consumed?: boolean
}

export interface EnemyProjectileDefinition {
  key: string
  speed: number
  gravity: number
  lifetimeMs: number
  damage: number
  hitFxKey?: string
  arc?: number
}

export interface EnemyFrameEventMarker {
  frame: number
  event: 'enable_hitbox' | 'disable_hitbox' | 'spawn_projectile' | 'footstep' | 'play_sfx' | 'spawn_vfx'
  payload?: Record<string, string | number | boolean>
}

export interface EnemyAnimationEntry {
  key: string
  frameRate: number
  repeat: number
  frameStart: number
  frameEnd: number
  events: EnemyFrameEventMarker[]
}
