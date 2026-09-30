import test from 'node:test'
import assert from 'node:assert/strict'
import { stageVerticalTop } from '../src/stage/stageGeometry.ts'
import { isDefeatLock } from '../src/mechanics/roomLock.ts'
import { getCampaignStage, getStageContentRetentionReport, type StagePlatformDefinition } from '../src/content/campaign.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'
import { resolveHazard, ventCycleAt } from '../src/mechanics/hazards.ts'
import { resolveRailGroup } from '../src/mechanics/timedRailGroup.ts'
import { resolveWindZone } from '../src/mechanics/windZone.ts'
import { wallBox } from '../src/mechanics/breakableWall.ts'
import {
  CONVEYOR_SHOT_BAND_PX,
  conveyorBox,
  conveyorCarryAt,
  conveyorCarryDeltaX,
  conveyorShotCarryAt,
  type ConveyorDefinition
} from '../src/mechanics/conveyor.ts'
import {
  FERRO_BLADE_MIDBOSS_MARKERS,
  FERRO_HALL_BAYS,
  FERRO_HALL_FLOOR_SPEED,
  FERRO_HALL_HOUSINGS,
  FERRO_HALL_UPPER_SPEED,
  FERRO_HEART_BELT_SPEED,
  FERRO_SWEEP_CYCLE_MS,
  FERRO_SWEEP_STEP_MS
} from '../src/content/stages/ferroBlade.ts'
import { stageScopedAtlases } from '../src/scenes/game/stageBackgroundLoading.ts'
import { GAMEPLAY_ACTOR_CEILING } from '../src/config/gameplayLayout.ts'

// Measured on this build (Heat Works, 2026-09-24): held running jump 246px across, 124-127px up; dash
// jump 336px across. The hero's body is 16x22. A dash jump off a belt keeps the belt's speed for its whole
// flight (`PlayerMotor.startDashJumpCarry`), about one second (the rise under 1050px/s^2 gravity, twice).
const PLAIN_JUMP_PX = 246
const DASH_JUMP_PX = 336
const MAX_RISE_PX = 127
const AIR_TIME_S = 2 * Math.sqrt((2 * MAX_RISE_PX) / 1050)
const BODY_PX = 16
/** Coyote time (100ms, `src/player/config.ts`) at the 220px/s run: a jump can leave this far past an edge. */
const COYOTE_PX = 22
const HALF_BODY_HEIGHT = 11
const FLOOR = 236
const SCREEN = 448

type Surface = { id: string; left: number; right: number; top: number; type: StagePlatformDefinition['type'] }
function surface(platform: StagePlatformDefinition): Surface {
  return { id: platform.id, left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - (platform.height ?? 8) / 2, type: platform.type }
}
function beltSurface(definition: ConveyorDefinition): Surface {
  const box = conveyorBox(definition)
  return { id: definition.id, left: box.left, right: box.right, top: box.top, type: definition.type ?? 'solid' }
}
const bottomOf = (platform: StagePlatformDefinition) => platform.y + (platform.height ?? 8) / 2

/** A jump arc (range `span`, rise `MAX_RISE_PX`) from `from`'s near edge lands on `to` if it clears `to`'s top over it. */
function canJumpOnto(from: Surface, to: Surface, span: number): boolean {
  const near = Math.max(0, to.left - from.right, from.left - to.right)
  const far = near + (to.right - to.left)
  if (near > span) return false
  const best = Math.min(Math.max(span / 2, near), Math.min(far, span))
  const riseAt = (d: number) => (4 * MAX_RISE_PX * d * (span - d)) / (span * span)
  return from.top - riseAt(best) < to.top - 2
}

const BELTS: ConveyorDefinition[] = [
  { id: 'right', x: 100, y: 206, width: 80, speed: 60 },
  { id: 'left', x: 300, y: 206, width: 80, speed: -90 }
]

