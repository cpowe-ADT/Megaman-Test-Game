import test from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStage, getStageContentRetentionReport } from '../src/content/campaign.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'
import { resolveHazard } from '../src/mechanics/hazards.ts'
import { isDefeatLock } from '../src/mechanics/roomLock.ts'
import { crumbleTiming } from '../src/mechanics/crumbleGroup.ts'
import {
  createRisingLiquidState,
  isRisingLiquidTripped,
  resetRisingLiquid,
  stepRisingLiquid,
  type RisingLiquidDefinition
} from '../src/mechanics/risingLiquid.ts'
import { DRILL_SERPENT_TUNING } from '../src/enemy/drillSerpent.ts'
import { MIRE_WRAITH_MIDBOSS_MARKERS } from '../src/content/stages/mireWraith.ts'

// Measured on this build (Heat Works, output/measure-jump.mjs, 2026-09-24): held running jump 246px across,
// 124-127px up; held dash jump 336px across; run speed 220px/s (src/player/config.ts).
const PLAIN_JUMP_PX = 246
const DASH_JUMP_PX = 336
const MAX_RISE_PX = 127
const RUN_PX_PER_S = 220
const BODY_PX = 16
const FLOOR = 236
const STAGE = 'mire_wraith'
const FAMILIES = ['enemy_bouncer', 'enemy_drone', 'enemy_fly_trap', 'enemy_mine_bot', 'enemy_shield_drone']

type Rect = { left: number; right: number; top: number; bottom: number }
const rectOf = (entry: { x: number; y: number; width: number; height?: number }): Rect => {
  const height = entry.height ?? 8
  return { left: entry.x - entry.width / 2, right: entry.x + entry.width / 2, top: entry.y - height / 2, bottom: entry.y + height / 2 }
}
const platform = (id: string) => {
  const entry = getCampaignStage(STAGE).arena.midPlatforms.find((candidate) => candidate.id === id)
  assert.ok(entry, id)
  return { ...rectOf(entry), type: entry.type }
}

test('rising liquid switch: only touching the switch box starts the rise, from any side; the respawn re-arms it', () => {
  const acid: RisingLiquidDefinition = {
    id: 'acid', x: 100, width: 300, floorY: 276, topY: -130, riseMs: 14000, triggerX: 150,
    switchBox: { x: 200, y: 188, width: 16, height: 96 }
  }
  const away = { left: 120, right: 136, top: 214, bottom: 236 }
  const onPlate = { left: 190, right: 206, top: 214, bottom: 236 }
  let state = createRisingLiquidState(acid)
  state = stepRisingLiquid(acid, state, { heroX: 160, prevHeroX: 140, deltaMs: 16, hero: away })
  assert.equal(state.phase, 'dormant', 'crossing triggerX does nothing when there is a switch')
  assert.equal(isRisingLiquidTripped(acid, { heroX: 200, prevHeroX: 190 }), false, 'no hero box, no trip')
  assert.equal(isRisingLiquidTripped(acid, { heroX: 200, prevHeroX: 200, hero: { left: 192, right: 208, top: 100, bottom: 140 } }), false, 'over the box, not in it')
  assert.equal(isRisingLiquidTripped(acid, { heroX: 200, prevHeroX: 200, hero: { left: 192, right: 208, top: 120, bottom: 142 } }), true, 'touching its top edge')
  assert.equal(isRisingLiquidTripped(acid, { heroX: 215, prevHeroX: 230, hero: { left: 207, right: 223, top: 214, bottom: 236 } }), true, 'walking in from the right')
  state = stepRisingLiquid(acid, state, { heroX: 198, prevHeroX: 198, deltaMs: 16, hero: onPlate })
  assert.deepEqual([state.phase, state.elapsedMs, state.surfaceY], ['rising', 0, 276], 'the trip frame starts the rise from the floor')
  state = stepRisingLiquid(acid, state, { heroX: 120, prevHeroX: 198, deltaMs: 7000, hero: away })
  assert.deepEqual([state.phase, state.surfaceY], ['rising', 73], 'leaving the plate does not stop it (halfway at 7s)')
  state = stepRisingLiquid(acid, state, { heroX: 120, prevHeroX: 120, deltaMs: 7000, hero: away })
  assert.deepEqual([state.phase, state.surfaceY], ['full', -130])
  state = resetRisingLiquid(acid)
  assert.equal(state.phase, 'dormant')
  assert.equal(stepRisingLiquid(acid, state, { heroX: 300, prevHeroX: 100, deltaMs: 16, hero: away }).phase, 'dormant', 're-armed: only the plate trips it again')
  // Without a switch the Heat Works crossing rule is unchanged.
  const slag = { ...acid, switchBox: undefined }
  assert.equal(stepRisingLiquid(slag, createRisingLiquidState(slag), { heroX: 150, prevHeroX: 149, deltaMs: 16 }).phase, 'rising')
})

