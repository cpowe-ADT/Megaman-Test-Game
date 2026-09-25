import type Phaser from 'phaser'
import type { SfxAssetKey } from '../audio/sfxLibrary'
import { resolveUpgradeModifiers, type UpgradeModifiers } from '../progression/upgrades'
import type { PlayerDamageRequest } from './types'
import { shouldFlipPlayerSpriteForFacing } from './config'
import type { PlayerFeatureFlags } from './featureFlags'
import type { BlasterConfig, SwordConfig, DamageConfig, Direction8, HitboxShape, SwordHitConfig } from './config'
import type {
  CombatSnapshot,
  HitTier,
  PlayerIntent,
  PlayerRuntimeEvent,
  ResolvedHitbox,
  SlashMove,
  SpawnProjectileRequest
} from './types'

const FRAME_MS = 1000 / 60
/** Phase clocks are float ms; anything this close to zero has run out. */
const PHASE_EPSILON_MS = 1e-6
const COMBO_MOVES: readonly SlashMove[] = ['combo1', 'combo2', 'combo3']
/** Each combo hit and the air spin has its own saber sound (part 12h). */
const SLASH_SFX: Record<SlashMove, SfxAssetKey> = { combo1: 'saber_combo_1', combo2: 'saber_combo_2', combo3: 'saber_combo_3', air_spin: 'saber_air_spin' }
/** Legacy single slash (comboEnabled false): the adapter's old flat numbers. */
const LEGACY_SWORD_DAMAGE = 2
const LEGACY_SWORD_KNOCKBACK = { x: 100, y: -60 }

/** Motor facts the slash reads: a jump started this tick cancels recovery. */
export type CombatMotionFacts = { justJumped?: boolean }

function isHorizontal(direction: Direction8): boolean {
  return direction === 'e' || direction === 'w'
}

function directionSign(direction: Direction8, facing: 1 | -1): 1 | -1 {
  if (direction === 'e' || direction === 'ne' || direction === 'se') return 1
  if (direction === 'w' || direction === 'nw' || direction === 'sw') return -1
  return facing
}

function mirrorShape(shape: HitboxShape, sign: 1 | -1): HitboxShape {
  return sign === 1 ? { ...shape } : { ...shape, offsetX: -shape.offsetX }
}

export function resolveEightDirection(
  aim: { x: number; y: number },
  facing: 1 | -1,
  deadzone: number
): Direction8 {
  const xRaw = Math.abs(aim.x) < deadzone ? 0 : aim.x
  const yRaw = Math.abs(aim.y) < deadzone ? 0 : aim.y
  const x = xRaw === 0 && yRaw === 0 ? facing : xRaw
  const y = yRaw

  const horizontal = x >= 0 ? 'e' : 'w'
  if (y === 0) {
    return horizontal
  }
  if (y < 0) {
    if (Math.abs(x) < deadzone) {
      return 'n'
    }
    return (horizontal === 'e' ? 'ne' : 'nw') as Direction8
  }
  if (Math.abs(x) < deadzone) {
    return 's'
  }
  return (horizontal === 'e' ? 'se' : 'sw') as Direction8
}

type DamageHooks = {
  onDamageAccepted: (damage: number) => void
  onKnockback: (vx: number, vy: number) => void
}

export class PlayerCombat {
  private modifiers: UpgradeModifiers = resolveUpgradeModifiers({})
  private saberReleaseArmed = false
  setUpgradeModifiers(modifiers: UpgradeModifiers): void { this.modifiers = modifiers }

  private nextFireAt = 0
  private charging = false
  private chargeStartedAt = 0
  /** A charged release that landed inside the fire-rate window fires at `nextFireAt` instead. */
  private deferredReleaseLevel: 0 | 1 | 2 | 3 | 4 = 0
  private chargeLevel: 0 | 1 | 2 | 3 | 4 = 0

  private slashDirection: Direction8 = 'e'
  private slashPhase: 'startup' | 'active' | 'recovery' | null = null
  private slashPhaseRemainingMs = 0
  private slashGrounded = true
  private slashHitboxFired = false
  private slashMove: SlashMove = 'combo1'
  private slashSign: 1 | -1 = 1
  private slashHit: SwordHitConfig | null = null
  /** Ground chain: index of the next hit, a press buffered during active/recovery, and the link window after it. */
  private comboNextIndex = 0
  private comboBuffered = false
  private comboLinkRemainingMs = 0
  private airSlashUsed = false
  private slashStartedThisTick = false
  private muzzlePose: 'stand' | 'run' | 'air' | 'dash' = 'stand'
  private wasDashing = false
  private swingId = 0
  private readonly swingTargets = new Set<unknown>()

