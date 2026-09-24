import test from 'node:test'
import assert from 'node:assert/strict'
import { stageMechanicPlatforms } from '../src/mechanics/stageMechanics.ts'
import { resolveCameraRoomIndex, verticalSegmentRoom } from '../src/mechanics/roomLock.ts'
import { resolveHazard } from '../src/mechanics/hazards.ts'
import { CAMPAIGN_STAGES, getCampaignStage, MECHANICS_LAB_STAGE_ID } from '../src/content/campaign.ts'
import { isInsideLiquid, risingLiquidSurfaceY } from '../src/mechanics/risingLiquid.ts'

test('crumbles and breakable walls enter the platform list (one-way crumbles, wall blocks)', () => {
  const platforms = stageMechanicPlatforms({
    crumbleGroups: [{ id: 'g', platforms: [{ id: 'c1', x: 10, y: 20, width: 30 }], type: 'solid' }, { id: 'h', platforms: [{ id: 'c2', x: 50, y: 20, width: 30 }] }],
    breakableWalls: [{ id: 'w', x: 100, y: 118, width: 16, height: 236 }]
  })
  assert.deepEqual(platforms.map((p) => [p.id, p.type, p.height]), [['c1', 'solid', 8], ['c2', 'oneWay', 8], ['w', 'wall', 236]])
})

test('a two-screen segment spans from the floor up two screens and holds the camera', () => {
  const room = verticalSegmentRoom({ id: 's', x: 896, width: 448, verticalScreens: 2 }, 252)
  assert.deepEqual(room, { x: 896, y: -252, width: 448, height: 504 })
  assert.equal(resolveCameraRoomIndex([{ room }], [{ phase: 'open' }], 1000, 252), 0)
  assert.equal(resolveCameraRoomIndex([{ room }], [{ phase: 'open' }], 1400, 252), -1)
})

test('mechanics_lab has one of each mechanic, is not a campaign stage, and its climb is escapable at full rise', () => {
  const lab = getCampaignStage(MECHANICS_LAB_STAGE_ID)
  assert.equal(lab.id, MECHANICS_LAB_STAGE_ID)
  assert.equal(MECHANICS_LAB_STAGE_ID in CAMPAIGN_STAGES, false)
  assert.equal(lab.enemyMarkers.length, 0)
  const kinds = lab.arena.hazards.map((hazard) => resolveHazard(hazard).kind)
  assert.deepEqual(kinds, ['spikes', 'vent', 'vent'])
  assert.equal(lab.arena.risingLiquids?.length, 1)
  assert.equal(lab.arena.crumbleGroups?.[0].platforms.length, 2)
  assert.equal(lab.arena.breakableWalls?.length, 2)
  assert.equal(lab.arena.verticalSegments?.[0].verticalScreens, 2)
  assert.ok(lab.arena.checkpoints.every((checkpoint) => checkpoint.x < lab.arena.bossRoom.x))
  const slag = lab.arena.risingLiquids![0]
  const top = risingLiquidSurfaceY(slag, slag.riseMs)
  const topStep = lab.arena.midPlatforms.filter((p) => p.id.startsWith('lab_climb_')).sort((a, b) => a.y - b.y)[0]
  const feet = topStep.y - (topStep.height ?? 8) / 2
  assert.equal(isInsideLiquid(slag, top, { left: topStep.x - 8, right: topStep.x + 8, bottom: feet }), false, 'the top step stays dry')
})

test('pyro_maw hazards keep their spike defaults (no stage layout changed)', () => {
  assert.ok(getCampaignStage('pyro_maw').arena.hazards.every((hazard) => resolveHazard(hazard).kind === 'spikes'))
})
