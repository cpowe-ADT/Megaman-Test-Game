// The warden boss rooms (prompt 12 part 12f wave 6, EVAL-P7-005): each stage's room data against the rules in
// `src/boss/bossRoomLayout.ts` (inside the span, shallow channels a boss stands across, anchors on solid floor).
import test from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStage, type CampaignStageId } from '../src/content/campaign'
import { REBUILT_STAGE_PATCHES } from '../src/content/stages/index'
import {
  BOSS_ROOM_CHANNEL_MAX_DEPTH,
  BOSS_ROOM_FLOOR_Y,
  bossRoomAnchorXs,
  bossRoomFeatureSpans,
  isOnRoomFloor,
  killPitGaps,
  type BossRoomFeatures,
  type BossRoomLayout
} from '../src/boss/bossRoomLayout'
import { BOSS_COMBAT_PROFILES } from '../src/bosses/bossCombatProfiles'
import { BOSS_ROSTER } from '../src/bosses/roster'
import { resolveDesperationArena } from '../src/boss/fightBeats'
import type { BossId } from '../src/bosses/types'

const WARDENS: Array<{ stageId: CampaignStageId; bossId: BossId; layout: BossRoomLayout }> = [
  { stageId: 'pyro_maw', bossId: 'pyro_maw', layout: 'pillars' },
  { stageId: 'tide_reaver', bossId: 'tide_reaver', layout: 'channels' },
  { stageId: 'volt_hopper', bossId: 'volt_hopper', layout: 'rails' },
  { stageId: 'basalt_titan', bossId: 'basalt_titan', layout: 'channels' },
  { stageId: 'ferro_blade', bossId: 'ferro_blade', layout: 'belts' },
  { stageId: 'mire_wraith', bossId: 'mire_wraith', layout: 'channels' },
  { stageId: 'gale_vixen', bossId: 'gale_vixen', layout: 'shaft' },
  { stageId: 'glacier_ronin', bossId: 'glacier_ronin', layout: 'ice_floor' }
]

const featuresOf = (stageId: CampaignStageId): BossRoomFeatures => {
  const features = REBUILT_STAGE_PATCHES[stageId]?.bossRoom
  assert.ok(features, `${stageId} authors its boss room`)
  return features
}
const floorBodyWidth = (bossId: BossId) => Number(BOSS_ROSTER[bossId].spritePlan.frame.x)
/** Solid floor with a margin: no cut within `margin` px of x. */
const onFloor = (x: number, gaps: ReadonlyArray<{ x: number; width: number }>, margin = 8) =>
  isOnRoomFloor(x, gaps.map((gap) => ({ x: gap.x - margin, width: gap.width + margin * 2 })))

test('every warden room matches its combat profile layout, and Rook keeps the flat room', () => {
  assert.equal(BOSS_COMBAT_PROFILES.sentinel_rook.room.layout, 'flat')
  for (const { stageId, bossId, layout } of WARDENS) {
    assert.equal(featuresOf(stageId).layout, layout, `${stageId} layout`)
    assert.equal(BOSS_COMBAT_PROFILES[bossId].room.layout, layout, `${bossId} profile layout`)
  }
})

test('every room feature sits inside its boss room span, and the route keeps its budget', () => {
  for (const { stageId } of WARDENS) {
    const room = getCampaignStage(stageId).arena.bossRoom
    for (const span of bossRoomFeatureSpans(featuresOf(stageId))) {
      assert.ok(span.left >= room.x && span.right <= room.x + room.width, `${stageId} ${span.id} ${span.left}-${span.right} inside ${room.x}-${room.x + room.width}`)
    }
  }
})

test('channels are shallow dips on a solid bed, narrower than the warden, never pits', () => {
  for (const { stageId, bossId } of WARDENS) {
    const arena = getCampaignStage(stageId).arena
    for (const channel of featuresOf(stageId).channels ?? []) {
      assert.ok(channel.depth > 0 && channel.depth <= BOSS_ROOM_CHANNEL_MAX_DEPTH, `${channel.id} depth ${channel.depth}`)
      assert.ok(arena.floorGaps?.some((gap) => gap.x === channel.x && gap.width === channel.width), `${channel.id} cuts the ground`)
      const bed = arena.midPlatforms.find((platform) => platform.id === `${channel.id}_bed`)
      assert.ok(bed && bed.type === 'solid', `${channel.id} has a solid bed`)
      assert.equal(bed.y - (bed.height ?? 8) / 2, BOSS_ROOM_FLOOR_Y + channel.depth, `${channel.id} bed top`)
      assert.ok(bed.x - bed.width / 2 <= channel.x && bed.x + bed.width / 2 >= channel.x + channel.width, `${channel.id} bed spans the cut`)
      // Centred over the channel the boss still stands 8px or more on each bank.
      assert.ok(channel.width + 16 <= floorBodyWidth(bossId), `${bossId} (${floorBodyWidth(bossId)}px) spans ${channel.id} (${channel.width}px)`)
    }
  }
})