test('Medicine District route: twelve screens, four checkpoints clear of every mechanic, pits a plain jump clears', () => {
  const { arena } = getCampaignStage(STAGE)
  assert.equal(getStageContentRetentionReport(STAGE)?.routeWidth, 12 * 448)
  assert.equal(arena.allowFallOff, true)
  assert.deepEqual(arena.checkpoints.map((entry) => entry.id), ['mire_start', 'mire_mid_a', 'mire_mid_b', 'mire_boss_gate'])
  assert.equal(arena.checkpoints[1].radioSequenceId, 'mire_wraith_radio')
  const gaps = arena.floorGaps ?? []
  assert.ok(gaps.length >= 3 && arena.hazards.length >= 8, `${gaps.length} pits, ${arena.hazards.length} hazards`)
  for (const gap of gaps) assert.ok(gap.width + BODY_PX <= PLAIN_JUMP_PX - 48, `pit at ${gap.x} is ${gap.width}px`)
  const hazards = arena.hazards.map(resolveHazard)
  const solids = arena.midPlatforms.filter((entry) => entry.type === 'solid' || entry.type === 'wall')
  const liquids = arena.risingLiquids ?? []
  const crumbles = (arena.crumbleGroups ?? []).flatMap((group) => group.platforms)
  for (const entry of arena.checkpoints) {
    for (const x of [entry.x, entry.triggerX + 8]) {
      assert.ok(!hazards.some((hazard) => Math.abs(hazard.x - x) < hazard.width / 2 + 24), `${entry.id} clear of hazards`)
      assert.ok(!liquids.some((liquid) => x >= liquid.x - 16 && x <= liquid.x + liquid.width + 16), `${entry.id} clear of the acid`)
      assert.ok(!crumbles.some((plank) => Math.abs(plank.x - x) < plank.width / 2 + 16), `${entry.id} clear of crumbles`)
      assert.ok(!gaps.some((gap) => x >= gap.x - 8 && x <= gap.x + gap.width + 8), `${entry.id} not over a pit`)
      assert.ok(!solids.some((block) => Math.abs(block.x - x) < block.width / 2 + 8 && block.y + (block.height ?? 8) / 2 > FLOOR - 40), `${entry.id} not in a block`)
    }
  }
  // Crumble walkways lie over acid pits at floor height, and a run crosses each plank before it drops.
  for (const group of (arena.crumbleGroups ?? []).filter((entry) => entry.id.endsWith('_walkway'))) {
    const { shakeMs } = crumbleTiming(group)
    for (const plank of group.platforms) {
      const box = rectOf(plank)
      assert.ok(gaps.some((gap) => box.left >= gap.x && box.right <= gap.x + gap.width), `${plank.id} over a pit`)
      assert.equal(box.top, FLOOR, `${plank.id} at floor height`)
      assert.ok(((plank.width + BODY_PX) / RUN_PX_PER_S) * 1000 < shakeMs, `${plank.id} is underfoot less than ${shakeMs}ms at a run`)
    }
  }
})

