import test from 'node:test'
import assert from 'node:assert/strict'
import { stageVerticalTop } from '../src/stage/stageGeometry.ts'
import {
  applyRoomLockDefeats,
  armRoomLock,
  createRoomLockState,
  isDefeatLock,
  isWaveLock,
  roomLockWaveToSpawn,
  type RoomLockDefinition
} from '../src/mechanics/roomLock.ts'
import {
  crumbleBox,
  crumbleTiming,
  detectCrumbleStomps,
  isStompedCrumble,
  loadLineMarks,
  stepCrumble,
  type CrumbleStomperSample
} from '../src/mechanics/crumbleGroup.ts'
import { createRockfallState, isRockfallActive, stepRockfall, type RockfallDefinition } from '../src/mechanics/rockfall.ts'
import { getCampaignStage, getStageContentRetentionReport, type StagePlatformDefinition } from '../src/content/campaign.ts'
import { getStageLocationDefinitions } from '../src/progression/catalog.ts'
import { resolveHazard } from '../src/mechanics/hazards.ts'
import { BASALT_TITAN_CEILINGS, BASALT_TITAN_MIDBOSS_MARKERS } from '../src/content/stages/basaltTitan.ts'
import { GAMEPLAY_ACTOR_CEILING } from '../src/config/gameplayLayout.ts'

// Measured on this build (Heat Works, 2026-09-24): held running jump 246px across, 124-127px up; dash jump
// 336px across. The hero's body is 16x22.
const PLAIN_JUMP_PX = 246
const DASH_JUMP_PX = 336
const MAX_RISE_PX = 127
const BODY_PX = 16
const HALF_BODY_HEIGHT = 11
const FLOOR = 236
const SCREEN = 448

type Surface = { id: string; left: number; right: number; top: number; bottom: number; type: StagePlatformDefinition['type'] | 'crumble' }
function surface(platform: StagePlatformDefinition): Surface {
  const half = (platform.height ?? 8) / 2
  return { id: platform.id, left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - half, bottom: platform.y + half, type: platform.type }
}

function stage() {
  const { arena, enemyMarkers } = getCampaignStage('basalt_titan')
  const crumbles: Surface[] = (arena.crumbleGroups ?? []).flatMap((group) =>
    group.platforms.map((platform) => ({ id: platform.id, ...crumbleBox(platform), type: 'crumble' as const }))
  )
  const platforms = arena.midPlatforms.map(surface)
  const all = [...platforms, ...crumbles]
  const byId = new Map(all.map((entry) => [entry.id, entry]))
  return { arena, enemyMarkers, crumbles, platforms, all, byId }
}

/**
 * A jump arc (range `span`, rise `MAX_RISE_PX`) launched from `from`'s near edge lands on `to` if it clears
 * `to`'s top somewhere over it and no obstacle between them meets the hero's body at its near or far face.
 */
function canJumpOnto(from: Surface, to: Surface, span: number, obstacles: readonly Surface[] = []): boolean {
  const rightward = to.left >= from.right
  const edge = rightward ? from.right : from.left
  const near = Math.max(0, to.left - from.right, from.left - to.right)
  const far = near + (to.right - to.left)
  if (near > span) return false
  const best = Math.min(Math.max(span / 2, near), Math.min(far, span))
  const riseAt = (d: number) => (4 * MAX_RISE_PX * d * (span - d)) / (span * span)
  if (from.top - riseAt(best) >= to.top - 2) return false
  for (const wall of obstacles) {
    const between = rightward ? wall.left >= edge && wall.right <= to.left : wall.right <= edge && wall.left >= to.right
    if (!between) continue
    for (const x of [wall.left, wall.right]) {
      const d = Math.min(Math.abs(x - edge), span)
      const feet = from.top - riseAt(d)
      if (feet - 2 * HALF_BODY_HEIGHT < wall.bottom && feet > wall.top) return false
    }
  }
  return true
}