test('12d conveyor: a shot skimming a belt rides it, in the belt\'s direction; a higher shot or one past its ends does not', () => {
  const shotAt = (x: number, y: number) => ({ left: x - 4, right: x + 4, top: y - 3, bottom: y + 3 })
  // Belt tops are y 200: a standing hero's buster fires about 10-16px over its feet.
  assert.deepEqual(conveyorShotCarryAt(BELTS, shotAt(100, 188)), { id: 'right', speed: 60 })
  assert.deepEqual(conveyorShotCarryAt(BELTS, shotAt(300, 199)), { id: 'left', speed: -90 })
  assert.deepEqual(conveyorShotCarryAt(BELTS, shotAt(100, 200 - CONVEYOR_SHOT_BAND_PX)), { id: 'right', speed: 60 }, 'the band edge rides')
  assert.deepEqual(conveyorShotCarryAt(BELTS, shotAt(100, 200 - CONVEYOR_SHOT_BAND_PX - 1)), { id: null, speed: 0 }, 'over the band: untouched')
  assert.deepEqual(conveyorShotCarryAt(BELTS, shotAt(100, 204)), { id: null, speed: 0 }, 'inside the belt body: not a skim')
  assert.deepEqual(conveyorShotCarryAt(BELTS, shotAt(141, 190)), { id: null, speed: 0 }, 'past the belt end')
  assert.deepEqual(conveyorShotCarryAt([], shotAt(100, 190)), { id: null, speed: 0 })
  // 50ms moves a shot 3px on the 60px/s belt and 4.5px back on the other; the rule is the actors' one.
  assert.equal(conveyorCarryDeltaX(conveyorShotCarryAt(BELTS, shotAt(100, 190)).speed, 50), 3)
  assert.equal(conveyorCarryDeltaX(conveyorShotCarryAt(BELTS, shotAt(300, 190)).speed, 50), -4.5)
  assert.deepEqual(conveyorCarryAt(BELTS, { left: 92, right: 108, top: 178, bottom: 200 }, true), { id: 'right', speed: 60 }, 'a standing body rides as before')
})

