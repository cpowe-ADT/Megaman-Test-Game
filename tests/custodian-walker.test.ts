import test from 'node:test'
import assert from 'node:assert/strict'
import {
  CUSTODIAN_TUNING,
  createCustodianState,
  killCustodian,
  stepCustodian,
  type CustodianEvent,
  type CustodianInput,
  type CustodianState
} from '../src/enemy/custodianWalker.ts'
import { hasFloorAt, hasWallAt, isWalkBlocked, type SolidRect } from '../src/enemy/floorProbe.ts'
import {
  CUSTODIAN_SHOCKWAVE,
  groundWaveHits,
  launchShockwaves,
  resolveShockwaveSpan,
  stepGroundWave
} from '../src/enemy/groundShockwave.ts'
import { resolveHeavyPush } from '../src/enemy/enemyDamage.ts'
import { EnemyCatalog } from '../src/enemy/EnemyCatalog.ts'
import { EnemyAnimationManifest } from '../src/enemy/EnemyAnimationManifest.ts'
import { mainGroundPlatforms } from '../src/stage/stageGeometry.ts'
import { getCampaignStage } from '../src/content/campaign.ts'
import { HEAT_WORKS_MIDBOSS_MARKERS } from '../src/content/stages/heatWorks.ts'

const T = CUSTODIAN_TUNING
const input = (patch: Partial<CustodianInput> = {}): CustodianInput => ({ dtMs: 16, dx: 60, dy: 0, hpFraction: 1, blockedAhead: false, ...patch })

/** Steps `ms` in 10 ms ticks, collecting every event and the phases passed through. */
function run(state: CustodianState, ms: number, patch: Partial<CustodianInput> = {}) {
  const events: CustodianEvent[] = []
  const phases = new Set<string>()
  let velocityX = 0
  for (let t = 0; t < ms; t += 10) {
    const step = stepCustodian(state, input({ ...patch, dtMs: 10 }))
    state = step.state
    velocityX = step.velocityX
    events.push(...step.events)
    phases.add(state.phase)
  }
  return { state, events, phases, velocityX }
}

const awake = (facing: 1 | -1 = 1): CustodianState => ({ ...createCustodianState(facing), phase: 'walk', cooldownMs: 0 })

test('custodian walker: wakes when the hero is in the room and walks toward it', () => {
  const far = run(createCustodianState(-1), 200, { dx: 500 })
  assert.equal(far.state.phase, 'dormant')
  const near = run(createCustodianState(-1), 200, { dx: 300 })
  assert.deepEqual([near.state.phase, near.state.facing, near.events[0]], ['walk', 1, 'aggro'])
  assert.equal(near.velocityX, T.walkSpeed)
})

test('custodian walker: in range it winds up 500 ms, stomps, recovers 700 ms', () => {
  let state = awake(1)
  let step = stepCustodian(state, input({ dx: 60 }))
  assert.deepEqual([step.state.phase, step.animState, step.events], ['windup', 'attack_windup', ['windup']])
  state = step.state
  const windup = run(state, T.windupMs - 20, { dx: 60 })
  assert.equal(windup.state.phase, 'windup', 'the tell lasts the full wind-up')
  const stomp = run(windup.state, 30, { dx: 60 })
  assert.deepEqual([stomp.state.phase, stomp.events], ['stomp', ['stomp']])
  const recover = run(stomp.state, T.stompMs + T.recoveryMs - 30, { dx: 60 })
  assert.equal(recover.state.phase, 'recover')
  step = stepCustodian(recover.state, input({ dx: 60, dtMs: 40 }))
  assert.equal(step.state.phase, 'walk')
  assert.equal(step.state.cooldownMs, T.stompCooldownMs, 'it walks a beat before the next wind-up')
})

