import Phaser from 'phaser'
import { AnimationManifest } from './AnimationManifest'
import { PlayerAnimator } from './PlayerAnimator'
import { PlayerCombat } from './PlayerCombat'
import { PlayerController } from './PlayerController'
import { PlayerDebug } from './PlayerDebug'
import { PlayerMotor } from './PlayerMotor'
import { PlayerStateMachine } from './PlayerStateMachine'
import { VfxSfxRouter } from './VfxSfxRouter'
import { PLAYER_GAMEPLAY_CONFIG } from './config'
import type { PlayerFeatureFlags } from './featureFlags'
import type { CombatSnapshot, MotorSnapshot, PlayerRuntimeEvent, ResolvedHitbox } from './types'

type ActionKeys = {
  dash: Phaser.Input.Keyboard.Key
  shoot: Phaser.Input.Keyboard.Key
  saber: Phaser.Input.Keyboard.Key
}

type RuntimeHooks = {
  setAnimation: (key: string) => void
  spawnProjectile: (request: {
    speed: number
    damage: number
    scale: number
    chargeLevel: 0 | 1 | 2 | 3 | 4
    impactFxKey: string
    facing: 1 | -1
  }) => void
  applySwordHitbox: (hitbox: ResolvedHitbox) => void
  applyDamage: (damage: number) => void
}

