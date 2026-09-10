import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerMotor } from '../src/player/PlayerMotor'
import { PLAYER_GAMEPLAY_CONFIG, resolvePlayerPhysicsLimits } from '../src/player/config'
import type { PlayerIntent } from '../src/player/types'

type MockBodyState = {
  onFloor: boolean
  velocity: { x: number; y: number }
  blocked: { up: boolean; down: boolean; left: boolean; right: boolean }
  touching: { up: boolean; down: boolean; left: boolean; right: boolean }
}

function createIntent(overrides: Partial<PlayerIntent> = {}): PlayerIntent {
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
    aim: { x: 1, y: 0 },
    ...overrides
  }
}

function createMockBody(overrides: Partial<MockBodyState> = {}) {
  const state: MockBodyState = {
    onFloor: false,
    velocity: { x: 0, y: 0 },
    blocked: { up: false, down: false, left: false, right: false },
    touching: { up: false, down: false, left: false, right: false },
    ...overrides
  }
  const body = {
    velocity: state.velocity,
    blocked: state.blocked,
    touching: state.touching,
    onFloor: () => state.onFloor,
    setVelocityX: (x: number) => {
      state.velocity.x = x
    },
    setVelocityY: (y: number) => {
      state.velocity.y = y
    },
    setVelocity: (x: number, y: number) => {
      state.velocity.x = x
      state.velocity.y = y
    },
    setAccelerationX: () => {},
    setAcceleration: () => {}
  }
  return { state, body }
}

function createMotor(overrides: Partial<MockBodyState> = {}) {
  const { state, body } = createMockBody(overrides)
  const player = { body } as any
  const motor = new PlayerMotor(player, PLAYER_GAMEPLAY_CONFIG.movement, PLAYER_GAMEPLAY_CONFIG.dash)
  return { motor, state }
}

function simulateJumpApex(fps: 30 | 60, holdMs: number): number {
  const dt = 1000 / fps
  const dtSeconds = dt / 1000
  const { motor, state } = createMotor({
    onFloor: true,
    blocked: { up: false, down: true, left: false, right: false }
  })
  let y = 0
  let elapsed = 0

  motor.update(createIntent({ jumpPressed: true, jumpHeld: holdMs > 0 }), dt, false)
  state.onFloor = false
  state.blocked.down = false

  while (elapsed < 2000 && state.velocity.y < 0) {
    y += state.velocity.y * dtSeconds
    state.velocity.y += PLAYER_GAMEPLAY_CONFIG.movement.gravity * dtSeconds
    elapsed += dt
    motor.update(createIntent({ jumpHeld: elapsed < holdMs }), dt, false)
  }

  return Math.abs(y)
}

function simulateDashTrace(fps: 30 | 60): { peakSpeed: number; distance: number; activeFrames: number } {
  const dt = 1000 / fps
  const { motor, state } = createMotor({
    onFloor: true,
    blocked: { up: false, down: true, left: false, right: false }
  })
  let distance = 0
  let peakSpeed = 0
  let activeFrames = 0
  let snapshot = motor.update(createIntent({ dashPressed: true, dashHeld: true }), dt, false)

  while (snapshot.dashing && activeFrames < 30) {
    peakSpeed = Math.max(peakSpeed, Math.abs(state.velocity.x))
    distance += state.velocity.x * (dt / 1000)
    activeFrames += 1
    snapshot = motor.update(createIntent({ dashHeld: true }), dt, false)
  }

  return { peakSpeed, distance, activeFrames }
}

test('PlayerMotor allows a coyote jump shortly after leaving ground', () => {
  const { motor, state } = createMotor({ onFloor: true, blocked: { up: false, down: true, left: false, right: false } })

  motor.update(createIntent(), 16, false)
  state.onFloor = false
  state.blocked.down = false

  const snapshot = motor.update(createIntent({ jumpPressed: true }), 16, false)

  assert.equal(snapshot.justJumped, true)
  assert.equal(snapshot.jumpSource, 'coyote')
  assert.equal(state.velocity.y, PLAYER_GAMEPLAY_CONFIG.movement.jumpVelocity)
})

test('PlayerMotor consumes a buffered jump on landing', () => {
  const { motor, state } = createMotor()

  motor.update(createIntent({ jumpPressed: true }), 16, false)
  state.onFloor = true
  state.blocked.down = true

  const snapshot = motor.update(createIntent(), 50, false)

  assert.equal(snapshot.justJumped, true)
  assert.equal(snapshot.jumpSource, 'ground')
  assert.equal(state.velocity.y, PLAYER_GAMEPLAY_CONFIG.movement.jumpVelocity)
})