test('Medicine District filter tower: every way up passes the switch plate; the acid tops out under the exit ledge', () => {
  const { arena } = getCampaignStage(STAGE)
  const tower = (arena.verticalSegments ?? []).find((segment) => segment.id === 'mire_filter_tower')
  assert.ok(tower && tower.verticalScreens === 2)
  const acid = (arena.risingLiquids ?? []).find((entry) => entry.id === 'mire_acid')
  assert.ok(acid?.switchBox, 'the acid has a filter switch')
  const plate = rectOf(acid.switchBox)
  const hatch = platform('mire_tower_hatch')
  const hatchFace = platform('mire_tower_hatch_face')
  const entrance = platform('mire_tower_wall_left')
  // The hatch runs from above the tower's top down to the plate's top; the plate fills the opening to the floor.
  assert.ok(hatch.top <= 252 - 2 * 252 && hatchFace.top <= hatch.top, 'no way over the hatch')
  assert.deepEqual([plate.left, plate.right, plate.top, plate.bottom], [hatch.left, hatchFace.right, hatch.bottom, FLOOR], 'the plate fills the hatch opening')
  assert.ok(entrance.left >= tower.x && hatchFace.right < tower.x + tower.width, 'pre-chamber and hatch inside the tower')
  assert.ok(acid.x === entrance.right && acid.x + acid.width === platform('mire_tower_wall_right').left, 'the acid fills the tower wall to wall')
  // The pre-chamber's faces take no wall kicks (only the shaft's hatch face and right wall do).
  assert.deepEqual([entrance.type, hatch.type, hatchFace.type, platform('mire_tower_wall_right').type], ['solid', 'solid', 'wall', 'wall'])
  const exit = platform('mire_climb_9')
  assert.ok(acid.topY - exit.top >= 16 && platform('mire_tower_wall_right').top === exit.top, 'the acid stops under the exit ledge; the exit clears the right wall')
})

test('Medicine District secrets: the sub tank needs a dash jump before the acid, the heart is behind the crate wall, the capsule on the route', () => {
  const { arena } = getCampaignStage(STAGE)
  const anchors = arena.locationAnchors ?? {}
  const acid = (arena.risingLiquids ?? [])[0]
  const step = platform('mire_tower_step')
  const launch = platform('mire_tower_launch')
  const ledge = platform('mire_tower_subtank')
  const gap = ledge.left - launch.right
  assert.equal(launch.top, ledge.top)
  assert.ok(gap > PLAIN_JUMP_PX + BODY_PX + 16 && gap < DASH_JUMP_PX - 24, `sub tank gap ${gap}px`)
  assert.ok(FLOOR - ledge.top > MAX_RISE_PX + 6, 'the floor under the sub tank is out of jump reach')
  assert.ok(FLOOR - step.top < MAX_RISE_PX - 8 && step.top - launch.top < MAX_RISE_PX - 8, 'floor to step to launch ledge on plain jumps')
  assert.ok(ledge.left - step.right > PLAIN_JUMP_PX - 24, 'the step is no plain-jump shortcut')
  const sub = anchors.sub_tank
  // Part 13e: the pickup sits on (not above) the ledge, so the ledge's own unreachability (line above) covers it.
  assert.ok(sub && sub.x > ledge.left && sub.x < ledge.right && sub.y < ledge.top, 'on the ledge, not from the floor')
  // Below the acid line, left of the switch: reached before the trip; the acid covers the ledge about 6s after it.
  assert.ok(acid?.switchBox && sub.y > acid.topY && sub.x >= acid.x && sub.x < acid.switchBox.x - acid.switchBox.width / 2)
  const coveredMs = ((acid.floorY - ledge.top) / (acid.floorY - acid.topY)) * acid.riseMs
  assert.ok(coveredMs > 5000, `the sub tank ledge goes under ${Math.round(coveredMs)}ms after the trip`)
  const wall = (arena.breakableWalls ?? []).find((entry) => entry.id === 'mire_crate_wall')
  const roof = platform('mire_crate_roof')
  const bulkhead = platform('mire_crate_bulkhead')
  assert.ok(wall && (wall.minChargeLevel ?? 0) >= 1 && (wall.hitsRequired ?? 3) >= 1)
  const box = rectOf(wall)
  assert.ok(roof.left <= box.left && roof.right >= bulkhead.left && box.top <= roof.bottom && box.bottom >= FLOOR, 'the crate room is sealed')
  assert.ok(anchors.heart_tank && anchors.heart_tank.x > box.right && anchors.heart_tank.x < bulkhead.left && anchors.heart_tank.y > roof.bottom)
  const crateA = platform('mire_capsule_crate_a')
  const crateB = platform('mire_capsule_crate_b')
  const capsule = anchors.capsule
  assert.ok(capsule && capsule.x > crateA.right && capsule.x < crateB.left && capsule.y > FLOOR - 30, 'the capsule sits in the dip between the crates')
  assert.ok(capsule.x >= 3 * 448 && capsule.x < 5 * 448, 'in the escalate segment')
})

