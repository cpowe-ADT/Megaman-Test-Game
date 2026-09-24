import test from 'node:test'
import assert from 'node:assert/strict'
import {
  applyRoomLockInput,
  armRoomLock,
  createRoomLockState,
  detectRoomLockVerbs,
  findRoomIndex,
  formatKeyCode,
  isSaberInReach,
  resolveCameraRoomIndex,
  roomLockKeyHint,
  type RoomLockDefinition,
  type RoomLockVerbSample
} from '../src/mechanics/roomLock.ts'
import { DEFAULT_BINDINGS } from '../src/input/ActionState.ts'
import { getCampaignStage, getStageContentRetentionReport, TUTORIAL_STAGE_ID } from '../src/content/campaign.ts'

const DASH_LOCK: RoomLockDefinition = { id: 'l', room: { x: 448, y: 0, width: 448, height: 252 }, gateX: 896, requiredInput: 'dash' }
const SAMPLE: RoomLockVerbSample = {
  grounded: true, velocityY: 0, lastJumpSource: 'none', dashStartedAtMs: 0, wallJumping: false,
  projectileSpawnMs: 0, projectileChargeLevel: 0, slashPhase: null
}

test('room lock: dormant until armed, ignores its verb before arming and every other verb after', () => {
  let state = createRoomLockState(DASH_LOCK)
  assert.equal(state.phase, 'dormant')
  assert.equal(applyRoomLockInput(state, 'dash').phase, 'dormant')
  state = armRoomLock(state)
  assert.equal(state.phase, 'locked')
  for (const wrong of ['jump', 'wall_jump', 'charge', 'saber'] as const) {
    assert.equal(applyRoomLockInput(state, wrong).phase, 'locked')
  }
  state = applyRoomLockInput(state, 'dash')
  assert.deepEqual([state.phase, state.satisfied, state.progress], ['open', true, 1])
  assert.equal(armRoomLock(state).phase, 'open', 'an open lock never re-arms')
})

test('room lock: the saber gate falls on the third hit', () => {
  let state = armRoomLock(createRoomLockState({ ...DASH_LOCK, requiredInput: 'saber', hitsRequired: 3 }))
  state = applyRoomLockInput(state, 'saber')
  state = applyRoomLockInput(state, 'saber')
  assert.deepEqual([state.phase, state.progress], ['locked', 2])
  assert.equal(applyRoomLockInput(state, 'saber').phase, 'open')
})

test('room lock: verb edges come from the runtime sample, once per edge', () => {
  assert.deepEqual(detectRoomLockVerbs(null, SAMPLE), [])
  assert.deepEqual(detectRoomLockVerbs(SAMPLE, { ...SAMPLE, grounded: false, velocityY: -300, lastJumpSource: 'ground' }), ['jump'])
  assert.deepEqual(detectRoomLockVerbs(SAMPLE, { ...SAMPLE, grounded: false, velocityY: 40 }), [], 'walking off a ledge is not a jump')
  assert.deepEqual(detectRoomLockVerbs(SAMPLE, { ...SAMPLE, dashStartedAtMs: 1200 }), ['dash'])
  const air = { ...SAMPLE, grounded: false }
  assert.deepEqual(detectRoomLockVerbs(air, { ...air, wallJumping: true, lastJumpSource: 'wall' }), ['wall_jump'])
  assert.deepEqual(detectRoomLockVerbs(SAMPLE, { ...SAMPLE, projectileSpawnMs: 900, projectileChargeLevel: 0 }), [], 'a pellet is not a charge')
  assert.deepEqual(detectRoomLockVerbs(SAMPLE, { ...SAMPLE, projectileSpawnMs: 900, projectileChargeLevel: 2 }), ['charge'])
  assert.deepEqual(detectRoomLockVerbs({ ...SAMPLE, slashPhase: 'startup' }, { ...SAMPLE, slashPhase: 'active' }), ['saber'])
  assert.deepEqual(detectRoomLockVerbs({ ...SAMPLE, slashPhase: 'active' }, { ...SAMPLE, slashPhase: 'active' }), [])
})

test('room lock: saber reach, key hints from bindings, camera room', () => {
  assert.equal(isSaberInReach(2216, 1, 2240), true)
  assert.equal(isSaberInReach(2216, -1, 2240), false)
  assert.equal(isSaberInReach(2150, 1, 2240), false)
  assert.equal(formatKeyCode('KeyZ'), 'Z')
  assert.equal(formatKeyCode('Space'), 'SPACE')
  assert.deepEqual(
    (['jump', 'dash', 'wall_jump', 'charge', 'saber'] as const).map((input) => roomLockKeyHint(input, DEFAULT_BINDINGS)),
    ['JUMP: SPACE', 'DASH: Z', 'WALL: JUMP OFF THE WALL', 'HOLD X TO CHARGE', 'SABER: C']
  )
  assert.equal(roomLockKeyHint('dash', { ...DEFAULT_BINDINGS, dash: ['ShiftLeft'] }), 'DASH: SHIFTLEFT')
  const tall: RoomLockDefinition = { ...DASH_LOCK, id: 't', room: { x: 896, y: -252, width: 448, height: 504 }, gateX: 1344 }
  const defs = [DASH_LOCK, tall]
  const states = defs.map(createRoomLockState)
  assert.equal(findRoomIndex(defs, 500), 0)
  assert.equal(resolveCameraRoomIndex(defs, states, 500, 252), -1, 'a dormant room does not hold the camera')
  assert.equal(resolveCameraRoomIndex(defs, [armRoomLock(states[0]), states[1]], 500, 252), 0)
  assert.equal(resolveCameraRoomIndex(defs, states, 1000, 252), 1, 'the tall shaft holds the camera while the player is inside')
})

test('tutorial: six screens, five teach locks in order, checkpoints at start and after the shaft', () => {
  const stage = getCampaignStage(TUTORIAL_STAGE_ID)
  const report = getStageContentRetentionReport(TUTORIAL_STAGE_ID)
  assert.equal(report?.routeWidth, 2688)
  const locks = stage.arena.roomLocks ?? []
  assert.deepEqual(locks.map((lock) => lock.requiredInput), ['jump', 'dash', 'wall_jump', 'charge', 'saber'])
  locks.forEach((lock, index) => {
    assert.equal(lock.room.x, index * 448)
    assert.equal(lock.gateX, (index + 1) * 448)
  })
  assert.ok(locks[2].room.height >= 2 * 252, 'the wall-kick shaft is two screens tall')
  assert.equal(locks[4].hitsRequired, 3)
  const walls = stage.arena.midPlatforms.filter((platform) => platform.type === 'wall')
  assert.ok(walls.length >= 2 && walls.every((wall) => wall.x > 896 && wall.x < 1344), 'two wall faces inside the shaft')
  assert.deepEqual(stage.arena.checkpoints.map((entry) => entry.id), ['tutorial_start', 'tutorial_shaft_exit', 'tutorial_boss_gate'])
  assert.ok(stage.arena.checkpoints[1].x > 1344 && stage.arena.checkpoints[1].x < 1792)
  assert.ok(stage.enemyMarkers.some((enemy) => enemy.typeKey === 'enemy_armored_bot' && enemy.x > 1344 && enemy.x < 1792))
  assert.equal(stage.arena.bossRoom.x, 2688)
})
