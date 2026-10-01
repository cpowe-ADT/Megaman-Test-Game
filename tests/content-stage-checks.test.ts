import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DASH_JUMP_DISTANCE_PX,
  checkBackdropCoversVertical,
  checkBossRoomInsideStage,
  checkCheckpointsOnFloor,
  checkHazardsOnSolid,
  checkPickupsGroundedOrFloat,
  checkReachability
} from '../scripts/content/stageChecks.mjs'

// GAME_HEIGHT (252) - MAIN_GROUND_HEIGHT (16), src/config/renderPolicy.ts, src/stage/stageGeometry.ts.
const FLOOR_TOP = 236
const ROUTE_WIDTH = 2000

test('checkReachability passes a pit exactly a dash-jump wide', () => {
  const arena = { floorGaps: [{ x: 500, width: DASH_JUMP_DISTANCE_PX }], midPlatforms: [] }
  assert.equal(checkReachability('t', arena, ROUTE_WIDTH).ok, true)
})

test('checkReachability fails a pit wider than a dash-jump with no bridging platform', () => {
  const arena = { floorGaps: [{ x: 500, width: DASH_JUMP_DISTANCE_PX + 40 }], midPlatforms: [] }
  const result = checkReachability('t', arena, ROUTE_WIDTH)
  assert.equal(result.ok, false)
  assert.equal(result.offenders.length, 1)
  assert.equal(result.offenders[0].widthPx, DASH_JUMP_DISTANCE_PX + 40)
})

test('checkReachability passes the same wide pit once a platform bridges it', () => {
  const gapWidth = DASH_JUMP_DISTANCE_PX + 40
  const arena = {
    floorGaps: [{ x: 500, width: gapWidth }],
    midPlatforms: [{ id: 'step', x: 500 + gapWidth / 2, y: FLOOR_TOP - 20, width: 40, height: 16, type: 'solid' }]
  }
  assert.equal(checkReachability('t', arena, ROUTE_WIDTH).ok, true)
})

test('checkCheckpointsOnFloor fails a checkpoint over open pit', () => {
  const arena = { floorGaps: [{ x: 400, width: 200 }], midPlatforms: [], checkpoints: [{ id: 'cp', x: 480, y: 214, triggerX: 460 }] }
  assert.equal(checkCheckpointsOnFloor('t', arena, ROUTE_WIDTH).ok, false)
})

test('checkCheckpointsOnFloor passes a checkpoint over solid ground', () => {
  const arena = { floorGaps: [], midPlatforms: [], checkpoints: [{ id: 'cp', x: 100, y: 214, triggerX: 80 }] }
  assert.equal(checkCheckpointsOnFloor('t', arena, ROUTE_WIDTH).ok, true)
})

test('checkPickupsGroundedOrFloat passes every campaign stage (the 13e rule; its verdict fixtures are in pickup-placement.test.ts)', () => {
  for (const stageId of ['tutorial_sentinel', 'pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin', 'omega_fortress']) {
    assert.deepEqual(checkPickupsGroundedOrFloat(stageId).offenders, [], stageId)
  }
})

test('checkHazardsOnSolid passes a floor-mounted vent (bottom edge on the main ground)', () => {
  const arena = {
    floorGaps: [],
    midPlatforms: [],
    hazards: [{ id: 'v', kind: 'vent', x: 100, y: FLOOR_TOP - 24, width: 16, height: 48, timing: { onMs: 1000, offMs: 1600 } }]
  }
  assert.equal(checkHazardsOnSolid('t', arena, ROUTE_WIDTH).ok, true)
})

test('checkHazardsOnSolid fails a hazard floating over a pit', () => {
  const arena = { floorGaps: [{ x: 0, width: ROUTE_WIDTH }], midPlatforms: [], hazards: [{ id: 'v', kind: 'spikes', x: 100, y: 200 }] }
  const result = checkHazardsOnSolid('t', arena, ROUTE_WIDTH)
  assert.equal(result.ok, false)
  assert.equal(result.offenders[0].id, 'v')
})

test('checkBackdropCoversVertical passes a flat one-screen stage with no layers', () => {
  const arena = { background: { baseColor: '#000', layers: [] } }
  assert.equal(checkBackdropCoversVertical(arena).ok, true)
})

test('checkBackdropCoversVertical fails a tall stage with no background layers', () => {
  const arena = { background: { baseColor: '#000', layers: [] }, verticalSegments: [{ id: 'v', x: 0, width: 448, verticalScreens: 2 }] }
  assert.equal(checkBackdropCoversVertical(arena).ok, false)
})

test('checkBackdropCoversVertical passes a tall stage once it has a layer (backdropLayerSpans always joins the upward copy)', () => {
  const arena = {
    background: { baseColor: '#000', layers: [{ key: 'sky', y: 100, scrollFactorX: 0.2 }] },
    verticalSegments: [{ id: 'v', x: 0, width: 448, verticalScreens: 2 }]
  }
  assert.equal(checkBackdropCoversVertical(arena).ok, true)
})

test('checkBossRoomInsideStage passes a room built from the world width', () => {
  assert.equal(checkBossRoomInsideStage({ bossRoom: { x: 1552, width: 448 } }, 2000).ok, true)
})

test('checkBossRoomInsideStage fails a room that overhangs the stage', () => {
  assert.equal(checkBossRoomInsideStage({ bossRoom: { x: 1600, width: 448 } }, 2000).ok, false)
})
