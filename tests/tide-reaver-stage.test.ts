import test from 'node:test'
import assert from 'node:assert/strict'
import { stageVerticalTop } from '../src/stage/stageGeometry.ts'
import { isDefeatLock } from '../src/mechanics/roomLock.ts'
import { getCampaignStage, getStageContentRetentionReport, type StagePlatformDefinition } from '../src/content/campaign.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'
import { resolveHazard } from '../src/mechanics/hazards.ts'
import { CURRENT_JUMP_RISE_SCALE, currentJumpRiseScale } from '../src/mechanics/currentZone.ts'
import { resolveHeroEnvironment } from '../src/mechanics/heroEnvironment.ts'
import { jumpLaunchVelocity, normalizePlayerEnvironment } from '../src/player/environment.ts'
import {
  WATER_BUOYANCY_DEFAULTS,
  isHeroUnderwater,
  waterBuoyancyOn,
  waterGateBox,
  waterLevelAt,
  type WaterLevelGateDefinition
} from '../src/mechanics/waterLevelGate.ts'
import { TIDE_REAVER_MIDBOSS_MARKERS } from '../src/content/stages/tideReaver.ts'

// Measured on this build (Heat Works, 2026-09-24): held running jump 246px across, 124-127px up; dash
// jump 336px across. A current keeps 80% of the rise. The hero's body is 16x22.
const PLAIN_JUMP_PX = 246
const DASH_JUMP_PX = 336
const MAX_RISE_PX = 127
const BODY_PX = 16
const HALF_BODY_HEIGHT = 11
const FLOOR = 236
const SCREEN = 448

const heroAt = (x: number, feetY: number) => ({ left: x - BODY_PX / 2, right: x + BODY_PX / 2, top: feetY - 2 * HALF_BODY_HEIGHT, bottom: feetY })

type Surface = { id: string; left: number; right: number; top: number; type: StagePlatformDefinition['type'] }
function surface(platform: StagePlatformDefinition): Surface {
  return { id: platform.id, left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - (platform.height ?? 8) / 2, type: platform.type }
}

/**
 * A jump arc (range `span`, rise `MAX_RISE_PX`) launched from `from`'s near edge lands on `to` if it clears
 * `to`'s top somewhere over it and no wall between them meets the hero's body on the way.
 */
function canJumpOnto(from: Surface, to: Surface, span: number, walls: readonly Surface[] = [], wallBottoms: ReadonlyMap<string, number> = new Map()): boolean {
  const rightward = to.left >= from.right
  const edge = rightward ? from.right : from.left
  const near = Math.max(0, to.left - from.right, from.left - to.right)
  const far = near + (to.right - to.left)
  if (near > span) return false
  const best = Math.min(Math.max(span / 2, near), Math.min(far, span))
  const riseAt = (d: number) => (4 * MAX_RISE_PX * d * (span - d)) / (span * span)
  if (from.top - riseAt(best) >= to.top - 2) return false
  for (const wall of walls) {
    const between = rightward ? wall.left >= edge && wall.right <= to.left : wall.right <= edge && wall.left >= to.right
    if (!between) continue
    const d = rightward ? wall.left - edge : edge - wall.right
    const feet = from.top - riseAt(Math.min(d, span))
    if (feet - 2 * HALF_BODY_HEIGHT < (wallBottoms.get(wall.id) ?? Infinity) && feet > wall.top) return false
  }
  return true
}

const WATER: WaterLevelGateDefinition = {
  id: 'w',
  x: 100,
  width: 100,
  highY: 100,
  lowY: 200,
  bottomY: 236,
  timing: { highMs: 1000, fallMs: 2000, lowMs: 3000, riseMs: 2000 },
  gate: { x: 96, top: 0, bottom: 236 }
}

