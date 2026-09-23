import type { PlayerIntent, MotorSnapshot, CombatSnapshot, PlayerResolvedState } from './types'

export class PlayerStateMachine {
  resolve(intent: PlayerIntent, motor: MotorSnapshot, combat: CombatSnapshot): PlayerResolvedState {
    let locomotion: PlayerResolvedState['locomotion'] = 'idle'

    if (combat.hitstunRemainingMs > 0) {
      locomotion = 'hurt'
    } else if (motor.wallSliding) {
      locomotion = 'wall_slide'
    } else if (motor.wallJumping) {
      locomotion = 'wall_jump'
    } else if (motor.airDashing) {
      locomotion = 'air_dash'
    } else if (motor.dashing) {
      locomotion = 'dash'
    } else if (intent.crouchHeld && motor.grounded) {
      locomotion = 'crouch'
    } else if (!motor.grounded) {
      if (motor.justJumped) {
        locomotion = 'jump_start'
      } else if (motor.velocityY < -24) {
        locomotion = 'jump_rise'
      } else if (Math.abs(motor.velocityY) <= 24) {
        locomotion = 'jump_apex'
      } else {
        locomotion = 'fall'
      }
    } else if (motor.justLanded) {
      locomotion = 'land'
    } else if (motor.turnRequested) {
      locomotion = 'turn'
    } else if (Math.abs(motor.velocityX) > 28) {
      locomotion = 'run'
    }

    let action: PlayerResolvedState['action'] = 'none'
    if (combat.pendingDamageTier === 'heavy') {
      action = 'hurt_heavy'
    } else if (combat.pendingDamageTier === 'light') {
      action = 'hurt_light'
    } else if (combat.slashActive) {
      action = 'slash'
    } else if (combat.chargeReleased) {
      action = 'charge_release'
    } else if (combat.charging && combat.chargeLevel > 0) {
      action = 'charge_hold'
    } else if (combat.charging) {
      action = 'charge_start'
    } else if (combat.shotFired) {
      action = 'shoot'
    }

    return {
      locomotion,
      action,
      facing: motor.facing,
      slashDirection: combat.slashDirection,
      chargeLevel: combat.chargeReleased ? combat.releasedChargeLevel : combat.chargeLevel,
      isGravityInverted: motor.isGravityInverted
    }
  }
}
