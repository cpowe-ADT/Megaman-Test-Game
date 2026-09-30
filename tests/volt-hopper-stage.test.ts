import test from 'node:test'
import assert from 'node:assert/strict'
import { stageVerticalTop } from '../src/stage/stageGeometry.ts'
import { isDefeatLock } from '../src/mechanics/roomLock.ts'
import { getCampaignStage, getStageContentRetentionReport, type StagePlatformDefinition } from '../src/content/campaign.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'
import { resolveHazard } from '../src/mechanics/hazards.ts'
import { resolveHeroEnvironment } from '../src/mechanics/heroEnvironment.ts'
import { railCycleAt, resolveRailGroup } from '../src/mechanics/timedRailGroup.ts'
import { stageMechanicPlatforms } from '../src/mechanics/stageMechanics.ts'
import { wallBox } from '../src/mechanics/breakableWall.ts'
import { LANE_SWAP_DEFAULTS, laneSwapAlpha, laneSwapAt, laneSwapCarriers, type LaneSwapDefinition } from '../src/mechanics/laneSwap.ts'
import { VOLT_HOPPER_MIDBOSS_MARKERS, VOLT_MASTER_PYLONS, VOLT_RAIL_BEAT, VOLT_SWAP_BEAT } from '../src/content/stages/voltHopper.ts'
import { GAMEPLAY_ACTOR_CEILING } from '../src/config/gameplayLayout.ts'

// Measured on this build (Heat Works, 2026-09-24): held running jump 246px across, 124-127px up; dash
// jump 336px across. The hero's body is 16x22.
const PLAIN_JUMP_PX = 246
const DASH_JUMP_PX = 336
const MAX_RISE_PX = 127
const BODY_PX = 16
const HALF_BODY_HEIGHT = 11
const FLOOR = 236
const SCREEN = 448

type Surface = { id: string; left: number; right: number; top: number; type: StagePlatformDefinition['type'] }
function surface(platform: StagePlatformDefinition): Surface {
  return { id: platform.id, left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - (platform.height ?? 8) / 2, type: platform.type }
}
const bottomOf = (platform: StagePlatformDefinition) => platform.y + (platform.height ?? 8) / 2

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

const PAIR: LaneSwapDefinition = { id: 'p', stations: [100, 300], lanes: [{ id: 'lo', top: 200 }, { id: 'hi', top: 160 }], timing: { holdMs: 1000, moveMs: 2000 } }

test('12d lane swap: the pair holds, blinks for the last 300ms, slides at one speed past each other, trades stations, comes home', () => {
  const at = (ms: number) => laneSwapAt(PAIR, ms)
  assert.deepEqual([at(0).phase, at(0).swapped, at(0).untilMoveMs], ['hold', false, 1000])
  assert.deepEqual(at(0).platforms.map((platform) => [platform.id, platform.x, platform.top, platform.velocityX]), [['lo', 100, 200, 0], ['hi', 300, 160, 0]])
  assert.deepEqual(at(0).platforms[0].box, { left: 72, right: 128, top: 200, bottom: 208 })
  assert.deepEqual([at(700).phase, at(700).untilMoveMs], ['arming', 300])
  assert.deepEqual([at(2000).phase, at(2000).platforms.map((platform) => [platform.x, platform.velocityX])], ['moving', [[200, 100], [200, -100]]], 'halfway, one lane over the other')
  assert.deepEqual([at(3000).phase, at(3000).swapped, at(3000).platforms.map((platform) => platform.x)], ['hold', true, [300, 100]], 'traded')
  assert.deepEqual(at(5000).platforms.map((platform) => [platform.x, platform.velocityX]), [[200, -100], [200, 100]], 'sliding home')
  assert.deepEqual(at(6000).platforms.map((platform) => platform.x), [100, 300], 'home after two swaps')
  assert.deepEqual(at(-1000).platforms.map((platform) => platform.x), at(5000).platforms.map((platform) => platform.x), 'a negative clock wraps')
  assert.equal(laneSwapAt({ ...PAIR, timing: { ...PAIR.timing, phaseMs: 3000 } }, 0).swapped, true)
  assert.equal(laneSwapAt({ ...PAIR, timing: undefined }, 0).untilMoveMs, LANE_SWAP_DEFAULTS.timing.holdMs)
  assert.deepEqual([laneSwapAlpha('arming', 0), laneSwapAlpha('arming', 75), laneSwapAlpha('hold', 0), laneSwapAlpha('moving', 0)], [0.55, 1, 1, 1])
})