test('12d crumble stomp: a stomp group ignores the hero and shakes when a walker stomps facing it on its floor', () => {
  const timing = { shakeMs: 350, respawnMs: 2500, trigger: 'stomp' as const }
  const solid = { id: 's', groupId: 'g', phase: 'solid' as const, timerMs: 0 }
  assert.equal(stepCrumble(solid, { heroStanding: true, heroOverlapping: true, deltaMs: 16 }, timing), solid, 'the hero standing does not shake it')
  const shaking = stepCrumble(solid, { heroStanding: false, heroOverlapping: false, deltaMs: 16, stomped: true }, timing)
  assert.equal(shaking.phase, 'shaking')
  assert.equal(stepCrumble(shaking, { heroStanding: false, heroOverlapping: false, deltaMs: 349 }, timing).phase, 'shaking')
  assert.equal(stepCrumble(shaking, { heroStanding: false, heroOverlapping: false, deltaMs: 350 }, timing).phase, 'fallen', 'falls 350ms after the stomp')
  const land = { shakeMs: 350, respawnMs: 2500 }
  assert.equal(stepCrumble(solid, { heroStanding: false, heroOverlapping: false, deltaMs: 16, stomped: true }, land), solid, 'a land group ignores stomps')
  assert.equal(stepCrumble(solid, { heroStanding: true, heroOverlapping: true, deltaMs: 16 }, land).phase, 'shaking')
  assert.deepEqual(crumbleTiming({ id: 'g', platforms: [], trigger: 'stomp' }), { shakeMs: 400, respawnMs: 3000, trigger: 'stomp', stompReachPx: 176 })
  assert.deepEqual(crumbleTiming({ id: 'g', platforms: [] }), { shakeMs: 400, respawnMs: 3000 }, 'Heat Works keeps its defaults')

  const seen = new Map<string, string>()
  const walker = (state: string, facing: 1 | -1 = 1): CrumbleStomperSample => ({ id: 'w', typeKey: 'custodian_walker_basalt', state, facing, x: 100, bottom: 204 })
  assert.deepEqual(detectCrumbleStomps(seen, [walker('attack_windup')]), [])
  assert.deepEqual(detectCrumbleStomps(seen, [walker('attack_active'), { ...walker('attack_active'), id: 'hopper', typeKey: 'enemy_shock_hopper' }]), [{ x: 100, floorTop: 204, facing: 1 }], 'the edge into the stomp, walkers only')
  assert.deepEqual(detectCrumbleStomps(seen, [walker('attack_active')]), [], 'one stomp per stomp phase')
  detectCrumbleStomps(seen, [])
  assert.equal(seen.size, 0, 'a walker that is gone is forgotten')
  const box = (left: number, top = 204) => ({ left, right: left + 48, top, bottom: top + 8 })
  const stomp = { x: 100, floorTop: 204, facing: 1 as const }
  assert.equal(isStompedCrumble(box(140), stomp), true, 'ahead, on its floor')
  assert.equal(isStompedCrumble(box(20), stomp), false, 'behind it')
  assert.equal(isStompedCrumble(box(300), stomp), false, 'out of reach')
  assert.equal(isStompedCrumble(box(140, 236), stomp), false, 'another floor')
  assert.equal(isStompedCrumble(box(20), { ...stomp, facing: -1 }), true, 'facing left, the left side')
  const marks = loadLineMarks({ left: 100, right: 164, top: 204, bottom: 252 })
  assert.deepEqual(marks[0], { x: 100, y: 205, width: 64, height: 1 })
  assert.ok(marks.length === 9 && marks.slice(1).every((mark) => mark.y === 206 && mark.x >= 100 && mark.x + mark.width <= 164))
  assert.deepEqual(loadLineMarks({ left: 0, right: 6, top: 0, bottom: 8 }), [])
})