test('Transit Security route: thirteen screens, four checkpoints clear of every mechanic, pits a plain jump clears over the rail lines', () => {
  const { arena } = getCampaignStage('ferro_blade')
  assert.equal(getStageContentRetentionReport('ferro_blade')?.routeWidth, 13 * SCREEN)
  assert.equal(arena.allowFallOff, true)
  assert.equal(stageVerticalTop(arena, 252), -252, 'the heart room is two screens tall')
  assert.deepEqual(arena.checkpoints.map((entry) => entry.id), ['ferro_start', 'ferro_mid_a', 'ferro_mid_b', 'ferro_boss_gate'])
  assert.equal(arena.checkpoints[1].radioSequenceId, 'ferro_blade_radio')
  const gaps = arena.floorGaps ?? []
  assert.ok(gaps.length >= 3)
  for (const gap of gaps) assert.ok(gap.width + BODY_PX <= PLAIN_JUMP_PX - 48, `pit at ${gap.x} is ${gap.width}px`)
  const rails = (arena.timedRailGroups ?? []).map(resolveRailGroup)
  assert.ok(rails.every((group) => !group.live), 'the only rails are the sealed lines in the pits')
  for (const gap of gaps) {
    assert.ok(rails.flatMap((group) => group.rails).some((rail) => rail.x - rail.width / 2 === gap.x && rail.width === gap.width && rail.floorY === 252), `rails on the floor of the pit at ${gap.x}`)
  }
  const hazards = arena.hazards.map(resolveHazard)
  const bladeStrips = hazards.filter((hazard) => hazard.kind === 'spikes')
  const torches = hazards.filter((hazard) => hazard.kind === 'vent')
  assert.ok(bladeStrips.length >= 6 && torches.length >= 8 && hazards.length >= 8)
  const beltDefs = arena.conveyors ?? []
  const lifts = (arena.windZones ?? []).map(resolveWindZone)
  // The brief's mechanics: belts both ways, magnet lifts, blades on belts, the inspection station's lock.
  assert.ok(beltDefs.some((entry) => (entry.speed ?? 0) > 0) && beltDefs.some((entry) => (entry.speed ?? 0) < 0))
  assert.ok(lifts.length >= 3 && lifts.every((zone) => zone.kind === 'lift' && zone.style === 'magnet' && zone.timing === null))
  for (const zone of lifts) {
    const under = beltDefs.find((entry) => { const box = conveyorBox(entry); return box.top === zone.rect.y + zone.rect.height && box.left <= zone.rect.x && box.right >= zone.rect.x + zone.rect.width })
    const floorLift = zone.rect.y + zone.rect.height === FLOOR
    assert.ok(under && floorLift, `${zone.id} lifts the hero off a belt`)
  }
  for (const strip of bladeStrips) {
    assert.ok(beltDefs.some((entry) => { const box = conveyorBox(entry); return strip.x - strip.width / 2 >= box.left && strip.x + strip.width / 2 <= box.right && Math.abs(strip.y + strip.height / 2 - box.top) <= 2 }), `${strip.id} sits on a belt`)
  }
  assert.ok((arena.roomLocks ?? []).some(isDefeatLock))
  const solids = arena.midPlatforms.filter((platform) => platform.type === 'solid' || platform.type === 'wall')
  for (const entry of arena.checkpoints) {
    for (const x of [entry.x, entry.triggerX + 8]) {
      assert.ok(!hazards.some((hazard) => Math.abs(hazard.x - x) < hazard.width / 2 + 24), `${entry.id} clear of blades and torches`)
      assert.ok(!beltDefs.some((beltDef) => Math.abs(beltDef.x - x) < beltDef.width / 2 + 16), `${entry.id} clear of belts`)
      assert.ok(!lifts.some((zone) => x >= zone.rect.x - 16 && x <= zone.rect.x + zone.rect.width + 16), `${entry.id} clear of lifts`)
      assert.ok(!gaps.some((gap) => x >= gap.x - 8 && x <= gap.x + gap.width + 8), `${entry.id} not over a pit`)
      assert.ok(!solids.some((block) => Math.abs(block.x - x) < block.width / 2 + 8 && bottomOf(block) > FLOOR - 40), `${entry.id} not in a block`)
    }
  }
  // No belt feeds a pit: a belt's downstream end stays 32px+ from every pit rim.
  for (const entry of beltDefs) {
    const box = conveyorBox(entry)
    const end = (entry.speed ?? 0) > 0 ? box.right : box.left
    assert.ok(!gaps.some((gap) => end > gap.x - 32 && end < gap.x + gap.width + 32), `${entry.id} does not feed a pit`)
  }
  // Outside a tall room the world ceiling is y 90: every surface a hero stands on above it sits in the heart room.
  const tall = (arena.verticalSegments ?? []).filter((segment) => segment.verticalScreens >= 2)
  const inTall = (left: number, right: number) => tall.some((segment) => left >= segment.x && right <= segment.x + segment.width)
  for (const platform of [...arena.midPlatforms.map(surface), ...beltDefs.map(beltSurface)]) {
    if (platform.top - 2 * HALF_BODY_HEIGHT >= GAMEPLAY_ACTOR_CEILING) continue
    assert.ok(inTall(platform.left, platform.right), `${platform.id} (top ${platform.top}) rises past the actor ceiling outside a tall room`)
  }
  for (const zone of lifts) {
    if (inTall(zone.rect.x, zone.rect.x + zone.rect.width)) continue
    assert.ok(zone.rect.y - HALF_BODY_HEIGHT >= GAMEPLAY_ACTOR_CEILING, `${zone.id} holds the hero's head under the actor ceiling`)
  }
})