test('12d lane swap: a hero on a sliding platform rides it (its speed is the belt carry); the platform list holds both; pit rails carry no damage box', () => {
  const hero = { left: 192, right: 208, top: 178, bottom: 200 }
  const base = { clockMs: 2000, iceFloors: [], currents: [], winds: [] }
  const sliding = laneSwapCarriers(PAIR, laneSwapAt(PAIR, 2000))
  const riding = resolveHeroEnvironment({ ...base, hero, grounded: true, conveyors: sliding })
  assert.deepEqual([riding.environment.carryVelocityX, riding.beltId], [100, 'lo'])
  assert.equal(resolveHeroEnvironment({ ...base, hero, grounded: false, conveyors: sliding }).environment.carryVelocityX, 0, 'airborne, no carry')
  const held = resolveHeroEnvironment({ ...base, hero: { ...hero, left: 92, right: 108 }, grounded: true, conveyors: laneSwapCarriers(PAIR, laneSwapAt(PAIR, 0)) })
  assert.deepEqual([held.environment.carryVelocityX, held.beltId], [0, 'lo'])
  assert.deepEqual(
    stageMechanicPlatforms({ laneSwaps: [PAIR] }).map((platform) => [platform.id, platform.x, platform.y, platform.width, platform.height, platform.type]),
    [['lo', 100, 204, 56, 8, 'oneWay'], ['hi', 300, 164, 56, 8, 'oneWay']]
  )
  assert.deepEqual([resolveRailGroup({ id: 'pit', rails: [], live: false }).live, resolveRailGroup({ id: 'r', rails: [] }).live], [false, true])
})

test('Power District route: thirteen screens, four checkpoints clear of every mechanic, pits a plain jump clears over pit rails', () => {
  const { arena } = getCampaignStage('volt_hopper')
  assert.equal(getStageContentRetentionReport('volt_hopper')?.routeWidth, 13 * SCREEN)
  assert.equal(arena.allowFallOff, true)
  assert.equal(stageVerticalTop(arena, 252), -252, 'the heart room is two screens tall')
  assert.deepEqual(arena.checkpoints.map((entry) => entry.id), ['volt_start', 'volt_mid_a', 'volt_mid_b', 'volt_boss_gate'])
  assert.equal(arena.checkpoints[1].radioSequenceId, 'volt_hopper_radio')
  const gaps = arena.floorGaps ?? []
  assert.ok(gaps.length >= 3)
  for (const gap of gaps) assert.ok(gap.width + BODY_PX <= PLAIN_JUMP_PX - 48, `pit at ${gap.x} is ${gap.width}px`)
  const groups = (arena.timedRailGroups ?? []).map(resolveRailGroup)
  const pitRails = groups.filter((group) => !group.live).flatMap((group) => group.rails)
  for (const gap of gaps) {
    assert.ok(pitRails.some((rail) => rail.x - rail.width / 2 === gap.x && rail.width === gap.width && rail.floorY === 252), `rails on the floor of the pit at ${gap.x}`)
  }
  const liveRails = groups.filter((group) => group.live).flatMap((group) => group.rails)
  for (const rail of liveRails) {
    assert.ok(!gaps.some((gap) => rail.x + rail.width / 2 > gap.x && rail.x - rail.width / 2 < gap.x + gap.width), `${rail.id} stands on solid floor`)
  }
  const spikes = arena.hazards.map(resolveHazard)
  assert.ok(spikes.every((hazard) => hazard.kind === 'spikes') && spikes.length + liveRails.length >= 8)
  // The brief's mechanics: rails on the stage beat, lane-swap pairs, belts in the yard (both directions).
  const beltDefs = arena.conveyors ?? []
  assert.ok(beltDefs.length >= 2 && beltDefs.some((entry) => (entry.speed ?? 0) > 0) && beltDefs.some((entry) => (entry.speed ?? 0) < 0))
  const swaps = arena.laneSwaps ?? []
  assert.ok(swaps.length >= 3)
  for (const pair of swaps) assert.deepEqual(pair.timing, VOLT_SWAP_BEAT, `${pair.id} keeps the stage beat`)
  const solids = arena.midPlatforms.filter((platform) => platform.type === 'solid' || platform.type === 'wall')
  for (const entry of arena.checkpoints) {
    for (const x of [entry.x, entry.triggerX + 8]) {
      assert.ok(!spikes.some((hazard) => Math.abs(hazard.x - x) < hazard.width / 2 + 24), `${entry.id} clear of spikes`)
      assert.ok(!liveRails.some((rail) => Math.abs(rail.x - x) < rail.width / 2 + 24), `${entry.id} clear of rails`)
      assert.ok(!beltDefs.some((beltDef) => Math.abs(beltDef.x - x) < beltDef.width / 2 + 16), `${entry.id} clear of belts`)
      assert.ok(!swaps.some((pair) => x >= Math.min(...pair.stations) - 44 && x <= Math.max(...pair.stations) + 44), `${entry.id} clear of swap platforms`)
      assert.ok(!gaps.some((gap) => x >= gap.x - 8 && x <= gap.x + gap.width + 8), `${entry.id} not over a pit`)
      assert.ok(!solids.some((block) => Math.abs(block.x - x) < block.width / 2 + 8 && bottomOf(block) > FLOOR - 40), `${entry.id} not in a block`)
    }
  }
  // Outside a tall room the world ceiling is y 90: every surface a hero stands on above it sits in the heart room.
  const tall = (arena.verticalSegments ?? []).filter((segment) => segment.verticalScreens >= 2)
  const inTall = (left: number, right: number) => tall.some((segment) => left >= segment.x && right <= segment.x + segment.width)
  const lanes = swaps.flatMap((pair) => pair.lanes.map((lane) => ({ id: lane.id, left: Math.min(...pair.stations) - 28, right: Math.max(...pair.stations) + 28, top: lane.top })))
  for (const platform of [...arena.midPlatforms.map(surface), ...lanes]) {
    if (platform.top - 2 * HALF_BODY_HEIGHT >= GAMEPLAY_ACTOR_CEILING) continue
    assert.ok(inTall(platform.left, platform.right), `${platform.id} (top ${platform.top}) rises past the actor ceiling outside a tall room`)
  }
})