test('12d rockfall active span: a timer spawner waits only while the hero is inside its room', () => {
  const def: RockfallDefinition = { id: 'r', x: 100, topY: -200, floorY: 50, intervalMs: 1000, activeFromX: 0, activeToX: 448 }
  let state = createRockfallState(def)
  for (let ms = 0; ms < 3000; ms += 100) state = stepRockfall(def, state, { heroX: 900, prevHeroX: 900, hero: null, deltaMs: 100 }).state
  assert.deepEqual([state.phase, state.timerMs, state.drops], ['waiting', 0, 0], 'outside the room nothing counts')
  for (let ms = 0; ms < 1000; ms += 100) state = stepRockfall(def, state, { heroX: 200, prevHeroX: 200, hero: null, deltaMs: 100 }).state
  assert.equal(state.phase, 'warning', 'inside, it drops on its interval')
  assert.deepEqual([isRockfallActive({}, -5000), isRockfallActive(def, 448), isRockfallActive(def, 0)], [true, false, true])
})

test('12d room lock waves: the next wave spawns when the last falls; the gate opens on the final wave', () => {
  const marker = (id: string) => ({ id, typeKey: 'enemy_bouncer', x: 100, y: 80, spawnTriggerX: 0, retireTriggerX: 600 })
  const lock: RoomLockDefinition = { id: 'pad', room: { x: 0, y: 0, width: 448, height: 252 }, gateX: 448, defeatMarkers: ['a', 'b'], waves: [[marker('c'), marker('d')], []] }
  assert.deepEqual([isDefeatLock(lock), isWaveLock(lock), isWaveLock({ defeatMarkers: ['a'] }), isWaveLock({ waves: [[marker('c')]] })], [true, true, false, false])
  let state = armRoomLock(createRoomLockState(lock))
  assert.deepEqual([state.hitsRequired, state.wave, state.pendingWaves, state.remainingMarkers], [4, 0, [['c', 'd']], ['a', 'b']], 'empty waves drop out')
  let next = applyRoomLockDefeats(state, ['a'])
  assert.deepEqual([next.phase, next.wave, next.progress, roomLockWaveToSpawn(lock, state, next)], ['locked', 0, 1, []])
  state = next
  next = applyRoomLockDefeats(state, ['a', 'b'])
  assert.deepEqual([next.phase, next.wave, next.progress, next.remainingMarkers, next.pendingWaves], ['locked', 1, 2, ['c', 'd'], []])
  assert.deepEqual(roomLockWaveToSpawn(lock, state, next).map((entry) => entry.id), ['c', 'd'], 'wave two spawns')
  state = applyRoomLockDefeats(next, ['a', 'b', 'c', 'd'])
  assert.deepEqual([state.phase, state.satisfied, state.progress], ['open', true, 4])
  const early = applyRoomLockDefeats(armRoomLock(createRoomLockState(lock)), ['a', 'b'])
  assert.deepEqual([early.phase, early.wave], ['locked', 1], 'a first wave cleared before the hero walked in brings the next at once')
})

