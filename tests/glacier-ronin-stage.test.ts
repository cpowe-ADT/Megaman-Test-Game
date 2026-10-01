import test from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStage, getStageContentRetentionReport } from '../src/content/campaign.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'
import { resolveHazard } from '../src/mechanics/hazards.ts'
import { isDefeatLock } from '../src/mechanics/roomLock.ts'
import { crumbleTiming } from '../src/mechanics/crumbleGroup.ts'
import { FROZEN_PIT_COLORS, frozenPitColors, iceFloorBox, iceFloorUnder } from '../src/mechanics/iceFloor.ts'
import {
  ICICLE_GRAVITY,
  ICICLE_HALF_WIDTH,
  ICICLE_REGROW_MS,
  ICICLE_SHADOW_START_SCALE,
  ICICLE_SHAKE_MS,
  createIcicleState,
  icicleMaxDrop,
  icicleRhythmAt,
  icicleShadow,
  resetIcicle,
  stepIcicle,
  type IcicleDefinition,
  type IcicleState
} from '../src/mechanics/icicle.ts'
import { CUSTODIAN_TUNING } from '../src/enemy/custodianWalker.ts'
import { MINIBOSS_SKINS } from '../src/enemy/minibossCatalog.ts'
import { GAMEPLAY_ACTOR_CEILING } from '../src/config/gameplayLayout.ts'
import {
  GLACIER_RONIN_GALLERY,
  GLACIER_RONIN_ICICLE_PERIOD_MS,
  GLACIER_RONIN_MIDBOSS_MARKERS,
  GLACIER_RONIN_SAFE_PATCHES
} from '../src/content/stages/glacierRonin.ts'

// Measured on this build (Heat Works, output/measure-jump.mjs, 2026-09-24): held running jump 246px across,
// 124-127px up; held dash jump 336px across; run speed 220px/s. Bodies (src/player/PlayerBodyProfiles.ts):
// stand 16x22, crouch 18 tall, dash 14 tall.
const PLAIN_JUMP_PX = 246
const DASH_JUMP_PX = 336
const MAX_RISE_PX = 127
const RUN_PX_PER_S = 220
const BODY_PX = 16
const HALF_BODY_HEIGHT = 11
const DASH_BODY_HEIGHT = 14
const CROUCH_BODY_HEIGHT = 18
const FLOOR = 236
const SCREEN = 448
const STAGE = 'glacier_ronin'
const FAMILIES = ['enemy_armored_bot', 'enemy_bouncer', 'enemy_drone', 'enemy_frost_turret', 'enemy_gunner_bot', 'enemy_laser_eye', 'enemy_mine_bot']
const FRAME = 1000 / 60

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
const iceById = (id: string) => {
  const entry = (getCampaignStage(STAGE).arena.iceFloors ?? []).find((candidate) => candidate.id === id)
  assert.ok(entry, id)
  return { ...iceFloorBox(entry), type: entry.type ?? 'solid' }
}
const heroAt = (x: number, feetY = FLOOR): Rect => ({ left: x - BODY_PX / 2, right: x + BODY_PX / 2, top: feetY - 2 * HALF_BODY_HEIGHT, bottom: feetY })