  private iFramesRemainingMs = 0
  private hitstunRemainingMs = 0
  private hitstopRemainingFrames = 0
  private pendingDamageTier: HitTier | undefined

  private transientShotFired = false
  private transientChargeReleased = false
  private transientReleasedChargeLevel: 0 | 1 | 2 | 3 | 4 = 0
  private chargeCueLevel: 0 | 1 | 2 | 3 | 4 = 0
  private chargeElapsedMs = 0

  constructor(
    private readonly player: Phaser.Physics.Arcade.Sprite,
    private readonly flags: PlayerFeatureFlags,
    private readonly blaster: BlasterConfig,
    private readonly sword: SwordConfig,
    private readonly damage: DamageConfig,
    private readonly hooks: DamageHooks
  ) {}

  update(
    intent: PlayerIntent,
    now: number,
    deltaMs: number,
    facing: 1 | -1,
    grounded: boolean,
    dashing: boolean,
    canChargeShot = this.flags.enableChargeShot,
    motion: CombatMotionFacts = {}
  ): { snapshot: CombatSnapshot; events: PlayerRuntimeEvent[] } {
    const events: PlayerRuntimeEvent[] = []
    this.transientShotFired = false
    this.transientChargeReleased = false
    this.transientReleasedChargeLevel = 0

    this.iFramesRemainingMs = Math.max(0, this.iFramesRemainingMs - deltaMs)
    this.hitstunRemainingMs = Math.max(0, this.hitstunRemainingMs - deltaMs)
    this.nextFireAt = Math.max(this.nextFireAt, 0)

    if (this.hitstopRemainingFrames > 0) {
      this.hitstopRemainingFrames -= 1
      return {
        snapshot: this.createSnapshot(),
        events
      }
    }

    if (this.hitstunRemainingMs <= 0) {
      this.pendingDamageTier = undefined
    }

    const canAct = this.hitstunRemainingMs <= 0
    this.muzzlePose = dashing ? 'dash' : !grounded ? 'air' : intent.moveAxis !== 0 ? 'run' : 'stand'

    if (canAct) {
      if (this.deferredReleaseLevel > 0 && now >= this.nextFireAt) {
        const level = this.deferredReleaseLevel
        this.deferredReleaseLevel = 0
        this.fireProjectile(events, level, facing, now)
      }

      // The pellet fires on press and the charge starts on the same frame (prompt 05 §5.2 item 3).
      if (intent.shootPressed) {
        this.fireProjectile(events, 0, facing, now)
        if (canChargeShot) {
          this.charging = true
          this.chargeStartedAt = now
          this.chargeLevel = 0
          this.chargeCueLevel = 0
          this.chargeElapsedMs = 0
        }
      }

      // The charge clock is accumulated frame time, so it stops in hit-stop and dialogue.
      if (this.charging && intent.shootHeld && !intent.shootPressed) {
        this.chargeElapsedMs += Math.max(0, deltaMs)
        const nextChargeLevel = this.resolveChargeLevel(this.chargeElapsedMs)
        this.chargeLevel = nextChargeLevel
        if (nextChargeLevel > 0 && nextChargeLevel > this.chargeCueLevel) {
          events.push({ type: 'vfx', key: `fx_charge_aura_lv${nextChargeLevel}` })
          events.push({ type: 'sfx', key: this.chargeCueLevel === 0 ? 'charge_start' : 'charge_loop' })
          this.chargeCueLevel = nextChargeLevel
        }
      }

      if (this.charging && intent.shootReleased) {
        const level = canChargeShot ? this.resolveChargeLevel(this.chargeElapsedMs) : 0
        this.charging = false
        this.chargeLevel = 0
        this.chargeCueLevel = 0
        this.chargeElapsedMs = 0
        if (level > 0) {
          if (now >= this.nextFireAt) {
            this.fireProjectile(events, level, facing, now)
          } else {
            this.deferredReleaseLevel = level
          }
          this.transientChargeReleased = true
          this.transientReleasedChargeLevel = level
        }
      }

      if (grounded) {
        this.airSlashUsed = false
      }
      // Dash and jump cancel recovery (never startup or active) and drop the chain.
      const dashStarted = dashing && !this.wasDashing
      if (this.slashPhase === 'recovery' && (dashStarted || motion.justJumped)) {
        this.endSlash()
        this.resetCombo()
      }

      const canSlash = this.flags.enableSword && !dashing
      if (canSlash && intent.slashPressed) {
        if (this.slashPhase == null) {
          this.startSlash(intent, facing, grounded, events)
        } else if (this.sword.comboEnabled && this.slashPhase !== 'startup' && this.slashMove !== 'air_spin') {
          this.comboBuffered = true
        }
      }
      if (intent.slashReleased) {
        if (this.saberReleaseArmed && this.modifiers.arcSlash) events.push({ type: 'projectile', request: { type: 'pellet', weaponId: 'ArcSlash', chargeLevel: 0, facing } })
        this.saberReleaseArmed = false
      }

    }

    this.wasDashing = dashing
    this.updateSlashPhase(deltaMs, intent, facing, grounded, events)

    return {
      snapshot: this.createSnapshot(),
      events
    }
  }