test('Transit Security master: a walled trimming hall; upper belts with the hero over floor belts against him, a magnet lift per bay, a cutter lane sweeping left to right', () => {
  const { arena } = getCampaignStage('ferro_blade')
  const byId = new Map(arena.midPlatforms.map((platform) => [platform.id, platform]))
  const housings = FERRO_HALL_HOUSINGS.map((_, index) => byId.get(`ferro_hall_housing_${index}`)!)
  for (const entry of housings) assert.ok(entry.type === 'wall' && bottomOf(entry) === 252, `${entry.id} is a wall standing on the ground`)
  const belts = new Map((arena.conveyors ?? []).map((entry) => [entry.id, entry]))
  const lifts = new Map((arena.windZones ?? []).map((zone) => [zone.id, resolveWindZone(zone)]))
  const hazards = arena.hazards.map(resolveHazard)
  assert.equal(FERRO_HALL_BAYS.length, housings.length - 1)
  for (const bay of FERRO_HALL_BAYS) {
    const left = surface(housings[bay.index])
    const right = surface(housings[bay.index + 1])
    const upper = beltSurface(belts.get(`ferro_hall_upper_${bay.index + 1}`)!)
    const lower = beltSurface(belts.get(`ferro_hall_floor_${bay.index + 1}`)!)
    assert.deepEqual([belts.get(`ferro_hall_upper_${bay.index + 1}`)!.speed, belts.get(`ferro_hall_floor_${bay.index + 1}`)!.speed], [FERRO_HALL_UPPER_SPEED, FERRO_HALL_FLOOR_SPEED], 'stacked in opposite directions')
    assert.ok(FERRO_HALL_UPPER_SPEED > 0 && FERRO_HALL_FLOOR_SPEED < 0)
    assert.deepEqual([upper.left, upper.top, lower.left, lower.right, lower.top], [left.right, left.top, left.right, right.left, FLOOR], 'the upper belt leaves the housing top level; the floor belt runs wall to wall')
    assert.ok(lower.top - (upper.top + 12) >= 2 * HALF_BODY_HEIGHT + 20, 'a hero walks the floor belt under the upper one')
    // The floor belt carries a hero who stands still into the blades at its downstream (left) end.
    assert.ok(hazards.some((hazard) => hazard.kind === 'spikes' && hazard.x - hazard.width / 2 === lower.left), `blades where floor belt ${bay.index + 1} ends`)
    // The magnet lift stands against the next housing's face (a hero walking into it is held in the column), past
    // a drop gap at the upper belt's end, and lifts the hero's feet over the housing top.
    const lift = lifts.get(`ferro_lift_hall_${bay.index + 1}`)!
    assert.ok(lift.rect.x - upper.right >= 2 * BODY_PX + 16 && lift.rect.x + lift.rect.width === right.left, 'a drop gap, then the lift against the housing face')
    assert.ok(lift.rect.y + HALF_BODY_HEIGHT < right.top - 16, 'the lift raises the feet over the next housing top')
    // The cutter lane: torches on the upper belt only, each firing FERRO_SWEEP_STEP_MS after the one to its left.
    const lane = hazards.filter((hazard) => hazard.kind === 'vent' && hazard.x > left.right && hazard.x < right.left).sort((a, b) => a.x - b.x)
    assert.ok(lane.length >= 3, `bay ${bay.index + 1} has a cutter lane`)
    const firing = (hazard: (typeof lane)[number], ms: number) => ventCycleAt(hazard.timing!, ms).phase === 'firing'
    /** The first time from `from` on that the torch starts firing. */
    const onset = (hazard: (typeof lane)[number], from: number) => {
      let ms = from
      while (!(firing(hazard, ms) && !firing(hazard, ms - 10))) ms += 10
      return ms
    }
    let previous = onset(lane[0], 0)
    for (const hazard of lane) {
      assert.ok(hazard.x - hazard.width / 2 > upper.left && hazard.x + hazard.width / 2 < upper.right && hazard.y + hazard.height / 2 === upper.top, `${hazard.id} fires from the upper belt`)
      assert.equal(hazard.timing!.onMs + hazard.timing!.offMs, FERRO_SWEEP_CYCLE_MS)
      if (hazard === lane[0]) continue
      const next = onset(hazard, previous)
      assert.equal(next - previous, FERRO_SWEEP_STEP_MS, `${hazard.id} fires ${FERRO_SWEEP_STEP_MS}ms after the torch to its left`)
      previous = next
    }
  }
})

