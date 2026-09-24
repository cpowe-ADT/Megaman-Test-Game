import { resolveUpgradeModifiers, type UpgradeModifiers } from '../progression/upgrades'
import Phaser from 'phaser'
import { type SceneInputActions } from '../input/InputActions'
import type { DigitalButtonPad } from '../input/DigitalButtonPad'
import { AnimationManifest } from './AnimationManifest'
import { PlayerAnimator } from './PlayerAnimator'
import {
  applyPlayerBodyProfile,
  PLAYER_BODY_PROFILES,
  resolvePlayerBodyProfileKey,
  type PlayerBodyProfileKey
} from './PlayerBodyProfiles'
import { PlayerCombat } from './PlayerCombat'
import { PlayerController } from './PlayerController'
import { PlayerDebug } from './PlayerDebug'
import { PlayerMotor } from './PlayerMotor'
import { createSolidPlatformProbe } from './SolidPlatformProbe'
import { iFrameBlinkAlpha } from './hitFeel'
import { PlayerStateMachine } from './PlayerStateMachine'
import { VfxSfxRouter } from './VfxSfxRouter'
import { PLAYER_GAMEPLAY_CONFIG, resolveSwordVisualFacing, shouldFlipPlayerSpriteForFacing } from './config'
import type { PlayerFeatureFlags } from './featureFlags'
import type { RoomLockVerbSample } from '../mechanics/roomLock'
import type {
  CombatSnapshot,
  HitTier,
  MotorSnapshot,
  PlayerDamageRequest,
  PlayerDamageResult,
  PlayerResolvedState,
  PlayerRuntimeEvent,
  ProjectileSpawnReceipt,
  ResolvedHitbox,
  SpawnProjectileRequest
} from './types'

type RuntimeHooks = {
  setAnimation: (key: string) => void
  spawnProjectile: (request: SpawnProjectileRequest) => ProjectileSpawnReceipt | null
  canChargeProjectile: () => boolean
  applySwordHitbox: (hitbox: ResolvedHitbox) => void
  applyDamage: (damage: number) => void
}

export class NewPlayerRuntime {
  private modifiers = resolveUpgradeModifiers({})
  setUpgradeModifiers(modifiers: UpgradeModifiers): void {
    this.modifiers = modifiers
    this.combat.setUpgradeModifiers(modifiers)
    this.motor.setMovementSpeedMultiplier(modifiers.movementSpeedMultiplier, modifiers.wallJumpSpeedMultiplier)
  }
  private readonly controller: PlayerController
  private readonly motor: PlayerMotor
  private readonly combat: PlayerCombat
  private readonly stateMachine: PlayerStateMachine
  private readonly animator: PlayerAnimator
  private readonly vfxSfx: VfxSfxRouter
  private readonly debug: PlayerDebug