test('only the channels drop out of the kill-plane strip: every route pit keeps it', () => {
  for (const { stageId } of WARDENS) {
    const arena = getCampaignStage(stageId).arena
    const channelXs = new Set((featuresOf(stageId).channels ?? []).map((channel) => channel.x))
    const expected = (arena.floorGaps ?? []).filter((gap) => !channelXs.has(gap.x))
    assert.deepEqual(killPitGaps(arena), expected, `${stageId} kill pits`)
  }
})

test('anchors, desperation hazards, the boss spawn and the hero entry stand on solid floor', () => {
  for (const { stageId, bossId } of WARDENS) {
    const arena = getCampaignStage(stageId).arena
    const room = arena.bossRoom
    const gaps = (arena.floorGaps ?? []).filter((gap) => gap.x + gap.width > room.x)
    const profile = BOSS_COMBAT_PROFILES[bossId].room
    const desperation = resolveDesperationArena(profile)
    const hazardXs = desperation.hazardFractions.map((fraction) => room.x + 24 + (room.width - 48) * fraction)
    const xs = [
      ...bossRoomAnchorXs(room, profile.anchorFractions),
      ...bossRoomAnchorXs(room, desperation.anchorFractions),
      ...hazardXs,
      arena.bossSpawn.x,
      room.playerIntroX
    ]
    for (const x of xs) assert.ok(onFloor(x, gaps), `${stageId}: x ${x.toFixed(1)} is over a channel`)
    // The boss spawns on open floor: its floor body clears every channel.
    const half = floorBodyWidth(bossId) / 2
    assert.ok(gaps.every((gap) => arena.bossSpawn.x + half <= gap.x || arena.bossSpawn.x - half >= gap.x + gap.width), `${stageId} spawn clear`)
  }
})

test('Pyro: two vents on the inner lanes and two pillars the dash runs through', () => {
  const arena = getCampaignStage('pyro_maw').arena
  const room = arena.bossRoom
  const vents = arena.hazards.filter((hazard) => hazard.id.startsWith('pyro_boss_vent'))
  const lanes = [0.38, 0.62].map((fraction) => room.x + 24 + (room.width - 48) * fraction)
  assert.deepEqual(vents.map((vent) => vent.kind), ['vent', 'vent'])
  vents.forEach((vent, index) => assert.ok(Math.abs(vent.x - lanes[index]) <= 1, `vent ${vent.id} on lane ${lanes[index]}`))
  assert.notEqual(vents[0].timing?.phaseMs, vents[1].timing?.phaseMs, 'the vents alternate')
  const caps = arena.midPlatforms.filter((platform) => platform.id.startsWith('pyro_boss_pillar') && platform.id.endsWith('_cap'))
  const posts = arena.midPlatforms.filter((platform) => platform.id.startsWith('pyro_boss_pillar') && platform.id.endsWith('_post'))
  assert.equal(caps.length, 2)
  assert.ok(posts.every((post) => post.type === 'passThrough'), 'Pyro dashes through the posts')
  const bossHeight = Number(BOSS_ROSTER.pyro_maw.spritePlan.frame.y)
  const spawnHalf = floorBodyWidth('pyro_maw') / 2
  for (const cap of caps) {
    assert.equal(cap.type, 'oneWay')
    assert.ok(cap.y + (cap.height ?? 8) / 2 <= BOSS_ROOM_FLOOR_Y - bossHeight - 2, `${cap.id} clears the dash`)
    assert.ok(Math.abs(cap.x - arena.bossSpawn.x) >= cap.width / 2 + spawnHalf, `${cap.id} clear of the spawn`)
  }
})