test('Structural Works route: twelve screens, four checkpoints clear of every mechanic, pits a plain jump clears', () => {
  const { arena, crumbles, platforms } = stage()
  assert.equal(getStageContentRetentionReport('basalt_titan')?.routeWidth, 12 * SCREEN)
  assert.equal(arena.allowFallOff, true)
  assert.equal(stageVerticalTop(arena, 252), -252, 'the headframe and the shaft are two screens tall')
  assert.deepEqual(arena.checkpoints.map((entry) => entry.id), ['basalt_start', 'basalt_mid_a', 'basalt_mid_b', 'basalt_boss_gate'])
  assert.equal(arena.checkpoints[1].radioSequenceId, 'basalt_titan_radio')
  const gaps = arena.floorGaps ?? []
  assert.ok(gaps.length >= 3)
  for (const gap of gaps) assert.ok(gap.width + BODY_PX <= PLAIN_JUMP_PX - 48, `pit at ${gap.x} is ${gap.width}px`)
  assert.ok(arena.hazards.length >= 8 && arena.hazards.every((hazard) => resolveHazard(hazard).kind === 'spikes'))
  const hazards = arena.hazards.map(resolveHazard)
  const rocks = arena.rockfalls ?? []
  const solids = platforms.filter((entry) => entry.type === 'solid' || entry.type === 'wall')
  for (const entry of arena.checkpoints) {
    for (const x of [entry.x, entry.triggerX + 8]) {
      assert.ok(!hazards.some((hazard) => Math.abs(hazard.x - x) < hazard.width / 2 + 24), `${entry.id} clear of spikes`)
      assert.ok(!gaps.some((gap) => x >= gap.x - 8 && x <= gap.x + gap.width + 8), `${entry.id} not over a pit`)
      assert.ok(!crumbles.some((box) => x >= box.left - 16 && x <= box.right + 16), `${entry.id} clear of crumbles`)
      assert.ok(!rocks.some((rock) => Math.abs(rock.x - x) < 32 || (rock.triggerX !== undefined && Math.abs(rock.triggerX - x) < 16)), `${entry.id} clear of rockfall`)
      assert.ok(!solids.some((block) => x > block.left - 8 && x < block.right + 8 && block.bottom > FLOOR - 40), `${entry.id} not in a block`)
    }
  }
  // Outside a tall room the world ceiling is y 90: every ledge a hero stands on above it sits in a room two
  // screens tall (the gallery roof is a ceiling under the HUD band, never stood on).
  const tall = (arena.verticalSegments ?? []).filter((segment) => segment.verticalScreens >= 2)
  assert.deepEqual(tall.map((segment) => segment.id), ['basalt_headframe', 'basalt_shaft'])
  const inTall = (left: number, right: number) => tall.some((segment) => left >= segment.x && right <= segment.x + segment.width)
  for (const entry of [...platforms, ...crumbles]) {
    if (entry.top - 2 * HALF_BODY_HEIGHT >= GAMEPLAY_ACTOR_CEILING || BASALT_TITAN_CEILINGS.includes(entry.id)) continue
    assert.ok(inTall(entry.left, entry.right), `${entry.id} (top ${entry.top}) rises past the actor ceiling outside a tall room`)
  }
})

test('Structural Works mechanics: crumbles shake 350ms and return in 2.5s, rocks land on what they fall onto, load lines mark what holds', () => {
  const { arena, all, crumbles, platforms, byId } = stage()
  const groups = arena.crumbleGroups ?? []
  assert.ok(groups.length >= 6 && crumbles.length >= 12)
  for (const group of groups) assert.deepEqual([crumbleTiming(group).shakeMs, crumbleTiming(group).respawnMs], [350, 2500], group.id)
  // Load lines: named solid-path platforms, never crumbles; every group but the mouth of the side shaft names one.
  for (const group of groups) {
    for (const id of group.loadLines ?? []) {
      const entry = byId.get(id)
      assert.ok(entry && entry.type !== 'crumble' && entry.type !== 'wall', `${group.id}: load line ${id} is a ledge that holds`)
    }
  }
  assert.ok(groups.every((group) => (group.loadLines ?? []).length > 0))
  // Rockfall: each boulder rests on the floor or on the ledge under its column, with nothing between.
  const gaps = arena.floorGaps ?? []
  const rocks = arena.rockfalls ?? []
  assert.ok(rocks.length >= 8)
  for (const rock of rocks) {
    const half = (rock.size ?? 22) / 2
    const landing = rock.floorY + half
    const onFloor = landing === FLOOR && !gaps.some((gap) => rock.x > gap.x && rock.x < gap.x + gap.width)
    const onLedge = all.some((entry) => entry.top === landing && rock.x - half >= entry.left && rock.x + half <= entry.right)
    assert.ok(onFloor || onLedge, `${rock.id} lands on something (${landing})`)
    const between = all.filter((entry) => entry.right > rock.x - half && entry.left < rock.x + half && entry.bottom > rock.topY - half && entry.top < landing)
    assert.deepEqual(between.map((entry) => entry.id), [], `${rock.id} falls clear`)
    if (rock.triggerX === undefined) {
      const room = (arena.verticalSegments ?? []).find((segment) => rock.x >= segment.x && rock.x < segment.x + segment.width)
      assert.ok(room && rock.activeFromX === room.x && rock.activeToX === room.x + room.width, `${rock.id} rains only while the hero is in its room`)
    }
  }
  // The first drop of the gallery lands before a running hero arrives (the safe first instance).
  const first = rocks.find((rock) => rock.id === 'basalt_rock_gallery_1')!
  assert.ok(first.x - first.triggerX! >= 240)
  const roof = byId.get('basalt_gallery_roof')!
  for (const rock of rocks.filter((entry) => entry.x > roof.left && entry.x < roof.right)) assert.equal(rock.topY - (rock.size ?? 22) / 2, roof.bottom, `${rock.id} hangs from the roof`)
  assert.ok(platforms.filter((entry) => entry.type === 'wall').length >= 3)
})