test('rhythm icicle: drops on the clock whoever is under it, grows back, never twice in one cycle; the respawn waits for the next window', () => {
  const icicle: IcicleDefinition = { id: 'r', x: 400, y: 104, floorY: 236, rhythm: { periodMs: 2400, offsetMs: 800 } }
  assert.deepEqual(icicleRhythmAt(icicle.rhythm!, 3300), { cycle: 1, sinceShakeMs: 100 })
  assert.deepEqual(icicleRhythmAt(icicle.rhythm!, 0), { cycle: -1, sinceShakeMs: 1600 })
  let state: IcicleState = createIcicleState(icicle)
  let clock = 0
  const runTo = (targetMs: number, hero: Rect | null = null) => {
    while (clock + FRAME <= targetMs) {
      clock += FRAME
      state = stepIcicle(icicle, state, { hero, deltaMs: FRAME, clockMs: clock }).state
    }
  }
  runTo(700, heroAt(400))
  assert.equal(state.phase, 'hanging', 'a hero under it before its window does not start it')
  runTo(900)
  assert.deepEqual([state.phase, state.cycle], ['shaking', 0], 'the window opens at the offset')
  assert.ok(Math.abs(state.timerMs - (clock - 800)) < 1, `in step with the clock (${state.timerMs} at ${clock})`)
  assert.deepEqual(icicleShadow(icicle, state), { visible: true, scale: ICICLE_SHADOW_START_SCALE }, 'the shadow shows while it shakes')
  runTo(800 + ICICLE_SHAKE_MS + 20)
  assert.equal(state.phase, 'falling')
  const fallMs = Math.sqrt((2 * icicleMaxDrop(icicle)) / ICICLE_GRAVITY) * 1000
  runTo(1200 + fallMs / 2)
  const mid = icicleShadow(icicle, state)
  assert.ok(mid.visible && mid.scale > ICICLE_SHADOW_START_SCALE && mid.scale < 1, `the shadow grows as it falls (${mid.scale})`)
  runTo(1200 + fallMs + 60)
  assert.deepEqual([state.phase, state.hits], ['shattered', 0], 'it shatters on the floor')
  assert.equal(icicleShadow(icicle, state).visible, false)
  runTo(1200 + fallMs + 60 + ICICLE_REGROW_MS + 20)
  assert.deepEqual([state.phase, state.dropY, state.cycle], ['hanging', 0, 0], 'it grows back')
  runTo(3180)
  assert.equal(state.phase, 'hanging', 'no second drop in the same cycle')
  runTo(3300)
  assert.deepEqual([state.phase, state.cycle], ['shaking', 1], 'the next cycle drops it again')
  // A hit shatters it on the hero; the respawn hangs it and it waits for the next window, not the current one.
  state = { ...state, phase: 'falling', timerMs: 0 }
  const hit = stepIcicle(icicle, { ...state, dropY: icicleMaxDrop(icicle) - 4 }, { hero: heroAt(404), deltaMs: FRAME, clockMs: clock })
  assert.deepEqual([hit.hit, hit.state.phase, hit.state.hits], [true, 'shattered', 1])
  state = resetIcicle(icicle, hit.state)
  assert.deepEqual([state.phase, state.cycle, state.hits], ['hanging', null, 1])
  assert.equal(stepIcicle(icicle, state, { hero: null, deltaMs: FRAME, clockMs: 800 + 2400 * 2 + 1000 }).state.phase, 'hanging', 'mid-cycle: waits')
  assert.equal(stepIcicle(icicle, state, { hero: null, deltaMs: FRAME, clockMs: 800 + 2400 * 3 + 10 }).state.phase, 'shaking', 'the next window')
})

test('a plain icicle keeps the 12b rule: it waits for the hero, ignores the clock and stays shattered', () => {
  const icicle: IcicleDefinition = { id: 'p', x: 400, y: 104, floorY: 236 }
  let state = stepIcicle(icicle, createIcicleState(icicle), { hero: null, deltaMs: FRAME, clockMs: 5000 }).state
  assert.equal(state.phase, 'hanging')
  state = stepIcicle(icicle, state, { hero: heroAt(410), deltaMs: FRAME, clockMs: 5016 }).state
  assert.deepEqual([state.phase, state.timerMs, state.cycle], ['shaking', 0, null])
  const shattered = { ...state, phase: 'shattered' as const }
  assert.equal(stepIcicle(icicle, shattered, { hero: null, deltaMs: 60000, clockMs: 9000 }).state.phase, 'shattered')
  assert.deepEqual(icicleShadow(icicle, { phase: 'hanging', dropY: 0 }), { visible: false, scale: 0 })
})

test('frozen pits: a stage with ice floors draws its pits as ice water; one without keeps the slag', () => {
  assert.deepEqual(frozenPitColors(getCampaignStage(STAGE).arena.iceFloors), { ...FROZEN_PIT_COLORS })
  assert.equal(frozenPitColors(getCampaignStage('pyro_maw').arena.iceFloors), undefined)
  assert.equal(frozenPitColors([]), undefined)
})