test('12d water-level gate: the level holds high, falls, holds low, rises; the sluice opens only while it holds low', () => {
  const at = (ms: number) => waterLevelAt(WATER, ms)
  assert.deepEqual([at(0).phase, at(0).surfaceY, at(0).gateOpen, at(0).untilChangeMs], ['high', 100, false, 1000])
  assert.deepEqual([at(2000).phase, at(2000).surfaceY, at(2000).gateOpen], ['falling', 150, false])
  assert.deepEqual([at(3000).phase, at(3000).surfaceY, at(3000).gateOpen], ['low', 200, true])
  assert.deepEqual([at(5999).phase, at(5999).gateOpen], ['low', true])
  assert.deepEqual([at(7000).phase, at(7000).surfaceY, at(7000).gateOpen], ['rising', 150, false])
  assert.deepEqual([at(8000).phase, at(8000).surfaceY], ['high', 100], 'the cycle repeats')
  assert.deepEqual([at(-1000).phase, at(-1000).surfaceY], ['rising', 150], 'a negative clock wraps')
  const shifted = waterLevelAt({ ...WATER, timing: { ...WATER.timing!, phaseMs: 3000 } }, 0)
  assert.equal(shifted.phase, 'low')
  const high = { ...WATER, gate: { ...WATER.gate!, openWhen: 'high' as const } }
  assert.deepEqual([waterLevelAt(high, 0).gateOpen, waterLevelAt(high, 3000).gateOpen], [true, false], 'openWhen high flips it')
  const still = { ...WATER, timing: undefined, gate: undefined }
  assert.deepEqual([waterLevelAt(still, 5000).phase, waterLevelAt(still, 5000).surfaceY, waterLevelAt(still, 5000).gateOpen], ['still', 100, false])
  assert.deepEqual(waterGateBox(WATER), { left: 88, right: 104, top: 0, bottom: 236 })
  assert.equal(waterGateBox(still), null)
})

test('12d water: under the surface the hero floats up (a lift through the motor environment); above it, or in still pools, nothing', () => {
  assert.equal(isHeroUnderwater(WATER, 100, heroAt(150, 236)), true)
  assert.equal(isHeroUnderwater(WATER, 230, heroAt(150, 236)), false, 'a puddle under the standing hero centre is dry')
  assert.equal(isHeroUnderwater(WATER, 100, heroAt(90, 236)), false, 'outside the basin')
  assert.deepEqual(waterBuoyancyOn(WATER, 100, heroAt(150, 236)), { id: 'w', forceX: 0, forceY: -WATER_BUOYANCY_DEFAULTS.force, cap: WATER_BUOYANCY_DEFAULTS.cap })
  assert.equal(waterBuoyancyOn(WATER, 100, heroAt(150, 105)), null, 'centre above the surface')
  assert.equal(waterBuoyancyOn({ ...WATER, buoyancy: 0 }, 100, heroAt(150, 236)), null)
  assert.ok(WATER_BUOYANCY_DEFAULTS.force > 1050, 'the float beats gravity')
  const environment = resolveHeroEnvironment({
    hero: heroAt(150, 236),
    grounded: false,
    clockMs: 0,
    conveyors: [],
    iceFloors: [],
    currents: [],
    winds: [],
    extraPushes: [waterBuoyancyOn(WATER, 100, heroAt(150, 236))!]
  })
  assert.deepEqual([environment.environment.forceY, environment.environment.pushCap, environment.zoneIds], [-WATER_BUOYANCY_DEFAULTS.force, WATER_BUOYANCY_DEFAULTS.cap, ['w']])
})

test('12d current: inside a current the jump rises 20% less (launch speed x sqrt 0.8); outside and neutral stay exact', () => {
  const zone = { id: 'c', x: 0, y: 100, width: 200, height: 136, forceX: -420, maxSpeed: 80 }
  assert.equal(CURRENT_JUMP_RISE_SCALE, 0.8)
  assert.equal(currentJumpRiseScale([zone], heroAt(100, 236)), 0.8)
  assert.equal(currentJumpRiseScale([zone], heroAt(300, 236)), 1)
  const base = { grounded: true, clockMs: 0, conveyors: [], iceFloors: [], winds: [] }
  const inside = resolveHeroEnvironment({ ...base, hero: heroAt(100, 236), currents: [zone] }).environment
  const outside = resolveHeroEnvironment({ ...base, hero: heroAt(300, 236), currents: [zone] }).environment
  assert.deepEqual([inside.forceX, inside.jumpRiseScale], [-420, 0.8])
  assert.equal(outside.jumpRiseScale, undefined, 'outside the environment carries no jump scale')
  assert.equal(normalizePlayerEnvironment(outside).jumpRiseScale, 1)
  assert.deepEqual([normalizePlayerEnvironment({ jumpRiseScale: Number.NaN }).jumpRiseScale, normalizePlayerEnvironment({ jumpRiseScale: -1 }).jumpRiseScale], [1, 1])
  assert.equal(jumpLaunchVelocity(-400, 1), -400)
  assert.ok(Math.abs(jumpLaunchVelocity(-400, 0.8) - -400 * Math.sqrt(0.8)) < 1e-9)
  // Rise grows with the square of the launch speed: the scaled launch keeps 80% of the height.
  assert.ok(Math.abs(jumpLaunchVelocity(-400, 0.8) ** 2 / 400 ** 2 - 0.8) < 1e-9)
})

