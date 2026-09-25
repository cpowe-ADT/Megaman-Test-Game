import test from 'node:test'
import assert from 'node:assert/strict'
import { mainGroundPlatforms, splitMainGround, stageVerticalTop } from '../src/stage/stageGeometry.ts'
import { applyRoomLockDefeats, applyRoomLockInput, armRoomLock, createRoomLockState, isDefeatLock, type RoomLockDefinition } from '../src/mechanics/roomLock.ts'
import { getCampaignStage, getStageContentRetentionReport, MECHANICS_LAB_STAGE_ID, TUTORIAL_STAGE_ID } from '../src/content/campaign.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'
import { resolveHazard } from '../src/mechanics/hazards.ts'
import { HEAT_WORKS_MIDBOSS_MARKERS } from '../src/content/stages/heatWorks.ts'

// Measured on this build (output/measure-jump.mjs, 2026-09-24): held running jump 246px across, 124-127px up;
// held dash jump 336px across. A gap is "plain" if a running jump clears it with a body width to spare.
const PLAIN_JUMP_PX = 246
const DASH_JUMP_PX = 336
const MAX_RISE_PX = 127
const BODY_PX = 16
const FLOOR = 236

test('floor gaps split the main ground: clipped, merged, sorted, the first span keeps the old id', () => {
  assert.deepEqual(splitMainGround(1000), [{ x: 0, width: 1000 }])
  assert.deepEqual(splitMainGround(1000, [{ x: 600, width: 50 }, { x: 100, width: 100 }, { x: 180, width: 40 }, { x: 980, width: 64 }]), [
    { x: 0, width: 100 },
    { x: 220, width: 380 },
    { x: 650, width: 330 }
  ])
  assert.deepEqual(splitMainGround(500, [{ x: -20, width: 40 }]), [{ x: 20, width: 480 }])
  const strips = mainGroundPlatforms('s', 1000, 252, [{ x: 400, width: 100 }])
  assert.deepEqual(strips.map((strip) => [strip.id, strip.x, strip.y, strip.width, strip.height]), [
    ['s_main_ground', 200, 244, 400, 16],
    ['s_main_ground_2', 750, 244, 500, 16]
  ])
})

test('a stage world reaches up to its tallest room; one-screen stages stay at 0', () => {
  assert.equal(stageVerticalTop(getCampaignStage('pyro_maw').arena, 252), -252)
  assert.equal(stageVerticalTop(getCampaignStage(TUTORIAL_STAGE_ID).arena, 252), -252)
  assert.equal(stageVerticalTop(getCampaignStage('tide_reaver').arena, 252), 0)
})

test('a defeat lock opens only once every marker is gone, counts markers cleared before arming, ignores verbs', () => {
  const lock: RoomLockDefinition = { id: 'fight', room: { x: 0, y: 0, width: 448, height: 252 }, gateX: 448, defeatMarkers: ['a', 'b', 'b'] }
  assert.equal(isDefeatLock(lock), true)
  let state = createRoomLockState(lock)
  assert.deepEqual([state.requiredInput, state.hitsRequired, state.remainingMarkers], [null, 2, ['a', 'b']])
  assert.equal(applyRoomLockDefeats(state, ['a', 'b']), state, 'a dormant lock does not count')
  state = armRoomLock(state)
  assert.equal(applyRoomLockInput(state, 'jump'), state, 'no verb opens a fight room')
  state = applyRoomLockDefeats(state, new Set(['a', 'other']))
  assert.deepEqual([state.phase, state.progress, state.remainingMarkers], ['locked', 1, ['b']])
  state = applyRoomLockDefeats(state, ['a', 'b'])
  assert.deepEqual([state.phase, state.satisfied, state.remainingMarkers], ['open', true, []])
  const verb = armRoomLock(createRoomLockState({ id: 'v', room: lock.room, gateX: 448, requiredInput: 'dash' }))
  assert.equal(applyRoomLockDefeats(verb, ['a']), verb, 'a verb lock ignores defeats')
})

test('Heat Works pickups sit on their anchors; ids are unchanged and other stages keep their defaults', () => {
  const byCategory = Object.fromEntries(getStageLocationDefinitions('pyro_maw').map((entry) => [entry.category, entry]))
  assert.deepEqual([byCategory.heart_tank.id, byCategory.heart_tank.x, byCategory.heart_tank.y], ['pyro_maw:heart_tank', 1284, 68])
  assert.deepEqual([byCategory.sub_tank.x, byCategory.capsule.y, byCategory.pickup_bonus.x], [2500, -212, 4680])
  const tide = getStageLocationDefinitions('tide_reaver').find((entry) => entry.category === 'heart_tank')
  assert.equal(tide?.y, 132)
})

