import test from 'node:test'
import assert from 'node:assert/strict'
import { CameraDirector, decideVerticalFollowMode, type CameraDirectorHost } from '../src/scenes/game/CameraDirector'

/**
 * Prompt 05 §5.3: the vertical follow mode is a pure decision (bounds height vs one screen tall),
 * and the facing look-ahead is a tweened follow offset driven off `host.facing`. Both are exercised
 * here without a scene, per AGENTS.md's "pure logic gets unit tests" rule.
 */

test('5.3-1 decideVerticalFollowMode locks at or below one screen tall, scrolls above it', () => {
  assert.equal(decideVerticalFollowMode(252, 252), 'locked')
  assert.equal(decideVerticalFollowMode(200, 252), 'locked')
  assert.equal(decideVerticalFollowMode(253, 252), 'scrolling')
  assert.equal(decideVerticalFollowMode(504, 252), 'scrolling')
})

function makeHost(facing: 1 | -1) {
  const calls: Array<{ name: string; args: unknown[] }> = []
  const camera = {
    setLerp: (...args: unknown[]) => calls.push({ name: 'setLerp', args }),
    setDeadzone: (...args: unknown[]) => calls.push({ name: 'setDeadzone', args }),
    setFollowOffset: (...args: unknown[]) => calls.push({ name: 'setFollowOffset', args }),
    startFollow: (...args: unknown[]) => calls.push({ name: 'startFollow', args }),
    shake: () => {},
    setBounds: () => {},
    scrollX: 0,
    zoom: 1,
    width: 100
  }
  const host = {
    game: { loop: { delta: 1000 / 60 } },
    physics: { world: { pause: () => {}, resume: () => {} } },
    cameras: { main: camera },
    hitstopRemainingFrames: 0,
    bossRoomCameraLocked: false,
    facing
  } as unknown as CameraDirectorHost
  return { host, calls }
}

test('5.3-2 startFollowingPlayer follows at 0.12/0.08 with a 64x40 deadzone', () => {
  const { host, calls } = makeHost(1)
  const director = new CameraDirector(host)
  const target = {}
  director.startFollowingPlayer(target)
  const startFollow = calls.find((c) => c.name === 'startFollow')
  const deadzone = calls.find((c) => c.name === 'setDeadzone')
  assert.deepEqual(startFollow?.args, [target, true, 0.12, 0.08])
  assert.deepEqual(deadzone?.args, [64, 40])
})

test('5.3-3 tickHitstop tweens the look-ahead offset toward the facing direction, never snapping', () => {
  const { host, calls } = makeHost(1)
  const director = new CameraDirector(host)
  director.startFollowingPlayer({})
  calls.length = 0

  director.tickHitstop()
  const firstOffset = calls.find((c) => c.name === 'setFollowOffset')?.args[0] as number
  assert.ok(firstOffset < 0 && firstOffset > -40, `expected a partial step toward -40, got ${firstOffset}`)

  for (let i = 0; i < 200; i += 1) director.tickHitstop()
  const settledOffset = calls.filter((c) => c.name === 'setFollowOffset').at(-1)?.args[0] as number
  assert.ok(Math.abs(settledOffset - -40) < 0.5, `expected convergence near -40, got ${settledOffset}`)
})
