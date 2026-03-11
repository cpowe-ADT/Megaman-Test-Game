export type BossState =
  | 'INTRO'
  | 'THINK'
  | 'MOVE_TO_RANGE'
  | 'ATTACKING'
  | 'RECOVER'
  | 'HURT_INVULN'
  | 'PHASE_TRANSITION'
  | 'DEAD'

export type DamageType = 'normal' | 'impact' | 'electric' | 'fire' | 'ice' | 'hazard' | string

export interface BossStats {
  maxHP: number
  contactDamage: number
  defense?: number
  resistances: Record<string, number>
}

export interface HitSpec {
  damageAmount: number
  damageType: DamageType
  knockbackVector?: { x: number; y: number }
  hitstopFrames?: number
}

export interface AttackTelegraphSpec {
  animationName?: string
  sfxName?: string
  vfxName?: string
}

export interface AttackParams {
  projectileSpeed?: number
  spread?: number
  count?: number
  arc?: number
  homingStrength?: number
  hazardDuration?: number
  dashSpeed?: number
  radius?: number
  [key: string]: number | string | boolean | undefined
}

export interface BossAttackDefinition {
  id: string
  displayName?: string
  type: 'melee' | 'projectile' | 'hazard' | 'dash' | 'slam'
  enabled?: boolean
  windupTime: number
  activeTime: number
  recoveryTime: number
  cooldown: number
  rangeMin: number
  rangeMax: number
  weight: number
  panicWeight?: number
  params?: AttackParams
  hit: HitSpec
  telegraph?: AttackTelegraphSpec
}

export interface BossPhaseDefinition {
  threshold: number
  speedMultiplier?: number
  thinkTimeMultiplier?: number
  attackWeightOverrides?: Record<string, number>
  unlockAttacks?: string[]
  transitionLockMs?: number
}

export interface BossDefinition {
  boss_id: string
  displayName: string
  maxHP: number
  contactDamage: number
  defense?: number
  resistances?: Record<string, number>
  introLockMs?: number
  recoverMs?: number
  hurtInvulnMs?: number
  hurtStunMs?: number
  moveSpeed?: number
  preferredRange?: { min: number; max: number }
  panicDistance?: number
  phases: BossPhaseDefinition[]
  attacks: BossAttackDefinition[]
}

export interface BossContext {
  nowMs: number
  dtMs: number
  bossPosition: { x: number; y: number }
  playerPosition: { x: number; y: number }
  distanceToPlayer: number
  lineOfSight: boolean
  rng: () => number
  phaseIndex: number
  speedMultiplier: number
  thinkTimeMultiplier: number
}

export interface AttackContext extends BossContext {
  isPlayerTooClose: boolean
}

export interface DamageEvent {
  amount: number
  type: DamageType
  source: string
  knockback?: { x: number; y: number }
  hitstopFrames?: number
  iFrameMs?: number
}

export interface HitResult {
  accepted: boolean
  immune: boolean
  defeated: boolean
  amountApplied: number
  nextHP: number
  hitstopFrames: number
  reason?: 'invuln' | 'zero-damage' | 'dead'
}

export interface IAttack {
  readonly id: string
  readonly Cooldown: number
  Enter(ctx: AttackContext): void
  Tick(dtMs: number, ctx: AttackContext): AttackTickResult
  Exit(ctx: AttackContext): void
  CanUse(ctx: AttackContext): boolean
}

export interface AttackTickResult {
  phase: 'windup' | 'active' | 'recovery' | 'done'
  spawnedHitbox?: boolean
  spawnedProjectile?: boolean
  spawnedHazard?: boolean
}

export interface BossTickResult {
  state: BossState
  activeAttackId?: string
  movementDirection: -1 | 0 | 1
  hp: { current: number; max: number }
  phaseChanged?: { previous: number; current: number }
  firedAttack?: BossAttackDefinition
  transitionLocked?: boolean
}

export interface IBoss {
  OnFightStart(): void
  TickAI(ctx: BossContext): BossTickResult
  ApplyDamage(event: DamageEvent): HitResult
  Die(): void
}

export interface BossEventHooks {
  onStateChanged?: (state: BossState) => void
  onAttackStarted?: (attack: BossAttackDefinition) => void
  onAttackResolved?: (attack: BossAttackDefinition) => void
  onDamageApplied?: (event: DamageEvent, result: HitResult) => void
  onPhaseChanged?: (phaseIndex: number, phase: BossPhaseDefinition) => void
  onDied?: () => void
}