test('Heat Works route: twelve screens, four checkpoints clear of every mechanic, pits a plain jump clears', () => {
  const stage = getCampaignStage('pyro_maw')
  const { arena } = stage
  assert.equal(getStageContentRetentionReport('pyro_maw')?.routeWidth, 12 * 448)
  assert.equal(arena.allowFallOff, true)
  assert.deepEqual(arena.checkpoints.map((entry) => entry.id), ['pyro_start', 'pyro_mid_a', 'pyro_mid_b', 'pyro_boss_gate'])
  assert.equal(arena.checkpoints[1].radioSequenceId, 'pyro_maw_radio')
  const gaps = arena.floorGaps ?? []
  assert.ok(gaps.length >= 3)
  for (const gap of gaps) assert.ok(gap.width + BODY_PX <= PLAIN_JUMP_PX - 48, `pit at ${gap.x} is ${gap.width}px`)
  const vents = arena.hazards.map(resolveHazard)
  const solids = arena.midPlatforms.filter((platform) => platform.type === 'solid' || platform.type === 'wall')
  const slag = arena.risingLiquids ?? []
  const crumbles = (arena.crumbleGroups ?? []).flatMap((group) => group.platforms)
  for (const entry of arena.checkpoints) {
    for (const x of [entry.x, entry.triggerX + 8]) {
      assert.ok(!vents.some((vent) => Math.abs(vent.x - x) < vent.width / 2 + 24), `${entry.id} clear of vents`)
      assert.ok(!slag.some((liquid) => x >= liquid.x - 16 && x <= liquid.x + liquid.width + 16), `${entry.id} clear of slag`)
      assert.ok(!crumbles.some((platform) => Math.abs(platform.x - x) < platform.width / 2 + 16), `${entry.id} clear of crumbles`)
      // On the open floor: respawn and the debug warps place the hero at y 214 (feet on the ground).
      assert.ok(!gaps.some((gap) => x >= gap.x - 8 && x <= gap.x + gap.width + 8), `${entry.id} not over a pit`)
      assert.ok(!solids.some((block) => Math.abs(block.x - x) < block.width / 2 + 8 && block.y + (block.height ?? 8) / 2 > FLOOR - 40), `${entry.id} not in a block`)
    }
  }
})

test('Heat Works secrets: the heart needs a dash jump, the sub tank is behind the breakable wall, the capsule tops the climb', () => {
  const { arena } = getCampaignStage('pyro_maw')
  const ledge = (id: string) => {
    const platform = arena.midPlatforms.find((entry) => entry.id === id)
    assert.ok(platform, id)
    return { left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - (platform.height ?? 8) / 2 }
  }
  const launch = ledge('pyro_heart_launch')
  const heart = ledge('pyro_heart_ledge')
  const gap = heart.left - launch.right
  assert.equal(launch.top, heart.top)
  assert.ok(gap > PLAIN_JUMP_PX + BODY_PX + 16 && gap < DASH_JUMP_PX - 24, `heart gap ${gap}px`)
  assert.ok(FLOOR - heart.top > MAX_RISE_PX + 6, 'the floor under the heart is out of jump reach')
  assert.ok((arena.verticalSegments ?? []).some((segment) => launch.left >= segment.x && heart.right <= segment.x + segment.width), 'the heart room is tall')
  const anchors = arena.locationAnchors ?? {}
  assert.ok(anchors.heart_tank && anchors.heart_tank.x > heart.left && anchors.heart_tank.x < heart.right)
  // A held jump from the floor puts the hero's head (22px body) at 236 - 127 - 22 = 87: under the pickup.
  assert.ok(anchors.heart_tank.y + 12 < FLOOR - MAX_RISE_PX - 22, 'the heart cannot be grabbed from the floor')
  const wall = (arena.breakableWalls ?? [])[0]
  assert.ok(wall && anchors.sub_tank && anchors.sub_tank.x > wall.x && (wall.minChargeLevel ?? 0) >= 1)
  const climb = (arena.risingLiquids ?? [])[0]
  assert.ok(climb && anchors.capsule && anchors.capsule.y < climb.topY && anchors.capsule.x >= climb.x && anchors.capsule.x <= climb.x + climb.width)
  assert.equal(climb.riseMs, 14000)
})

test('Heat Works enemies: 18+ placements of the five brief types, each spawning off camera and retiring behind', () => {
  const stage = getCampaignStage('pyro_maw')
  const markers = stage.enemyMarkers
  assert.ok(markers.length >= 18)
  assert.deepEqual(
    [...new Set(markers.map((entry) => entry.typeKey))].sort(),
    ['enemy_armored_bot', 'enemy_drone', 'enemy_mine_bot', 'enemy_rocket_bot', 'enemy_slicer_bot']
  )
  for (const entry of markers) {
    assert.ok((entry.spawnTriggerX ?? 0) <= entry.x - 260, `${entry.id} spawns off camera`)
    assert.ok((entry.retireTriggerX ?? 0) > entry.x, `${entry.id} retires behind`)
    assert.ok(stage.arena.checkpoints.every((checkpoint) => Math.abs(checkpoint.x - entry.x) > 48), `${entry.id} is not on a checkpoint`)
  }
  const lock = (stage.arena.roomLocks ?? []).find((entry) => isDefeatLock(entry))
  assert.ok(lock)
  assert.deepEqual(lock.defeatMarkers, HEAT_WORKS_MIDBOSS_MARKERS)
  for (const id of HEAT_WORKS_MIDBOSS_MARKERS) {
    const entry = markers.find((marker) => marker.id === id)
    assert.ok(entry && entry.x > lock.room.x && entry.x < lock.gateX && (entry.retireTriggerX ?? 0) > lock.gateX, `${id} fights inside the room`)
  }
})

test('the mechanics lab keeps its own layout: no pits, no mid-boss lock, no hand-placed pickups', () => {
  const lab = getCampaignStage(MECHANICS_LAB_STAGE_ID).arena
  assert.deepEqual([lab.allowFallOff, lab.floorGaps, lab.roomLocks, lab.locationAnchors], [false, undefined, undefined, undefined])
})
