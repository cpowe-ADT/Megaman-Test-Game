import test from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStage, getStageContentRetentionReport } from '../src/content/campaign.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'
import { resolveHazard } from '../src/mechanics/hazards.ts'
import { isDefeatLock } from '../src/mechanics/roomLock.ts'
import { heroInZone } from '../src/mechanics/forceZone.ts'
import { laneSwapAt, laneSwapWidth } from '../src/mechanics/laneSwap.ts'
import { STORM_PIT_COLORS, WIND_BUILD_MS, resolveWindZone, stormPitColors, windCycleAt, windDriftPx } from '../src/mechanics/windZone.ts'
import { GROUNDED_PUSH_SCALE, environmentDriftX, stepPushVelocity } from '../src/player/environment.ts'
import { MINIBOSS_SKINS } from '../src/enemy/minibossCatalog.ts'
import { SENTRY_TWINS_TUNING } from '../src/enemy/sentryTwins.ts'
import { GAMEPLAY_ACTOR_CEILING } from '../src/config/gameplayLayout.ts'
import {
  GALE_VIXEN_BEAT,
  GALE_VIXEN_CARRIER_BEAT,
  GALE_VIXEN_GUST,
  GALE_VIXEN_GUST_GAPS,
  GALE_VIXEN_MAST,
  GALE_VIXEN_MIDBOSS_MARKERS
} from '../src/content/stages/galeVixen.ts'

// Measured on this build (output/gale-probe, 2026-09-30, on the Weather District's floor, under the actor
// ceiling): a held running jump covers 224px and rises 124px in 60 frames (1s); a held dash jump 325px.
// In a gust blowing the whole flight a running jump went 421px and a dash jump 529px (the stage gust), 373
// and 478 (the 12b default); `windDriftPx` over the same second from a standing start is the model below.
const PLAIN_JUMP_PX = 224
const DASH_JUMP_PX = 325
const MAX_RISE_PX = 127
const FLIGHT_MS = 1000
const BODY_PX = 16
const HALF_BODY_HEIGHT = 11
const FLOOR = 236
const SCREEN = 448
const STAGE = 'gale_vixen'
const FAMILIES = ['enemy_drone', 'enemy_gunner_bot', 'enemy_laser_eye', 'enemy_rocket_bot', 'enemy_shield_drone', 'enemy_shock_hopper']

type Rect = { left: number; right: number; top: number; bottom: number }
const rectOf = (entry: { x: number; y: number; width: number; height?: number }): Rect => {
  const height = entry.height ?? 8
  return { left: entry.x - entry.width / 2, right: entry.x + entry.width / 2, top: entry.y - height / 2, bottom: entry.y + height / 2 }
}
const arena = () => getCampaignStage(STAGE).arena
const platform = (id: string) => {
  const entry = arena().midPlatforms.find((candidate) => candidate.id === id)
  assert.ok(entry, id)
  return { ...rectOf(entry), type: entry.type }
}
const windById = (id: string) => {
  const entry = (arena().windZones ?? []).find((candidate) => candidate.id === id)
  assert.ok(entry, id)
  return resolveWindZone(entry)
}
const carrierById = (id: string) => {
  const entry = (arena().laneSwaps ?? []).find((candidate) => candidate.id === id)
  assert.ok(entry, id)
  return entry
}
const heroAt = (x: number, feetY = FLOOR): Rect => ({ left: x - BODY_PX / 2, right: x + BODY_PX / 2, top: feetY - 2 * HALF_BODY_HEIGHT, bottom: feetY })
/** Every spot a hero can stand on a ledge, edge to edge (its centre 7px past each end). */
const standingSpots = (surface: { left: number; right: number; top: number }) =>
  Array.from({ length: Math.floor((surface.right - surface.left + 14) / 4) + 1 }, (_, index) => heroAt(surface.left - 7 + index * 4, surface.top))

