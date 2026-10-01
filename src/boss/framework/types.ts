import type { TelegraphSpec } from '../../bosses/types'

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
  /** The authored wind-up tell (`src/bosses/roster.ts`); required by `validateBossDefinition`, drawn by the Game scene. */
  warningFx?: TelegraphSpec['warningFx']
  /** Where the tell appears relative to the boss; required with `warningFx`. */
  anchor?: TelegraphSpec['anchor']
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
  requirements?: {
    grounded?: boolean
    airborne?: boolean
    maxActiveHazards?: number
  }
}

export interface AttackTimingOverride {
  windupTime?: number
  cooldown?: number
}

export interface BossPhaseDefinition {
  /** HUD name for phases the blueprint's `phases` list does not hold (desperation). */
  name?: string
  /** The 20%-HP phase: its own attack, a palette flash and the arena change (prompt 07 phase 7.2). */
  desperation?: boolean
  /** The phase kit's `enabled` flip: an attack mapped to false never starts in this phase. */
  attackEnabled?: Record<string, boolean>
  /** The phase kit's retimes: the attack's wind-up and cooldown in this phase. */
  attackTiming?: Record<string, AttackTimingOverride>
  threshold: number
  speedMultiplier?: number
  thinkTimeMultiplier?: number
  attackWeightOverrides?: Record<string, number>
  unlockAttacks?: string[]
  transitionLockMs?: number
  /** Optional deterministic authored order. Unavailable/cooling entries are skipped safely. */
  patternDeck?: string[]
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
  bossGrounded?: boolean
  activeHazardCount?: number
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
  /**
   * A weakness hit breaks the boss (`src/boss/bossBreak.ts`): it cancels the running attack whatever its lifecycle,
   * and the boss is knocked back and held in its recoil pose for `stunMs` instead of the definition's `hurtStunMs`.
   */
  breaks?: boolean
  /** The break's stun (`BOSS_BREAK.stunMs`, 450 ms, when absent). */
  stunMs?: number
  /** After a break, later breaking hits only damage (plain stun, nothing cancelled) for this long. */
  stunLockoutMs?: number
}

export interface HitResult {
  accepted: boolean
  immune: boolean
  defeated: boolean
  amountApplied: number
  nextHP: number
  hitstopFrames: number
  reason?: 'invuln' | 'zero-damage' | 'dead'
  /** The attack this hit's break cancelled (wind-up, active or recovery). */
  interruptedAttackId?: string
  /** The hit broke the boss: false for plain hits, and for weakness hits inside the lockout. */
  broke?: boolean
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
  onAttackInterrupted?: (attack: BossAttackDefinition) => void
  /** A break landed (after `onAttackInterrupted` for the attack it cancelled, if any): play the knockback and the pose. */
  onBroken?: (info: { stunMs: number; interruptedAttack?: BossAttackDefinition }) => void
  onDied?: () => void
}