test('Water District route: twelve screens, four checkpoints clear of every mechanic, pits a plain jump clears, a pool in each', () => {
  const { arena } = getCampaignStage('tide_reaver')
  assert.equal(getStageContentRetentionReport('tide_reaver')?.routeWidth, 12 * SCREEN)
  assert.equal(arena.allowFallOff, true)
  assert.equal(stageVerticalTop(arena, 252), -252, 'the shaft is two screens tall')
  assert.deepEqual(arena.checkpoints.map((entry) => entry.id), ['tide_start', 'tide_mid_a', 'tide_mid_b', 'tide_boss_gate'])
  assert.equal(arena.checkpoints[1].radioSequenceId, 'tide_reaver_radio')
  const gaps = arena.floorGaps ?? []
  assert.ok(gaps.length >= 3)
  for (const gap of gaps) assert.ok(gap.width + BODY_PX <= PLAIN_JUMP_PX - 48, `pit at ${gap.x} is ${gap.width}px`)
  const water = arena.waterLevelGates ?? []
  for (const gap of gaps) {
    const pool = water.find((entry) => entry.x === gap.x && entry.width === gap.width)
    assert.ok(pool && !pool.timing && pool.buoyancy === 0, `a still pool without float in the pit at ${gap.x}`)
  }
  assert.ok(arena.hazards.length >= 8 && arena.hazards.every((hazard) => resolveHazard(hazard).kind === 'spikes'))
  const hazards = arena.hazards.map(resolveHazard)
  const solids = arena.midPlatforms.filter((platform) => platform.type === 'solid' || platform.type === 'wall')
  const zones = [...(arena.currentZones ?? []), ...water.filter((entry) => entry.timing).map((entry) => ({ x: entry.x, width: entry.width }))]
  const belts = arena.conveyors ?? []
  for (const entry of arena.checkpoints) {
    for (const x of [entry.x, entry.triggerX + 8]) {
      assert.ok(!hazards.some((hazard) => Math.abs(hazard.x - x) < hazard.width / 2 + 24), `${entry.id} clear of spikes`)
      assert.ok(!zones.some((zone) => x >= zone.x - 16 && x <= zone.x + zone.width + 16), `${entry.id} clear of currents and water`)
      assert.ok(!belts.some((beltDef) => Math.abs(beltDef.x - x) < beltDef.width / 2 + 16), `${entry.id} clear of belts`)
      assert.ok(!gaps.some((gap) => x >= gap.x - 8 && x <= gap.x + gap.width + 8), `${entry.id} not over a pit`)
      assert.ok(!solids.some((block) => Math.abs(block.x - x) < block.width / 2 + 8 && block.y + (block.height ?? 8) / 2 > FLOOR - 40), `${entry.id} not in a block`)
    }
  }
  // The brief's mechanics: currents (every one after the teach pushes toward the intake, leftward), water gates, carry belts.
  const currents = arena.currentZones ?? []
  assert.ok(currents.length >= 4 && currents.slice(1).every((zone) => (zone.forceX ?? 0) < 0))
  assert.ok(belts.some((entry) => entry.type === 'oneWay' && entry.y < FLOOR - 20), 'raised carry belts')
  assert.ok(water.filter((entry) => entry.gate).length >= 3)
})