test('12d gust drift: the push builds toward the cap while it blows and fades after; a late jump gets less; a lift carries no one sideways', () => {
  const stage = resolveWindZone({ id: 's', x: 0, y: 0, width: 1, height: 1, ...GALE_VIXEN_GUST })
  const light = resolveWindZone({ id: 'd', x: 0, y: 0, width: 1, height: 1 })
  // Hand-stepped with the motor's own rule, the same sum.
  let push = 0
  let drift = 0
  for (let frame = 0; frame < 60; frame += 1) {
    push = stepPushVelocity(push, 1200, 200, 1 / 60)
    drift += push / 60
  }
  assert.ok(Math.abs(windDriftPx(stage, FLIGHT_MS) - drift) < 0.5, `${windDriftPx(stage, FLIGHT_MS)} vs ${drift}`)
  assert.ok(windDriftPx(stage, FLIGHT_MS) > 180 && windDriftPx(stage, FLIGHT_MS) < 190, 'the stage gust: about 185px over a one-second flight')
  assert.ok(windDriftPx(light, FLIGHT_MS) > 135 && windDriftPx(light, FLIGHT_MS) < 142, 'the 12b default: about 138px')
  assert.ok(windDriftPx(stage, FLIGHT_MS, { startPush: 200 }) > windDriftPx(stage, FLIGHT_MS), 'a hero already in it goes further')
  assert.ok(windDriftPx(stage, FLIGHT_MS, { blowMs: 300 }) < windDriftPx(stage, FLIGHT_MS) / 2, 'a gust that stops early carries less than half')
  assert.equal(windDriftPx(resolveWindZone({ id: 'l', kind: 'lift', x: 0, y: 0, width: 1, height: 1 }), FLIGHT_MS), 0)
  assert.equal(windDriftPx(stage, 0), 0)
  // Measured drift (probe) sits above the model from a standing start and within the pre-built push.
  assert.ok(421 - PLAIN_JUMP_PX >= windDriftPx(stage, FLIGHT_MS) && 421 - PLAIN_JUMP_PX <= windDriftPx(stage, FLIGHT_MS, { startPush: 200 }) + 4)
  // The airborne hero is pushed hardest: on the ground the same push counts half.
  const environment = { surface: 'ground' as const, carryVelocityX: 0, forceX: 1200, forceY: 0 }
  assert.deepEqual([environmentDriftX(environment, 200, false), environmentDriftX(environment, 200, true)], [200, 200 * GROUNDED_PUSH_SCALE])
})

test('12d storm pits: a stage with sideways gusts draws its pits as the storm below; lifts and the magnet do not count', () => {
  assert.deepEqual(stormPitColors(arena().windZones), { ...STORM_PIT_COLORS })
  assert.equal(stormPitColors(getCampaignStage('pyro_maw').arena.windZones), undefined)
  assert.equal(stormPitColors([{ id: 'l', kind: 'lift', x: 0, y: 0, width: 1, height: 1 }]), undefined)
  assert.equal(stormPitColors([{ id: 'm', kind: 'gust', style: 'magnet', x: 0, y: 0, width: 1, height: 1 }]), undefined)
  assert.equal(stormPitColors(undefined), undefined)
})

