import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  RELAY_NEST_TUNING,
  createRelayNestState,
  killRelayNest,
  relayNestWindupTimeScale,
  stepRelayNest,
  type RelayNestEvent,
  type RelayNestInput,
  type RelayNestState
} from '../src/enemy/relayTurretNest.ts'
import { RELAY_NEST_MORTAR, launchMortar, mortarApexY, mortarBlastHits, stepMortar } from '../src/enemy/mortarShell.ts'
import {
  SENTRY_TWINS_TUNING,
  createTwinsState,
  killTwins,
  stepTwins,
  twinsDashLine,
  type TwinPose,
  type TwinsEvent,
  type TwinsInput,
  type TwinsState
} from '../src/enemy/sentryTwins.ts'
import {
  DRILL_SERPENT_TUNING,
  SERPENT_ANIMATIONS,
  createSerpentState,
  isSerpentUnderground,
  killSerpent,
  serpentAnimationSuffix,
  stepSerpent,
  type SerpentEvent,
  type SerpentState
} from '../src/enemy/drillSerpent.ts'
import { MINIBOSS_CATALOG, MINIBOSS_TYPE_KEYS, minibossDefeatDrop } from '../src/enemy/minibossCatalog.ts'
import { EnemyCatalog } from '../src/enemy/EnemyCatalog.ts'
import { EnemyAnimationManifest } from '../src/enemy/EnemyAnimationManifest.ts'
import { resolveLevelEnemyMarkers } from '../src/enemy/EnemyLevelData.ts'
import { CAMPAIGN_STAGES, getCampaignStage } from '../src/content/campaign.ts'
import { MINIBOSS_LAB_ROOMS, MINIBOSS_LAB_STAGE_ID } from '../src/content/stages/minibossLab.ts'

const DT = 10

// ---------- relay turret nest ----------

type NestLog = { state: RelayNestState; events: Array<{ at: number; event: RelayNestEvent }>; x: number; maxOffset: number; phases: string[] }

/** Steps `ms` in 10 ms ticks from `at`, integrating the shuffle, logging events with their time. */
function runNest(log: NestLog, ms: number, patch: Partial<RelayNestInput> = {}, at = 0): NestLog {
  let { state, x, maxOffset } = log
  const events = [...log.events]
  const phases = [...log.phases]
  for (let t = 0; t < ms; t += DT) {
    const step = stepRelayNest(state, { dtMs: DT, dx: -150, dy: 0, offsetX: x, blockedShuffle: false, ...patch })
    state = step.state
    x += (step.velocityX * DT) / 1000
    maxOffset = Math.max(maxOffset, Math.abs(x))
    step.events.forEach((event) => events.push({ at: at + t + DT, event }))
    if (phases[phases.length - 1] !== state.phase) phases.push(state.phase)
  }
  return { state, events, x, maxOffset, phases }
}

const nestStart = (): NestLog => ({ state: createRelayNestState(1), events: [], x: 0, maxOffset: 0, phases: [] })
const timesOf = (log: NestLog, event: RelayNestEvent) => log.events.filter((entry) => entry.event === event).map((entry) => entry.at)

test('relay turret nest: wakes facing the hero, shuffles a little, then a 600 ms barrel-glow tell and an aimed three-shot burst 150 ms apart', () => {
  const log = runNest(nestStart(), 1600)
  assert.equal(log.events[0].event, 'aggro')
  assert.equal(log.state.facing, -1, 'it turned to the hero on the left when it woke')
  assert.ok(log.phases.includes('shuffle'))
  assert.ok(log.maxOffset <= RELAY_NEST_TUNING.shuffleRangeX + 1, `it stays within its shuffle range (${log.maxOffset})`)
  const [windupAt] = timesOf(log, 'burst_windup')
  const shots = timesOf(log, 'shot')
  assert.equal(shots.length, 3)
  const tellMs = shots[0] - windupAt
  assert.ok(tellMs >= RELAY_NEST_TUNING.burstWindupMs && tellMs <= RELAY_NEST_TUNING.burstWindupMs + 2 * DT, `a 600 ms tell (${tellMs})`)
  assert.deepEqual([shots[1] - shots[0], shots[2] - shots[1]], [150, 150])
  assert.equal(relayNestWindupTimeScale({ phase: 'burst_windup' }), 1)
})