test('PlayerMotor marks dash start and early ground release', () => {
  const { motor, state } = createMotor({ onFloor: true, blocked: { up: false, down: true, left: false, right: false } })

  const started = motor.update(createIntent({ dashPressed: true }), 16, false)
  assert.equal(started.dashStarted, true)
  assert.equal(started.dashing, true)
  assert.equal(state.velocity.x, PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed)

  const ended = motor.update(createIntent({ dashReleased: true }), 16, false)
  assert.equal(ended.dashEnded, true)
  assert.equal(ended.dashing, false)
})

test('player physics limits accommodate every authored movement burst', () => {
  const base = resolvePlayerPhysicsLimits(PLAYER_GAMEPLAY_CONFIG)
  const speedster = resolvePlayerPhysicsLimits(PLAYER_GAMEPLAY_CONFIG, 1.15)

  assert.equal(base.maxVelocityX, PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed)
  assert.equal(base.maxVelocityY, PLAYER_GAMEPLAY_CONFIG.movement.terminalVelocity)
  assert.equal(speedster.maxVelocityX, PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed * 1.15)
})

test('PlayerMotor applies the same progression multiplier to run, dash, and boosted wall jump', () => {
  const multiplier = 1.15
  const grounded = createMotor({
    onFloor: true,
    blocked: { up: false, down: true, left: false, right: false }
  })
  grounded.motor.setMovementSpeedMultiplier(multiplier)
  grounded.motor.update(createIntent({ dashPressed: true }), 16, false)
  assert.equal(grounded.state.velocity.x, PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed * multiplier)

  const wall = createMotor({
    velocity: { x: 0, y: 120 },
    touching: { up: false, down: false, left: false, right: true }
  })
  wall.motor.setMovementSpeedMultiplier(multiplier)
  wall.motor.update(createIntent({ moveAxis: 1 }), 16, false)
  wall.motor.update(createIntent({ moveAxis: 1, jumpPressed: true, dashHeld: true }), 16, false)
  assert.equal(
    wall.state.velocity.x,
    -PLAYER_GAMEPLAY_CONFIG.movement.wallJumpVelocityX *
      PLAYER_GAMEPLAY_CONFIG.movement.wallJumpBoostMultiplier *
      multiplier
  )
})

test('PlayerMotor caps wall slide speed and wall jumps away from the wall', () => {
  const { motor, state } = createMotor({
    velocity: { x: 0, y: 220 },
    touching: { up: false, down: false, left: false, right: true }
  })

  const slide = motor.update(createIntent({ moveAxis: 1 }), 16, false)
  assert.equal(slide.wallSliding, true)
  assert.equal(slide.wallSide, 1)
  assert.equal(state.velocity.y, PLAYER_GAMEPLAY_CONFIG.movement.wallSlideFallSpeed)

  const jump = motor.update(createIntent({ moveAxis: 1, jumpPressed: true }), 16, false)
  assert.equal(jump.justJumped, true)
  assert.equal(jump.jumpSource, 'wall')
  assert.equal(state.velocity.x < 0, true)
  assert.equal(state.velocity.y, PLAYER_GAMEPLAY_CONFIG.movement.wallJumpVelocityY)
})

test('PlayerMotor short-hop remains meaningfully lower than held full-hop', () => {
  const shortHop = simulateJumpApex(60, 0)
  const fullHop = simulateJumpApex(60, 900)

  assert.equal(shortHop > 90, true)
  assert.equal(fullHop > shortHop * 1.5, true)
  assert.equal(shortHop / fullHop < 0.7, true)
})

test('PlayerMotor jump apex stays within tolerance at 30fps and 60fps', () => {
  const fullHop60 = simulateJumpApex(60, 900)
  const fullHop30 = simulateJumpApex(30, 900)
  const ratio = Math.abs(fullHop60 - fullHop30) / fullHop60

  assert.equal(ratio < 0.12, true)
})

test('PlayerMotor dash feel trace stays stable at 30fps and 60fps', () => {
  const trace30 = simulateDashTrace(30)
  const trace60 = simulateDashTrace(60)
  const distanceDelta = Math.abs(trace30.distance - trace60.distance) / trace60.distance

  assert.equal(trace30.peakSpeed, PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed)
  assert.equal(trace60.peakSpeed, PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed)
  assert.equal(distanceDelta < 0.15, true)
})