test('custodian walker: it stomps before it turns (back exposed through the recovery)', () => {
  let state = stepCustodian(awake(1), input({ dx: 60 })).state
  // The hero jumps over it during the wind-up: the stomp and the recovery keep the old facing.
  const through = run(state, T.windupMs + T.stompMs + T.recoveryMs - 20, { dx: -60 })
  assert.equal(through.state.facing, 1)
  assert.ok(through.phases.has('stomp') && through.state.phase === 'recover')
  assert.ok(!through.events.includes('turn'))
  state = through.state
  const turned = run(state, 40 + T.turnMs + 20, { dx: -60 })
  assert.deepEqual([turned.state.facing, turned.events.includes('turn')], [-1, true])
  assert.ok(turned.phases.has('turn'))
})

test('custodian walker: turns at a ledge instead of walking off; stomps at a reachable hero from the edge', () => {
  const ledge = stepCustodian({ ...awake(1), cooldownMs: 500 }, input({ dx: 300, blockedAhead: true }))
  assert.deepEqual([ledge.state.phase, ledge.velocityX], ['turn', 0])
  const reach = stepCustodian(awake(1), input({ dx: 200, blockedAhead: true }))
  assert.equal(reach.state.phase, 'windup')
})

test('custodian walker: below half HP it winds up faster and walks faster', () => {
  const calm = stepCustodian(awake(1), input({ hpFraction: 0.5 }))
  const enraged = stepCustodian(awake(1), input({ hpFraction: 0.45 }))
  assert.equal(calm.state.windupMs, T.windupMs)
  assert.equal(enraged.state.windupMs, T.enragedWindupMs)
  assert.ok(T.enragedWindupMs < T.windupMs)
  const walk = stepCustodian({ ...awake(1), cooldownMs: 500 }, input({ dx: 200, hpFraction: 0.4 }))
  assert.equal(walk.velocityX, T.enragedWalkSpeed)
})

test('custodian walker: a kill plays the death frames, then the defeat fires once', () => {
  const dying = killCustodian(awake(1))
  assert.equal(dying.phase, 'dying')
  assert.equal(killCustodian(dying), dying)
  const done = run(dying, T.deathMs + 100)
  assert.deepEqual(done.events, ['defeated'])
  assert.equal(done.state.phase, 'gone')
})

// A floor 0..400 at y 236 with a block (a wall face at 100) and a ledge end at 400.
const SOLIDS: SolidRect[] = [
  { left: 0, right: 400, top: 236, bottom: 252 },
  { left: 60, right: 100, top: 204, bottom: 252 }
]

test('floor probes: ledge ends and wall faces block the walk; patrol bounds too', () => {
  assert.equal(hasFloorAt(SOLIDS, 200, 236), true)
  assert.equal(hasFloorAt(SOLIDS, 410, 236), false)
  assert.equal(hasWallAt(SOLIDS, 90, 236, 50), true)
  assert.equal(hasWallAt(SOLIDS, 200, 236, 50), false)
  const probe = { halfWidth: 22, floorTop: 236, bodyHeight: 50 }
  assert.equal(isWalkBlocked(SOLIDS, { ...probe, x: 200, facing: 1 }), false)
  assert.equal(isWalkBlocked(SOLIDS, { ...probe, x: 380, facing: 1 }), true, 'the ledge end')
  assert.equal(isWalkBlocked(SOLIDS, { ...probe, x: 124, facing: -1 }), true, 'the block face')
  assert.equal(isWalkBlocked(SOLIDS, { ...probe, x: 200, facing: 1, bounds: { minX: 150, maxX: 200 } }), true)
})