test('relay turret nest: the attacks alternate, burst then a mortar after a 500 ms wind-up, then a burst again', () => {
  const log = runNest(nestStart(), 7000)
  const order = log.events.filter((entry) => entry.event === 'burst_windup' || entry.event === 'mortar_windup').map((entry) => entry.event)
  assert.deepEqual(order.slice(0, 3), ['burst_windup', 'mortar_windup', 'burst_windup'])
  const [mortarWindupAt] = timesOf(log, 'mortar_windup')
  const [mortarAt] = timesOf(log, 'mortar')
  assert.equal(mortarAt - mortarWindupAt, RELAY_NEST_TUNING.mortarWindupMs)
  assert.equal(log.state.mortars, 1)
  assert.ok(log.state.bursts >= 1)
  assert.equal(relayNestWindupTimeScale({ phase: 'mortar_windup' }), 600 / 500)
})

test('relay turret nest: it turns to face the hero between attacks, never during one', () => {
  let log = runNest(nestStart(), 520)
  assert.equal(log.state.phase, 'burst_windup')
  // The hero crosses behind it during the wind-up: the burst still fires, then the recovery ends in a turn.
  log = runNest(log, 1100, { dx: 150 }, 520)
  assert.equal(timesOf(log, 'shot').length, 3)
  assert.equal(log.state.facing, -1, 'no turn during the attack')
  log = runNest(log, 1200, { dx: 150 }, 1620)
  assert.ok(log.events.some((entry) => entry.event === 'turn'))
  assert.equal(log.state.facing, 1, 'it faces the hero after the recovery')
})

test('relay turret nest: a kill plays the death frames, then the defeat fires once', () => {
  let state = killRelayNest(runNest(nestStart(), 300).state)
  assert.equal(state.phase, 'dying')
  assert.equal(killRelayNest(state), state)
  const events: RelayNestEvent[] = []
  for (let t = 0; t < 700; t += DT) {
    const step = stepRelayNest(state, { dtMs: DT, dx: -40, dy: 0, offsetX: 0, blockedShuffle: false })
    state = step.state
    events.push(...step.events)
  }
  assert.deepEqual(events, ['defeated'])
  assert.equal(state.phase, 'gone')
})

test('mortar shell: lands exactly on its target after its flight, arcs well above the muzzle, and only the landed blast hurts', () => {
  let shell = launchMortar(100, 190, 260, 236)
  assert.ok(mortarApexY(shell) < 190 - 60, `a lob, not a line (${mortarApexY(shell)})`)
  const hero = (x: number, bottom = 236) => ({ left: x - 8, right: x + 8, top: bottom - 28, bottom })
  let flightHit = false
  for (let t = 0; t < RELAY_NEST_MORTAR.flightMs - DT; t += DT) {
    shell = stepMortar(shell, DT)
    flightHit ||= mortarBlastHits(shell, hero(shell.x, shell.y + 4))
  }
  assert.equal(shell.stage, 'flight')
  assert.equal(flightHit, false, 'the shell in flight hurts nobody')
  shell = stepMortar(shell, DT)
  assert.deepEqual([shell.stage, shell.x, shell.y], ['blast', 260, 236])
  assert.equal(mortarBlastHits(shell, hero(260)), true, 'a hero on the marker is hit')
  assert.equal(mortarBlastHits(shell, hero(290)), false, 'a hero who stepped off the marker is clear')
  assert.equal(mortarBlastHits(shell, hero(260, 236 - RELAY_NEST_MORTAR.blastHeight - 1)), false, 'a hero above the blast is clear')
  shell = stepMortar(shell, RELAY_NEST_MORTAR.blastMs)
  assert.equal(shell.stage, 'spent')
})