test('Public Archives route: twelve screens, four checkpoints clear of every mechanic, pits a plain jump clears', () => {
  const { arena } = getCampaignStage(STAGE)
  assert.equal(getStageContentRetentionReport(STAGE)?.routeWidth, 12 * SCREEN)
  assert.equal(arena.allowFallOff, true)
  assert.deepEqual(arena.checkpoints.map((entry) => entry.id), ['glacier_start', 'glacier_mid_a', 'glacier_mid_b', 'glacier_boss_gate'])
  assert.equal(arena.checkpoints[1].radioSequenceId, 'glacier_ronin_radio')
  const gaps = arena.floorGaps ?? []
  assert.ok(gaps.length >= 3 && arena.hazards.length >= 8, `${gaps.length} pits, ${arena.hazards.length} hazards`)
  for (const gap of gaps) assert.ok(gap.width + BODY_PX <= PLAIN_JUMP_PX - 48, `pit at ${gap.x} is ${gap.width}px`)
  const hazards = arena.hazards.map(resolveHazard)
  const solids = arena.midPlatforms.filter((entry) => entry.type === 'solid' || entry.type === 'wall')
  const ice = (arena.iceFloors ?? []).map(iceFloorBox)
  const icicles = arena.icicles ?? []
  const crumbles = (arena.crumbleGroups ?? []).flatMap((group) => group.platforms)
  for (const entry of arena.checkpoints) {
    for (const x of [entry.x, entry.triggerX + 8]) {
      assert.ok(!hazards.some((hazard) => Math.abs(hazard.x - x) < hazard.width / 2 + 24), `${entry.id} clear of spikes`)
      assert.ok(!ice.some((box) => x >= box.left - 16 && x <= box.right + 16), `${entry.id} clear of the ice`)
      assert.ok(!icicles.some((spike) => Math.abs(spike.x - x) < 48), `${entry.id} clear of icicles`)
      assert.ok(!crumbles.some((plank) => Math.abs(plank.x - x) < plank.width / 2 + 16), `${entry.id} clear of the shelves`)
      assert.ok(!gaps.some((gap) => x >= gap.x - 8 && x <= gap.x + gap.width + 8), `${entry.id} not over a pit`)
      assert.ok(!solids.some((block) => Math.abs(block.x - x) < block.width / 2 + 8 && block.y + (block.height ?? 8) / 2 > FLOOR - 40), `${entry.id} not in a block`)
    }
  }
  // The ice shelves (crumble group) lie over a frozen pit at floor height, and a run crosses each before it drops.
  const shelves = (arena.crumbleGroups ?? []).find((group) => group.id === 'glacier_ice_shelves')
  assert.ok(shelves && shelves.platforms.length >= 3)
  const { shakeMs } = crumbleTiming(shelves)
  for (const plank of shelves.platforms) {
    const box = rectOf(plank)
    assert.ok(gaps.some((gap) => box.left >= gap.x && box.right <= gap.x + gap.width), `${plank.id} over a pit`)
    assert.equal(box.top, FLOOR, `${plank.id} at floor height`)
    assert.ok(((plank.width + BODY_PX) / RUN_PX_PER_S) * 1000 < shakeMs, `${plank.id} is underfoot less than ${shakeMs}ms at a run`)
  }
  // Floor ice lies flush with the floor, never over a pit edge (a slide off it would be a blind drop).
  for (const box of ice.filter((entry) => entry.top === FLOOR)) {
    assert.ok(!gaps.some((gap) => box.right > gap.x && box.left < gap.x + gap.width), 'no ice over a pit')
  }
  // Outside a tall room the world ceiling is y 90: every ledge a hero stands on above it sits in a room two
  // screens tall. Ceiling slabs and stacks start at y 88 (in the ceiling band): nothing stands on them.
  const tall = (arena.verticalSegments ?? []).filter((segment) => segment.verticalScreens >= 2)
  const inTall = (left: number, right: number) => tall.some((segment) => left >= segment.x && right <= segment.x + segment.width)
  const surfaces = [...arena.midPlatforms.map((entry) => ({ id: entry.id, ...rectOf(entry) })), ...(arena.iceFloors ?? []).map((entry) => ({ id: entry.id, ...iceFloorBox(entry) }))]
  for (const surface of surfaces) {
    if (surface.top - 2 * HALF_BODY_HEIGHT >= GAMEPLAY_ACTOR_CEILING) continue
    if (surface.top <= GAMEPLAY_ACTOR_CEILING && !inTall(surface.left, surface.right)) {
      assert.ok(/ceiling|stack/.test(surface.id), `${surface.id} (top ${surface.top}) is a ceiling or a stack`)
      continue
    }
    assert.ok(inTall(surface.left, surface.right), `${surface.id} (top ${surface.top}) rises past the actor ceiling outside a tall room`)
  }
})