test('Structural Works master: the headframe and the shaft are two screens tall, walled, and the shaft descends on crumbling and load-lined ledges', () => {
  const { arena, byId } = stage()
  const shaft = (arena.verticalSegments ?? []).find((segment) => segment.id === 'basalt_shaft')!
  assert.equal(shaft.verticalScreens, 2)
  const left = byId.get('basalt_climb_wall_right')!
  const right = byId.get('basalt_shaft_wall_right')!
  assert.deepEqual([left.type, right.type], ['wall', 'wall'])
  assert.ok(left.right === shaft.x && right.right === shaft.x + shaft.width, 'wall faces on both sides of the shaft')
  // The descent a player holding right takes: over the climb's right wall onto the landing, onto the launch
  // crumble, off it onto the first crumbling ledge, onto the first load-lined ledge, down to the floor. A walk
  // at the run speed (220px/s) off an edge drifts 220 * sqrt(2 * drop / 1050) before it lands; a same-height
  // step is a gap narrower than the body.
  const links: Array<[string, string[]]> = [
    ['basalt_climb_wall_right', ['basalt_shaft_landing', 'basalt_shaft_launch', 'basalt_shaft_d1']],
    ['basalt_shaft_landing', ['basalt_shaft_launch']],
    ['basalt_shaft_launch', ['basalt_shaft_d1']],
    ['basalt_shaft_d1', ['basalt_shaft_s1']]
  ]
  for (const [fromId, toIds] of links) {
    const from = byId.get(fromId)!
    const targets = toIds.map((id) => byId.get(id)!)
    if (targets[0].top === from.top) {
      assert.ok(targets[0].left - from.right < BODY_PX / 2 + 1, `${from.id} steps onto ${targets[0].id}`)
      continue
    }
    // From a run still accelerating to the full run, the body lands on a target (2px of overlap or more).
    for (const speed of [140, 220]) {
      const lands = (to: Surface) => from.right + BODY_PX / 2 + speed * Math.sqrt((2 * (to.top - from.top)) / 1050)
      const onto = (to: Surface) => to.top > from.top && lands(to) + BODY_PX / 2 > to.left + 2 && lands(to) - BODY_PX / 2 < to.right - 2
      assert.ok(targets.some(onto), `${from.id} walks off at ${speed}px/s onto ${toIds}`)
    }
  }
  const s1 = byId.get('basalt_shaft_s1')!
  assert.ok(s1.top < FLOOR && !(arena.floorGaps ?? []).some((gap) => gap.x < s1.right + 32 && gap.x + gap.width > s1.left), 'the floor under the last drop is solid')
  const inShaft = (entry: { left: number; right: number }) => entry.left >= shaft.x && entry.right <= shaft.x + shaft.width
  assert.ok(['basalt_shaft_launch', 'basalt_shaft_d1', 'basalt_shaft_d2'].every((id) => byId.get(id)!.type === 'crumble' && inShaft(byId.get(id)!)))
  assert.ok((arena.rockfalls ?? []).filter((rock) => rock.x > shaft.x && rock.x < shaft.x + shaft.width).length >= 3, 'rockfall down the shaft')
  const climb = (arena.verticalSegments ?? []).find((segment) => segment.id === 'basalt_headframe')!
  assert.equal(climb.verticalScreens, 2)
  // The climb's rungs a jump apart: each next ledge is up to 44px higher and within a plain jump.
  const rungs = ['basalt_climb_1', 'basalt_climb_2', 'basalt_climb_3', 'basalt_climb_4', 'basalt_climb_c1', 'basalt_climb_c2', 'basalt_climb_7', 'basalt_climb_8', 'basalt_climb_9']
  for (let index = 1; index < rungs.length; index += 1) {
    const from = byId.get(rungs[index - 1])!
    const to = byId.get(rungs[index])!
    assert.ok(canJumpOnto(from, to, PLAIN_JUMP_PX), `${from.id} to ${to.id}`)
  }
})