// ---------- sentry twins ----------

const PERCHES = [{ x: 100, y: 136 }, { x: 356, y: 136 }] as const
type TwinsLog = { state: TwinsState; events: Array<{ at: number; event: TwinsEvent }>; poses: [TwinPose, TwinPose] | null; at: number; shooterPoses: TwinPose[] }

function runTwins(log: TwinsLog, ms: number, patch: Partial<TwinsInput> = {}): TwinsLog {
  let { state, poses, at } = log
  const events = [...log.events]
  const shooterPoses = [...log.shooterPoses]
  for (let t = 0; t < ms; t += DT) {
    const step = stepTwins(state, { dtMs: DT, heroX: 228, heroY: 214, floorTop: 236, ...patch })
    state = step.state
    poses = step.poses
    at += DT
    step.events.forEach((event) => events.push({ at, event }))
    shooterPoses.push(step.poses[step.state.shooter])
  }
  return { state, events, poses, at, shooterPoses }
}

const twinsStart = (): TwinsLog => ({ state: createTwinsState(PERCHES), events: [], poses: null, at: 0, shooterPoses: [] })
const twinTimes = (log: TwinsLog, event: TwinsEvent) => log.events.filter((entry) => entry.event === event).map((entry) => entry.at)

test('sentry twins: twin 0 crackles 600 ms and bolts; twin 1 drops to the hero, flashes 450 ms and dashes across, short of twin 0', () => {
  let log = runTwins(twinsStart(), 1900)
  assert.equal(log.events[0].event, 'aggro')
  const [windupAt] = twinTimes(log, 'bolt_windup')
  const [boltAt] = twinTimes(log, 'bolt')
  assert.equal(boltAt - windupAt, SENTRY_TWINS_TUNING.boltWindupMs)
  assert.equal(log.state.bolts, 1)
  const [flashAt] = twinTimes(log, 'flash')
  assert.equal(flashAt - boltAt, SENTRY_TWINS_TUNING.boltMs + SENTRY_TWINS_TUNING.lineUpMs)
  assert.equal(log.state.phase, 'flash')
  assert.deepEqual([log.poses?.[1].x, log.poses?.[1].y], [356, 214], 'the swooper holds at the hero height under the flash')
  log = runTwins(log, 460)
  const [swoopAt] = twinTimes(log, 'swoop')
  assert.equal(swoopAt - flashAt, SENTRY_TWINS_TUNING.flashMs)
  log = runTwins(log, 700)
  assert.equal(log.state.phase, 'rise')
  assert.equal(log.state.swooper.x, PERCHES[0].x + SENTRY_TWINS_TUNING.swoopStopShortX, 'the dash stops short of the other perch')
  assert.ok(log.shooterPoses.every((pose) => pose.x === PERCHES[0].x && pose.y === PERCHES[0].y), 'the shooter holds its perch')
})

test('sentry twins: after the swooper flies home the roles swap; the next round twin 1 bolts and twin 0 dashes the other way', () => {
  let log = runTwins(twinsStart(), 4200)
  assert.ok(twinTimes(log, 'swap').length >= 1)
  assert.equal(log.state.shooter, 1)
  assert.equal(log.state.rounds, 1)
  log = runTwins(log, 2200)
  assert.equal(log.state.bolts, 2)
  assert.equal(log.state.swoops, 2)
  assert.equal(log.poses?.[0].pose, 'dash')
  assert.equal(log.poses?.[0].facing, 1, 'twin 0 dashes toward twin 1')
})

