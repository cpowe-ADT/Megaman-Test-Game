import test from 'node:test'
import assert from 'node:assert/strict'
import {
  FINAL_STAGE_ID,
  GROUNDED_PLAYER_SPAWN_Y,
  TUTORIAL_STAGE_ID,
  getCampaignStage,
  getRobotMasterStages,
  getStageContentRetentionReport
} from '../src/content/campaign'
import {
  buildDefaultBossRoom,
  clampBossXToBounds,
  getBossRoomCameraBounds,
  getBossRoomMovementBounds
} from '../src/content/stageArenaLayout'
import { GAMEPLAY_ACTOR_CEILING, getGameplayWorldBounds } from '../src/config/gameplayLayout'
import { REBUILT_STAGE_PATCHES } from '../src/content/stages/index'

test('default boss rooms lock to the final visible screen', () => {
  const stageIds = [TUTORIAL_STAGE_ID, ...getRobotMasterStages().map((stage) => stage.id), FINAL_STAGE_ID]

  stageIds.forEach((stageId) => {
    const stage = getCampaignStage(stageId)
    assert.equal(stage.arena.bossRoom.width, 448)
    assert.equal(stage.arena.bossRoom.x, stage.arena.width! - 448)
    assert.equal(stage.arena.background.layers.length > 0, true)
  })
})

test('every stage reserves a boss room after retaining its complete authored route', () => {
  const stageIds = [TUTORIAL_STAGE_ID, ...getRobotMasterStages().map((stage) => stage.id), FINAL_STAGE_ID]

  stageIds.forEach((stageId) => {
    const stage = getCampaignStage(stageId)
    const report = getStageContentRetentionReport(stageId)

    assert.ok(report)
    assert.deepEqual(report.retained, report.authored)
    assert.equal(report.worldWidth, report.routeWidth + 448)
    assert.equal(report.bossRoomX, report.routeWidth)
    assert.equal(stage.arena.spawn.y, GROUNDED_PLAYER_SPAWN_Y)
    stage.arena.checkpoints.forEach((checkpoint) => {
      assert.equal(checkpoint.y, GROUNDED_PLAYER_SPAWN_Y)
      assert.equal(checkpoint.x < stage.arena.bossRoom.x, true)
      assert.equal(checkpoint.triggerX < stage.arena.bossRoom.x, true)
    })
  })
})

test('robot-master routes retain intro, mid, pre-boss, and gate content budgets', () => {
  getRobotMasterStages().forEach((stage) => {
    const report = getStageContentRetentionReport(stage.id)
    assert.ok(report)
    assert.equal(report.routeWidth >= 928, true)
    // Rebuilt stages (12d registry) follow their briefs (start, after teach, after the mid-boss, before the gate); the rest keep five.
    assert.equal(report.retained.checkpoints >= (stage.id in REBUILT_STAGE_PATCHES ? 4 : 5), true)
    assert.equal(report.retained.enemies >= 6, true)
    assert.equal(report.retained.platforms >= 5, true)
    assert.equal(report.retained.hazards >= 3, true)
  })
})

test('boss room movement bounds keep wide-stage bosses inside the room instead of the viewport', () => {
  const bossRoom = buildDefaultBossRoom(928, { bossSpawnX: 844 })
  const movementBounds = getBossRoomMovementBounds(bossRoom)

  assert.deepEqual(movementBounds, { minX: 504, maxX: 904 })
  assert.equal(clampBossXToBounds(432, movementBounds), 504)
  assert.equal(clampBossXToBounds(880, movementBounds), 880)
  assert.equal(clampBossXToBounds(980, movementBounds), 904)
})

test('boss room camera bounds match the room rectangle', () => {
  const bossRoom = buildDefaultBossRoom(960, { bossSpawnX: 876 })

  assert.deepEqual(getBossRoomCameraBounds(bossRoom, 252), {
    x: 512,
    y: 0,
    width: 448,
    height: 252
  })
})

test('gameplay physics begins below the fixed HUD and retains the stage floor', () => {
  assert.deepEqual(getGameplayWorldBounds(928, 252), {
    x: 0,
    y: GAMEPLAY_ACTOR_CEILING,
    width: 928,
    height: 162
  })
})
