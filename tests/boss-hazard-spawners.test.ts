import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BOSS_HAZARD_ART,
  BOSS_HAZARD_IDS,
  BURN_PUDDLE,
  ACID_TRAIL,
  CHARGE_MINE,
  GROUND_SHOCKWAVE,
  MAG_DISC,
  MAGNET_NODE,
  SPLASH_PILLAR,
  STONE_PILLAR,
  VAPOR_POD,
  createBossHazard,
  hazardBodyRect,
  hazardSolidRect,
  magnetPull,
  resolveHazardSpawn,
  type BossHazard,
  type BossHazardId,
  type HazardEnv,
  type HazardFrame
} from '../src/boss/hazards/hazardSpawners'
import { lanceVolleyCount, serpentStreamSweep, SERPENT_STREAM } from '../src/boss/pilotAttacks'
import { rectsOverlap, type BossRect } from '../src/bosses/bossBodies'
import { BOSS_ROSTER } from '../src/bosses/roster'

// Prompt 07 phase 7.1 (EVAL-P7-001): one test per spawner, each on the pure sample the Game scene draws from.
const FLOOR = 200
const spec = (id: BossHazardId, extra: Record<string, number> = {}) =>
  createBossHazard({ id, originX: 300, floorY: FLOOR, ceilingY: 20, muzzleY: 184, facing: -1, heroX: 160, minX: 40, maxX: 420, damage: 2, ...extra })
const heroAt = (x: number, bottom = FLOOR): BossRect => ({ x: x - 7, y: bottom - 28, width: 14, height: 28 })
const env = (hero: BossRect | null = null, boss = { x: 300, y: 184 }): HazardEnv => ({ hero, boss })
const bodies = (frame: HazardFrame) => frame.pieces.map(hazardBodyRect).filter((rect): rect is BossRect => rect !== null)

function run(hazard: BossHazard, untilMs: number, at: (t: number) => HazardEnv = () => env(), stepMs = 16) {
  const frames: Array<{ t: number; frame: HazardFrame }> = []
  for (let t = 0; t <= untilMs; t += stepMs) {
    const frame = hazard.sample(t, at(t))
    frames.push({ t, frame })
    if (frame.done) break
  }
  return frames
}

test('icicle_fall: a shadow over the hero column first, then a falling spike that hurts, then shards', () => {
  const frames = run(spec('icicle_fall'), 4000)
  const first = frames[0].frame
  assert.equal(first.phase, 'shadow')
  assert.equal(first.pieces[0].x, 160, 'the first icicle hangs over the hero')
  assert.equal(first.pieces[0].marker, true, 'its floor marker shows')
  assert.equal(bodies(first).length, 0, 'nothing hurts during the shadow')
  const falling = frames.filter(({ frame }) => frame.pieces[0].body)
  assert.ok(falling.length > 3, 'the spike falls with a body')
  assert.ok(falling[falling.length - 1].frame.pieces[0].y > falling[0].frame.pieces[0].y, 'it moves down')
  assert.ok(frames.some(({ frame }) => frame.pieces[0].frame === 1), 'it shatters (frame 001) on the floor')
  assert.equal(frames[frames.length - 1].frame.done, true)
})

test('charge_mine: harmless while arming, detonates on contact once armed, or on its fuse', () => {
  const touched = spec('charge_mine', { originX: 200 })
  const early = touched.sample(200, env(heroAt(200)))
  assert.equal(early.phase, 'arming')
  assert.equal(bodies(early).length, 0, 'touching an unarmed mine does nothing')
  assert.equal(touched.sample(CHARGE_MINE.armMs + 16, env()).phase, 'armed')
  const blast = touched.sample(CHARGE_MINE.armMs + 32, env(heroAt(200)))
  assert.equal(blast.phase, 'blast')
  assert.equal(blast.pieces[0].frame, 3)
  assert.deepEqual(bodies(blast)[0].width, CHARGE_MINE.blast.width)
  const fused = spec('charge_mine', { originX: 200 })
  const frames = run(fused, 4000)
  const firstBlast = frames.find(({ frame }) => frame.phase === 'blast')
  assert.ok(firstBlast && firstBlast.t >= CHARGE_MINE.fuseMs && firstBlast.t < CHARGE_MINE.fuseMs + 20, 'untouched, it blows on the fuse')
})