test('Public Archives gallery: walled by record stacks only a slide passes, ice lanes under rhythm icicles, grip patches, a turret per bay', () => {
  const { arena } = getCampaignStage(STAGE)
  const ceiling = platform('glacier_gallery_ceiling')
  assert.deepEqual([ceiling.left, ceiling.right, ceiling.type], [GLACIER_RONIN_GALLERY.left, GLACIER_RONIN_GALLERY.right, 'solid'])
  assert.ok(GLACIER_RONIN_GALLERY.left >= 7 * SCREEN && GLACIER_RONIN_GALLERY.right <= 10 * SCREEN, 'in the master segment')
  const stacks = arena.midPlatforms.filter((entry) => entry.id.startsWith('glacier_stack_')).map((entry) => ({ id: entry.id, ...rectOf(entry), type: entry.type }))
  assert.equal(stacks.length, 4)
  for (const stack of stacks) {
    assert.equal(stack.type, 'wall', `${stack.id}: the record stacks are walls`)
    assert.ok(stack.top <= ceiling.bottom && stack.left >= ceiling.left && stack.right <= ceiling.right, `${stack.id} hangs from the ceiling`)
    const slot = FLOOR - stack.bottom
    assert.ok(slot > DASH_BODY_HEIGHT + 2 && slot <= CROUCH_BODY_HEIGHT, `${stack.id}: an ${slot}px slot takes a slide and nothing taller`)
  }
  assert.equal(stacks[0].left, ceiling.left)
  assert.equal(stacks[stacks.length - 1].right, ceiling.right, 'a stack closes each end of the gallery')
  // Bays: between each pair of stacks, ice lanes and grip patches cover the floor edge to edge, no pits.
  const ice = (arena.iceFloors ?? []).filter((entry) => entry.id.startsWith('glacier_gallery_ice_')).map(iceFloorBox)
  const cover = [...ice.map((box) => ({ left: box.left, right: box.right, ice: true })), ...GLACIER_RONIN_SAFE_PATCHES.map((patch) => ({ ...patch, ice: false }))].sort((a, b) => a.left - b.left)
  const icicles = (arena.icicles ?? []).filter((entry) => entry.rhythm)
  for (let index = 0; index + 1 < stacks.length; index += 1) {
    const [from, to] = [stacks[index].right, stacks[index + 1].left]
    const bay = cover.filter((piece) => piece.left >= from && piece.right <= to)
    assert.equal(bay[0].left, from)
    assert.equal(bay[bay.length - 1].right, to)
    bay.forEach((piece, at) => at > 0 && assert.equal(piece.left, bay[at - 1].right, `bay ${index + 1} floor is continuous`))
    assert.ok(bay.filter((piece) => !piece.ice).length >= 2 && bay[0].ice, `bay ${index + 1}: ice under the slide, grip patches to stop on`)
    assert.ok(!(arena.floorGaps ?? []).some((gap) => gap.x < to && gap.x + gap.width > from), `bay ${index + 1} has no pit`)
    const turrets = getCampaignStage(STAGE).enemyMarkers.filter((entry) => entry.typeKey === 'enemy_frost_turret' && entry.x > from && entry.x < to)
    assert.equal(turrets.length, 1, `bay ${index + 1}: one frost turret`)
    assert.ok(to - turrets[0].x <= 16 && turrets[0].y > ceiling.bottom + 16 && turrets[0].y < FLOOR - 40, `bay ${index + 1}: the turret sits on the far stack`)
    assert.ok(icicles.some((spike) => spike.x > from && spike.x < to), `bay ${index + 1} has icicles`)
  }
  // Every rhythm icicle hangs from the ceiling line over an ice lane, clear of the grip patches, and its beat
  // leaves room for the shake, the fall and the regrow before the next.
  assert.ok(icicles.length >= 6)
  for (const spike of icicles) {
    assert.equal(spike.y, ceiling.bottom, `${spike.id} hangs from the ceiling`)
    assert.ok(ice.some((box) => spike.x - ICICLE_HALF_WIDTH >= box.left && spike.x + ICICLE_HALF_WIDTH <= box.right), `${spike.id} over an ice lane`)
    for (const patch of GLACIER_RONIN_SAFE_PATCHES) {
      assert.ok(spike.x + ICICLE_HALF_WIDTH + BODY_PX / 2 < patch.left || spike.x - ICICLE_HALF_WIDTH - BODY_PX / 2 > patch.right, `${spike.id} cannot hit a hero on a grip patch`)
    }
    const fallMs = Math.sqrt((2 * icicleMaxDrop(spike)) / ICICLE_GRAVITY) * 1000
    assert.equal(spike.rhythm?.periodMs, GLACIER_RONIN_ICICLE_PERIOD_MS)
    assert.ok(ICICLE_SHAKE_MS + fallMs + ICICLE_REGROW_MS + 400 < GLACIER_RONIN_ICICLE_PERIOD_MS, `${spike.id}: the beat is readable`)
  }
  // The icicles outside the gallery wait for the hero (the teach's safe first instances).
  assert.ok((arena.icicles ?? []).filter((entry) => !entry.rhythm).every((entry) => entry.x < GLACIER_RONIN_GALLERY.left))
})