test('Water District master: the flooded shaft is two screens tall, walled both sides, and its exit sluice opens only at low water', () => {
  const { arena } = getCampaignStage('tide_reaver')
  const shaft = (arena.verticalSegments ?? []).find((segment) => segment.id === 'tide_shaft')
  assert.ok(shaft && shaft.verticalScreens === 2)
  const platforms = new Map(arena.midPlatforms.map((platform) => [platform.id, surface(platform)]))
  const left = platforms.get('tide_shaft_wall_left')!
  const right = platforms.get('tide_shaft_wall_right')!
  assert.deepEqual([left.type, right.type], ['wall', 'wall'])
  assert.ok(left.left >= shaft.x && right.right <= shaft.x + shaft.width)
  const water = (arena.waterLevelGates ?? []).find((entry) => entry.id === 'tide_shaft_water')!
  assert.ok(water.x === left.right && water.x + water.width === right.left, 'the water fills the shaft wall to wall')
  const box = waterGateBox(water)!
  assert.ok(box.left >= right.left - 1 && box.right <= right.right + 1 && box.bottom === right.top && box.top <= -252, 'the sluice stands on the right wall')
  const top = platforms.get('tide_shaft_top')!
  assert.equal(top.top, right.top)
  assert.ok(top.top - water.highY >= 8 && top.top - water.highY <= 24, 'high water floats the hero onto the top ledge')
  assert.ok(water.lowY >= FLOOR - HALF_BODY_HEIGHT + 2, 'low water is a puddle a standing hero is dry in')
  const phases = new Set<string>()
  for (let ms = 0; ms < 20000; ms += 250) {
    const level = waterLevelAt(water, ms)
    phases.add(level.phase)
    assert.equal(level.gateOpen, level.phase === 'low', `gate at ${ms}ms`)
  }
  assert.deepEqual([...phases].sort(), ['falling', 'high', 'low', 'rising'])
  const current = (arena.currentZones ?? []).filter((zone) => zone.x >= left.right - 1 && zone.x + zone.width <= right.left + 1)
  assert.ok(current.length >= 1 && current.every((zone) => (zone.forceX ?? 0) < 0), 'the current pushes toward the intake')
})

test('Water District secrets: the heart needs wall kicks, the sub tank needs high water, the capsule is on the route after the mid-boss', () => {
  const { arena } = getCampaignStage('tide_reaver')
  const all = arena.midPlatforms.map(surface)
  const byId = new Map(all.map((entry) => [entry.id, entry]))
  const floor: Surface = { id: 'floor', left: -1e6, right: 1e6, top: FLOOR, type: 'solid' }
  const walls = all.filter((entry) => entry.type === 'wall')
  const wallBottoms = new Map(arena.midPlatforms.map((platform) => [platform.id, platform.y + (platform.height ?? 8) / 2]))
  const unreachable = (target: Surface, label: string) => {
    for (const from of [floor, ...all.filter((entry) => entry.type !== 'wall' && entry.id !== target.id)]) {
      for (const span of [PLAIN_JUMP_PX, DASH_JUMP_PX]) assert.ok(!canJumpOnto(from, target, span, walls, wallBottoms), `${label} is out of a ${span}px jump from ${from.id}`)
    }
  }
  const anchors = arena.locationAnchors ?? {}
  // Heart: two wall faces 48px apart reaching down into a floor jump's reach; the ledge between them caps the climb.
  const heart = byId.get('tide_heart_ledge')!
  const wallLeft = byId.get('tide_heart_wall_left')!
  const wallRight = byId.get('tide_heart_wall_right')!
  const gap = wallRight.left - wallLeft.right
  assert.deepEqual([wallLeft.type, wallRight.type], ['wall', 'wall'])
  assert.ok(gap >= BODY_PX + 16 && gap <= 64, `chimney ${gap}px`)
  assert.ok(heart.left === wallLeft.right && heart.right === wallRight.left)
  const wallBottom = (id: string) => {
    const platform = arena.midPlatforms.find((entry) => entry.id === id)!
    return platform.y + (platform.height ?? 8) / 2
  }
  assert.ok(wallBottom('tide_heart_wall_left') > FLOOR - MAX_RISE_PX && wallBottom('tide_heart_wall_left') <= FLOOR - 2 * HALF_BODY_HEIGHT - 20, 'a floor jump meets the faces; the hero walks under them')
  assert.ok(wallLeft.top <= heart.top + 4)
  unreachable(heart, 'the heart ledge')
  assert.ok(anchors.heart_tank && anchors.heart_tank.x > heart.left && anchors.heart_tank.x < heart.right && anchors.heart_tank.y < heart.top)
  // Sub tank: a ledge 18px under the basin's high line, over its right edge; the basin drains below the floor.
  const basin = (arena.waterLevelGates ?? []).find((entry) => entry.id === 'tide_float_basin')!
  const subTank = byId.get('tide_subtank_ledge')!
  assert.ok(subTank.top - basin.highY >= 8 && subTank.top - basin.highY <= 24, 'high water floats the hero over the ledge')
  assert.ok(subTank.left < basin.x + basin.width && subTank.right > basin.x + basin.width, 'the ledge overhangs the basin edge')
  assert.ok(basin.lowY >= FLOOR, 'low water drains the basin')
  unreachable(subTank, 'the sub tank ledge')
  // No wall-kick climb toward it: every wall face within a kick's glide either hangs over a floor jump's head.
  for (const face of walls.filter((entry) => Math.max(entry.left - subTank.right, subTank.left - entry.right) < 440)) {
    assert.ok((wallBottoms.get(face.id) ?? 0) < FLOOR - MAX_RISE_PX - 2 * HALF_BODY_HEIGHT - 8, `${face.id} cannot be climbed from the floor`)
  }
  assert.ok(anchors.sub_tank && anchors.sub_tank.x > subTank.left && anchors.sub_tank.x < subTank.right && anchors.sub_tank.y < subTank.top)
  // Capsule: the alcove at the top of the shaft, above the high line, a plain jump from the last climb ledge.
  const alcove = byId.get('tide_shaft_alcove')!
  const shaftWater = (arena.waterLevelGates ?? []).find((entry) => entry.id === 'tide_shaft_water')!
  assert.ok(alcove.top < shaftWater.highY)
  assert.ok(canJumpOnto(byId.get('tide_shaft_8')!, alcove, PLAIN_JUMP_PX), 'a plain jump from the last climb ledge reaches the alcove')
  assert.ok(anchors.capsule && anchors.capsule.x > alcove.left && anchors.capsule.x < alcove.right && anchors.capsule.y < alcove.top)
  const lock = (arena.roomLocks ?? [])[0]
  assert.ok(anchors.capsule.x > lock.gateX, 'the capsule comes after the mid-boss')
  const byCategory = Object.fromEntries(getStageLocationDefinitions('tide_reaver').map((entry) => [entry.category, entry]))
  assert.deepEqual([byCategory.heart_tank.id, byCategory.heart_tank.x, byCategory.heart_tank.y], ['tide_reaver:heart_tank', 2024, 44])
  assert.deepEqual([byCategory.sub_tank.x, byCategory.capsule.y, byCategory.pickup_bonus.x], [3008, -212, 4560])
})