test('Weather District route: thirteen screens, four checkpoints clear of every mechanic, three kinds of gap, the actor ceiling', () => {
  const stage = arena()
  assert.equal(getStageContentRetentionReport(STAGE)?.routeWidth, 13 * SCREEN)
  assert.equal(stage.allowFallOff, true)
  assert.deepEqual(stage.checkpoints.map((entry) => entry.id), ['gale_start', 'gale_mid_a', 'gale_mid_b', 'gale_boss_gate'])
  assert.equal(stage.checkpoints[1].radioSequenceId, 'gale_vixen_radio')
  const gaps = stage.floorGaps ?? []
  assert.ok(gaps.length >= 3 && stage.hazards.length >= 8, `${gaps.length} gaps, ${stage.hazards.length} hazards`)
  const winds = (stage.windZones ?? []).map(resolveWindZone)
  const carriers = stage.laneSwaps ?? []
  let gustGaps = 0
  let ferryGaps = 0
  for (const gap of gaps) {
    const far = gap.x + gap.width
    const gust = winds.find((zone) => zone.rect.x < far && zone.rect.x + zone.rect.width > gap.x && zone.rect.y + zone.rect.height >= FLOOR)
    const ferry = carriers.find((pair) => pair.stations[0] > gap.x && pair.stations[1] < far)
    if (gust) {
      // The gust is the way: a dash jump from the rim falls short, a running jump it carries clears it.
      gustGaps += 1
      assert.ok(GALE_VIXEN_GUST_GAPS.includes(gust.id as (typeof GALE_VIXEN_GUST_GAPS)[number]), `${gust.id} is a gust gap`)
      assert.deepEqual([gust.rect.x, gust.rect.x + gust.rect.width], [gap.x + 8, far], `${gust.id}: from 8px past the take-off rim to the landing rim`)
      assert.ok(gust.rect.y <= FLOOR - MAX_RISE_PX - HALF_BODY_HEIGHT && gust.direction === 1, `${gust.id} covers the arc and blows toward the landing`)
      const carried = PLAIN_JUMP_PX + windDriftPx(gust, FLIGHT_MS)
      assert.ok(gap.width + BODY_PX <= carried - 24, `${gust.id}: ${gap.width}px against ${Math.round(carried)}px carried`)
      assert.ok(gap.width > PLAIN_JUMP_PX + BODY_PX, 'a running jump alone falls short')
      if (gap.width > DASH_JUMP_PX + BODY_PX / 2) assert.ok(gap.width - BODY_PX / 2 > DASH_JUMP_PX + 16, `${gust.id}: a dash jump from the rim falls short`)
      // The floor after it holds the landing of a dash jump the gust carried.
      const next = gaps.find((other) => other.x > far)
      assert.ok(!next || next.x - far >= 200, `${gust.id}: ${next ? next.x - far : 'no'}px of floor after it`)
    } else if (ferry) {
      // A carrier spans the gap: its platforms stop 8px from each rim, a hop above the floor.
      ferryGaps += 1
      const half = laneSwapWidth(ferry) / 2
      assert.deepEqual([ferry.stations[0] - half - gap.x, far - (ferry.stations[1] + half)], [8, 8], `${ferry.id} rims`)
      assert.ok(ferry.lanes.every((lane) => FLOOR - lane.top >= 16 && FLOOR - lane.top < MAX_RISE_PX - 60), `${ferry.id}: a hop onto either lane`)
      assert.ok(gap.width > PLAIN_JUMP_PX + BODY_PX, 'wider than a running jump')
    } else {
      assert.ok(gap.width + BODY_PX <= PLAIN_JUMP_PX - 48, `pit at ${gap.x} is ${gap.width}px`)
    }
  }
  assert.ok(gustGaps >= 2 && ferryGaps >= 2, `${gustGaps} gust gaps, ${ferryGaps} ferries`)
  const widestGust = Math.max(...gaps.filter((gap) => winds.some((zone) => zone.rect.x === gap.x + 8)).map((gap) => gap.width))
  assert.ok(widestGust - BODY_PX / 2 > DASH_JUMP_PX + 16, `the widest gust gap (${widestGust}px) is past a dash jump`)
  const hazards = stage.hazards.map(resolveHazard)
  const solids = stage.midPlatforms.filter((entry) => entry.type === 'solid' || entry.type === 'wall')
  for (const entry of stage.checkpoints) {
    for (const x of [entry.x, entry.triggerX + 8]) {
      assert.ok(!hazards.some((hazard) => Math.abs(hazard.x - x) < hazard.width / 2 + 24), `${entry.id} clear of spikes`)
      assert.ok(!gaps.some((gap) => x >= gap.x - 8 && x <= gap.x + gap.width + 8), `${entry.id} not over a gap`)
      assert.ok(!winds.some((zone) => x >= zone.rect.x - 16 && x <= zone.rect.x + zone.rect.width + 16 && zone.rect.y + zone.rect.height >= FLOOR), `${entry.id} out of the wind`)
      assert.ok(!solids.some((block) => Math.abs(block.x - x) < block.width / 2 + 8 && block.y + (block.height ?? 8) / 2 > FLOOR - 40), `${entry.id} not in a block`)
    }
  }
  // Every spike telegraphs by standing still; none sits where a jump over a gap lands.
  for (const hazard of hazards) {
    for (const gap of gaps) assert.ok(hazard.x - hazard.width / 2 > gap.x + gap.width + 40 || hazard.x + hazard.width / 2 < gap.x - 8 || hazard.y < FLOOR - 40, `${hazard.id} is clear of the landing after ${gap.x}`)
  }
  // Outside a tall room the world ceiling is y 90: every ledge a hero stands on above it sits in a room two screens tall.
  const tall = (stage.verticalSegments ?? []).filter((segment) => segment.verticalScreens >= 2)
  const inTall = (left: number, right: number) => tall.some((segment) => left >= segment.x && right <= segment.x + segment.width)
  const surfaces = [
    ...stage.midPlatforms.map((entry) => ({ id: entry.id, ...rectOf(entry) })),
    ...carriers.flatMap((pair) => pair.lanes.map((lane) => ({ id: lane.id, left: Math.min(...pair.stations) - 28, right: Math.max(...pair.stations) + 28, top: lane.top })))
  ]
  for (const surface of surfaces) {
    if (surface.top - 2 * HALF_BODY_HEIGHT >= GAMEPLAY_ACTOR_CEILING) continue
    assert.ok(inTall(surface.left, surface.right), `${surface.id} (top ${surface.top}) rises past the actor ceiling outside a tall room`)
  }
})