  receiveDamage(
    damage: number,
    grounded: boolean,
    knockbackDirection: 1 | -1,
    tier: HitTier = 'light',
    options: { bypassIFrames?: boolean; knockback?: { x: number; y: number }; sourceType?: PlayerDamageRequest['sourceType'] } = {}
  ): { accepted: boolean; events: PlayerRuntimeEvent[] } {
    if (this.iFramesRemainingMs > 0 && !options.bypassIFrames) {
      return { accepted: false, events: [] }
    }

    this.saberReleaseArmed = false
    const contact = options.sourceType === 'enemy_contact' || options.sourceType === 'boss_contact'
    const suppressHurt = contact && !this.modifiers.contactHitstun
    this.hooks.onDamageAccepted(damage * (options.sourceType === 'fall' ? 1 : this.modifiers.damageTakenMultiplier))
    this.iFramesRemainingMs = this.damage.iFramesMs
    this.hitstunRemainingMs = suppressHurt ? 0 : tier === 'heavy' ? this.damage.hitstunMs.heavy : this.damage.hitstunMs.light
    this.pendingDamageTier = suppressHurt ? undefined : tier

    const configuredKnockback = grounded ? this.damage.knockback.ground : this.damage.knockback.air
    const knockback = options.knockback ?? {
      x: configuredKnockback.x * knockbackDirection,
      y: configuredKnockback.y
    }
    this.hooks.onKnockback(knockback.x, knockback.y)

    if (this.blaster.chargeCancelOnHit) {
      this.clearCharge()
    }

    const events: PlayerRuntimeEvent[] = []
    if (tier === 'heavy') {
      events.push({ type: 'vfx', key: 'fx_shake_camera_heavy' })
      events.push({ type: 'hitstop', frames: 10 })
    } else {
      events.push({ type: 'hitstop', frames: 4 })
    }
    return { accepted: true, events }
  }

  cancelPendingCharge(): void {
    this.saberReleaseArmed = false
    this.clearCharge()
    this.chargeStartedAt = 0
  }

  getHitstunRemainingMs(): number {
    return this.hitstunRemainingMs
  }

  private clearCharge(): void {
    this.charging = false
    this.chargeLevel = 0
    this.chargeCueLevel = 0
    this.chargeElapsedMs = 0
    this.deferredReleaseLevel = 0
  }

  resetForRespawn(): void {
    this.saberReleaseArmed = false
    this.nextFireAt = 0
    this.deferredReleaseLevel = 0
    this.charging = false
    this.chargeStartedAt = 0
    this.chargeLevel = 0
    this.chargeElapsedMs = 0
    this.slashDirection = 'e'
    this.slashPhase = null
    this.slashPhaseRemainingMs = 0
    this.slashGrounded = true
    this.slashHitboxFired = false
    this.slashHit = null
    this.slashStartedThisTick = false
    this.airSlashUsed = false
    this.wasDashing = false
    this.swingTargets.clear()
    this.resetCombo()
    this.iFramesRemainingMs = 0
    this.hitstunRemainingMs = 0
    this.hitstopRemainingFrames = 0
    this.pendingDamageTier = undefined
    this.transientShotFired = false
    this.transientChargeReleased = false
    this.transientReleasedChargeLevel = 0
    this.chargeCueLevel = 0
  }

  grantInvulnerability(ms: number): void {
    this.iFramesRemainingMs = Math.max(this.iFramesRemainingMs, ms)
    this.hitstunRemainingMs = 0
    this.hitstopRemainingFrames = 0
    this.pendingDamageTier = undefined
  }

