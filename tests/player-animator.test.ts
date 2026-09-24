import test from 'node:test'
import assert from 'node:assert/strict'
import { AnimationManifest } from '../src/player/AnimationManifest'
import { PlayerAnimator } from '../src/player/PlayerAnimator'
import type { CombatSnapshot, MotorSnapshot, PlayerResolvedState } from '../src/player/types'

function createMotor(overrides: Partial<MotorSnapshot> = {}): MotorSnapshot {
  return {
    grounded: true,
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
    slashActive: true,
    slashGrounded: false,
    slashDirection: 'n',
    slashPhase: 'startup',
    hitstunRemainingMs: 0,
    iFramesRemainingMs: 0,
    hitstopRemainingFrames: 0,
    ...overrides
  }
}

function createState(overrides: Partial<PlayerResolvedState> = {}): PlayerResolvedState {
  return {
    locomotion: 'fall',
    action: 'slash',
    facing: 1,
    slashDirection: 'n',
    chargeLevel: 0,
    isGravityInverted: false,
    ...overrides
  }
}

test('PlayerAnimator keeps airborne slash animation when slash started in air', () => {
  const played: string[] = []
  const animator = new PlayerAnimator(AnimationManifest, {
    play: (key) => played.push(key),
    onAnimationEvent: () => {}
  })

  const key = animator.update(
    createState(),
    createMotor({ grounded: true }),
    createCombat({ slashGrounded: false, slashDirection: 'n' })
  )

  assert.equal(key, 'player_slash_air_n')
  assert.deepEqual(played, ['player_slash_air_n'])
})

test('shoot and charge release animations are visual-only projectile consumers', () => {
  const shootKeys = Object.keys(AnimationManifest.animations).filter(
    (key) => key.startsWith('player_shoot_') || key.startsWith('player_charge_release_')
  )

  for (const key of shootKeys) {
    const events = AnimationManifest.animations[key]?.events ?? []
    assert.equal(events.some((event) => event.event === 'projectile.spawn'), false, key)
  }
})

test('PlayerAnimator holds a transient shoot pose long enough to render cleanly', () => {
  const played: string[] = []
  const animator = new PlayerAnimator(AnimationManifest, {
    play: (key) => played.push(key),
    onAnimationEvent: () => {}
  })

  const shootKey = animator.update(
    createState({ locomotion: 'idle', action: 'shoot' }),
    createMotor(),
    createCombat({ shotFired: true }),
    16
  )
  const heldKey = animator.update(
    createState({ locomotion: 'idle', action: 'none' }),
    createMotor(),
    createCombat(),
    16
  )

  assert.equal(shootKey, 'player_shoot_stand_fwd')
  assert.equal(heldKey, 'player_shoot_stand_fwd')
  assert.deepEqual(played, ['player_shoot_stand_fwd'])
})

test('horizontal combo hits 2 and 3 and the air spin play their own bodies; aimed swings keep directional frames', () => {
  const cases = [
    { combat: { slashGrounded: true, slashDirection: 'e', slashMove: 'combo2' }, key: 'player_slash_combo2' },
    { combat: { slashGrounded: true, slashDirection: 'w', slashMove: 'combo3' }, key: 'player_slash_combo3' },
    { combat: { slashGrounded: false, slashDirection: 'e', slashMove: 'air_spin' }, key: 'player_slash_air_spin' },
    { combat: { slashGrounded: true, slashDirection: 'e', slashMove: 'combo1' }, key: 'player_slash_ground_e' },
    { combat: { slashGrounded: true, slashDirection: 'n', slashMove: 'combo3' }, key: 'player_slash_ground_n' }
  ] as const
  for (const { combat, key } of cases) {
    const animator = new PlayerAnimator(AnimationManifest, { play: () => {}, onAnimationEvent: () => {} })
    const state = { ...createState(), slashDirection: combat.slashDirection }
    assert.equal(animator.update(state, createMotor(), createCombat({ ...combat })), key)
    assert.ok(AnimationManifest.animations[key], `${key} is in the manifest`)
  }
})