test('sentry twins: the dash line follows the hero, kept over the floor and under the perches; one kill fells both', () => {
  assert.equal(twinsDashLine(214, 136, 236), 214)
  assert.equal(twinsDashLine(100, 136, 236), 136 + SENTRY_TWINS_TUNING.perchClearance)
  assert.equal(twinsDashLine(240, 136, 236), 236 - SENTRY_TWINS_TUNING.floorClearance)
  let state = killTwins(runTwins(twinsStart(), 900).state)
  const events: TwinsEvent[] = []
  let poses: [TwinPose, TwinPose] | null = null
  for (let t = 0; t < 700; t += DT) {
    const step = stepTwins(state, { dtMs: DT, heroX: 228, heroY: 214, floorTop: 236 })
    state = step.state
    poses = step.poses
    events.push(...step.events)
  }
  assert.deepEqual(events, ['defeated'])
  assert.deepEqual(poses?.map((pose) => pose.pose), ['dead', 'dead'])
})

// ---------- drill serpent ----------

type SerpentLog = { state: SerpentState; x: number; heroX: number; at: number; events: Array<{ at: number; event: SerpentEvent }>; undergroundAt: string[] }

function runSerpent(log: SerpentLog, ms: number, patch: { heroX?: number; blockedAhead?: boolean } = {}): SerpentLog {
  let { state, x, at } = log
  const heroX = patch.heroX ?? log.heroX
  const events = [...log.events]
  const undergroundAt = [...log.undergroundAt]
  for (let t = 0; t < ms; t += DT) {
    const step = stepSerpent(state, { dtMs: DT, dx: heroX - x, dy: 0, x, bounds: { minX: 40, maxX: 408 }, blockedAhead: Boolean(patch.blockedAhead) })
    state = step.state
    x += (step.velocityX * DT) / 1000
    at += DT
    step.events.forEach((event) => events.push({ at, event }))
    if (isSerpentUnderground(state.phase) && !undergroundAt.includes(state.phase)) undergroundAt.push(state.phase)
  }
  return { state, x, heroX, at, events, undergroundAt }
}

const serpentStart = (heroX = 150): SerpentLog => ({ state: createSerpentState(-1), x: 320, heroX, at: 0, events: [], undergroundAt: [] })
const serpentTimes = (log: SerpentLog, event: SerpentEvent) => log.events.filter((entry) => entry.event === event).map((entry) => entry.at)

test('drill serpent: burrows, tunnels under the hero, shakes a 500 ms mound there, then bursts up under the hero', () => {
  const log = runSerpent(serpentStart(), 2800)
  const [burrowAt] = serpentTimes(log, 'burrow')
  const [moundAt] = serpentTimes(log, 'mound')
  const [burstAt] = serpentTimes(log, 'burst')
  assert.ok(burrowAt > 0 && moundAt > burrowAt + DRILL_SERPENT_TUNING.burrowMs)
  assert.equal(burstAt - moundAt, DRILL_SERPENT_TUNING.moundMs, 'the mound is the 500 ms tell')
  assert.deepEqual(log.undergroundAt, ['burrow', 'tunnel', 'mound'], 'underground (and unhurtable) from the dive to the burst')
  assert.ok(Math.abs((log.state.moundX ?? 0) - 150) <= DRILL_SERPENT_TUNING.arriveDeadZoneX, `it came up under the hero (${log.state.moundX})`)
  assert.equal(isSerpentUnderground('burst'), false)
  assert.deepEqual(['burrow', 'mound', 'burst', 'lunge'].map((phase) => serpentAnimationSuffix(phase as SerpentState['phase'])), ['burrow', 'mound', 'emerge', null])
})

test('drill serpent: a hero past the room edge sees it come up beside, at the edge', () => {
  const log = runSerpent(serpentStart(10), 2800)
  assert.equal(log.state.moundX, 40)
})

test('drill serpent: after the burst, a 500 ms coil then a lunge along the floor toward the hero, then it burrows again', () => {
  let log = runSerpent(serpentStart(), 5200)
  const [coilAt] = serpentTimes(log, 'coil')
  const [lungeAt] = serpentTimes(log, 'lunge')
  assert.equal(lungeAt - coilAt, DRILL_SERPENT_TUNING.coilMs, 'the coil is the lunge tell')
  assert.equal(log.state.lunges, 1)
  assert.equal(log.state.bursts, 1)
  log = runSerpent(log, 1600)
  assert.equal(log.state.burrows, 2, 'the attacks alternate')
})

