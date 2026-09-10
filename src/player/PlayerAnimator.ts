import type { AnimationManifestType } from './AnimationManifest'
import type { CombatSnapshot, MotorSnapshot, PlayerResolvedState } from './types'

export type PlayerAnimatorHooks = {
  play: (key: string) => void
  onAnimationEvent: (eventName: string, payload?: Record<string, unknown>) => void
}

export class PlayerAnimator {
  private currentKey = ''
  private firedEventKeys = new Set<string>()
  private poseHoldRemainingMs = 0
  private poseHoldGrounded: boolean | null = null

  constructor(
    private readonly manifest: AnimationManifestType,
    private readonly hooks: PlayerAnimatorHooks
  ) {}

  update(
    state: PlayerResolvedState,
    motor: MotorSnapshot,
    combat: CombatSnapshot,
    deltaMs = 1000 / 60
  ): string {
    this.poseHoldRemainingMs = Math.max(0, this.poseHoldRemainingMs - Math.max(0, deltaMs))
    const resolvedKey = this.resolveAnimationKey(state, motor, combat)
    const interruptPose =
      state.action === 'hurt_heavy' ||
      state.action === 'hurt_light' ||
      state.action === 'slash' ||
      (this.poseHoldGrounded != null && this.poseHoldGrounded !== motor.grounded)
    const canHoldPose =
      !interruptPose &&
      this.poseHoldRemainingMs > 0 &&
      this.currentKey.length > 0 &&
      state.action === 'none'
    const key = canHoldPose ? this.currentKey : resolvedKey

    if (state.action === 'shoot' || state.action === 'charge_release') {
      const entry = this.manifest.animations[resolvedKey]
      const frameCount = Math.max(1, (entry?.frameEnd ?? 0) - (entry?.frameStart ?? 0) + 1)
      this.poseHoldRemainingMs = Math.max(90, (frameCount / Math.max(1, entry?.frameRate ?? 12)) * 1000)
      this.poseHoldGrounded = motor.grounded
    } else if (interruptPose || this.poseHoldRemainingMs <= 0) {
      this.poseHoldGrounded = null
    }
    if (key !== this.currentKey) {
      this.currentKey = key
      this.firedEventKeys.clear()
      this.hooks.play(key)
    }

    const entry = this.manifest.animations[key]
    if (entry?.events) {
      for (const marker of entry.events) {
        const token = `${key}:${marker.event}:${marker.frame}`
        if (!this.firedEventKeys.has(token) && marker.frame === 0) {
          this.firedEventKeys.add(token)
          this.hooks.onAnimationEvent(marker.event, marker.payload)
        }
      }
    }

    return key
  }

  private resolveAnimationKey(
    state: PlayerResolvedState,
    motor: MotorSnapshot,
    combat: CombatSnapshot
  ): string {
    if (state.action === 'hurt_heavy') {
      return 'player_hurt_heavy'
    }
    if (state.action === 'hurt_light') {
      return 'player_hurt_light'
    }
    if (state.action === 'slash') {
      const dir = state.slashDirection ?? 'e'
      return `${combat.slashGrounded ?? motor.grounded ? 'player_slash_ground' : 'player_slash_air'}_${dir}`
    }
    if (state.action === 'charge_release') {
      const level = Math.max(1, Math.min(4, state.chargeLevel ?? 1))
      return `player_charge_release_lv${level}`
    }
    if (state.action === 'charge_hold') {
      return 'player_charge_hold'
    }
    if (state.action === 'charge_start') {
      return 'player_charge_start'
    }
    if (state.action === 'shoot') {
      if (state.locomotion === 'dash') {
        return 'player_shoot_dash_fwd'
      }
      if (!motor.grounded) {
        return 'player_shoot_air_fwd'
      }
      if (Math.abs(motor.velocityX) > 28) {
        return 'player_shoot_run_fwd'
      }
      return 'player_shoot_stand_fwd'
    }

    switch (state.locomotion) {
      case 'dash':
        return 'player_dash_loop'
      case 'air_dash':
        return 'player_airdash_loop'
      case 'wall_slide':
        return 'player_wall_slide'
      case 'wall_jump':
        return 'player_wall_jump'
      case 'crouch':
        return 'player_crouch_hold'
      case 'turn':
        return 'player_turn'
      case 'jump_start':
        return 'player_jump_start'
      case 'jump_rise':
        return 'player_jump_rise'
      case 'jump_apex':
        return 'player_jump_apex'
      case 'fall':
        return 'player_fall'
      case 'land':
        return 'player_land'
      case 'run':
        return 'player_run'
      case 'hurt':
        return 'player_hurt_light'
      case 'idle':
      default:
        return 'player_idle'
    }
  }
}
