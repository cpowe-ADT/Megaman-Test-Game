import test from 'node:test'
import assert from 'node:assert/strict'
import { PlayerMotor } from '../src/player/PlayerMotor'
import * as playerConfig from '../src/player/config'
import type { PlayerIntent } from '../src/player/types'

const { PLAYER_GAMEPLAY_CONFIG, resolvePlayerPhysicsLimits } = playerConfig

const MOVE = PLAYER_GAMEPLAY_CONFIG.movement
const DASH = PLAYER_GAMEPLAY_CONFIG.dash
const FRAME_60 = 1000 / 60

type Rect = { x: number; y: number; width: number; height: number }

type MockBodyState = {
  onFloor: boolean
  velocity: { x: number; y: number }
  blocked: { up: boolean; down: boolean; left: boolean; right: boolean }
  touching: { up: boolean; down: boolean; left: boolean; right: boolean }
  x: number
  y: number
  width: number
  height: number
  drag: { x: number; y: number }
  allowDrag: boolean
  gravity: { x: number; y: number }
  allowGravity: boolean
  worldGravityY?: number
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
    x: 100,
    y: 100,
    width: 16,
    height: 22,
    drag: { x: 0, y: 0 },
    allowDrag: true,
    gravity: { x: 0, y: 0 },
    allowGravity: true,
    ...overrides
  }
  const body = {
    velocity: state.velocity,
    blocked: state.blocked,
    touching: state.touching,
    drag: state.drag,
    gravity: state.gravity,
    get x() {
      return state.x
    },
    set x(value: number) {
      state.x = value
    },
    get y() {
      return state.y
    },
    set y(value: number) {
      state.y = value
    },
    get width() {
      return state.width
    },
    get height() {
      return state.height
    },
    get allowDrag() {
      return state.allowDrag
    },
    get allowGravity() {
      return state.allowGravity
    },
    world: state.worldGravityY === undefined ? undefined : { gravity: { x: 0, y: state.worldGravityY } },
    setAllowDrag: (value = true) => {
      state.allowDrag = value
    },
    setDragX: (value: number) => {
      state.drag.x = value
    },
    setGravityY: (value: number) => {
      state.gravity.y = value
    },
    setAllowGravity: (value = true) => {
      state.allowGravity = value
    },
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

const groundedBody = (): Partial<MockBodyState> => ({
  onFloor: true,
  blocked: { up: false, down: true, left: false, right: false }
})

/** Arcade's non-damped drag, applied by World.computeVelocity when acceleration.x is 0. */
function applyArcadeDragX(state: MockBodyState, dtSeconds: number): void {
  if (!state.allowDrag || state.drag.x === 0) return
  const dragX = state.drag.x * dtSeconds
  if (state.velocity.x - dragX > 0.01) state.velocity.x -= dragX
  else if (state.velocity.x + dragX < -0.01) state.velocity.x += dragX
  else state.velocity.x = 0
}

/** One physics step for the mock: gravity when allowed, then position. */
function stepBody(state: MockBodyState, dtSeconds: number): void {
  if (state.allowGravity) state.velocity.y += MOVE.gravity * dtSeconds
  state.x += state.velocity.x * dtSeconds
  state.y += state.velocity.y * dtSeconds
}

function createProbe(solids: Rect[]) {
  return {
    solids,
    isSolid(x: number, y: number, width: number, height: number): boolean {
      return solids.some(
        (rect) => x < rect.x + rect.width && x + width > rect.x && y < rect.y + rect.height && y + height > rect.y
      )
    }
  }
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

test('PlayerMotor tap, short and full hops follow the -400 / 1050 arc with a jump cut', () => {
  const tap = simulateJumpApex(60, 0)
  const shortHop = simulateJumpApex(60, 140)
  const fullHop = simulateJumpApex(60, 900)

  assert.equal(MOVE.jumpVelocity, -400)
  assert.equal(MOVE.gravity, 1050)
  assert.equal(MOVE.jumpCutVelocity, -140)
  assert.ok(fullHop >= 120 && fullHop <= 150, `full hop ${fullHop.toFixed(1)}px, want about 130`)
  assert.ok(shortHop >= 45 && shortHop <= 75, `short hop ${shortHop.toFixed(1)}px, want about 60`)
  assert.ok(tap >= 8 && tap < shortHop, `tap ${tap.toFixed(1)}px`)
  assert.ok(fullHop > shortHop * 1.8)
})

test('PlayerMotor jump released at 80ms caps apex at 70px', () => {
  const apex = simulateJumpApex(60, 80)
  assert.ok(apex <= 70, `apex ${apex.toFixed(1)}px`)
})

test('PlayerMotor sets hero body gravity so world plus body equals movement gravity', () => {
  const { motor, state } = createMotor({ worldGravityY: 800 })
  motor.update(createIntent(), FRAME_60, false)
  assert.equal(state.gravity.y, MOVE.gravity - 800)
})

test('PlayerMotor jump apex stays within tolerance at 30fps and 60fps', () => {
  const fullHop60 = simulateJumpApex(60, 900)
  const fullHop30 = simulateJumpApex(30, 900)
  const ratio = Math.abs(fullHop60 - fullHop30) / fullHop60

  assert.equal(ratio < 0.12, true)
})

test('PlayerMotor dash lasts about 17 active frames at 60fps and covers the same distance at 30fps', () => {
  const trace30 = simulateDashTrace(30)
  const trace60 = simulateDashTrace(60)
  const distanceDelta = Math.abs(trace30.distance - trace60.distance) / trace60.distance

  assert.equal(DASH.dashDurationMs, 280)
  assert.ok(trace60.activeFrames >= 16 && trace60.activeFrames <= 18, `60fps frames ${trace60.activeFrames}`)
  assert.equal(trace30.peakSpeed, DASH.dashSpeed)
  assert.equal(trace60.peakSpeed, DASH.dashSpeed)
  assert.ok(distanceDelta < 0.07, `distance delta ${distanceDelta.toFixed(3)}`)
})

test('PlayerMotor allows a second dash within 100ms of the first ending', () => {
  const { motor } = createMotor(groundedBody())
  let snapshot = motor.update(createIntent({ dashPressed: true, dashHeld: true }), FRAME_60, false)
  let frames = 0
  while (snapshot.dashing && frames < 40) {
    snapshot = motor.update(createIntent({ dashHeld: true }), FRAME_60, false)
    frames += 1
  }
  assert.equal(snapshot.dashEnded, true)
  for (let index = 0; index < 4; index += 1) {
    motor.update(createIntent(), FRAME_60, false)
  }
  const second = motor.update(createIntent({ dashPressed: true, dashHeld: true }), FRAME_60, false)
  assert.equal(DASH.dashCooldownMs, 60)
  assert.equal(second.dashStarted, true)
})

test('PlayerMotor air dash zeroes vy, suspends gravity and holds y within 2px', () => {
  const { motor, state } = createMotor({ velocity: { x: 0, y: 200 } })
  const startY = state.y
  let snapshot = motor.update(createIntent({ dashPressed: true, dashHeld: true }), FRAME_60, true)
  assert.equal(snapshot.airDashing, true)
  let maxDrift = 0
  let frames = 0
  while (snapshot.dashing && frames < 40) {
    stepBody(state, FRAME_60 / 1000)
    maxDrift = Math.max(maxDrift, Math.abs(state.y - startY))
    snapshot = motor.update(createIntent({ dashHeld: true }), FRAME_60, true)
    frames += 1
  }
  assert.ok(maxDrift <= 2, `air dash drifted ${maxDrift.toFixed(2)}px`)
  assert.equal(state.allowGravity, true)
})

test('PlayerMotor under Arcade drag 900 holds a steady grounded run at or above 219', () => {
  const { motor, state } = createMotor({ ...groundedBody(), drag: { x: 900, y: 0 } })
  const samples: number[] = []
  for (let frame = 0; frame < 60; frame += 1) {
    motor.update(createIntent({ moveAxis: 1 }), FRAME_60, false)
    applyArcadeDragX(state, FRAME_60 / 1000)
    samples.push(state.velocity.x)
  }
  const steady = Math.min(...samples.slice(-10))
  assert.ok(steady >= 219, `steady grounded vx ${steady.toFixed(1)}`)
})

test('PlayerMotor under Arcade drag 900 reaches 200 airborne within 250ms', () => {
  const { motor, state } = createMotor({ drag: { x: 900, y: 0 } })
  let peak = 0
  for (let elapsed = 0; elapsed < 250; elapsed += FRAME_60) {
    motor.update(createIntent({ moveAxis: 1 }), FRAME_60, false)
    applyArcadeDragX(state, FRAME_60 / 1000)
    peak = Math.max(peak, state.velocity.x)
  }
  assert.ok(peak >= 200, `airborne vx after 250ms ${peak.toFixed(1)}`)
})

test('PlayerMotor dash-jump on dash frame 3 leaves the ground at 320 and holds at least 300 at apex', () => {
  const { motor, state } = createMotor(groundedBody())
  motor.update(createIntent({ moveAxis: 1, dashPressed: true, dashHeld: true }), FRAME_60, false)
  motor.update(createIntent({ moveAxis: 1, dashHeld: true }), FRAME_60, false)
  const jump = motor.update(createIntent({ moveAxis: 1, dashHeld: true, jumpPressed: true, jumpHeld: true }), FRAME_60, false)
  assert.equal(jump.justJumped, true)
  assert.equal(Math.abs(state.velocity.x), DASH.dashSpeed)
  state.onFloor = false
  state.blocked.down = false
  let frames = 0
  while (state.velocity.y < 0 && frames < 120) {
    stepBody(state, FRAME_60 / 1000)
    motor.update(createIntent({ moveAxis: 1, dashHeld: true, jumpHeld: true }), FRAME_60, false)
    frames += 1
  }
  assert.ok(Math.abs(state.velocity.x) >= 300, `apex vx ${state.velocity.x.toFixed(1)}`)
})

test('PlayerMotor keeps dash-jump carry and jump cut on a 144Hz render frame without a physics step', () => {
  const frameMs = 1000 / 144
  const { motor, state } = createMotor(groundedBody())
  motor.update(createIntent({ moveAxis: 1, dashPressed: true, dashHeld: true }), frameMs, false)
  const jump = motor.update(createIntent({ moveAxis: 1, dashHeld: true, jumpPressed: true, jumpHeld: true }), frameMs, false)
  assert.equal(jump.justJumped, true)
  // No physics step yet: Arcade's floor flags still say grounded from before the jump.
  const stale = motor.update(createIntent({ moveAxis: 1, dashHeld: true }), frameMs, false)
  assert.equal(stale.grounded, false)
  assert.equal(state.velocity.x, DASH.dashSpeed)
  assert.equal(state.velocity.y, MOVE.jumpCutVelocity)
})

test('PlayerMotor dash-jump carry ends on opposite input and on wall contact', () => {
  const run = createMotor(groundedBody())
  run.motor.update(createIntent({ moveAxis: 1, dashPressed: true, dashHeld: true }), FRAME_60, false)
  run.motor.update(createIntent({ moveAxis: 1, dashHeld: true, jumpPressed: true, jumpHeld: true }), FRAME_60, false)
  run.state.onFloor = false
  run.state.blocked.down = false
  run.motor.update(createIntent({ moveAxis: 0, jumpHeld: true }), FRAME_60, false)
  assert.equal(run.state.velocity.x, DASH.dashSpeed)
  run.motor.update(createIntent({ moveAxis: -1, jumpHeld: true }), FRAME_60, false)
  assert.ok(run.state.velocity.x < DASH.dashSpeed)

  const wall = createMotor(groundedBody())
  wall.motor.update(createIntent({ moveAxis: 1, dashPressed: true, dashHeld: true }), FRAME_60, false)
  wall.motor.update(createIntent({ moveAxis: 1, dashHeld: true, jumpPressed: true, jumpHeld: true }), FRAME_60, false)
  wall.state.onFloor = false
  wall.state.blocked.down = false
  // Arcade zeroes vx when the body is blocked by the wall; the carry must not restore 320.
  wall.state.blocked.right = true
  wall.state.velocity.x = 0
  wall.motor.update(createIntent({ moveAxis: 1, jumpHeld: true }), FRAME_60, false)
  wall.state.blocked.right = false
  wall.motor.update(createIntent({ moveAxis: 1, jumpHeld: true }), FRAME_60, false)
  assert.ok(wall.state.velocity.x < 50, `vx after wall contact ${wall.state.velocity.x}`)
})

test('PlayerMotor wall kick: release toward-wall input, jump 50ms later, kicks away from the wall', () => {
  const { motor, state } = createMotor({
    velocity: { x: 0, y: 120 },
    blocked: { up: false, down: false, left: false, right: true }
  })
  assert.equal(MOVE.wallKickGraceMs, 80)
  assert.equal(MOVE.wallStickMs, 60)
  motor.update(createIntent({ moveAxis: 1 }), FRAME_60, false)
  state.blocked.right = false
  motor.update(createIntent(), FRAME_60, false)
  motor.update(createIntent(), FRAME_60, false)
  const kick = motor.update(createIntent({ jumpPressed: true, jumpHeld: true }), FRAME_60, false)
  assert.equal(kick.jumpSource, 'wall')
  assert.ok(state.velocity.x < 0, `kick vx ${state.velocity.x}`)
})

test('PlayerMotor fires a jump buffered 60ms before wall contact, with neutral input', () => {
  const { motor, state } = createMotor({ velocity: { x: 0, y: 100 } })
  motor.update(createIntent({ jumpPressed: true, jumpHeld: true }), 20, false)
  motor.update(createIntent({ jumpHeld: true }), 20, false)
  motor.update(createIntent({ jumpHeld: true }), 20, false)
  state.touching.right = true
  const kick = motor.update(createIntent({ jumpHeld: true }), 20, false)
  assert.equal(kick.jumpSource, 'wall')
  assert.ok(state.velocity.x < 0)
})

test('PlayerMotor wall stick holds the hero on the wall briefly when pressing away', () => {
  const { motor, state } = createMotor({
    velocity: { x: 0, y: 120 },
    blocked: { up: false, down: false, left: false, right: true }
  })
  motor.update(createIntent({ moveAxis: 1 }), FRAME_60, false)
  state.blocked.right = false
  motor.update(createIntent({ moveAxis: -1 }), FRAME_60, false)
  motor.update(createIntent({ moveAxis: -1 }), FRAME_60, false)
  assert.equal(state.velocity.x, 0)
  for (let index = 0; index < 3; index += 1) motor.update(createIntent({ moveAxis: -1 }), FRAME_60, false)
  assert.ok(state.velocity.x < 0)
})

test('PlayerMotor nudges around a ceiling corner of up to 3px and not a wider one', () => {
  const near = createMotor({ velocity: { x: 0, y: -300 } })
  near.motor.setTerrainProbe(createProbe([{ x: 80, y: 90, width: 22, height: 8 }]), 22)
  near.motor.update(createIntent({ jumpHeld: true }), FRAME_60, false)
  assert.equal(near.state.x, 102)

  const wide = createMotor({ velocity: { x: 0, y: -300 } })
  wide.motor.setTerrainProbe(createProbe([{ x: 80, y: 90, width: 25, height: 8 }]), 22)
  wide.motor.update(createIntent({ jumpHeld: true }), FRAME_60, false)
  assert.equal(wide.state.x, 100)
})

test('PlayerMotor steps up a 1 to 3px lip while running and not a 5px one', () => {
  const lip = createMotor({ ...groundedBody(), velocity: { x: MOVE.runSpeed, y: 0 } })
  lip.motor.setTerrainProbe(createProbe([{ x: 116.5, y: 120, width: 40, height: 2 }]), 22)
  lip.motor.update(createIntent({ moveAxis: 1 }), FRAME_60, false)
  assert.equal(lip.state.y, 98)

  const step = createMotor({ ...groundedBody(), velocity: { x: MOVE.runSpeed, y: 0 } })
  step.motor.setTerrainProbe(createProbe([{ x: 116.5, y: 117, width: 40, height: 5 }]), 22)
  step.motor.update(createIntent({ moveAxis: 1 }), FRAME_60, false)
  assert.equal(step.state.y, 100)
})

test('PlayerMotor keeps dashing under a low ceiling until the stand body fits', () => {
  const { motor, state } = createMotor({ ...groundedBody(), y: 108, height: 14 })
  const probe = createProbe([{ x: 0, y: 96, width: 400, height: 10 }])
  motor.setTerrainProbe(probe, 22)
  let snapshot = motor.update(createIntent({ dashPressed: true, dashHeld: true }), FRAME_60, false)
  for (let frame = 0; frame < 30; frame += 1) {
    snapshot = motor.update(createIntent({ dashHeld: frame < 20, dashReleased: frame === 20 }), FRAME_60, false)
  }
  assert.equal(snapshot.dashing, true)
  assert.equal(state.velocity.x, DASH.dashSpeed)
  probe.solids.length = 0
  snapshot = motor.update(createIntent(), FRAME_60, false)
  snapshot = motor.update(createIntent(), FRAME_60, false)
  assert.equal(snapshot.dashing, false)
})

test('PlayerMotor crouch on the ground slows the hero to 0', () => {
  const { motor, state } = createMotor({ ...groundedBody(), velocity: { x: MOVE.runSpeed, y: 0 } })
  let snapshot = motor.update(createIntent({ moveAxis: 1, crouchHeld: true }), FRAME_60, false)
  for (let frame = 0; frame < 10; frame += 1) {
    snapshot = motor.update(createIntent({ moveAxis: 1, crouchHeld: true }), FRAME_60, false)
  }
  assert.equal(state.velocity.x, 0)
  assert.equal(snapshot.facing, 1)
})

test('tickHitstopFrames keeps a 5-frame hit-stop near 83ms at 30, 60 and 144fps', () => {
  for (const fps of [30, 60, 144]) {
    const frameMs = 1000 / fps
    let remaining = 5
    let ticks = 0
    while (remaining > 0 && ticks < 100) {
      remaining = playerConfig.tickHitstopFrames(remaining, frameMs)
      ticks += 1
    }
    const elapsed = ticks * frameMs
    assert.ok(Math.abs(elapsed - 5000 / 60) <= frameMs, `${fps}fps hit-stop lasted ${elapsed.toFixed(1)}ms`)
  }
})

test('timeScaledLerp converges the camera by the same amount per second at 30, 60 and 144fps', () => {
  const remainingAfterOneSecond = (fps: number) => {
    let remaining = 1
    for (let frame = 0; frame < fps; frame += 1) remaining *= 1 - playerConfig.timeScaledLerp(0.1, 1000 / fps)
    return remaining
  }
  const reference = remainingAfterOneSecond(60)
  assert.ok(Math.abs(reference - Math.pow(0.9, 60)) < 1e-9)
  for (const fps of [30, 144]) {
    assert.ok(Math.abs(remainingAfterOneSecond(fps) - reference) < 1e-6, `${fps}fps lerp drifted`)
  }
})