  private activeHitbox: ResolvedHitbox | undefined
  private lastMotorSnapshot?: MotorSnapshot
  private lastCombatSnapshot?: CombatSnapshot
  private currentAnimationKey = 'player_idle'
  private currentBodyProfile: PlayerBodyProfileKey = 'stand'
  private nextDashAfterimageAt = 0
  private nextWallSlideFxAt = 0
  private shotsFiredTotal = 0
  private lastProjectileSpawnMs = 0
  private lastProjectileSpawnFrame = 0
  private lastProjectile: ProjectileSpawnReceipt | null = null
  private lastLandingSpeed = 0
  private lastJumpSource: MotorSnapshot['jumpSource'] = 'none'
  private lastDashStartedAtMs = 0
  /** Saber swings started (room-lock saber hits count these, so a short active window is never missed). */
  private slashesStarted = 0
  private lastDashEndedAtMs = 0
  private lastDamageSource = 'none'
  private lastDamageTier: HitTier | 'none' = 'none'
  private lastKnockback = { x: 0, y: 0 }
  private destroyed = false
  /** Set by `playDeath` until `resetForRespawn`: the runtime stops driving the hero. */
  private deathActive = false
  private iFrameElapsedMs = 0
  private blinking = false
  private removeDebugInput?: () => void
  private removeCancelledInput?: () => void
  private readonly debugToggleHandler = () => this.debug.toggle()

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Arcade.Sprite,
    actions: SceneInputActions,
    private readonly flags: PlayerFeatureFlags,
    private readonly hooks: RuntimeHooks,
    private readonly virtualButtons?: DigitalButtonPad
  ) {
    this.controller = new PlayerController(scene, actions)
    this.motor = new PlayerMotor(player, PLAYER_GAMEPLAY_CONFIG.movement, PLAYER_GAMEPLAY_CONFIG.dash)
    this.motor.setTerrainProbe(createSolidPlatformProbe(scene, player), PLAYER_BODY_PROFILES.stand.height)
    this.combat = new PlayerCombat(
      player,
      flags,
      PLAYER_GAMEPLAY_CONFIG.blaster,
      PLAYER_GAMEPLAY_CONFIG.sword,
      PLAYER_GAMEPLAY_CONFIG.damage,
      {
        onDamageAccepted: (damage) => this.hooks.applyDamage(damage),
        onKnockback: (vx, vy) => this.applyKnockback(vx, vy)
      }
    )
    this.stateMachine = new PlayerStateMachine()
    this.animator = new PlayerAnimator(AnimationManifest, {
      play: (key) => this.hooks.setAnimation(key),
      onAnimationEvent: (eventName, payload) => {
        if (eventName === 'hitbox.enable') {
          const request = this.activeHitbox
          if (request) {
            this.hooks.applySwordHitbox(request)
          }
        }
        if (eventName === 'fx.spawn') {
          this.vfxSfx.dispatch([{ type: 'vfx', key: String(payload?.key ?? 'fx_hit_spark') }])
        }
      }
    })
    this.vfxSfx = new VfxSfxRouter(scene, player)
    this.debug = new PlayerDebug(scene, player)
    applyPlayerBodyProfile(this.player, this.currentBodyProfile)

    if (flags.enableDebugHitboxes) {
      this.debug.toggle(true)
    }

    this.removeDebugInput = actions.onPressed('debugPlayer', this.debugToggleHandler)
    this.removeCancelledInput = actions.onCancelled(() => this.cancelPendingCharge())
  }

  update(now: number, deltaMs: number): void {
    if (this.deathActive) {
      return
    }
    const intent = this.controller.sampleIntent(this.motor.getFacing())
    const motorSnapshot = this.motor.update(
      intent,
      deltaMs,
      this.flags.enableAirDash && this.modifiers.allowAirDash,
      this.combat.getHitstunRemainingMs()
    )

    const combatResult = this.combat.update(
      intent,
      now,
      deltaMs,
      motorSnapshot.facing,
      motorSnapshot.grounded,
      motorSnapshot.dashing,
      this.hooks.canChargeProjectile()
    )

    this.consumeCombatEvents(combatResult.events)
    this.updateIFrameBlink(deltaMs, combatResult.snapshot.iFramesRemainingMs)
    if (motorSnapshot.justJumped) {
      this.lastJumpSource = motorSnapshot.jumpSource
    }
    this.dispatchLocomotionSfx(now, motorSnapshot)
    const slashPhase = combatResult.snapshot.slashPhase
    const prevSlashPhase = this.lastCombatSnapshot?.slashPhase
    if ((slashPhase === 'startup' && prevSlashPhase !== 'startup') || (slashPhase === 'active' && prevSlashPhase !== 'active' && prevSlashPhase !== 'startup')) this.slashesStarted += 1
    this.lastMotorSnapshot = motorSnapshot
    this.lastCombatSnapshot = combatResult.snapshot

    const resolved = this.stateMachine.resolve(intent, motorSnapshot, combatResult.snapshot)
    this.syncBodyProfile(resolved)
    this.currentAnimationKey = this.animator.update(resolved, motorSnapshot, combatResult.snapshot, deltaMs)

    if (combatResult.snapshot.slashPhase !== 'active') {
      this.activeHitbox = undefined
    }

    const visualFacing =
      combatResult.snapshot.slashPhase != null
        ? resolveSwordVisualFacing(combatResult.snapshot.slashDirection, motorSnapshot.facing)
        : motorSnapshot.facing
    this.player.setFlipX(shouldFlipPlayerSpriteForFacing(visualFacing))

    this.debug.draw(motorSnapshot, combatResult.snapshot, this.activeHitbox)
  }

  pauseAnimations(): void {
    this.player.anims.pause()
  }

  resumeAnimations(): void {
    this.player.anims.resume()
  }

  receiveDamage(request: PlayerDamageRequest): PlayerDamageResult {
    if (this.destroyed || !this.player.active) {
      return { accepted: false, reason: 'inactive', amount: 0, request }
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const tier = request.tier ?? (request.amount >= 2 ? 'heavy' : 'light')
    const damageResult = this.combat.receiveDamage(
      Math.max(0, request.amount),
      body.onFloor() || body.blocked.down,
      request.direction ?? ((-this.motor.getFacing()) as 1 | -1),
      tier,
      {
        sourceType: request.sourceType,
        bypassIFrames: request.bypassIFrames,
        knockback: request.knockback
      }
    )
    this.lastDamageSource = `${request.sourceType}:${request.sourceId}`
    this.lastDamageTier = tier
    if (damageResult.accepted) {
      this.consumeCombatEvents(damageResult.events)
      this.lastDamageTier = tier
      const contact = request.sourceType === 'enemy_contact' || request.sourceType === 'boss_contact'
      if (!contact || this.modifiers.contactHitstun) this.hooks.setAnimation(tier === 'heavy' ? 'player_hurt_heavy' : 'player_hurt_light')
    }
    return {
      accepted: damageResult.accepted,
      reason: damageResult.accepted ? 'accepted' : 'iframes',
      amount: damageResult.accepted ? Math.max(0, request.amount) * (request.sourceType === 'fall' ? 1 : this.modifiers.damageTakenMultiplier) : 0,
      request
    }
  }

  destroy(): void {
    if (this.destroyed) {
      return
    }
    this.destroyed = true
    this.removeDebugInput?.()
    this.removeCancelledInput?.()
    this.vfxSfx.destroy()
    this.debug.destroy()
  }

  cancelPendingCharge(): void {
    this.combat.cancelPendingCharge()
    if (this.lastCombatSnapshot) {
      this.lastCombatSnapshot = { ...this.lastCombatSnapshot, charging: false, chargeLevel: 0, chargeElapsedMs: 0 }
    }
  }

  suppressJumpFor(ms: number): void {
    this.controller.suppressJumpFor(ms)
  }

  setMovementSpeedMultiplier(multiplier: number): void {
    this.motor.setMovementSpeedMultiplier(multiplier)
  }

  getFacing(): 1 | -1 {
    return this.motor.getFacing()
  }

  /** Death beat 1 (`DeathSequence`): the hero stops updating and plays `player_death` with its sfx. */
  playDeath(): void {
    this.deathActive = true
    this.combat.cancelPendingCharge()
    this.activeHitbox = undefined
    this.blinking = false
    this.player.setAlpha(1)
    this.currentAnimationKey = 'player_death'
    this.hooks.setAnimation('player_death')
    this.vfxSfx.dispatch([{ type: 'sfx', key: 'player_death' }])
  }

  /** Death beat 2: eight orbs from the effects atlas and a heavy (capped) shake. */
  playDeathBurst(): void {
    this.vfxSfx.dispatch([
      { type: 'vfx', key: 'fx_death_orbs' },
      { type: 'vfx', key: 'fx_shake_camera_heavy' }
    ])
  }

  /** Respawn: the hero beams in (a scale tween back to the resting scale). */
  playBeamIn(): void {
    this.vfxSfx.dispatch([{ type: 'vfx', key: 'fx_beam_in' }])
  }

  resetForRespawn(iFrameMs = PLAYER_GAMEPLAY_CONFIG.damage.iFramesMs): void {
    this.deathActive = false
    this.iFrameElapsedMs = 0
    this.controller.suppressJumpFor(120)
    this.motor.resetForRespawn()
    this.combat.resetForRespawn()
    this.combat.grantInvulnerability(iFrameMs)
    this.activeHitbox = undefined
    this.lastMotorSnapshot = undefined
    this.lastCombatSnapshot = undefined
    this.currentAnimationKey = 'player_idle'
    this.currentBodyProfile = 'stand'
    this.nextDashAfterimageAt = 0
    this.nextWallSlideFxAt = 0
    this.lastProjectileSpawnFrame = 0
    this.lastProjectile = null
    this.lastLandingSpeed = 0
    this.lastJumpSource = 'none'
    this.lastDashStartedAtMs = 0
    this.lastDashEndedAtMs = 0
    this.lastDamageSource = 'none'
    this.lastDamageTier = 'none'
    this.lastKnockback = { x: 0, y: 0 }
    applyPlayerBodyProfile(this.player, this.currentBodyProfile)
    this.hooks.setAnimation('player-idle')
  }

  /** The room-lock verbs' per-frame read (prompt 05 §5.7): typed, no debug surface. */
  getVerbSample(): RoomLockVerbSample | null {
    const motor = this.lastMotorSnapshot
    const combat = this.lastCombatSnapshot
    if (!motor || !combat) return null
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined
    return {
      grounded: motor.grounded,
      velocityY: body?.velocity.y ?? motor.velocityY,
      lastJumpSource: this.lastJumpSource,
      dashStartedAtMs: this.lastDashStartedAtMs,
      wallJumping: motor.wallJumping,
      projectileSpawnMs: this.lastProjectileSpawnMs,
      projectileChargeLevel: this.lastProjectile?.chargeLevel ?? 0,
      slashesStarted: this.slashesStarted,
      hurtLocked: combat.hitstunRemainingMs > 0
    }
  }

  getDebugState(): Record<string, unknown> | null {
    if (!this.lastMotorSnapshot || !this.lastCombatSnapshot) {
      return null
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body | undefined
    return {
      locomotion: {
        grounded: this.lastMotorSnapshot.grounded,
        dashing: this.lastMotorSnapshot.dashing,
        dashStarted: this.lastMotorSnapshot.dashStarted,
        dashEnded: this.lastMotorSnapshot.dashEnded,
        lastDashStartedAtMs: this.lastDashStartedAtMs,
        lastDashEndedAtMs: this.lastDashEndedAtMs,
        airDashing: this.lastMotorSnapshot.airDashing,
        wallSliding: this.lastMotorSnapshot.wallSliding,
        wallSide: this.lastMotorSnapshot.wallSide,
        wallJumping: this.lastMotorSnapshot.wallJumping,
        coyoteMs: Math.round(this.lastMotorSnapshot.coyoteRemainingMs),
        jumpBufferMs: Math.round(this.lastMotorSnapshot.jumpBufferRemainingMs),
        lastJumpSource: this.lastJumpSource,
        lastLandingSpeed: this.lastLandingSpeed,
        dashMs: Math.round(this.lastMotorSnapshot.dashRemainingMs),
        dashCooldownMs: Math.round(this.lastMotorSnapshot.dashCooldownRemainingMs)
      },
      combat: {
        shotFired: this.lastCombatSnapshot.shotFired,
        chargeLevel: this.lastCombatSnapshot.chargeLevel,
        chargeElapsedMs: Math.round(this.lastCombatSnapshot.chargeElapsedMs),
        charging: this.lastCombatSnapshot.charging,
        chargeReleased: this.lastCombatSnapshot.chargeReleased,
        shotsFiredTotal: this.shotsFiredTotal,
        lastProjectileSpawnMs: this.lastProjectileSpawnMs,
        lastProjectileSpawnFrame: this.lastProjectileSpawnFrame,
        lastProjectile: this.lastProjectile ? { ...this.lastProjectile } : null,
        slashGrounded: this.lastCombatSnapshot.slashGrounded ?? null,
        slashPhase: this.lastCombatSnapshot.slashPhase ?? null,
        slashDirection: this.lastCombatSnapshot.slashDirection ?? null,
        iFramesMs: Math.round(this.lastCombatSnapshot.iFramesRemainingMs),
        hitstunMs: Math.round(this.lastCombatSnapshot.hitstunRemainingMs),
        hitstopFrames: this.lastCombatSnapshot.hitstopRemainingFrames,
        lastDamageSource: this.lastDamageSource,
        lastDamageTier: this.lastDamageTier,
        lastKnockback: { ...this.lastKnockback }
      },
      physics: {
        bodyProfileKey: this.currentBodyProfile,
        onFloor: Boolean(body?.onFloor?.()),
        blocked: {
          up: Boolean(body?.blocked.up),
          down: Boolean(body?.blocked.down),
          left: Boolean(body?.blocked.left),
          right: Boolean(body?.blocked.right)
        },
        touching: {
          up: Boolean(body?.touching.up),
          down: Boolean(body?.touching.down),
          left: Boolean(body?.touching.left),
          right: Boolean(body?.touching.right)
        }
      },
      input: {
        touchButtons: this.virtualButtons?.getHeldSnapshot?.() ?? null
      },
      visuals: {
        animationKey: this.currentAnimationKey,
        frameName: String(this.player.frame?.name ?? ''),
        facing: this.player.flipX ? 1 : -1,
        activeHitbox: this.activeHitbox
          ? {
              direction: this.activeHitbox.direction,
              grounded: this.activeHitbox.grounded,
              shape: { ...this.activeHitbox.shape }
            }
          : null
      }
    }
  }

  private consumeCombatEvents(events: PlayerRuntimeEvent[]): void {
    for (const event of events) {
      if (event.type === 'projectile') {
        this.dispatchProjectile(event.request)
      } else if (event.type === 'hitbox') {
        this.activeHitbox = event.request
        this.hooks.applySwordHitbox(event.request)
      }
    }

    this.vfxSfx.dispatch(events)
  }

  private dispatchProjectile(request: SpawnProjectileRequest): void {
    const receipt = this.hooks.spawnProjectile(request)
    if (!receipt) {
      return
    }
    this.shotsFiredTotal += 1
    this.lastProjectileSpawnMs = Math.max(0, Math.round(this.scene.time.now ?? 0))
    this.lastProjectileSpawnFrame = Math.max(0, Math.round((this.scene.time.now ?? 0) / (1000 / 60)))
    this.lastProjectile = { ...receipt }
  }

  private dispatchLocomotionSfx(now: number, motorSnapshot: MotorSnapshot): void {
    if (motorSnapshot.justJumped) {
      this.vfxSfx.dispatch([{ type: 'sfx', key: 'jump' }])
    }

    if (motorSnapshot.justLanded) {
      this.lastLandingSpeed = motorSnapshot.landingSpeed ?? 0
      // A hard landing squashes and puffs dust (the motor applies the lag); no hit-stop, nothing was hit.
      this.vfxSfx.dispatch(
        motorSnapshot.hardLanding
          ? [
              { type: 'sfx', key: 'land' },
              { type: 'vfx', key: 'fx_land_dust' },
              { type: 'vfx', key: 'fx_land_squash' }
            ]
          : [{ type: 'sfx', key: 'land' }]
      )
    }

    const lastDashMs = this.lastMotorSnapshot?.dashRemainingMs ?? 0
    if (lastDashMs <= 0 && motorSnapshot.dashRemainingMs > 0) {
      this.lastDashStartedAtMs = Math.max(0, Math.round(now))
      this.vfxSfx.dispatch([{ type: 'sfx', key: 'dash' }])
      this.nextDashAfterimageAt = now
    }

    if (motorSnapshot.dashEnded) {
      this.lastDashEndedAtMs = Math.max(0, Math.round(now))
    }

    if (motorSnapshot.dashing && now >= this.nextDashAfterimageAt) {
      this.vfxSfx.dispatch([{ type: 'vfx', key: 'fx_dash_afterimage' }])
      this.nextDashAfterimageAt = now + 42
    }

    const wasWallSliding = Boolean(this.lastMotorSnapshot?.wallSliding)
    if (motorSnapshot.wallSliding && (!wasWallSliding || now >= this.nextWallSlideFxAt)) {
      this.vfxSfx.dispatch([{ type: 'vfx', key: 'fx_wall_slide_dust' }])
      this.nextWallSlideFxAt = now + 90
    }

    if (!motorSnapshot.wallSliding) {
      this.nextWallSlideFxAt = now
    }
  }

  /** Hurt blink: alpha toggles every 4 frames while i-frames remain, then returns to 1. */
  private updateIFrameBlink(deltaMs: number, iFramesRemainingMs: number): void {
    if (iFramesRemainingMs > 0) {
      this.iFrameElapsedMs += Math.max(0, deltaMs)
      this.blinking = true
      this.player.setAlpha(iFrameBlinkAlpha(this.iFrameElapsedMs, iFramesRemainingMs))
    } else if (this.blinking) {
      this.blinking = false
      this.iFrameElapsedMs = 0
      this.player.setAlpha(1)
    }
  }

  private syncBodyProfile(state: PlayerResolvedState): void {
    const nextProfile = resolvePlayerBodyProfileKey(state)
    if (nextProfile === this.currentBodyProfile) {
      return
    }
    this.currentBodyProfile = nextProfile
    applyPlayerBodyProfile(this.player, nextProfile)
  }

  private applyKnockback(vx: number, vy: number): void {
    this.lastKnockback = {
      x: Math.round(vx),
      y: Math.round(vy)
    }
    this.motor.applyKnockback(vx, vy)
  }
}