test('Structural Works secrets: the heart is sealed behind a breakable wall, the sub tank needs a dash jump off a crumbling ledge, the capsule is before the mid-boss', () => {
  const { arena, all, byId } = stage()
  const anchors = arena.locationAnchors ?? {}
  // Heart: the crew hut is sealed (the wall under the roof, the bulkhead on the right); only a charged shot opens it.
  const wall = (arena.breakableWalls ?? []).find((entry) => entry.id === 'basalt_secret_wall')!
  const roof = byId.get('basalt_secret_roof')!
  const bulkhead = byId.get('basalt_secret_bulkhead')!
  assert.ok((wall.minChargeLevel ?? 0) >= 1 && wall.hitsRequired >= 1)
  assert.ok(wall.y - wall.height / 2 <= roof.bottom && wall.y + wall.height / 2 >= FLOOR, 'the wall closes the gap under the roof')
  assert.ok(roof.left <= wall.x - wall.width / 2 && roof.right >= bulkhead.left && bulkhead.bottom >= FLOOR && bulkhead.top <= roof.top)
  assert.ok(anchors.heart_tank && anchors.heart_tank.x > wall.x + wall.width / 2 && anchors.heart_tank.x < bulkhead.left && anchors.heart_tank.y > roof.bottom)
  // Sub tank: the side shaft across the chasm. The motor takes a kick off any solid face (`body.blocked`), so the
  // side shaft is one-way ledges only; no plain jump reaches it from anywhere, and a dash jump only from a ledge
  // that crumbles under the take-off (the launch): "a dash jump before the ledges fall".
  const launch = byId.get('basalt_shaft_launch')!
  const mouth = byId.get('basalt_side_mouth')!
  const shelf = byId.get('basalt_subtank_shelf')!
  const outer = byId.get('basalt_shaft_wall_right')!
  const pocketIds = ['basalt_side_mouth', 'basalt_side_mid', 'basalt_subtank_shelf']
  const pocket = pocketIds.map((id) => byId.get(id)!)
  assert.ok(pocket.every((entry) => entry.type === 'crumble' || entry.type === 'oneWay'), 'no face in the side shaft')
  assert.ok(pocket.filter((entry) => entry.type === 'crumble').length >= 2, 'the side shaft crumbles')
  assert.ok(shelf.top > Math.max(...pocket.filter((entry) => entry !== shelf).map((entry) => entry.top)), 'the shelf is its bottom')
  assert.equal(launch.type, 'crumble', 'the launch ledge crumbles: the dash jump must come before it falls')
  assert.ok(canJumpOnto(launch, mouth, DASH_JUMP_PX), 'a dash jump off the launch lands in the mouth')
  assert.ok(!canJumpOnto(launch, mouth, PLAIN_JUMP_PX), 'a plain jump falls short')
  const floor: Surface = { id: 'floor', left: -1e6, right: 1e6, top: FLOOR, bottom: 252, type: 'solid' }
  const sources = [floor, ...all.filter((entry) => !pocketIds.includes(entry.id) && entry.top > -252 + 2 * HALF_BODY_HEIGHT)]
  for (const target of pocket) {
    for (const from of sources) {
      assert.ok(!canJumpOnto(from, target, PLAIN_JUMP_PX), `${target.id} is out of a plain jump from ${from.id}`)
      if (from.type === 'crumble') continue
      assert.ok(!canJumpOnto(from, target, DASH_JUMP_PX), `${target.id} is out of a dash jump from ${from.id}, which holds`)
      // A dash toward a lower ledge keeps falling past its arc: 24px more reach.
      if (target.top > from.top) assert.ok(Math.max(0, target.left - from.right) > DASH_JUMP_PX + 24, `${target.id} is out of a falling dash from ${from.id}`)
    }
  }
  // The only face near the side shaft that rises within a jump of it is the outer wall over it, and no ledge that
  // holds reaches that wall with a jump (a kick climb needs a first touch).
  const nearFaces = all.filter(
    (entry) => (entry.type === 'wall' || entry.type === 'solid') && entry.top < shelf.top + MAX_RISE_PX + 2 * HALF_BODY_HEIGHT && Math.max(entry.left - shelf.right, mouth.left - entry.right) < DASH_JUMP_PX
  )
  assert.deepEqual(nearFaces.map((entry) => entry.id), [outer.id])
  for (const from of sources.filter((entry) => entry.type !== 'crumble' && Math.max(outer.left - entry.right, entry.left - outer.right) < DASH_JUMP_PX)) {
    assert.ok(from.top - MAX_RISE_PX - 2 * HALF_BODY_HEIGHT > outer.bottom, `${from.id} cannot touch the outer wall to kick up it`)
  }
  assert.ok(anchors.sub_tank && anchors.sub_tank.x > shelf.left && anchors.sub_tank.x < shelf.right && anchors.sub_tank.y < shelf.top)
  // Capsule: the alcove over the hut's roof, a plain jump from the roof, before the mid-boss room.
  const alcove = byId.get('basalt_capsule_ledge')!
  assert.ok(canJumpOnto(roof, alcove, PLAIN_JUMP_PX) || (alcove.left < roof.right && roof.top - alcove.top < MAX_RISE_PX - 20))
  assert.ok(anchors.capsule && anchors.capsule.x > alcove.left && anchors.capsule.x < alcove.right && anchors.capsule.y < alcove.top)
  const midboss = (arena.roomLocks ?? []).find((entry) => entry.id === 'basalt_midboss_lock')!
  assert.ok(anchors.capsule.x < midboss.room.x, 'the capsule comes before the mid-boss')
  const byCategory = Object.fromEntries(getStageLocationDefinitions('basalt_titan').map((entry) => [entry.category, entry]))
  assert.deepEqual([byCategory.heart_tank.id, byCategory.heart_tank.x, byCategory.heart_tank.y], ['basalt_titan:heart_tank', 2472, 218])
  assert.deepEqual([byCategory.sub_tank.x, byCategory.capsule.y, byCategory.pickup_bonus.x], [4008, 104, 4560])
})

