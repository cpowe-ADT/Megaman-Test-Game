import test from 'node:test'
import assert from 'node:assert/strict'
import { shotPlatformProcess, shotStopsAtPlatform } from '../src/projectiles/platformContact'

const floor = { center: { y: 220 }, top: 212, bottom: 228 }
const wall = { center: { y: 180 }, top: 150, bottom: 212 }
const ceiling = { center: { y: 40 }, top: 32, bottom: 48 }

test('a level shot whose body only grazes the floor top flies on', () => {
  // A charged shot 24px tall centred 10px above the floor top reaches 2px into it.
  assert.equal(shotStopsAtPlatform({ center: { y: 202 }, top: 190, bottom: 214, velocity: { y: 0 } }, floor), false)
})

test('a falling shot lands on the floor top as the bodies touch (the lob that quakes)', () => {
  assert.equal(shotStopsAtPlatform({ center: { y: 206 }, top: 200, bottom: 212, velocity: { y: 180 } }, floor), true)
})

test('a shot stops at a wall it meets at its centre, and a rising shot at a ceiling', () => {
  assert.equal(shotStopsAtPlatform({ center: { y: 190 }, top: 186, bottom: 194, velocity: { y: 0 } }, wall), true)
  assert.equal(shotStopsAtPlatform({ center: { y: 52 }, top: 46, bottom: 58, velocity: { y: -120 } }, ceiling), true)
  assert.equal(shotStopsAtPlatform({ center: { y: 52 }, top: 46, bottom: 58, velocity: { y: 0 } }, ceiling), false)
})

test('the process callback finds the platform by its static body, in either order', () => {
  const shot = { body: { center: { y: 202 }, top: 190, bottom: 214, velocity: { y: 0 }, physicsType: 0 } }
  const platform = { body: { ...floor, physicsType: 1 } }
  assert.equal(shotPlatformProcess(shot, platform), false)
  assert.equal(shotPlatformProcess(platform, shot), false)
  const inWall = { body: { center: { y: 190 }, top: 186, bottom: 194, velocity: { y: 0 }, physicsType: 0 } }
  assert.equal(shotPlatformProcess(inWall, { body: { ...wall, physicsType: 1 } }), true)
})