test('Power District master: a walled corridor of insulated pylons; the rails arc exactly while the swap platforms slide; each bay is ridden station to station', () => {
  const { arena } = getCampaignStage('volt_hopper')
  const byId = new Map(arena.midPlatforms.map((platform) => [platform.id, platform]))
  const pylons = VOLT_MASTER_PYLONS.map((_, index) => byId.get(`volt_master_pylon_${index}`)!)
  for (const pylon of pylons) assert.ok(pylon.type === 'wall' && bottomOf(pylon) === 252, `${pylon.id} is a wall standing on the ground`)
  const master = resolveRailGroup((arena.timedRailGroups ?? []).find((group) => group.id === 'volt_master_rails')!)
  assert.deepEqual([master.timing.onMs, master.timing.offMs], [VOLT_RAIL_BEAT.onMs, VOLT_RAIL_BEAT.offMs])
  const pairs = (arena.laneSwaps ?? []).filter((pair) => pair.id.startsWith('volt_master_swap_'))
  assert.equal(pairs.length, pylons.length - 1)
  for (let ms = 0; ms < 12000; ms += 50) {
    const arcing = railCycleAt(master.timing, ms).phase === 'arcing'
    for (const pair of pairs) assert.equal(laneSwapAt(pair, ms).phase === 'moving', arcing, `${pair.id} slides only while the rails arc (${ms}ms)`)
  }
  pairs.forEach((pair, index) => {
    const left = surface(pylons[index])
    const right = surface(pylons[index + 1])
    const rails = master.rails.filter((rail) => rail.x > left.right && rail.x < right.left)
    assert.equal(Math.min(...rails.map((rail) => rail.x - rail.width / 2)), left.right, `${pair.id}: rails from pylon to pylon`)
    assert.equal(Math.max(...rails.map((rail) => rail.x + rail.width / 2)), right.left)
    assert.equal(rails.reduce((sum, rail) => sum + rail.width, 0), right.left - left.right)
    assert.ok(right.left - left.right > PLAIN_JUMP_PX, 'a bay is wider than a running jump')
    const arcTop = Math.min(...rails.map((rail) => rail.y - rail.height / 2))
    for (const lane of pair.lanes) assert.ok(lane.top <= arcTop - 10, `${lane.id} rides 10px+ over the arcs`)
    assert.deepEqual(pair.lanes.map((lane) => lane.top), [left.top, left.top - 36], 'low lane level with the pylon tops, high lane a hop above')
    // Every hold leaves a platform beside each pylon; the one by the left pylon ends the next slide by the right one.
    for (const ms of [0, VOLT_SWAP_BEAT.holdMs + VOLT_SWAP_BEAT.moveMs]) {
      const before = laneSwapAt(pair, ms)
      const after = laneSwapAt(pair, ms + VOLT_SWAP_BEAT.holdMs + VOLT_SWAP_BEAT.moveMs)
      const near = before.platforms.find((platform) => Math.abs(platform.box.left - left.right) <= 8)
      assert.ok(near, `${pair.id}: a platform waits by the left pylon at ${ms}ms`)
      assert.ok(near.top <= left.top && near.top >= left.top - 40, 'a walk or a hop onto it')
      const landed = after.platforms.find((platform) => platform.id === near.id)!
      assert.ok(Math.abs(right.left - landed.box.right) <= 8, `${near.id} carries its rider to the right pylon`)
    }
  })
  // Without the ride: from a pylon top the actor ceiling caps a jump's rise (smoke 56 measures a dash jump's reach).
  const riseCap = surface(pylons[0]).top - 2 * HALF_BODY_HEIGHT - GAMEPLAY_ACTOR_CEILING
  assert.ok(riseCap < MAX_RISE_PX * 0.75, `a jump from a pylon top rises at most ${riseCap}px`)
})