test('Medicine District pickups sit on their anchors with the usual ids', () => {
  const byCategory = Object.fromEntries(getStageLocationDefinitions(STAGE).map((entry) => [entry.category, entry]))
  const anchors = getCampaignStage(STAGE).arena.locationAnchors ?? {}
  for (const category of ['capsule', 'heart_tank', 'sub_tank', 'pickup_bonus'] as const) {
    assert.deepEqual([byCategory[category].id, byCategory[category].x, byCategory[category].y], [`${STAGE}:${category}`, anchors[category]?.x, anchors[category]?.y])
  }
})

test('Medicine District enemies: 18+ of the five brief families and the drill serpent, spawning 448px ahead, the locked room', () => {
  const stage = getCampaignStage(STAGE)
  const markers = stage.enemyMarkers
  const route = markers.filter((entry) => entry.typeKey !== 'drill_serpent')
  assert.ok(route.length >= 18, `${route.length} placements`)
  assert.deepEqual([...new Set(route.map((entry) => entry.typeKey))].sort(), FAMILIES)
  for (const entry of markers) {
    assert.ok((entry.spawnTriggerX ?? 0) <= entry.x - 448, `${entry.id} spawns a screen ahead`)
    assert.ok((entry.retireTriggerX ?? 0) > entry.x, `${entry.id} retires behind`)
    assert.ok(stage.arena.checkpoints.every((checkpoint) => Math.abs(checkpoint.x - entry.x) > 48), `${entry.id} is not on a checkpoint`)
  }
  const lock = (stage.arena.roomLocks ?? []).find((entry) => isDefeatLock(entry))
  assert.ok(lock)
  assert.deepEqual(lock.defeatMarkers, MIRE_WRAITH_MIDBOSS_MARKERS)
  for (const id of MIRE_WRAITH_MIDBOSS_MARKERS) {
    const entry = markers.find((marker) => marker.id === id)
    assert.ok(entry && entry.typeKey === 'drill_serpent')
    assert.ok(entry.x > lock.room.x && entry.x < lock.gateX && (entry.retireTriggerX ?? 0) > lock.gateX, `${id} fights inside the room`)
    assert.ok((entry.patrolMinX ?? 0) > lock.room.x && (entry.patrolMaxX ?? Infinity) < lock.gateX, `${id} tunnels between the room's walls`)
    assert.ok(entry.x - lock.room.x >= DRILL_SERPENT_TUNING.aggroRangeX, `${id} wakes as the hero enters, not before`)
  }
  assert.ok(!(stage.arena.floorGaps ?? []).some((gap) => gap.x < lock.gateX && gap.x + gap.width > lock.room.x), 'the room floor is whole')
})