test('tornado_pillar: rises ahead of the boss without a body, then drifts towards the hero with one', () => {
  const hazard = spec('tornado_pillar')
  const rising = hazard.sample(100, env(heroAt(160)))
  assert.equal(rising.phase, 'rise')
  assert.equal(rising.pieces[0].x, 300 - 48, 'it rises 48px ahead of the boss')
  assert.equal(bodies(rising).length, 0)
  const frames = run(hazard, 1500, () => env(heroAt(160)))
  const drifting = frames.filter(({ frame }) => frame.phase === 'drift')
  const start = drifting[0].frame.pieces[0].x
  const later = drifting[drifting.length - 1]
  assert.ok(bodies(later.frame).length === 1, 'the risen tornado hurts')
  assert.ok(later.frame.pieces[0].x < start, 'it drifts towards the hero')
  assert.ok(start - later.frame.pieces[0].x <= ((later.t - drifting[0].t) / 1000) * 38 + 1, 'at 38px/s at most')
})

test('splash_pillar: a ripple warns first, then pillars rise either side of the landing', () => {
  const hazard = spec('splash_pillar')
  const ripple = hazard.sample(SPLASH_PILLAR.staggerMs + 10, env())
  assert.equal(ripple.phase, 'ripple')
  assert.ok(ripple.pieces.every((entry) => entry.marker && entry.body === null))
  const hold = hazard.sample(SPLASH_PILLAR.warnMs + SPLASH_PILLAR.riseMs + 200, env())
  assert.deepEqual(hold.pieces.map((entry) => entry.x), [264, 336], 'two pillars 36px either side')
  assert.ok(bodies(hold).every((rect) => rect.height === SPLASH_PILLAR.body.height && rect.y + rect.height === FLOOR))
  assert.equal(hazard.sample(2000, env()).done, true)
})

test('burn_puddle: a puddle each 24px of the dash, laid at the dash speed, low enough to jump, then gone', () => {
  const hazard = spec('burn_puddle', { speed: 240 })
  const laid = hazard.sample(400, env())
  assert.deepEqual(laid.pieces.map((entry) => entry.x), [300, 276, 252, 228], 'every 24px along the facing')
  assert.ok(bodies(laid).every((rect) => rect.height === BURN_PUDDLE.body.height && rect.y + rect.height === FLOOR))
  assert.equal(hazard.sample(50, env()).pieces[3].visible, false, 'the last puddle waits for the dash to reach it')
  assert.equal(hazard.sample(4000, env()).done, true)
})

test('acid_trail: five thinner, shorter-lived puddles along the slide', () => {
  const hazard = spec('acid_trail', { speed: 260 })
  const laid = hazard.sample(500, env())
  assert.equal(laid.pieces.length, ACID_TRAIL.count)
  assert.equal(laid.pieces[1].x - laid.pieces[0].x, -ACID_TRAIL.spacing)
  assert.ok(bodies(laid).every((rect) => rect.height === ACID_TRAIL.body.height))
  assert.equal(hazard.sample(ACID_TRAIL.appearMs + ACID_TRAIL.lingerMs + ACID_TRAIL.fadeMs + 1000, env()).done, true)
})