test('Power District secrets: the heart needs wall kicks, the sub tank is behind a breakable wall, the capsule is on the route after the mid-boss', () => {
  const { arena } = getCampaignStage('volt_hopper')
  const all = arena.midPlatforms.map(surface)
  const byId = new Map(all.map((entry) => [entry.id, entry]))
  const floor: Surface = { id: 'floor', left: -1e6, right: 1e6, top: FLOOR, type: 'solid' }
  const walls = all.filter((entry) => entry.type === 'wall')
  const wallBottoms = new Map(arena.midPlatforms.map((platform) => [platform.id, bottomOf(platform)]))
  const lanes = (arena.laneSwaps ?? []).flatMap((pair) => pair.lanes.map((lane) => ({ id: lane.id, left: Math.min(...pair.stations) - 28, right: Math.max(...pair.stations) + 28, top: lane.top, type: 'oneWay' as const })))
  const unreachable = (target: Surface, label: string, except: string[] = []) => {
    for (const from of [floor, ...lanes, ...all.filter((entry) => entry.type !== 'wall' && entry.id !== target.id && !except.includes(entry.id))]) {
      for (const span of [PLAIN_JUMP_PX, DASH_JUMP_PX]) assert.ok(!canJumpOnto(from, target, span, walls, wallBottoms), `${label} is out of a ${span}px jump from ${from.id}`)
    }
  }
  const anchors = arena.locationAnchors ?? {}
  // Heart: two wall faces 48px apart reaching down into a floor jump's reach; the ledge between them caps the climb.
  const heart = byId.get('volt_heart_ledge')!
  const wallLeft = byId.get('volt_heart_wall_left')!
  const wallRight = byId.get('volt_heart_wall_right')!
  assert.deepEqual([wallLeft.type, wallRight.type], ['wall', 'wall'])
  assert.ok(wallRight.left - wallLeft.right >= BODY_PX + 16 && wallRight.left - wallLeft.right <= 64)
  assert.ok(heart.left === wallLeft.right && heart.right === wallRight.left)
  const chimneyBottom = wallBottoms.get('volt_heart_wall_left')!
  assert.ok(chimneyBottom > FLOOR - MAX_RISE_PX && chimneyBottom <= FLOOR - 2 * HALF_BODY_HEIGHT - 20, 'a floor jump meets the faces; the hero walks under them')
  assert.ok(wallLeft.top <= heart.top + 4)
  unreachable(heart, 'the heart ledge')
  unreachable(wallLeft, 'the top of the left chimney wall', [heart.id])
  unreachable(wallRight, 'the top of the right chimney wall', [heart.id])
  assert.ok(anchors.heart_tank && anchors.heart_tank.x > heart.left && anchors.heart_tank.x < heart.right && anchors.heart_tank.y < heart.top)
  const room = (arena.verticalSegments ?? []).find((segment) => segment.id === 'volt_heart_room')!
  const belts = arena.conveyors ?? []
  assert.ok(heart.left > room.x && heart.right < room.x + room.width, 'the heart room is tall')
  assert.ok(belts.some((entry) => entry.x < room.x + room.width && entry.x > room.x - SCREEN), 'the heart stands above the yard')
  assert.ok(!belts.some((entry) => entry.x - entry.width / 2 < wallRight.right + 16 && entry.x + entry.width / 2 > wallLeft.left - 16), 'no belt under the chimney')
  // Sub tank: a chamber sealed by the breakable wall (floor to roof), the roof and the bulkhead; a charged shot opens it.
  const breakable = (arena.breakableWalls ?? []).find((entry) => entry.id === 'volt_secret_wall')!
  const box = wallBox(breakable)
  const roof = arena.midPlatforms.find((platform) => platform.id === 'volt_secret_roof')!
  const bulkhead = byId.get('volt_secret_bulkhead')!
  assert.ok((breakable.minChargeLevel ?? 0) >= 1 && breakable.hitsRequired >= 1, 'a charged shot breaks it')
  assert.deepEqual([box.bottom, box.top], [FLOOR, bottomOf(roof)], 'the wall runs floor to roof')
  assert.ok(surface(roof).left <= box.left && surface(roof).right === bulkhead.left && bulkhead.top <= surface(roof).top)
  assert.ok(anchors.sub_tank && anchors.sub_tank.x > box.right && anchors.sub_tank.x < bulkhead.left && anchors.sub_tank.y > bottomOf(roof))
  // Capsule: on the bulkhead the route crosses, past the mid-boss gate.
  const lock = (arena.roomLocks ?? [])[0]
  assert.ok(anchors.capsule && anchors.capsule.x > lock.gateX && anchors.capsule.x > bulkhead.left && anchors.capsule.x < bulkhead.right && anchors.capsule.y < bulkhead.top)
  const byCategory = Object.fromEntries(getStageLocationDefinitions('volt_hopper').map((entry) => [entry.category, entry]))
  assert.deepEqual([byCategory.heart_tank.id, byCategory.heart_tank.x, byCategory.heart_tank.y], ['volt_hopper:heart_tank', 2344, 44])
  assert.deepEqual([byCategory.sub_tank.x, byCategory.capsule.y, byCategory.pickup_bonus.x], [3400, 152, 5040])
})