test('Tide water, Volt rails, Ferro belts, Mire acid and the Glacier ice', () => {
  const tide = getCampaignStage('tide_reaver').arena
  for (const channel of featuresOf('tide_reaver').channels ?? []) {
    const water = tide.waterLevelGates?.find((gate) => gate.id === `${channel.id}_water`)
    assert.ok(water && water.x === channel.x && water.width === channel.width && water.buoyancy === 0, `${channel.id} holds still water`)
  }
  const rails = getCampaignStage('volt_hopper').arena.timedRailGroups?.find((group) => group.id === 'volt_boss_rails')
  assert.equal(rails?.rails.length, 2)
  assert.ok(rails?.rails.every((rail) => rail.y === BOSS_ROOM_FLOOR_Y), 'rails stand on the floor line')
  const belts = (getCampaignStage('ferro_blade').arena.conveyors ?? []).filter((belt) => belt.id.startsWith('ferro_boss_belt'))
  assert.equal(belts.length, 2)
  assert.ok(belts.every((belt) => belt.y - (belt.height ?? 12) / 2 === BOSS_ROOM_FLOOR_Y), 'belts flush with the floor')
  assert.ok(Math.sign(belts[0].speed ?? 0) === -Math.sign(belts[1].speed ?? 0), 'belts run opposite ways')
  const mire = getCampaignStage('mire_wraith').arena
  for (const channel of featuresOf('mire_wraith').channels ?? []) {
    const acid = mire.hazards.find((hazard) => hazard.id === `${channel.id}_acid`)
    assert.ok(acid, `${channel.id} acid hurts`)
    const top = acid.y - (acid.height ?? 10) / 2
    const bottom = acid.y + (acid.height ?? 10) / 2
    assert.ok(top > BOSS_ROOM_FLOOR_Y && bottom <= BOSS_ROOM_FLOOR_Y + channel.depth + 1, `${acid.id} inside the dip`)
    assert.ok(acid.x - (acid.width ?? 28) / 2 >= channel.x && acid.x + (acid.width ?? 28) / 2 <= channel.x + channel.width)
  }
  const glacier = getCampaignStage('glacier_ronin').arena
  const ice = glacier.iceFloors?.find((floor) => floor.id === 'glacier_boss_ice')
  assert.ok(ice && ice.width === glacier.bossRoom.width && ice.y - (ice.height ?? 16) / 2 === BOSS_ROOM_FLOOR_Y, 'ice wall to wall, flush')
})

test('Gale: a two-screen shaft with walls both sides and ledges over her highest hover', () => {
  const arena = getCampaignStage('gale_vixen').arena
  const room = arena.bossRoom
  const shaft = arena.verticalSegments?.find((segment) => segment.id === 'gale_boss_shaft')
  assert.ok(shaft && shaft.x === room.x && shaft.width === room.width && shaft.verticalScreens === 2, 'the shaft is the room, two screens')
  const walls = arena.midPlatforms.filter((platform) => platform.id.startsWith('gale_boss_wall'))
  assert.deepEqual(walls.map((wall) => wall.type), ['wall', 'wall'])
  const shaftTop = 252 - 2 * 252
  walls.forEach((wall) => assert.equal(wall.y - (wall.height ?? 8) / 2, shaftTop, `${wall.id} reaches the shaft top`))
  const [left, right] = walls
  assert.ok(left.x - left.width / 2 === room.x && right.x + right.width / 2 === room.x + room.width, 'walls on both sides')
  assert.ok(left.y + (left.height ?? 8) / 2 <= BOSS_ROOM_FLOOR_Y - 64, 'the hero walks in under the left wall')
  const maxHover = Math.max(...Object.values(BOSS_COMBAT_PROFILES.gale_vixen.attacks).map((attack) => attack.motion.hoverHeight ?? 0))
  const ledges = arena.midPlatforms.filter((platform) => platform.id.startsWith('gale_boss_ledge'))
  assert.equal(ledges.length, 2)
  for (const ledge of ledges) {
    const top = ledge.y - (ledge.height ?? 8) / 2
    assert.ok(top < BOSS_ROOM_FLOOR_Y - maxHover - 8, `${ledge.id} (top ${top}) over her highest hover, so she lands on the floor`)
    const againstWall = walls.some((wall) => Math.abs(ledge.x - wall.x) <= (ledge.width + wall.width) / 2)
    assert.ok(againstWall, `${ledge.id} is wall-side`)
  }
})
