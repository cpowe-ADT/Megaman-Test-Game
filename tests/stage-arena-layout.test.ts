import test from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStage, getRobotMasterStages, FINAL_STAGE_ID, TUTORIAL_STAGE_ID } from '../src/content/campaign'
import {
  buildDefaultBossRoom,
  clampBossXToBounds,
  getBossRoomCameraBounds,
  getBossRoomMovementBounds
} from '../src/content/stageArenaLayout'

test('default boss rooms lock to the final visible screen', () => {
  const stageIds = [TUTORIAL_STAGE_ID, ...getRobotMasterStages().map((stage) => stage.id), FINAL_STAGE_ID]

  stageIds.forEach((stageId) => {
    const stage = getCampaignStage(stageId)
    assert.equal(stage.arena.bossRoom.width, 448)
    assert.equal(stage.arena.bossRoom.x, stage.arena.width! - 448)
    assert.equal(stage.arena.background.layers.length > 0, true)
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