test('Power District enemies: 19+ placements of the five brief families and the twins, each spawning 448px+ ahead and retiring behind', () => {
  const stage = getCampaignStage('volt_hopper')
  const markers = stage.enemyMarkers
  const families = ['enemy_bouncer', 'enemy_laser_eye', 'enemy_rocket_bot', 'enemy_shield_drone', 'enemy_shock_hopper']
  assert.deepEqual([...new Set(markers.map((entry) => entry.typeKey))].sort(), [...families, 'sentry_twin'].sort())
  assert.ok(markers.filter((entry) => families.includes(entry.typeKey)).length >= 19)
  for (const family of families) assert.ok(markers.filter((entry) => entry.typeKey === family).length >= 2, `${family} appears more than once`)
  const signature = markers.filter((entry) => entry.typeKey === 'enemy_shock_hopper').length
  for (const family of families) assert.ok(markers.filter((entry) => entry.typeKey === family).length <= signature, 'the relay tender is the most common')
  for (const entry of markers) {
    assert.ok((entry.spawnTriggerX ?? 0) <= entry.x - SCREEN, `${entry.id} spawns a screen ahead`)
    assert.ok((entry.retireTriggerX ?? 0) > entry.x, `${entry.id} retires behind`)
    assert.ok(stage.arena.checkpoints.every((checkpoint) => Math.abs(checkpoint.x - entry.x) > 48), `${entry.id} is not on a checkpoint`)
  }
  // Brief spots: bouncers in the yard, rocket loaders at its exit, laser eyes on the pylons.
  const lock = (stage.arena.roomLocks ?? []).find((entry) => isDefeatLock(entry))!
  assert.ok(markers.filter((entry) => entry.typeKey === 'enemy_bouncer' && entry.x > 1792 && entry.x < lock.room.x).length >= 2)
  assert.ok(markers.filter((entry) => entry.typeKey === 'enemy_rocket_bot' && entry.x > lock.room.x - 128 && entry.x < lock.room.x).length >= 2)
  const pylons = stage.arena.midPlatforms.filter((platform) => platform.id.includes('pylon')).map(surface)
  const eyes = markers.filter((entry) => entry.typeKey === 'enemy_laser_eye')
  assert.ok(eyes.filter((eye) => pylons.some((pylon) => eye.x >= pylon.left && eye.x <= pylon.right && eye.y < pylon.top)).length >= 3, 'laser eyes over the pylons')
  // The mid-boss: the twins inside the locked room, over its rails.
  assert.deepEqual(lock.defeatMarkers, VOLT_HOPPER_MIDBOSS_MARKERS)
  const twins = markers.find((marker) => marker.id === VOLT_HOPPER_MIDBOSS_MARKERS[0])!
  assert.ok(twins.typeKey === 'sentry_twin' && twins.x > lock.room.x && (twins.patrolMaxX ?? 0) < lock.gateX && (twins.retireTriggerX ?? 0) > lock.gateX, 'the twins fight inside the room')
  const roomRails = (stage.arena.timedRailGroups ?? []).map(resolveRailGroup).filter((group) => group.live).flatMap((group) => group.rails).filter((rail) => rail.x > lock.room.x && rail.x < lock.gateX)
  assert.ok(roomRails.length >= 4, 'rails on the room floor')
})