test('Public Archives secrets: the sub tank needs a dash jump off the ice over a frozen pit, the heart is behind the ice wall, the capsule on the route', () => {
  const { arena } = getCampaignStage(STAGE)
  const anchors = arena.locationAnchors ?? {}
  const launch = iceById('glacier_store_launch')
  const step = platform('glacier_store_step')
  const ledge = platform('glacier_store_subtank')
  const back = platform('glacier_store_back')
  const gap = ledge.left - launch.right
  assert.deepEqual([launch.type, launch.top], ['oneWay', ledge.top], 'the launch ledge is ice, level with the sub tank ledge')
  assert.ok(gap > PLAIN_JUMP_PX + BODY_PX + 16 && gap < DASH_JUMP_PX - 24, `sub tank gap ${gap}px`)
  assert.ok((arena.floorGaps ?? []).some((pit) => pit.x >= launch.right && pit.x + pit.width <= ledge.left), 'a frozen pit under the gap')
  assert.ok(FLOOR - ledge.top > MAX_RISE_PX + 6, 'the floor under the sub tank is out of jump reach')
  assert.ok(FLOOR - step.top < MAX_RISE_PX - 8 && step.top - launch.top < MAX_RISE_PX - 8, 'floor to step to launch ledge on plain jumps')
  assert.ok(ledge.left - step.right > PLAIN_JUMP_PX - 24, 'the step is no plain-jump shortcut')
  assert.ok(back.left === ledge.right && back.top <= ledge.top - 2 * HALF_BODY_HEIGHT && back.bottom >= ledge.top, 'the back wall stops the landing slide')
  const store = (arena.verticalSegments ?? []).find((segment) => segment.id === 'glacier_cold_store')
  assert.ok(store && store.verticalScreens === 2 && launch.left >= store.x && back.right <= store.x + store.width, 'the cold store is two screens tall')
  assert.equal(iceFloorUnder(arena.iceFloors ?? [], heroAt(1840, launch.top), true), 'glacier_store_launch', 'standing on the launch ledge is standing on ice')
  const sub = anchors.sub_tank
  // Part 13e: the pickup sits on (not above) the ledge, so the ledge's own unreachability (line above) covers it.
  assert.ok(sub && sub.x > ledge.left && sub.x < ledge.right && sub.y < ledge.top, 'on the ledge, not from the floor')
  const wall = (arena.breakableWalls ?? []).find((entry) => entry.id === 'glacier_ice_wall')
  const roof = platform('glacier_vault_roof')
  const bulkhead = platform('glacier_vault_bulkhead')
  assert.ok(wall && (wall.minChargeLevel ?? 0) >= 1 && (wall.hitsRequired ?? 3) >= 1)
  const box = rectOf(wall)
  assert.ok(roof.left <= box.left && roof.right >= bulkhead.left && box.top <= roof.bottom && box.bottom >= FLOOR, 'the vault is sealed')
  assert.ok(anchors.heart_tank && anchors.heart_tank.x > box.right && anchors.heart_tank.x < bulkhead.left && anchors.heart_tank.y > roof.bottom)
  assert.ok(anchors.heart_tank.x >= 5 * SCREEN && anchors.heart_tank.x < 6 * SCREEN, 'in the secret screen')
  const crateA = platform('glacier_capsule_crate_a')
  const crateB = platform('glacier_capsule_crate_b')
  const capsule = anchors.capsule
  const lock = (arena.roomLocks ?? []).find((entry) => isDefeatLock(entry))
  assert.ok(capsule && capsule.x > crateA.right && capsule.x < crateB.left && capsule.y > FLOOR - 30, 'the capsule sits in the dip between the crates')
  assert.ok(lock && capsule.x < lock.room.x, 'before the mid-boss')
})