  private createSnapshot(): CombatSnapshot {
    return {
      shotFired: this.transientShotFired,
      chargeLevel: this.chargeLevel,
      chargeElapsedMs: this.chargeElapsedMs,
      charging: this.charging,
      chargeReleased: this.transientChargeReleased,
      releasedChargeLevel: this.transientReleasedChargeLevel,
      slashActive: this.slashPhase != null,
      slashGrounded: this.slashPhase != null ? this.slashGrounded : undefined,
      slashDirection: this.slashPhase != null ? this.slashDirection : undefined,
      slashPhase: this.slashPhase ?? undefined,
      slashMove: this.slashPhase != null ? this.slashMove : undefined,
      swordHitbox: this.slashPhase === 'active' ? this.resolveHitbox() : undefined,
      hitstunRemainingMs: this.hitstunRemainingMs,
      iFramesRemainingMs: this.iFramesRemainingMs,
      hitstopRemainingFrames: this.hitstopRemainingFrames,
      pendingDamageTier: this.pendingDamageTier
    }
  }

  /**
   * The current swing's box on an active frame, else null. The sword-hit path tests it every active
   * frame (a target that walks in on the last active frame still gets hit) and uses `claimSwordHit`
   * so each target takes one hit per combo hit.
   */
  getActiveSwordHitbox(): ResolvedHitbox | null {
    return this.slashPhase === 'active' ? this.resolveHitbox() : null
  }

  /** True the first time `target` is claimed during this swing's active frames; false after that or outside them. */
  claimSwordHit(target: unknown): boolean {
    if (this.slashPhase !== 'active' || this.swingTargets.has(target)) {
      return false
    }
    this.swingTargets.add(target)
    return true
  }

  private startSlash(
    intent: PlayerIntent,
    facing: 1 | -1,
    grounded: boolean,
    events: PlayerRuntimeEvent[],
    chained = false
  ): boolean {
    if (!grounded && this.sword.comboEnabled && this.airSlashUsed) {
      return false
    }
    if (this.flags.enableChargeShot && this.blaster.chargeCancelOnSlash) {
      this.clearCharge()
    }
    this.saberReleaseArmed = true
    this.slashDirection = resolveEightDirection(intent.aim, facing, this.sword.aimDeadzone)
    this.slashSign = directionSign(this.slashDirection, facing)
    this.slashGrounded = grounded
    if (!grounded) {
      this.slashMove = 'air_spin'
      this.airSlashUsed = true
      this.resetCombo()
    } else {
      const linked = chained || this.comboLinkRemainingMs > 0
      const index = this.sword.comboEnabled && linked ? this.comboNextIndex : 0
      this.slashMove = COMBO_MOVES[index]
      this.comboNextIndex = (index + 1) % COMBO_MOVES.length
      this.comboLinkRemainingMs = 0
    }
    this.comboBuffered = false
    this.slashHit = this.resolveHitConfig()
    this.slashPhase = 'startup'
    this.slashPhaseRemainingMs = this.framesToMs(this.slashHit.startupFrames)
    this.slashHitboxFired = false
    this.slashStartedThisTick = true
    this.swingId += 1
    this.swingTargets.clear()
    events.push({ type: 'sfx', key: SLASH_SFX[this.slashMove] })
    return true
  }

  /**
   * Phases carry leftover time across transitions, so a long frame never drops an active window, and
   * the press tick itself is startup frame 1 (startup N shows N frames, then the box is live).
   */
  private updateSlashPhase(
    deltaMs: number,
    intent: PlayerIntent,
    facing: 1 | -1,
    grounded: boolean,
    events: PlayerRuntimeEvent[]
  ): void {
    if (this.slashPhase == null) {
      if (this.comboLinkRemainingMs > 0) {
        this.comboLinkRemainingMs -= deltaMs
        if (this.comboLinkRemainingMs <= PHASE_EPSILON_MS) {
          this.resetCombo()
        }
      }
      return
    }
    if (this.slashStartedThisTick) {
      // The press tick is startup frame 1: its time is not spent.
      this.slashStartedThisTick = false
    } else {
      this.slashPhaseRemainingMs -= deltaMs
    }

    while (this.slashPhase != null && this.slashPhaseRemainingMs <= PHASE_EPSILON_MS) {
      const carry = this.slashPhaseRemainingMs
      const hit = this.slashHit ?? this.resolveHitConfig()
      if (this.slashPhase === 'startup') {
        this.slashPhase = 'active'
        this.slashPhaseRemainingMs = this.framesToMs(hit.activeFrames) + carry
        events.push({ type: 'vfx', key: `fx_sword_trail_dir_${this.slashDirection}` })
        events.push({ type: 'vfx', key: `fx_slash_arc_${this.slashMove}_${this.slashDirection}` })
        if (!this.slashHitboxFired) {
          // One event per combo hit (debug overlay, animation hitbox.enable); the hit path itself reads
          // snapshot.swordHitbox every active frame (src/combat/SwordHitRouter.ts) and emits hit-stop on contact.
          events.push({ type: 'hitbox', request: this.resolveHitbox() })
          this.slashHitboxFired = true
        }
      } else if (this.slashPhase === 'active') {
        this.slashPhase = 'recovery'
        this.slashPhaseRemainingMs = this.framesToMs(hit.recoveryFrames) + carry
      } else {
        // Recovery over: a buffered press starts the next hit now (hit 1 after the finisher);
        // otherwise the link window opens, and the chain resets when it runs out.
        const buffered = this.comboBuffered
        const move = this.slashMove
        this.endSlash()
        if (move === 'combo3') {
          this.resetCombo()
        }
        if (buffered && move !== 'air_spin' && this.startSlash(intent, facing, grounded, events, move !== 'combo3')) {
          this.slashStartedThisTick = false
          this.slashPhaseRemainingMs += carry
        } else if (move === 'combo1' || move === 'combo2') {
          this.comboLinkRemainingMs = this.sword.comboEnabled ? this.framesToMs(this.sword.combo.linkFrames) + carry : 0
        }
      }
    }
  }