test('Transit Security secrets: the heart past the wrong-way belt takes a dash jump against it, the sub tank is behind a breakable wall, the capsule is on the route after the mid-boss', () => {
  const { arena } = getCampaignStage('ferro_blade')
  const platforms = arena.midPlatforms.map(surface)
  const beltDefs = arena.conveyors ?? []
  const all = [...platforms, ...beltDefs.map(beltSurface)]
  const byId = new Map(all.map((entry) => [entry.id, entry]))
  const floor: Surface = { id: 'floor', left: -1e6, right: 1e6, top: FLOOR, type: 'solid' }
  const anchors = arena.locationAnchors ?? {}
  // Heart: the ledge sits 292px past the upstream end of a belt running back toward its step, 140px over the floor.
  const heart = byId.get('ferro_heart_ledge')!
  const wrongWay = beltDefs.find((entry) => entry.id === 'ferro_heart_belt')!
  const shelf = beltSurface(wrongWay)
  const step = byId.get('ferro_heart_step')!
  assert.equal(wrongWay.speed, FERRO_HEART_BELT_SPEED)
  assert.ok(FERRO_HEART_BELT_SPEED < 0 && heart.left > shelf.right, 'the belt runs away from the heart')
  assert.ok(heart.top === shelf.top && FLOOR - heart.top > MAX_RISE_PX, 'level with the belt, out of a floor jump')
  const gap = heart.left - shelf.right
  const dashAgainst = DASH_JUMP_PX - Math.abs(FERRO_HEART_BELT_SPEED) * AIR_TIME_S
  assert.ok(gap > PLAIN_JUMP_PX + BODY_PX + COYOTE_PX, `a plain jump off the belt falls short, coyote time included (${gap}px)`)
  assert.ok(gap + BODY_PX / 2 <= dashAgainst, `a dash jump against the belt from 16px before its end reaches it (${Math.round(dashAgainst)}px)`)
  assert.ok(canJumpOnto({ ...shelf, right: shelf.right }, heart, dashAgainst) && !canJumpOnto(shelf, heart, PLAIN_JUMP_PX + BODY_PX))
  for (const from of [floor, ...all.filter((entry) => entry.type !== 'wall' && entry.id !== heart.id && entry.id !== shelf.id)]) {
    for (const span of [PLAIN_JUMP_PX, DASH_JUMP_PX]) assert.ok(!canJumpOnto(from, heart, span), `the heart ledge is out of a ${span}px jump from ${from.id}`)
  }
  // The belt: only from its step (the floor is 140px under it).
  assert.ok(canJumpOnto(step, shelf, PLAIN_JUMP_PX) && !canJumpOnto(floor, shelf, DASH_JUMP_PX))
  assert.ok(anchors.heart_tank && anchors.heart_tank.x > heart.left && anchors.heart_tank.x < heart.right && anchors.heart_tank.y < heart.top)
  const room = (arena.verticalSegments ?? []).find((segment) => segment.id === 'ferro_heart_room')!
  assert.ok(room.verticalScreens === 2 && step.left >= room.x && heart.right <= room.x + room.width, 'step, belt and ledge are in the tall room')
  // Sub tank: the inspection office, sealed by the breakable wall (floor to roof), the roof and the bulkhead.
  const breakable = (arena.breakableWalls ?? []).find((entry) => entry.id === 'ferro_office_wall')!
  const box = wallBox(breakable)
  const roof = arena.midPlatforms.find((platform) => platform.id === 'ferro_office_roof')!
  const bulkhead = byId.get('ferro_office_bulkhead')!
  assert.ok((breakable.minChargeLevel ?? 0) >= 1 && breakable.hitsRequired >= 1, 'a charged shot breaks it')
  assert.deepEqual([box.bottom, box.top], [FLOOR, bottomOf(roof)], 'the wall runs floor to roof')
  assert.ok(surface(roof).left <= box.left && surface(roof).right === bulkhead.left && bulkhead.top <= surface(roof).top)
  assert.ok(anchors.sub_tank && anchors.sub_tank.x > box.right && anchors.sub_tank.x < bulkhead.left && anchors.sub_tank.y > bottomOf(roof))
  // Capsule: on the bulkhead the route crosses, past the inspection station's gate.
  const lock = (arena.roomLocks ?? [])[0]
  assert.ok(anchors.capsule && anchors.capsule.x > lock.gateX && anchors.capsule.x > bulkhead.left && anchors.capsule.x < bulkhead.right && anchors.capsule.y < bulkhead.top)
  const byCategory = Object.fromEntries(getStageLocationDefinitions('ferro_blade').map((entry) => [entry.category, entry]))
  assert.deepEqual([byCategory.heart_tank.id, byCategory.heart_tank.x, byCategory.heart_tank.y], ['ferro_blade:heart_tank', 2674, 80])
  assert.deepEqual([byCategory.sub_tank.x, byCategory.capsule.x, byCategory.capsule.y, byCategory.pickup_bonus.x], [3400, 3536, 152, 5008])
})