test('Weather District mast: two screens tall, the carriers slide in the calm and the gusts blow while they hold; the widest gap needs the gust', () => {
  const stage = arena()
  const mast = (stage.verticalSegments ?? []).find((segment) => segment.id === 'gale_mast')
  assert.deepEqual([mast?.x, mast?.width, mast?.verticalScreens], [GALE_VIXEN_MAST.left, GALE_VIXEN_MAST.right - GALE_VIXEN_MAST.left, 2])
  const carrier1 = carrierById('gale_mast_carrier_1')
  const carrier2 = carrierById('gale_mast_carrier_2')
  const gust1 = windById('gale_gust_mast_1')
  const gust2 = windById('gale_gust_mast_2')
  // The beat: 3.6s; the streaks build in the slide's last 0.5s; the gusts blow exactly while the carriers hold.
  assert.deepEqual([GALE_VIXEN_BEAT.onMs + GALE_VIXEN_BEAT.offMs, GALE_VIXEN_CARRIER_BEAT.holdMs + GALE_VIXEN_CARRIER_BEAT.moveMs], [3600, 3600])
  for (let ms = 0; ms < 14400; ms += 50) {
    const holding = laneSwapAt(carrier1, ms).phase !== 'moving'
    for (const zone of [gust1, gust2]) {
      const phase = windCycleAt(zone, ms).phase
      assert.equal(phase === 'blowing', holding, `${zone.id} blows only while the carriers hold (${ms}ms)`)
      if (phase === 'building') assert.ok(windCycleAt(zone, ms).untilBlowMs <= WIND_BUILD_MS && laneSwapAt(carrier1, ms).phase === 'moving')
    }
    assert.equal(laneSwapAt(carrier2, ms).phase === 'moving', !holding, 'both carriers on one beat')
  }
  const a = platform('gale_mast_a')
  const b = platform('gale_mast_b')
  const c = platform('gale_mast_c')
  const d = platform('gale_mast_d')
  const alcove = platform('gale_mast_alcove')
  const [low1, high1] = carrier1.lanes
  const [low2, high2] = carrier2.lanes
  const half = laneSwapWidth(carrier1) / 2
  // Tier 1: the base to carrier 1, carrier 1 to A; A is out of reach from the base and B out of reach of carrier 1.
  assert.ok(FLOOR - a.top > MAX_RISE_PX + 6, 'A is out of jump reach from the base')
  assert.ok(high1.top - a.top < MAX_RISE_PX - 40 && low1.top - a.top < MAX_RISE_PX - 8, 'carrier 1 lifts the hero to A')
  assert.ok(a.left - (carrier1.stations[1] + half) <= 16, 'carrier 1 stops by A')
  assert.ok(high1.top - b.top > MAX_RISE_PX + 6, 'B is out of reach of carrier 1')
  // The widest gap, A back to B, on the gust (blowing toward B); a dash jump alone falls short (smoke 60 measures it).
  const widest = a.left - b.right
  assert.equal(gust1.direction, -1)
  assert.deepEqual([gust1.rect.x, gust1.rect.x + gust1.rect.width], [b.right, a.left - 8], 'the gust spans the gap, clear of A')
  assert.ok(widest + BODY_PX > DASH_JUMP_PX - 8, `A to B is ${widest}px, rising ${a.top - b.top}`)
  assert.ok(widest + BODY_PX + 24 < PLAIN_JUMP_PX + windDriftPx(gust1, FLIGHT_MS), 'a running jump the gust carries clears it')
  // Tier 2: B to carrier 2's low lane, carrier 2 to C; carrier 2 is out of reach from A, C from A and B.
  assert.ok(b.top - low2.top < MAX_RISE_PX - 30 && carrier2.stations[0] - half - b.right <= 16, 'B to carrier 2')
  assert.ok(a.top - low2.top > MAX_RISE_PX + 6 && a.top - high2.top > MAX_RISE_PX + 6, 'carrier 2 is out of reach from A')
  assert.ok(low2.top - c.top < MAX_RISE_PX - 40 && c.left - (carrier2.stations[1] + half) <= 16, 'carrier 2 to C')
  assert.ok(b.top - c.top > MAX_RISE_PX + 6 && a.top - c.top > MAX_RISE_PX + 6, 'C only from carrier 2')
  assert.ok(c.top - alcove.top < MAX_RISE_PX - 30 && c.left - alcove.right <= 40, 'the capsule alcove over C')
  // C to D on the second gust (a dash jump clears it too); D is level with the right wall's top, the exit.
  assert.equal(gust2.direction, 1)
  assert.deepEqual([gust2.rect.x, gust2.rect.x + gust2.rect.width], [c.right + 8, d.left])
  assert.ok(d.left - c.right + BODY_PX <= DASH_JUMP_PX - 24 && d.left - c.right > PLAIN_JUMP_PX + BODY_PX, 'C to D: a dash jump or the gust')
  const right = platform('gale_mast_wall_right')
  assert.ok(right.top === d.top && d.right === right.left && right.type === 'solid', 'the exit over the right wall; no kick line up it')
  assert.ok(stage.midPlatforms.some((entry) => entry.id === 'gale_mast_face_left' && entry.type === 'wall' && rectOf(entry).bottom <= b.top - 2 * HALF_BODY_HEIGHT), 'wall faces over B')
  // A hero standing still is never blown off: no mast gust reaches a standing spot on a ledge or a carrier.
  for (const surface of [a, b, c, d, alcove]) {
    for (const hero of standingSpots(surface)) {
      for (const zone of [gust1, gust2]) {
        const inside = heroInZone(zone.rect, hero)
        assert.ok(!inside || (surface === b && zone === gust1) || (surface === d && zone === gust2), `${zone.id} reaches a hero standing at ${hero.left + 8}`)
      }
    }
  }
  for (const pair of [carrier1, carrier2]) {
    for (const ms of [0, 1800, 3600, 5400]) {
      for (const deck of laneSwapAt(pair, ms).platforms) {
        for (const hero of standingSpots({ left: deck.box.left, right: deck.box.right, top: deck.top })) {
          assert.ok(![gust1, gust2].some((zone) => heroInZone(zone.rect, hero)), `${deck.id} at ${ms}ms is out of the wind`)
        }
      }
    }
  }
  // The landing past the exit holds a dash jump the second gust carried (the probe landed it at x 4679).
  const landing = platform('gale_cable_landing')
  assert.ok(landing.left === right.right && landing.right >= 4720, 'the cable landing catches an overshoot')
})

