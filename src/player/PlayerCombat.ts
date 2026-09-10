import type Phaser from 'phaser'
import { shouldFlipPlayerSpriteForFacing } from './config'
import type { PlayerFeatureFlags } from './featureFlags'
import type { BlasterConfig, SwordConfig, DamageConfig, Direction8 } from './config'
import type {
  CombatSnapshot,
  HitTier,
  PlayerIntent,
  PlayerRuntimeEvent,
  ResolvedHitbox,
  SpawnProjectileRequest
} from './types'

const FRAME_MS = 1000 / 60

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
  private nextFireAt = 0
  private charging = false
  private chargeStartedAt = 0
  private chargeLevel: 0 | 1 | 2 | 3 | 4 = 0

  private slashDirection: Direction8 = 'e'
  private slashPhase: 'startup' | 'active' | 'recovery' | null = null
  private slashPhaseRemainingMs = 0
  private slashGrounded = true
  private slashHitboxFired = false

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
    canChargeShot = this.flags.enableChargeShot
  ): { snapshot: CombatSnapshot; events: PlayerRuntimeEvent[] } {
    const events: PlayerRuntimeEvent[] = []
    this.transientShotFired = false
    this.transientChargeReleased = false
    this.transientReleasedChargeLevel = 0
    this.chargeElapsedMs = this.charging ? Math.max(0, now - this.chargeStartedAt) : 0

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

    if (canAct) {
      const canShoot = true
      if (canShoot && intent.shootPressed) {
        if (canChargeShot) {
          this.charging = true
          this.chargeStartedAt = now
          this.chargeLevel = 0
          this.chargeCueLevel = 0
          this.chargeElapsedMs = 0
          events.push({ type: 'vfx', key: 'fx_charge_aura_lv1' })
          events.push({ type: 'sfx', key: 'charge_start' })
        } else {
          this.fireProjectile(events, 0, facing)
        }
      }

      if (this.charging && intent.shootHeld) {
        const nextChargeLevel = this.resolveChargeLevel(now - this.chargeStartedAt)
        this.chargeElapsedMs = Math.max(0, now - this.chargeStartedAt)
        this.chargeLevel = nextChargeLevel
        if (nextChargeLevel > 0 && nextChargeLevel > this.chargeCueLevel) {
          this.chargeCueLevel = nextChargeLevel
          events.push({ type: 'vfx', key: `fx_charge_aura_lv${nextChargeLevel}` })
          events.push({ type: 'sfx', key: 'charge_loop' })
        }
      }

      if (this.charging && intent.shootReleased) {
        const level = canChargeShot ? this.resolveChargeLevel(now - this.chargeStartedAt) : 0
        this.fireProjectile(events, level, facing)
        this.charging = false
        this.chargeLevel = 0
        this.chargeCueLevel = 0
        this.chargeElapsedMs = 0
        this.transientChargeReleased = true
        this.transientReleasedChargeLevel = level
      }

      const canSlash = this.flags.enableSword && !dashing
      if (canSlash && intent.slashPressed && this.slashPhase == null) {
        this.slashDirection = resolveEightDirection(intent.aim, facing, this.sword.aimDeadzone)
        this.slashGrounded = grounded
        this.slashPhase = 'startup'
        this.slashPhaseRemainingMs = this.framesToMs(
          this.getSwordWindow(grounded, this.slashDirection).startupFrames
        )
        this.slashHitboxFired = false
        events.push({ type: 'sfx', key: 'sword_swing' })
      }
    }

    this.updateSlashPhase(deltaMs, events)

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
    options: { bypassIFrames?: boolean; knockback?: { x: number; y: number } } = {}
  ): { accepted: boolean; events: PlayerRuntimeEvent[] } {
    if (this.iFramesRemainingMs > 0 && !options.bypassIFrames) {
      return { accepted: false, events: [] }
    }

    this.hooks.onDamageAccepted(damage)
    this.iFramesRemainingMs = this.damage.iFramesMs
    this.hitstunRemainingMs = tier === 'heavy' ? this.damage.hitstunMs.heavy : this.damage.hitstunMs.light
    this.pendingDamageTier = tier

    const configuredKnockback = grounded ? this.damage.knockback.ground : this.damage.knockback.air
    const knockback = options.knockback ?? {
      x: configuredKnockback.x * knockbackDirection,
      y: configuredKnockback.y
    }
    this.hooks.onKnockback(knockback.x, knockback.y)

    if (this.blaster.chargeCancelOnHit) {
      this.charging = false
      this.chargeLevel = 0
      this.chargeCueLevel = 0
      this.chargeElapsedMs = 0
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

  resetForRespawn(): void {
    this.nextFireAt = 0
    this.charging = false
    this.chargeStartedAt = 0
    this.chargeLevel = 0
    this.chargeElapsedMs = 0
    this.slashDirection = 'e'
    this.slashPhase = null
    this.slashPhaseRemainingMs = 0
    this.slashGrounded = true
    this.slashHitboxFired = false
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
      hitstunRemainingMs: this.hitstunRemainingMs,
      iFramesRemainingMs: this.iFramesRemainingMs,
      hitstopRemainingFrames: this.hitstopRemainingFrames,
      pendingDamageTier: this.pendingDamageTier
    }
  }

  private updateSlashPhase(deltaMs: number, events: PlayerRuntimeEvent[]): void {
    if (this.slashPhase == null) {
      return
    }

    this.slashPhaseRemainingMs -= deltaMs
    if (this.slashPhaseRemainingMs > 0) {
      return
    }

    if (this.slashPhase === 'startup') {
      this.slashPhase = 'active'
      this.slashPhaseRemainingMs = this.framesToMs(
        this.getSwordWindow(this.slashGrounded, this.slashDirection).activeFrames
      )
      events.push({ type: 'vfx', key: `fx_sword_trail_dir_${this.slashDirection}` })
      if (!this.slashHitboxFired) {
        const window = this.getSwordWindow(this.slashGrounded, this.slashDirection)
        events.push({
          type: 'hitbox',
          request: {
            shape: window.hitbox,
            direction: this.slashDirection,
            grounded: this.slashGrounded
          }
        })
        if (this.flags.enableHitstop && window.hitstopFrames > 0) {
          events.push({ type: 'hitstop', frames: window.hitstopFrames })
          if (window.hitstopFrames >= 4) {
            events.push({ type: 'vfx', key: 'fx_shake_camera_medium' })
          }
        }
        this.slashHitboxFired = true
      }
      return
    }

    if (this.slashPhase === 'active') {
      this.slashPhase = 'recovery'
      this.slashPhaseRemainingMs = this.framesToMs(
        this.getSwordWindow(this.slashGrounded, this.slashDirection).recoveryFrames
      )
      return
    }

    this.slashPhase = null
    this.slashPhaseRemainingMs = 0
    this.slashHitboxFired = false
  }

  private fireProjectile(events: PlayerRuntimeEvent[], chargeLevel: 0 | 1 | 2 | 3 | 4, facing: 1 | -1): void {
    if (this.player.scene.time.now < this.nextFireAt) {
      return
    }

    const request: SpawnProjectileRequest = {
      type: chargeLevel === 0 ? 'pellet' : 'charge',
      chargeLevel,
      facing
    }

    this.nextFireAt = this.player.scene.time.now + this.blaster.fireRateMs
    this.transientShotFired = true

    events.push({ type: 'projectile', request })
    events.push({ type: 'vfx', key: 'fx_muzzle_small' })
    events.push({ type: 'sfx', key: chargeLevel > 0 ? `shot_charge_lv${chargeLevel}` : 'shot_basic' })

    if (this.flags.enableChargeShot && chargeLevel > 0) {
      this.charging = false
      this.chargeLevel = 0
      this.chargeCueLevel = 0
      this.chargeElapsedMs = 0
    }

    if (this.flags.enableChargeShot && this.blaster.chargeCancelOnSlash && this.slashPhase != null) {
      this.charging = false
      this.chargeLevel = 0
      this.chargeCueLevel = 0
      this.chargeElapsedMs = 0
    }

    this.player.setFlipX(shouldFlipPlayerSpriteForFacing(facing))
  }

  private resolveChargeLevel(heldMs: number): 0 | 1 | 2 | 3 | 4 {
    const [l1, l2, l3, l4] = this.blaster.chargeThresholdsMs
    if (heldMs >= l4) return 4
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
