import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHeroEnvironment } from '../src/mechanics/heroEnvironment.ts'
import { MAGNET_PLATE_HEIGHT, MAGNET_PLATE_TOP_ROW, liftTileOffsetY, magnetFrameIndex, windArtAlpha, windLiftFrameIndex } from '../src/mechanics/mechanicsV2Visuals.ts'
import { WIND_BUILD_MS, WIND_GUST_DEFAULTS, resolveWindZone, windCycleAt, windPushOn } from '../src/mechanics/windZone.ts'

const gust = resolveWindZone({ id: 'g', x: 0, y: 0, width: 200, height: 100, direction: -1, timing: { onMs: 1000, offMs: 1500 } })
const hero = { left: 92, right: 108, top: 35, bottom: 65 }

test('wind gust: calm, then building for 500ms (the tell), then blowing, on the shared stage clock', () => {
  assert.equal(WIND_BUILD_MS, 500)
  assert.deepEqual(windCycleAt(gust, 0), { phase: 'calm', untilBlowMs: 1500 })
  assert.deepEqual(windCycleAt(gust, 1000), { phase: 'building', untilBlowMs: 500 })
  assert.deepEqual(windCycleAt(gust, 1500), { phase: 'blowing', untilBlowMs: 0 })
  assert.equal(windCycleAt(gust, 2500).phase, 'calm')
  assert.deepEqual(resolveWindZone({ id: 'd', x: 0, y: 0, width: 1, height: 1 }).timing, WIND_GUST_DEFAULTS.timing)
})

test('wind: a gust pushes sideways only while blowing; a lift pushes up always; a magnet lift is the same pull', () => {
  assert.equal(windPushOn(gust, 'building', hero), null)
  assert.deepEqual(windPushOn(gust, 'blowing', hero), { id: 'g', forceX: -900, forceY: 0, cap: 150 })
  const lift = resolveWindZone({ id: 'l', kind: 'lift', x: 80, y: 0, width: 40, height: 200 })
  assert.deepEqual([lift.timing, windCycleAt(lift, 12345).phase], [null, 'blowing'])
  assert.deepEqual(windPushOn(lift, 'blowing', hero), { id: 'l', forceX: 0, forceY: -2100, cap: 170 })
  const magnet = resolveWindZone({ id: 'm', kind: 'lift', style: 'magnet', x: 80, y: 0, width: 40, height: 200 })
  assert.deepEqual([magnet.style, windPushOn(magnet, 'blowing', hero)?.forceY], ['magnet', -2100])
})

test('wind: the hero environment folds a gust in only while it blows', () => {
  const at = (clockMs: number) => resolveHeroEnvironment({ hero, grounded: false, clockMs, conveyors: [], iceFloors: [], currents: [], winds: [gust] })
  assert.deepEqual([at(0).environment.forceX, at(0).environment.pushCap], [0, undefined])
  assert.deepEqual([at(1600).environment.forceX, at(1600).environment.pushCap, at(1600).zoneIds], [-900, 150, ['g']])
})

test('wind art: hidden while calm, faint while building, full while blowing; lifts climb; magnet plates stay in frame', () => {
  assert.deepEqual([windArtAlpha('calm'), windArtAlpha('building'), windArtAlpha('blowing')], [0, 0.45, 0.9])
  assert.equal(liftTileOffsetY(1000, 90, 46), 44)
  assert.deepEqual([windLiftFrameIndex(0), windLiftFrameIndex(120), windLiftFrameIndex(240), windLiftFrameIndex(360)], [1, 2, 3, 1])
  assert.deepEqual([magnetFrameIndex(false, 500), magnetFrameIndex(true, 140), magnetFrameIndex(true, 560)], [0, 1, 0])
  for (const row of Object.values(MAGNET_PLATE_TOP_ROW)) assert.ok(row + MAGNET_PLATE_HEIGHT <= 38)
})