test('magnet_node: pulls the hero 40px/s towards it within 96px and not beyond', () => {
  assert.equal(magnetPull({ x: 100, y: 170 }, { x: 180, y: 170 }), -40)
  assert.equal(magnetPull({ x: 100, y: 170 }, { x: 40, y: 170 }), 40)
  assert.equal(magnetPull({ x: 100, y: 170 }, { x: 220, y: 170 }), 0, 'out of range')
  const hazard = spec('magnet_node')
  const node = hazard.sample(MAGNET_NODE.appearMs + 100, env(heroAt(160)))
  assert.equal(node.pieces[0].x, 160 + MAGNET_NODE.offset, 'the node sits beside the hero on the boss side')
  assert.equal(node.pullX, 40, 'the hero is pulled towards it')
  assert.ok(node.field && node.field.radius === 96)
  assert.equal(bodies(node).length, 1, 'the node itself hurts')
  assert.equal(hazard.sample(MAGNET_NODE.appearMs + 100, env(heroAt(60))).pullX, 0)
})

test('stone_pillar: rubble warns, the rising pillar hurts, the standing pillar blocks without hurting, then sinks', () => {
  const hazard = spec('stone_pillar')
  const rubble = hazard.sample(100, env())
  assert.equal(rubble.pieces[0].x, 160, 'under the hero')
  assert.equal(rubble.pieces[0].marker, true)
  assert.equal(bodies(rubble).length, 0)
  const rising = hazard.sample(STONE_PILLAR.warnMs + 60, env())
  assert.equal(bodies(rising).length, 1)
  const standing = hazard.sample(STONE_PILLAR.warnMs + STONE_PILLAR.riseMs + 500, env())
  assert.equal(standing.pieces[0].frame, 3)
  assert.equal(bodies(standing).length, 0, 'a standing pillar does not hurt')
  assert.deepEqual(hazardSolidRect(standing.pieces[0]), { x: 145, y: FLOOR - 46, width: 30, height: 46 })
  assert.equal(hazard.sample(4000, env()).done, true)
})

test('vapor_pod: pods beside the hero pulse harmlessly, then burst', () => {
  const hazard = spec('vapor_pod')
  const fuse = hazard.sample(VAPOR_POD.appearMs + 300, env())
  assert.deepEqual(fuse.pieces.map((entry) => entry.x), [120, 200])
  assert.equal(bodies(fuse).length, 0, 'the pulse does not hurt')
  const burst = hazard.sample(VAPOR_POD.appearMs + VAPOR_POD.fuseMs + 100, env())
  assert.equal(burst.phase, 'burst')
  assert.equal(burst.pieces[0].frame, 3)
  assert.equal(bodies(burst)[0].width, VAPOR_POD.body.width)
})

test('short_quake: two low ripples run both ways a short way', () => {
  const hazard = spec('short_quake')
  const a = hazard.sample(100, env())
  const b = hazard.sample(300, env())
  assert.ok(b.pieces[0].x < a.pieces[0].x && b.pieces[1].x > a.pieces[1].x, 'they run apart')
  assert.ok(bodies(a).every((rect) => rect.height <= 8), 'low enough to jump')
  assert.equal(hazard.sample(700, env()).done, true)
})

test('ground_shockwave: travels along the floor to the wall; a jumping hero clears it, a standing one is hit', () => {
  const hazard = spec('ground_shockwave')
  const frame = hazard.sample(500, env())
  const wave = bodies(frame)[0]
  assert.equal(frame.pieces[0].x, 300 - 20 - 100, 'facing the hero at 200px/s')
  assert.equal(wave.height, GROUND_SHOCKWAVE.body.height)
  const x = frame.pieces[0].x
  assert.equal(rectsOverlap(heroAt(x), wave), true, 'a grounded hero is hit')
  assert.equal(rectsOverlap(heroAt(x, FLOOR - 12), wave), false, 'feet 12px up clear it')
  assert.equal(run(hazard, 3000).pop()?.frame.done, true)
})

test('wind_hitbox: a box moving at the dash speed, not a bullet', () => {
  const hazard = spec('wind_hitbox', { speed: 240 })
  const a = hazard.sample(100, env())
  const b = hazard.sample(200, env())
  assert.equal(a.pieces[0].x - b.pieces[0].x, 24, '240px/s towards the hero')
  assert.deepEqual([bodies(a)[0].width, bodies(a)[0].height], [34, 20])
  assert.equal(hazard.sample(1000, env()).done, true, 'it ends after 220px')
})