test('Public Archives pickups sit on their anchors with the usual ids', () => {
  const byCategory = Object.fromEntries(getStageLocationDefinitions(STAGE).map((entry) => [entry.category, entry]))
  const anchors = getCampaignStage(STAGE).arena.locationAnchors ?? {}
  for (const category of ['capsule', 'heart_tank', 'sub_tank', 'pickup_bonus'] as const) {
    assert.deepEqual([byCategory[category].id, byCategory[category].x, byCategory[category].y], [`${STAGE}:${category}`, anchors[category]?.x, anchors[category]?.y])
  }
})

test('Public Archives enemies: 18+ of the seven brief families and the Glacier custodian, spawning 448px ahead, the locked room on ice', () => {
  const stage = getCampaignStage(STAGE)
  const markers = stage.enemyMarkers
  const route = markers.filter((entry) => !GLACIER_RONIN_MIDBOSS_MARKERS.includes(entry.id))
  assert.ok(route.length >= 18, `${route.length} placements`)
  assert.deepEqual([...new Set(route.map((entry) => entry.typeKey))].sort(), FAMILIES)
  for (const entry of markers) {
    assert.ok((entry.spawnTriggerX ?? 0) <= entry.x - 448, `${entry.id} spawns a screen ahead`)
    assert.ok((entry.retireTriggerX ?? 0) > entry.x, `${entry.id} retires behind`)
    assert.ok(stage.arena.checkpoints.every((checkpoint) => Math.abs(checkpoint.x - entry.x) > 48), `${entry.id} is not on a checkpoint`)
  }
  const lock = (stage.arena.roomLocks ?? []).find((entry) => isDefeatLock(entry))
  assert.ok(lock)
  assert.deepEqual(lock.defeatMarkers, GLACIER_RONIN_MIDBOSS_MARKERS)
  assert.ok(MINIBOSS_SKINS.custodian_walker.includes('custodian_walker_glacier'))
  for (const id of GLACIER_RONIN_MIDBOSS_MARKERS) {
    const entry = markers.find((marker) => marker.id === id)
    assert.ok(entry && entry.typeKey === 'custodian_walker_glacier', `${id} is the Glacier skin`)
    assert.ok(entry.x > lock.room.x && entry.x < lock.gateX && (entry.retireTriggerX ?? 0) > lock.gateX, `${id} fights inside the room`)
    assert.ok((entry.patrolMinX ?? 0) > lock.room.x && (entry.patrolMaxX ?? Infinity) < lock.gateX, `${id} walks between the room's walls`)
    assert.ok(entry.x - lock.room.x >= CUSTODIAN_TUNING.aggroRangeX, `${id} wakes as the hero enters, not before`)
  }
  assert.ok(!(stage.arena.floorGaps ?? []).some((gap) => gap.x < lock.gateX && gap.x + gap.width > lock.room.x), 'the room floor is whole')
  const roomIce = iceById('glacier_mid_ice')
  assert.ok(roomIce.left > lock.room.x && roomIce.right < lock.gateX && roomIce.right - roomIce.left >= SCREEN / 2, 'the fight is on the ice')
  assert.ok(lock.room.x === 6 * SCREEN && lock.gateX === 7 * SCREEN, 'the mid-boss screen')
})