  private endSlash(): void {
    this.slashPhase = null
    this.slashPhaseRemainingMs = 0
    this.slashHitboxFired = false
    this.comboBuffered = false
  }

  private resetCombo(): void {
    this.comboNextIndex = 0
    this.comboBuffered = false
    this.comboLinkRemainingMs = 0
  }

  private resolveHitConfig(): SwordHitConfig {
    const window = this.getSwordWindow(this.slashGrounded, this.slashDirection)
    if (!this.sword.comboEnabled) {
      return { ...window, damage: LEGACY_SWORD_DAMAGE, knockback: { ...LEGACY_SWORD_KNOCKBACK } }
    }
    const hit = this.slashMove === 'air_spin' ? this.sword.combo.air : this.sword.combo.ground[COMBO_MOVES.indexOf(this.slashMove)]
    return {
      ...hit,
      hitbox: isHorizontal(this.slashDirection) ? mirrorShape(hit.hitbox, this.slashSign) : window.hitbox
    }
  }

  private resolveHitbox(): ResolvedHitbox {
    const hit = this.slashHit ?? this.resolveHitConfig()
    return {
      shape: hit.hitbox,
      direction: this.slashDirection,
      grounded: this.slashGrounded,
      hitstopFrames: this.flags.enableHitstop ? hit.hitstopFrames : 0,
      swingId: this.swingId,
      move: this.slashMove,
      damage: hit.damage,
      knockback: { x: hit.knockback.x * this.slashSign, y: hit.knockback.y }
    }
  }

  private fireProjectile(events: PlayerRuntimeEvent[], chargeLevel: 0 | 1 | 2 | 3 | 4, facing: 1 | -1, now: number): void {
    if (now < this.nextFireAt) {
      return
    }

    const request: SpawnProjectileRequest = {
      type: chargeLevel === 0 ? 'pellet' : 'charge',
      chargeLevel,
      facing
    }

    this.nextFireAt = now + this.blaster.fireRateMs
    this.transientShotFired = true

    events.push({ type: 'projectile', request })
    events.push({ type: 'vfx', key: `fx_muzzle_lv${chargeLevel}_${this.muzzlePose}` })
    events.push({ type: 'sfx', key: chargeLevel > 0 ? `shot_charge_lv${chargeLevel}` : 'shot_basic' })

    this.player.setFlipX(shouldFlipPlayerSpriteForFacing(facing))
  }

  private resolveChargeLevel(heldMs: number): 0 | 1 | 2 | 3 | 4 {
    const [l1, l2, l3, l4] = this.blaster.chargeThresholdsMs.map(value => value * this.modifiers.chargeTimeMultiplier)
    if (heldMs >= l4) return this.modifiers.maxChargeLevel
    if (heldMs >= l3) return 3
    if (heldMs >= l2) return 2
    if (heldMs >= l1) return 1
    return 0
  }

  private getSwordWindow(grounded: boolean, direction: Direction8) {
    return grounded ? this.sword.windows.ground[direction] : this.sword.windows.air[direction]
  }

  private framesToMs(frames: number): number {
    return Math.max(FRAME_MS, frames * FRAME_MS)
  }
}