test('Transit Security enemies: 19+ placements of the six brief families and the Ferro nest, each spawning 448px+ ahead and retiring behind', () => {
  const stage = getCampaignStage('ferro_blade')
  const markers = stage.enemyMarkers
  const families = ['enemy_bouncer', 'enemy_frost_turret', 'enemy_gunner_bot', 'enemy_laser_eye', 'enemy_shield_drone', 'enemy_slicer_bot']
  assert.deepEqual([...new Set(markers.map((entry) => entry.typeKey))].sort(), [...families, 'relay_turret_nest_ferro'].sort())
  assert.ok(markers.filter((entry) => families.includes(entry.typeKey)).length >= 19)
  for (const family of families) assert.ok(markers.filter((entry) => entry.typeKey === family).length >= 2, `${family} appears more than once`)
  const signature = markers.filter((entry) => entry.typeKey === 'enemy_slicer_bot').length
  for (const family of families) assert.ok(markers.filter((entry) => entry.typeKey === family).length <= signature, 'the sheet trimmer is the most common')
  for (const entry of markers) {
    assert.ok((entry.spawnTriggerX ?? 0) <= entry.x - SCREEN, `${entry.id} spawns a screen ahead`)
    assert.ok((entry.retireTriggerX ?? 0) > entry.x, `${entry.id} retires behind`)
    assert.ok(stage.arena.checkpoints.every((checkpoint) => Math.abs(checkpoint.x - entry.x) > 48), `${entry.id} is not on a checkpoint`)
  }
  // Brief spots: laser eyes (inspectors) over the hall's housings, a coolant nozzle over the hall.
  const housings = stage.arena.midPlatforms.filter((platform) => platform.id.startsWith('ferro_hall_housing_')).map(surface)
  const eyes = markers.filter((entry) => entry.typeKey === 'enemy_laser_eye')
  assert.ok(eyes.filter((eye) => housings.some((entry) => eye.x >= entry.left && eye.x <= entry.right && eye.y < entry.top)).length >= 2, 'inspectors over the housings')
  // The mid-boss: the Ferro nest inside the locked inspection station, on its housing at the end of the belt that feeds it.
  const lock = (stage.arena.roomLocks ?? []).find((entry) => isDefeatLock(entry))!
  assert.deepEqual(lock.defeatMarkers, FERRO_BLADE_MIDBOSS_MARKERS)
  const nest = markers.find((marker) => marker.id === FERRO_BLADE_MIDBOSS_MARKERS[0])!
  assert.ok(nest.typeKey === 'relay_turret_nest_ferro' && nest.x > lock.room.x && (nest.patrolMaxX ?? 0) < lock.gateX && (nest.retireTriggerX ?? 0) > lock.gateX, 'the nest fights inside the room')
  const feed = (stage.arena.conveyors ?? []).find((entry) => entry.id === 'ferro_mid_belt')!
  const housing = surface(stage.arena.midPlatforms.find((platform) => platform.id === 'ferro_mid_housing')!)
  assert.ok((feed.speed ?? 0) > 0 && conveyorBox(feed).right === housing.left && nest.x > housing.left && nest.x < housing.right, 'the belt carries a hero who stands still to the nest')
  assert.ok(stageScopedAtlases('ferro_blade').some((entry) => entry.atlasKey === 'atlas_relay_turret_nest_ferro'), 'the Ferro nest atlas loads with the stage')
})
