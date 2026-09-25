import test from 'node:test'
import assert from 'node:assert/strict'
import { CameraDirector, type CameraDirectorHost, type CameraFollowTarget } from '../src/scenes/game/CameraDirector'
import { stepCameraFollow, initialCameraFollowState, snapScrollToGamePixel } from '../src/scenes/game/cameraFollow'

/**
 * `CameraDirector` wiring around the pure `stepCameraFollow` (prompt 05 §5.3b/c, EVAL-P5-004 fix):
 * it must stop any Phaser follow (never `startFollow`/`setDeadzone`/`setFollowOffset` again, the
 * source of the commit 610fe2c review BLOCKs), and `tickCameraFollow` (called after the runtime
 * update, per the 5.3c review MINOR, not `tickHitstop`) writes whole game pixels to
 * `scrollX`/`scrollY` from the pure step's own bounds/view size every tick (the 5.3c review found
 * a fractional 1x scroll blending the wrong ground row into smoke 40). The step's own scenarios
 * live in camera-follow.test.ts.
 */

const VIEW = { x: 0, y: 0, width: 4000, height: 252 }

function makeHost(target: CameraFollowTarget, facing: 1 | -1) {
  const calls: string[] = []
  const camera = {
    roundPixels: true,
    scrollX: 0,
    scrollY: 0,
    zoom: 1,
    width: 100,
    displayWidth: 448,
    displayHeight: 252,
    shake: () => {},
    setBounds: () => {},
    stopFollow: () => calls.push('stopFollow'),
    startFollow: () => calls.push('startFollow'),
    setDeadzone: () => calls.push('setDeadzone'),
    setFollowOffset: () => calls.push('setFollowOffset'),
    getBounds: () => ({ ...VIEW })
  }
  const host = {
    game: { loop: { delta: 1000 / 60 } },
    physics: { world: { pause: () => {}, resume: () => {} } },
    cameras: { main: camera },
    hitstopRemainingFrames: 0,
    bossRoomCameraLocked: false,
    facing
  } as unknown as CameraDirectorHost
  return { host, calls, camera }
}

test('5.3b-9 startFollowingPlayer stops any Phaser follow and never calls startFollow/setDeadzone/setFollowOffset', () => {
  const target = { x: 600, y: 100 }
  const { host, calls } = makeHost(target, 1)
  const director = new CameraDirector(host)
  director.startFollowingPlayer(target)
  director.tickCameraFollow()
  assert.ok(calls.includes('stopFollow'))
  assert.equal(calls.includes('startFollow'), false)
  assert.equal(calls.includes('setDeadzone'), false)
  assert.equal(calls.includes('setFollowOffset'), false)
})

test('5.3c-4 tickCameraFollow writes whole game pixels matching stepCameraFollow, rounded and re-clamped', () => {
  const target = { x: 600, y: 100 }
  const { host, camera } = makeHost(target, 1)
  const director = new CameraDirector(host)
  director.startFollowingPlayer(target)

  let expected = initialCameraFollowState(600, 100, 1, 0, 0, VIEW)
  for (let i = 0; i < 5; i += 1) {
    target.x += 4
    expected = stepCameraFollow(expected, {
      heroX: target.x,
      heroY: target.y,
      facing: 1,
      dtMs: 1000 / 60,
      viewWidth: 448,
      viewHeight: 252,
      bounds: VIEW
    })
    director.tickCameraFollow()
    // Written every tick, not just the last: a fractional scroll must never reach the camera.
    assert.equal(camera.scrollX, snapScrollToGamePixel(expected.scrollX, VIEW.x, VIEW.width, 448))
    assert.equal(Number.isInteger(camera.scrollX), true, `scrollX must be a whole game pixel, got ${camera.scrollX}`)
  }

  assert.equal(camera.scrollX, snapScrollToGamePixel(expected.scrollX, VIEW.x, VIEW.width, 448))
  assert.equal(camera.scrollY, snapScrollToGamePixel(expected.scrollY, VIEW.y, VIEW.height, 252))
})

test('5.3c-5 tickHitstop no longer touches the camera; tickCameraFollow does the whole step', () => {
  const target = { x: 600, y: 100 }
  const { host, camera } = makeHost(target, 1)
  const director = new CameraDirector(host)
  director.startFollowingPlayer(target)
  target.x = 900
  director.tickHitstop()
  assert.equal(camera.scrollX, 0, 'tickHitstop alone must not step the camera')
  director.tickCameraFollow()
  assert.notEqual(camera.scrollX, 0, 'tickCameraFollow steps the camera from the current hero position')
})

test('5.3d-1 startFollowingPlayer switches roundPixels off for gameplay (smoke 40 identity, pre-5.3 behaviour)', () => {
  const target = { x: 600, y: 100 }
  const { host, camera } = makeHost(target, 1)
  assert.equal(camera.roundPixels, true)
  new CameraDirector(host).startFollowingPlayer(target)
  assert.equal(camera.roundPixels, false)
})
