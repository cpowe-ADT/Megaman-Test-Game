import test from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStage, MECHANICS_LAB_STAGE_ID } from '../src/content/campaign.ts'
import { conveyorBox } from '../src/mechanics/conveyor.ts'
import { iceFloorBox } from '../src/mechanics/iceFloor.ts'
import { stageMechanicPlatforms } from '../src/mechanics/stageMechanics.ts'
import { resolveRailGroup } from '../src/mechanics/timedRailGroup.ts'
import { resolveWindZone } from '../src/mechanics/windZone.ts'
import { PLAYER_GAMEPLAY_CONFIG } from '../src/player/config.ts'
import { ICE_DASH_DISTANCE_SCALE } from '../src/player/environment.ts'

const lab = getCampaignStage(MECHANICS_LAB_STAGE_ID).arena
const FLOOR_TOP = 236

test('mechanics_lab has each 12b mechanic on the route, belts and ice flush with the floor', () => {
  assert.deepEqual(
    [lab.conveyors?.length, lab.iceFloors?.length, lab.currentZones?.length, lab.timedRailGroups?.length, lab.rockfalls?.length, lab.icicles?.length],
    [2, 1, 1, 1, 1, 1]
  )
  const winds = (lab.windZones ?? []).map(resolveWindZone)
  assert.deepEqual(winds.map((wind) => `${wind.kind}:${wind.style}`), ['gust:wind', 'lift:wind', 'lift:magnet'])
  for (const belt of lab.conveyors ?? []) assert.equal(conveyorBox(belt).top, FLOOR_TOP, `${belt.id} top on the floor`)
  for (const ice of lab.iceFloors ?? []) assert.equal(iceFloorBox(ice).top, FLOOR_TOP, `${ice.id} top on the floor`)
  assert.deepEqual(new Set((lab.conveyors ?? []).map((belt) => Math.sign(belt.speed ?? 0))), new Set([1, -1]), 'one belt each way')
  const ids = stageMechanicPlatforms(lab).map((platform) => platform.id)
  assert.ok(['lab_belt_right', 'lab_belt_left', 'lab_ice'].every((id) => ids.includes(id)), 'belts and ice are platforms')
  const xs = [...(lab.conveyors ?? []).map((b) => b.x), ...(lab.iceFloors ?? []).map((i) => i.x), ...(lab.rockfalls ?? []).map((r) => r.x), ...(lab.icicles ?? []).map((i) => i.x)]
  assert.ok(xs.every((x) => x < lab.bossRoom.x), 'every 12b mechanic sits before the boss room')
})

test('mechanics_lab 12b placement: the ice holds a full ice dash and slide, lifts reach their ledges, drops hang under the ceiling', () => {
  const dash = (PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed * PLAYER_GAMEPLAY_CONFIG.dash.dashDurationMs) / 1000
  const ice = iceFloorBox(lab.iceFloors![0])
  assert.ok(ice.right - ice.left >= dash * ICE_DASH_DISTANCE_SCALE + 100, 'ice fits a dash from its left edge plus the slide')
  for (const lift of (lab.windZones ?? []).map(resolveWindZone).filter((wind) => wind.kind === 'lift')) {
    const ledge = lab.midPlatforms.find((platform) => platform.x > lift.rect.x + lift.rect.width && platform.x < lift.rect.x + lift.rect.width + 60 && platform.y < 100)
    assert.ok(ledge && ledge.y > lift.rect.y, `${lift.id} rises past a ledge (${ledge?.id})`)
    assert.equal(lift.rect.y + lift.rect.height, FLOOR_TOP, `${lift.id} starts at the floor`)
  }
  const ceiling = lab.midPlatforms.find((platform) => platform.id === 'lab_ceiling')!
  const ceilingBottom = ceiling.y + (ceiling.height ?? 8) / 2
  for (const drop of [...(lab.rockfalls ?? []).map((r) => ({ x: r.x, top: r.topY - 11 })), ...(lab.icicles ?? []).map((i) => ({ x: i.x, top: i.y }))]) {
    assert.ok(Math.abs(drop.x - ceiling.x) < ceiling.width / 2 && drop.top >= ceilingBottom, 'hangs under the ceiling')
  }
  assert.ok(lab.rockfalls![0].triggerX! < lab.rockfalls![0].x, 'the rockfall trigger comes before the boulder')
  assert.ok(resolveRailGroup(lab.timedRailGroups![0]).rails.every((rail) => rail.floorY === FLOOR_TOP))
  const drops = lab.checkpoints.find((checkpoint) => checkpoint.id === 'lab_drops')!
  assert.ok(drops.x < resolveRailGroup(lab.timedRailGroups![0]).rails[0].x - 28, 'the drops checkpoint is clear of the rails')
})