test('drill serpent: a wall or the room edge ends the lunge; a kill plays the death frames then defeats once', () => {
  let log = runSerpent(serpentStart(), 3800)
  while (log.state.phase !== 'lunge') log = runSerpent(log, DT)
  log = runSerpent(log, DT, { blockedAhead: true })
  assert.equal(log.state.phase, 'recover')
  let state = killSerpent(log.state)
  const events: SerpentEvent[] = []
  for (let t = 0; t < 700; t += DT) {
    const step = stepSerpent(state, { dtMs: DT, dx: 0, dy: 0, x: 200, blockedAhead: false })
    state = step.state
    events.push(...step.events)
  }
  assert.deepEqual(events, ['defeated'])
})

// ---------- roster, catalog, atlases ----------

const BRAINS: Record<string, string> = {
  custodian_walker: 'custodian_walker',
  custodian_walker_basalt: 'custodian_walker',
  custodian_walker_glacier: 'custodian_walker',
  relay_turret_nest: 'relay_turret_nest',
  relay_turret_nest_ferro: 'relay_turret_nest',
  sentry_twin: 'sentry_twins',
  sentry_twin_gale: 'sentry_twins',
  drill_serpent: 'drill_serpent'
}

test('mini-boss roster: four archetypes and four skins, each its own family with its brain, its animation set and a forced health drop', () => {
  assert.deepEqual([...MINIBOSS_TYPE_KEYS].sort(), Object.keys(BRAINS).sort())
  for (const [key, brain] of Object.entries(BRAINS)) {
    const definition = EnemyCatalog[key]
    assert.ok(definition === MINIBOSS_CATALOG[key], `${key} is in the enemy catalog`)
    assert.deepEqual([definition.typeKey, definition.brain, definition.role], [key, brain, 'miniboss'])
    assert.equal(minibossDefeatDrop(definition), 'health')
    const manifestKeys = (EnemyAnimationManifest[key] ?? []).map((entry) => entry.key)
    for (const animation of Object.values(definition.animations)) {
      assert.ok(animation.startsWith(`${key}_`) && manifestKeys.includes(animation), `${key}: ${animation}`)
    }
  }
  assert.equal(minibossDefeatDrop(EnemyCatalog.enemy_gunner_bot), undefined, 'other enemies roll their drops as before')
  for (const [skin, base] of [['custodian_walker_basalt', 'custodian_walker'], ['relay_turret_nest_ferro', 'relay_turret_nest'], ['sentry_twin_gale', 'sentry_twin']]) {
    assert.deepEqual(EnemyCatalog[skin].stats, EnemyCatalog[base].stats, `${skin} fights like ${base}`)
  }
})

test('the new mini-bosses: 14 to 18 HP, bodies on their feet rows, tells filled by their wind-up frames', () => {
  const nest = EnemyCatalog.relay_turret_nest
  const twin = EnemyCatalog.sentry_twin
  const serpent = EnemyCatalog.drill_serpent
  for (const definition of [nest, twin, serpent]) {
    assert.ok(definition.stats.hp >= 14 && definition.stats.hp <= 18, `${definition.typeKey} ${definition.stats.hp} HP`)
    assert.ok(definition.stats.heavy, 'super armour: no hitstun')
  }
  assert.equal(64 + nest.collider.offsetY, 62, 'nest feet on row 62')
  assert.equal(64 + serpent.collider.offsetY, 62, 'serpent feet on row 62')
  assert.ok(48 + twin.collider.offsetY <= 44 && twin.collider.height <= 30, 'the twin body sits round the lens, above its thrusters')
  const frameMs = (key: string, suffix: string) => {
    const entry = EnemyAnimationManifest[key].find((candidate) => candidate.key === `${key}_${suffix}`)
    return Math.round((3 / (entry?.frameRate ?? 1)) * 1000)
  }
  assert.equal(frameMs('relay_turret_nest', 'attack_windup'), RELAY_NEST_TUNING.burstWindupMs)
  assert.equal(frameMs('sentry_twin', 'attack_windup'), SENTRY_TWINS_TUNING.boltWindupMs)
  assert.equal(frameMs('drill_serpent', 'attack_windup'), DRILL_SERPENT_TUNING.coilMs)
  assert.equal(Math.round((3 / SERPENT_ANIMATIONS.burrow.frameRate) * 1000), DRILL_SERPENT_TUNING.burrowMs)
})