export class NewPlayerRuntime {
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

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly player: Phaser.Physics.Arcade.Sprite,
    cursors: Phaser.Types.Input.Keyboard.CursorKeys,
    actionKeys: ActionKeys,
    private readonly flags: PlayerFeatureFlags,
    private readonly hooks: RuntimeHooks
  ) {
    this.controller = new PlayerController(scene, cursors, actionKeys)
    this.motor = new PlayerMotor(player, PLAYER_GAMEPLAY_CONFIG.movement, PLAYER_GAMEPLAY_CONFIG.dash)
    this.combat = new PlayerCombat(
      player,
      flags,
      PLAYER_GAMEPLAY_CONFIG.blaster,
      PLAYER_GAMEPLAY_CONFIG.sword,
      PLAYER_GAMEPLAY_CONFIG.damage,
      {
        onDamageAccepted: (damage) => this.hooks.applyDamage(damage),
        onKnockback: (vx, vy) => this.motor.applyKnockback(vx, vy)
      }
    )
    this.stateMachine = new PlayerStateMachine()
    this.animator = new PlayerAnimator(AnimationManifest, {
      play: (key) => this.hooks.setAnimation(key),
      onAnimationEvent: (eventName, payload) => {
        if (eventName === 'projectile.spawn') {
          this.hooks.spawnProjectile({
            speed: PLAYER_GAMEPLAY_CONFIG.blaster.pelletSpeed,
            damage: PLAYER_GAMEPLAY_CONFIG.blaster.pelletDamage,
            scale: 1,
            chargeLevel: 0,
            impactFxKey: 'fx_impact_small',
            facing: this.motor.getFacing()
          })
        }
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

    if (flags.enableDebugHitboxes) {
      this.debug.toggle(true)
    }

    this.scene.input.keyboard?.on('keydown-F2', () => this.debug.toggle())
  }

  update(now: number, deltaMs: number): void {
    const intent = this.controller.sampleIntent(this.motor.getFacing())
    const motorSnapshot = this.motor.update(intent, deltaMs, this.flags.enableAirDash)

    const combatResult = this.combat.update(
      intent,
      now,
      deltaMs,
      motorSnapshot.facing,
      motorSnapshot.grounded,
      motorSnapshot.dashing
    )

    this.consumeCombatEvents(combatResult.events)
    this.dispatchLocomotionSfx(motorSnapshot)
    this.lastMotorSnapshot = motorSnapshot
    this.lastCombatSnapshot = combatResult.snapshot

    const resolved = this.stateMachine.resolve(intent, motorSnapshot, combatResult.snapshot)
    this.currentAnimationKey = this.animator.update(resolved, motorSnapshot, combatResult.snapshot)

    if (!combatResult.snapshot.slashActive) {
      this.activeHitbox = undefined
    }

    this.player.setFlipX(motorSnapshot.facing === -1)

    this.debug.draw(motorSnapshot, combatResult.snapshot, this.activeHitbox)
  }

  receiveDamage(damage: number, tier: 'light' | 'heavy' = 'light'): boolean {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const accepted = this.combat.receiveDamage(
      damage,
      body.onFloor() || body.blocked.down,
      this.motor.getFacing(),
      tier
    )
    if (accepted) {
      this.hooks.setAnimation(tier === 'heavy' ? 'player_hurt_heavy' : 'player_hurt_light')
    }
    return accepted
  }

  destroy(): void {
    this.debug.destroy()
  }

  suppressJumpFor(ms: number): void {
    this.controller.suppressJumpFor(ms)
  }

  resetForRespawn(iFrameMs = PLAYER_GAMEPLAY_CONFIG.damage.iFramesMs): void {
    this.controller.suppressJumpFor(120)
    this.motor.resetForRespawn()
    this.combat.resetForRespawn()
    this.combat.grantInvulnerability(iFrameMs)
    this.activeHitbox = undefined
    this.lastMotorSnapshot = undefined
    this.lastCombatSnapshot = undefined
    this.currentAnimationKey = 'player_idle'
    this.hooks.setAnimation('player-idle')
  }

  getDebugState(): Record<string, unknown> | null {
    if (!this.lastMotorSnapshot || !this.lastCombatSnapshot) {
      return null
    }
    return {
      locomotion: {
        grounded: this.lastMotorSnapshot.grounded,
        dashing: this.lastMotorSnapshot.dashing,
        airDashing: this.lastMotorSnapshot.airDashing,
        coyoteMs: Math.round(this.lastMotorSnapshot.coyoteRemainingMs),
        jumpBufferMs: Math.round(this.lastMotorSnapshot.jumpBufferRemainingMs),
        dashMs: Math.round(this.lastMotorSnapshot.dashRemainingMs),
        dashCooldownMs: Math.round(this.lastMotorSnapshot.dashCooldownRemainingMs)
      },
      combat: {
        chargeLevel: this.lastCombatSnapshot.chargeLevel,
        charging: this.lastCombatSnapshot.charging,
        slashPhase: this.lastCombatSnapshot.slashPhase ?? null,
        slashDirection: this.lastCombatSnapshot.slashDirection ?? null,
        iFramesMs: Math.round(this.lastCombatSnapshot.iFramesRemainingMs),
        hitstunMs: Math.round(this.lastCombatSnapshot.hitstunRemainingMs),
        hitstopFrames: this.lastCombatSnapshot.hitstopRemainingFrames
      },
      visuals: {
        animationKey: this.currentAnimationKey,
        frameName: String(this.player.frame?.name ?? ''),
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
        this.hooks.spawnProjectile({
          speed: event.request.speed,
          damage: event.request.damage,
          scale: event.request.scale,
          chargeLevel: event.request.chargeLevel,
          impactFxKey: event.request.impactFxKey,
          facing: event.request.facing
        })
      } else if (event.type === 'hitbox') {
        this.activeHitbox = event.request
        this.hooks.applySwordHitbox(event.request)
      }
    }

    this.vfxSfx.dispatch(events)
  }

  private dispatchLocomotionSfx(motorSnapshot: MotorSnapshot): void {
    if (motorSnapshot.justJumped) {
      this.vfxSfx.dispatch([{ type: 'sfx', key: 'jump' }])
    }

    if (motorSnapshot.justLanded) {
      this.vfxSfx.dispatch([{ type: 'sfx', key: 'land' }])
    }

    const lastDashMs = this.lastMotorSnapshot?.dashRemainingMs ?? 0
    if (lastDashMs <= 0 && motorSnapshot.dashRemainingMs > 0) {
      this.vfxSfx.dispatch([{ type: 'sfx', key: 'dash' }])
    }
  }
}