test('Weather District secrets: the heart rides a gust on a dash jump, the sub tank is behind the office wall, the capsule on the route after the mid-boss', () => {
  const stage = arena()
  const anchors = stage.locationAnchors ?? {}
  const step = platform('gale_heart_step')
  const launch = platform('gale_heart_launch')
  const ledge = platform('gale_heart_ledge')
  const gust = windById('gale_gust_heart')
  const gap = ledge.left - launch.right
  assert.equal(launch.top, ledge.top, 'the launch ledge is level with the heart ledge')
  assert.ok(FLOOR - step.top < MAX_RISE_PX - 8 && step.top - launch.top < MAX_RISE_PX - 8 && launch.left - step.right <= 16, 'floor to step to launch ledge')
  assert.ok(FLOOR - ledge.top > MAX_RISE_PX + 6, 'the heart ledge is out of reach from the dock')
  // The back stop: flush with the ledge's far end, it catches a dash jump the gust carried too far.
  const back = platform('gale_heart_back')
  assert.ok(back.left === ledge.right && back.top <= ledge.top - 2 * HALF_BODY_HEIGHT - 40 && back.bottom >= ledge.top && back.type === 'solid', 'the back stop')
  // Nothing else stands within a jump of it (a crate or a vane would be a way round the gust).
  for (const entry of stage.midPlatforms) {
    if (['gale_heart_ledge', 'gale_heart_launch', 'gale_heart_back'].includes(entry.id)) continue
    const box = rectOf(entry)
    const reachable = box.top - ledge.top < MAX_RISE_PX + 6 && box.left < ledge.right + PLAIN_JUMP_PX && box.right > ledge.left - PLAIN_JUMP_PX
    assert.ok(!reachable, `${entry.id} is a way to the heart`)
  }
  assert.deepEqual([gust.rect.x, gust.rect.x + gust.rect.width, gust.direction], [launch.right + 8, ledge.left, 1])
  assert.ok(gust.rect.y + gust.rect.height <= FLOOR - MAX_RISE_PX - HALF_BODY_HEIGHT - 4, 'the heart gust is high over the dock: the floor under it is still')
  const drift = windDriftPx(gust, FLIGHT_MS)
  assert.ok(gap > DASH_JUMP_PX + BODY_PX, `${gap}px: a dash jump alone falls short`)
  assert.ok(gap > PLAIN_JUMP_PX + drift + BODY_PX, 'a running jump the gust carries falls short')
  assert.ok(gap + BODY_PX <= DASH_JUMP_PX + drift, 'a dash jump the gust carries clears it')
  assert.ok(ledge.right - ledge.left >= 96, 'wide enough to land a dash jump the gust carried')
  const room = (stage.verticalSegments ?? []).find((segment) => segment.id === 'gale_heart_room')
  assert.ok(room && room.verticalScreens === 2 && step.left >= room.x && ledge.right <= room.x + room.width, 'the heart room is two screens tall')
  assert.ok(!(stage.floorGaps ?? []).some((pit) => pit.x < ledge.right && pit.x + pit.width > launch.right), 'a missed jump lands on the dock, not in a gap')
  const heart = anchors.heart_tank
  assert.ok(heart && heart.x > ledge.left && heart.x < ledge.right && heart.y < ledge.top, 'on the heart ledge')
  // The sub tank: inside the dock office, its wall breaks on a charged shot, the route runs over its roof.
  const wall = (stage.breakableWalls ?? []).find((entry) => entry.id === 'gale_office_wall')
  const roof = platform('gale_office_roof')
  const bulkhead = platform('gale_office_bulkhead')
  assert.ok(wall && (wall.minChargeLevel ?? 0) >= 1 && (wall.hitsRequired ?? 3) >= 1)
  const box = rectOf(wall)
  assert.ok(roof.left <= box.left && roof.right >= bulkhead.left && box.top <= roof.bottom && box.bottom >= FLOOR, 'the office is sealed')
  assert.ok(FLOOR - roof.top < MAX_RISE_PX - 40, 'the roof is a hop from the floor')
  const sub = anchors.sub_tank
  assert.ok(sub && sub.x > box.right && sub.x < bulkhead.left && sub.y > roof.bottom, 'inside the office')
  assert.ok(sub.x >= 7 * SCREEN && sub.x < 8 * SCREEN, 'in the secret screen')
  // The capsule: in the alcove over C, on the route after the mid-boss.
  const alcove = platform('gale_mast_alcove')
  const lock = (stage.roomLocks ?? []).find((entry) => isDefeatLock(entry))
  const capsule = anchors.capsule
  assert.ok(capsule && capsule.x > alcove.left && capsule.x < alcove.right && capsule.y < alcove.top, 'the capsule sits in the alcove')
  assert.ok(lock && capsule.x > lock.gateX, 'after the mid-boss')
})