test('ground shockwave: runs both ways at 150 px/s, dies at a wall or a ledge end, and a jump clears it', () => {
  const def = CUSTODIAN_SHOCKWAVE
  assert.deepEqual([def.speed, def.height], [150, 16])
  const span = resolveShockwaveSpan(SOLIDS, 250, 236)
  assert.ok(span.minX >= 100 + def.width / 2 && span.minX <= 100 + def.width / 2 + 2, `stops at the wall (${span.minX})`)
  assert.ok(span.maxX <= 400 && span.maxX >= 396, `stops at the ledge end (${span.maxX})`)
  const arena = resolveShockwaveSpan(SOLIDS, 250, 236, def, { arena: { minX: 0, maxX: 320 } })
  assert.ok(arena.maxX <= 320)
  const waves = launchShockwaves(250, 236, span)
  assert.deepEqual(waves.map((wave) => [wave.dir, wave.x, wave.alive]), [[-1, 250 - def.spawnOffsetX, true], [1, 250 + def.spawnOffsetX, true]])
  const moved = stepGroundWave(waves[1], 500)
  assert.equal(moved.alive, true)
  assert.equal(moved.x, 250 + def.spawnOffsetX + 75)
  const ended = stepGroundWave(moved, 1000)
  assert.deepEqual([ended.alive, ended.x], [false, span.maxX], 'dies at its limit')
  const standing = { left: moved.x - 7, right: moved.x + 7, top: 214, bottom: 236 }
  const jumping = { left: moved.x - 7, right: moved.x + 7, top: 190, bottom: 212 }
  assert.equal(groundWaveHits(moved, standing), true)
  assert.equal(groundWaveHits(moved, jumping), false)
})

test('heavy: pellets and light swings do not push it; the combo finisher pushes a little', () => {
  const heavy = EnemyCatalog.custodian_walker.stats.heavy
  assert.ok(heavy)
  assert.equal(resolveHeavyPush(1, 120, heavy), null)
  assert.equal(resolveHeavyPush(2, 100, heavy), null)
  assert.deepEqual(resolveHeavyPush(4, -100, heavy), { vx: -heavy.pushSpeed, ms: heavy.pushMs })
})

test('custodian walker family: mini-boss stats, a body on its feet row, its own animation set', () => {
  const def = EnemyCatalog.custodian_walker
  assert.equal(def.stats.hp, 20)
  assert.equal(def.stats.contactDamage, 3)
  assert.deepEqual([def.collider.width, def.collider.height], [44, 50])
  // 64px frames, feet on row 62: the body's bottom sits 2px above the frame's bottom.
  assert.equal(64 - def.collider.height + def.collider.offsetY + def.collider.height, 62)
  assert.equal(def.brain, 'custodian_walker')
  assert.equal(def.deathSequenceMs, T.deathMs)
  const keys = EnemyAnimationManifest.custodian_walker.map((entry) => entry.key)
  for (const key of Object.values(def.animations)) assert.ok(keys.includes(key), key)
  const windup = EnemyAnimationManifest.custodian_walker.find((entry) => entry.key === 'custodian_walker_attack_windup')
  assert.equal(Math.round((3 / (windup?.frameRate ?? 1)) * 1000), T.windupMs, 'three wind-up frames fill the 500 ms tell')
})

test('Heat Works: the walker stands in the catwalk room; its waves stop at the step and at the gate', () => {
  const stage = getCampaignStage('pyro_maw')
  const arena = stage.arena
  const marker = stage.enemyMarkers.find((entry) => entry.id === HEAT_WORKS_MIDBOSS_MARKERS[0])
  assert.ok(marker && marker.typeKey === 'custodian_walker')
  const lock = (arena.roomLocks ?? [])[0]
  const solids: SolidRect[] = [
    ...mainGroundPlatforms('pyro_maw', 12 * 448 + 896, 252, arena.floorGaps),
    ...arena.midPlatforms.filter((platform) => platform.type === 'solid' || platform.type === 'wall')
  ].map((platform) => {
    const height = platform.height ?? 8
    return { left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - height / 2, bottom: platform.y + height / 2 }
  })
  const span = resolveShockwaveSpan(solids, 3500, 236, CUSTODIAN_SHOCKWAVE, {
    arena: { minX: (marker.patrolMinX ?? 0) - 22, maxX: (marker.patrolMaxX ?? 0) + 22 }
  })
  assert.ok(span.minX > 3344 && span.minX < 3360, `left wave stops at the catwalk step (${span.minX})`)
  assert.ok(span.maxX < lock.gateX && span.maxX > lock.gateX - 12, `right wave stops at the gate (${span.maxX})`)
})