test('Water District enemies: 18+ placements of the five brief families and the nest, each spawning 448px+ ahead and retiring behind', () => {
  const stage = getCampaignStage('tide_reaver')
  const markers = stage.enemyMarkers
  assert.ok(markers.length >= 18)
  assert.deepEqual(
    [...new Set(markers.map((entry) => entry.typeKey))].sort(),
    ['enemy_drone', 'enemy_fly_trap', 'enemy_gunner_bot', 'enemy_mine_bot', 'enemy_shock_hopper', 'relay_turret_nest']
  )
  for (const family of ['enemy_drone', 'enemy_fly_trap', 'enemy_gunner_bot', 'enemy_mine_bot', 'enemy_shock_hopper']) {
    assert.ok(markers.filter((entry) => entry.typeKey === family).length >= 2, `${family} appears more than once`)
  }
  for (const entry of markers) {
    assert.ok((entry.spawnTriggerX ?? 0) <= entry.x - SCREEN, `${entry.id} spawns a screen ahead`)
    assert.ok((entry.retireTriggerX ?? 0) > entry.x, `${entry.id} retires behind`)
    assert.ok(stage.arena.checkpoints.every((checkpoint) => Math.abs(checkpoint.x - entry.x) > 48), `${entry.id} is not on a checkpoint`)
  }
  const lock = (stage.arena.roomLocks ?? []).find((entry) => isDefeatLock(entry))
  assert.ok(lock)
  assert.deepEqual(lock.defeatMarkers, TIDE_REAVER_MIDBOSS_MARKERS)
  for (const id of TIDE_REAVER_MIDBOSS_MARKERS) {
    const entry = markers.find((marker) => marker.id === id)
    assert.ok(entry && entry.typeKey === 'relay_turret_nest' && entry.x > lock.room.x && entry.x < lock.gateX && (entry.retireTriggerX ?? 0) > lock.gateX, `${id} fights inside the room`)
  }
  const housing = stage.arena.midPlatforms.find((platform) => platform.id === 'tide_intake_housing')!
  const nest = markers.find((marker) => marker.id === 'tide_mid_nest')!
  assert.ok(Math.abs(nest.x - housing.x) < housing.width / 2, 'the nest stands over the intake')
  assert.ok((stage.arena.conveyors ?? []).some((entry) => entry.x > lock.room.x && entry.x < lock.gateX && (entry.speed ?? 0) > 0), 'the intake belt feeds the nest')
})
