import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerStateMachine } from '../src/player/PlayerStateMachine'
import type { CombatSnapshot, MotorSnapshot, PlayerIntent } from '../src/player/types'

function createIntent(): PlayerIntent {
  return {
    moveAxis: 0,
    jumpPressed: false,
    jumpHeld: false,
    jumpReleased: false,
    dashPressed: false,
    dashHeld: false,
    dashReleased: false,
    shootPressed: false,
    shootHeld: false,
    shootReleased: false,
    slashPressed: false,
    crouchHeld: false,
    aim: { x: 1, y: 0 }
  }
}

function createMotor(overrides: Partial<MotorSnapshot> = {}): MotorSnapshot {
  return {
    grounded: false,
    justLanded: false,
    justJumped: false,
    jumpSource: 'none',
    dashing: false,
    dashStarted: false,
    dashEnded: false,
    airDashing: false,
    wallSliding: false,
    wallSide: 0,
    wallJumping: false,
    facing: 1,
    turnRequested: false,
    velocityX: 0,
    velocityY: 0,
    coyoteRemainingMs: 0,
    jumpBufferRemainingMs: 0,
    dashRemainingMs: 0,
    dashCooldownRemainingMs: 0,
    isGravityInverted: false,
    ...overrides
  }
}

function createCombat(overrides: Partial<CombatSnapshot> = {}): CombatSnapshot {
  return {
    shotFired: false,
    chargeLevel: 0,
    chargeElapsedMs: 0,
    charging: false,
    chargeReleased: false,
    releasedChargeLevel: 0,
    slashActive: false,
    hitstunRemainingMs: 0,
    iFramesRemainingMs: 0,
    hitstopRemainingFrames: 0,
    ...overrides
  }
}

test('PlayerStateMachine resolves wall slide and wall jump locomotion', () => {
  const stateMachine = new PlayerStateMachine()

  const wallSlide = stateMachine.resolve(
    createIntent(),
    createMotor({ wallSliding: true, wallSide: 1, velocityY: 80 }),
    createCombat()
  )
  assert.equal(wallSlide.locomotion, 'wall_slide')

  const wallJump = stateMachine.resolve(
    createIntent(),
    createMotor({ wallJumping: true, velocityY: -200 }),
    createCombat()
  )
  assert.equal(wallJump.locomotion, 'wall_jump')
})