test('Structural Works enemies: 18+ placements of the five brief families, the walker locked in the shaft head, waves at both pads', () => {
  const { arena, enemyMarkers: markers, byId, crumbles } = stage()
  assert.ok(markers.length >= 18)
  const families = ['enemy_armored_bot', 'enemy_bouncer', 'enemy_laser_eye', 'enemy_mine_bot', 'enemy_shock_hopper']
  assert.deepEqual([...new Set(markers.map((entry) => entry.typeKey))].sort(), [...families, 'custodian_walker_basalt'].sort())
  for (const family of families) assert.ok(markers.filter((entry) => entry.typeKey === family).length >= 2, `${family} appears more than once`)
  for (const entry of markers) {
    assert.ok((entry.spawnTriggerX ?? 0) <= entry.x - SCREEN, `${entry.id} spawns a screen ahead`)
    assert.ok((entry.retireTriggerX ?? 0) > entry.x, `${entry.id} retires behind`)
    assert.ok(arena.checkpoints.every((checkpoint) => Math.abs(checkpoint.x - entry.x) > 48), `${entry.id} is not on a checkpoint`)
  }
  const locks = arena.roomLocks ?? []
  // The mid-boss room is the one defeat lock without waves: its arming plays the callout.
  const plain = locks.filter((entry) => isDefeatLock(entry) && !isWaveLock(entry))
  assert.deepEqual(plain.map((entry) => entry.id), ['basalt_midboss_lock'])
  const lock = plain[0]
  assert.deepEqual(lock.defeatMarkers, BASALT_TITAN_MIDBOSS_MARKERS)
  const walker = markers.find((entry) => entry.id === 'basalt_mid_custodian')!
  assert.ok(walker.typeKey === 'custodian_walker_basalt' && walker.x > lock.room.x && walker.x < lock.gateX && (walker.retireTriggerX ?? 0) > lock.gateX)
  const pad = byId.get('basalt_head_pad')!
  assert.ok(walker.patrolMinX! >= pad.left && walker.patrolMaxX! <= pad.right && walker.y === pad.top - 51, 'it walks the load-lined pad')
  const stompGroup = (arena.crumbleGroups ?? []).find((group) => group.trigger === 'stomp')!
  const slabs = crumbles.filter((box) => stompGroup.platforms.some((platform) => platform.id === box.id))
  assert.ok(slabs.some((box) => box.right <= pad.left) && slabs.some((box) => box.left >= pad.right), 'slabs on both sides of the pad')
  for (const box of slabs) {
    assert.equal(box.top, pad.top, `${box.id} is on the walker's floor`)
    assert.ok(box.left >= lock.room.x && box.right <= lock.gateX)
    const reach = stompGroup.stompReachPx ?? 176
    const side = box.left >= pad.right ? 1 : -1
    const from = side > 0 ? walker.patrolMaxX! : walker.patrolMinX!
    assert.ok(isStompedCrumble(box, { x: from, floorTop: pad.top, facing: side }, reach), `${box.id} crumbles when the walker stomps facing it`)
    assert.ok(!isStompedCrumble(box, { x: from, floorTop: pad.top, facing: side > 0 ? -1 : 1 }, reach), `${box.id} holds when it faces away`)
  }
  // The pads: wave rooms whose first wave stands in the room and whose next waves spawn inside it.
  const waves = locks.filter(isWaveLock)
  assert.deepEqual(waves.map((entry) => entry.id), ['basalt_pad_a_lock', 'basalt_pad_b_lock'])
  let placements = markers.length
  for (const wave of waves) {
    for (const id of wave.defeatMarkers ?? []) {
      const entry = markers.find((marker) => marker.id === id)!
      assert.ok(entry.x > wave.room.x && entry.x < wave.gateX && (entry.retireTriggerX ?? 0) > wave.gateX, `${id} fights inside ${wave.id}`)
    }
    for (const entry of (wave.waves ?? []).flat()) {
      placements += 1
      assert.ok(families.includes(entry.typeKey), `${entry.id} is a brief family`)
      assert.ok(entry.x > wave.room.x && entry.x < wave.gateX && entry.spawnTriggerX === wave.room.x && (entry.retireTriggerX ?? 0) > wave.gateX, `${entry.id} drops into ${wave.id}`)
      assert.ok(!markers.some((marker) => marker.id === entry.id), `${entry.id} is not a streamed marker`)
    }
    assert.ok([...(wave.defeatMarkers ?? [])].some((id) => markers.find((marker) => marker.id === id)?.typeKey === 'enemy_shock_hopper'), 'shock hoppers on the pads')
  }
  assert.ok(placements >= 22)
})