test('Weather District pickups sit on their anchors with the usual ids', () => {
  const byCategory = Object.fromEntries(getStageLocationDefinitions(STAGE).map((entry) => [entry.category, entry]))
  const anchors = arena().locationAnchors ?? {}
  for (const category of ['capsule', 'heart_tank', 'sub_tank', 'pickup_bonus'] as const) {
    assert.deepEqual([byCategory[category].id, byCategory[category].x, byCategory[category].y], [`${STAGE}:${category}`, anchors[category]?.x, anchors[category]?.y])
  }
})

test('Weather District enemies: 18+ of the six brief families and the Gale twins in the wind, spawning 448px ahead, the locked room', () => {
  const stage = getCampaignStage(STAGE)
  const markers = stage.enemyMarkers
  const route = markers.filter((entry) => !GALE_VIXEN_MIDBOSS_MARKERS.includes(entry.id))
  assert.ok(route.length >= 18, `${route.length} placements`)
  assert.deepEqual([...new Set(route.map((entry) => entry.typeKey))].sort(), FAMILIES)
  for (const entry of markers) {
    assert.ok((entry.spawnTriggerX ?? 0) <= entry.x - 448, `${entry.id} spawns a screen ahead`)
    assert.ok((entry.retireTriggerX ?? 0) > entry.x, `${entry.id} retires behind`)
    assert.ok(stage.arena.checkpoints.every((checkpoint) => Math.abs(checkpoint.x - entry.x) > 48), `${entry.id} is not on a checkpoint`)
  }
  const mastEnemies = route.filter((entry) => entry.x > GALE_VIXEN_MAST.left && entry.x < GALE_VIXEN_MAST.right)
  assert.ok(mastEnemies.length >= 3 && mastEnemies.every((entry) => (entry.retireTriggerX ?? 0) > GALE_VIXEN_MAST.right), 'the mast keeps its enemies until the hero is out of it')
  const lock = (stage.arena.roomLocks ?? []).find((entry) => isDefeatLock(entry))
  assert.ok(lock)
  assert.deepEqual(lock.defeatMarkers, GALE_VIXEN_MIDBOSS_MARKERS)
  assert.ok(MINIBOSS_SKINS.sentry_twin.includes('sentry_twin_gale'))
  for (const id of GALE_VIXEN_MIDBOSS_MARKERS) {
    const entry = markers.find((marker) => marker.id === id)
    assert.ok(entry && entry.typeKey === 'sentry_twin_gale', `${id} is the Gale skin`)
    assert.ok(entry.x > lock.room.x && entry.x < lock.gateX && (entry.retireTriggerX ?? 0) > lock.gateX, `${id} fights inside the room`)
    assert.ok((entry.patrolMinX ?? 0) > lock.room.x && (entry.patrolMaxX ?? Infinity) < lock.gateX, `${id} perches between the room's walls`)
    assert.ok(entry.y < FLOOR - SENTRY_TWINS_TUNING.floorClearance - SENTRY_TWINS_TUNING.perchClearance && entry.y > GAMEPLAY_ACTOR_CEILING, `${id} perches under the ceiling, over the dash line`)
  }
  assert.ok(!(stage.arena.floorGaps ?? []).some((gap) => gap.x < lock.gateX && gap.x + gap.width > lock.room.x), 'the room floor is whole')
  const wind = windById('gale_gust_midboss')
  assert.ok(wind.rect.x > lock.room.x && wind.rect.x + wind.rect.width < lock.gateX && wind.rect.width >= SCREEN - 64, 'the fight is in the wind')
  assert.ok(heroInZone(wind.rect, { left: lock.room.x + 200, right: lock.room.x + 216, top: FLOOR - 22, bottom: FLOOR }), 'the gust reaches a hero on the room floor')
  assert.ok(lock.room.x === 6 * SCREEN && lock.gateX === 7 * SCREEN, 'the mid-boss screen')
})