test('every mini-boss atlas has the frames its animator, its brain and its skin need', () => {
  for (const key of MINIBOSS_TYPE_KEYS) {
    const atlas = JSON.parse(fs.readFileSync(`assets/sprites/enemies/${key}/${key}.atlas.json`, 'utf8'))
    const names = new Set<string>(Array.isArray(atlas.frames) ? atlas.frames.map((frame: { filename: string }) => frame.filename) : Object.keys(atlas.frames))
    const move = key.startsWith('sentry_twin') ? 'hover' : 'run'
    const groups: Array<[string, number]> = [['idle', 3], ['hurt', 1], [move, 4], ['attack_windup', 3], ['attack_active', 3], ['death', 4]]
    for (const [group, count] of groups) {
      for (let index = 0; index < count; index += 1) {
        const frame = `${key}/${group}/${String(index).padStart(3, '0')}`
        assert.ok(names.has(frame), `${frame}`)
      }
    }
    if (key === 'drill_serpent') {
      for (const spec of Object.values(SERPENT_ANIMATIONS)) spec.frames.forEach((frame) => assert.ok(names.has(`${key}/${frame}`), frame))
    }
  }
})

test('miniboss_lab: one defeat-locked room per archetype and skin, each mini-boss spawning off camera and kept inside its room', () => {
  const lab = getCampaignStage(MINIBOSS_LAB_STAGE_ID)
  assert.equal(lab.id, MINIBOSS_LAB_STAGE_ID)
  assert.equal(MINIBOSS_LAB_STAGE_ID in CAMPAIGN_STAGES, false, 'not a campaign stage')
  assert.equal(getCampaignStage(MINIBOSS_LAB_STAGE_ID), lab, 'built once')
  const locks = lab.arena.roomLocks ?? []
  assert.equal(locks.length, MINIBOSS_TYPE_KEYS.length)
  assert.deepEqual(lab.enemyMarkers.map((marker) => marker.typeKey).sort(), [...MINIBOSS_TYPE_KEYS].sort())
  assert.deepEqual(resolveLevelEnemyMarkers(MINIBOSS_LAB_STAGE_ID), lab.enemyMarkers)
  locks.forEach((lock, index) => {
    const room = MINIBOSS_LAB_ROOMS[index]
    const marker = lab.enemyMarkers.find((candidate) => lock.defeatMarkers?.includes(candidate.id))
    assert.ok(marker && marker.id === room.markerId, `${lock.id} opens on its own mini-boss`)
    assert.equal(lock.gateX, lock.room.x + lock.room.width)
    assert.ok(marker.x >= lock.room.x && marker.x < lock.gateX, `${marker.id} stands in its room`)
    assert.ok((marker.patrolMinX ?? 0) >= lock.room.x && (marker.patrolMaxX ?? 0) <= lock.gateX, `${marker.id} is kept inside`)
    assert.ok((marker.spawnTriggerX ?? Infinity) < lock.room.x, `${marker.id} spawns before the hero is in the room`)
    assert.ok((marker.retireTriggerX ?? 0) > lock.gateX)
    if (index > 0) assert.ok(lock.room.x > (locks[index - 1].gateX ?? 0), 'rooms do not overlap')
  })
  assert.deepEqual([lab.arena.hazards.length, lab.arena.allowFallOff, lab.arena.floorGaps, lab.rewardEnabled], [0, false, undefined, false])
})