test('mag_disc: out along the facing, stops 108px away, then comes back to the boss and is caught', () => {
  const hazard = spec('mag_disc')
  const frames = run(hazard, 3000, () => env(null, { x: 300, y: 184 }))
  const farthest = Math.min(...frames.map(({ frame }) => frame.pieces[0].x))
  assert.ok(Math.abs(288 - farthest - 108) < 2, `turns about 108px out (${288 - farthest})`)
  const turn = frames.find(({ t }) => t >= MAG_DISC.turnMs)!
  const last = frames[frames.length - 1]
  assert.equal(last.frame.done, true, 'caught by the boss')
  assert.ok(last.t < MAG_DISC.maxMs, 'before the safety timeout')
  assert.ok(last.frame.pieces[0].x > turn.frame.pieces[0].x, 'on its way back')
})

test('blaze_lob (Pyro pilot): the orb lands in the hero column and bursts into three arcs', () => {
  const hazard = spec('blaze_lob')
  const mid = hazard.sample(360, env())
  assert.ok(mid.pieces[0].y < 184, 'the orb arcs up')
  const burst = hazard.sample(760, env())
  assert.equal(burst.pieces[0].visible, false, 'the orb is gone')
  const embers = burst.pieces.slice(1)
  assert.equal(embers.filter((entry) => entry.visible).length, 3, 'three arcs')
  assert.ok(embers[0].x < 160 && embers[1].x === 160 && embers[2].x > 160, 'left, straight up and right of the landing')
  assert.equal(run(hazard, 3000).pop()?.frame.done, true)
})

test('every authored hazard id resolves to its own spawner and art; no floor-spike fallback is left', () => {
  const spawns = new Set(Object.values(BOSS_ROSTER).flatMap((boss) => [...boss.attacks, ...(boss.desperation ? [boss.desperation.attack] : [])].flatMap((attack) => attack.spawns ?? [])))
  const hazards = [...spawns].map(resolveHazardSpawn).filter(Boolean)
  for (const id of ['icicle_fall', 'charge_mine', 'tornado_pillar', 'splash_pillar', 'burn_puddle', 'acid_trail', 'magnet_node', 'stone_pillar', 'vapor_pod', 'short_quake', 'ground_shockwave', 'wind_hitbox', 'mag_disc']) {
    assert.ok(hazards.includes(id as BossHazardId), `${id} is authored and resolves`)
  }
  assert.equal(resolveHazardSpawn('ground_slam_hazard'), 'short_quake')
  assert.equal(resolveHazardSpawn('fire_orb'), 'blaze_lob')
  assert.equal(resolveHazardSpawn('water_lance'), null, 'shots stay shots')
  BOSS_HAZARD_IDS.forEach((id) => assert.ok(BOSS_HAZARD_ART[id].group, `${id} has art`))
  assert.deepEqual(
    BOSS_ROSTER.pyro_maw.attacks.find((attack) => attack.name === 'Blaze Lob')?.spawns,
    ['fire_orb'],
    'Blaze Lob bursts on landing instead of firing a fan at once'
  )
})

test('Serpent Stream sweeps up through its cone; Lance Volley fires two lances, then three from phase two', () => {
  const sweep = serpentStreamSweep(900)
  assert.equal(sweep.length, 10)
  assert.equal(sweep[0].angle, SERPENT_STREAM.fromAngle)
  assert.ok(Math.abs(sweep[sweep.length - 1].angle - SERPENT_STREAM.toAngle) < 1e-9)
  sweep.slice(1).forEach((shot, index) => {
    assert.ok(shot.angle < sweep[index].angle, 'each flame higher than the last')
    assert.equal(shot.atMs - sweep[index].atMs, SERPENT_STREAM.intervalMs)
  })
  assert.equal(lanceVolleyCount(0), 2)
  assert.equal(lanceVolleyCount(1), 3)
  assert.equal(lanceVolleyCount(2), 3)
})
