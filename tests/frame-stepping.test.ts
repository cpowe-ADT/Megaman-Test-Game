import test from 'node:test'
import assert from 'node:assert/strict'
import { stepGameFrames, type FrameSteppableGame } from '../src/config/frameStepping'

function createFakeGame(lastTime = 1000) {
  const counters = { sleep: 0, wake: 0 }
  const steps: Array<{ time: number; delta: number }> = []
  const loop = {
    running: true,
    lastTime,
    frame: 0,
    sleep(): void { counters.sleep += 1; loop.running = false },
    wake(): void { counters.wake += 1; loop.running = true }
  }
  const game: FrameSteppableGame = { step: (time, delta) => steps.push({ time, delta }), loop }
  return { game, loop, steps, counters }
}

test('stepGameFrames advances lastTime by n*1000/60 and frame by n, at a fixed 60Hz delta', () => {
  const { game, loop, steps } = createFakeGame(1000)
  const frameMs = 1000 / 60
  const stepped = stepGameFrames(game, 5)
  assert.equal(stepped, 5)
  assert.equal(loop.frame, 5)
  // Accumulated by repeated `+= frameMs` (like the real implementation), so compare with an
  // epsilon rather than the single-multiplication value, which can differ by a float ULP.
  assert.ok(Math.abs(loop.lastTime - (1000 + 5 * frameMs)) < 1e-9)
  assert.equal(steps.length, 5)
  for (const step of steps) assert.equal(step.delta, frameMs)
})

test('stepGameFrames manages sleep/wake itself by default, once per call, only while running', () => {
  const { game, counters } = createFakeGame()
  stepGameFrames(game, 3)
  assert.equal(counters.sleep, 1)
  assert.equal(counters.wake, 1)

  const asleep = createFakeGame()
  asleep.loop.running = false
  stepGameFrames(asleep.game, 3)
  assert.equal(asleep.counters.sleep, 0)
  assert.equal(asleep.counters.wake, 0)
})

test('a caller-managed multi-row replay sleeps and wakes exactly once across several manageLoop:false calls', () => {
  const { game, loop, counters } = createFakeGame()
  loop.sleep()
  stepGameFrames(game, 2, { manageLoop: false })
  stepGameFrames(game, 3, { manageLoop: false })
  stepGameFrames(game, 1, { manageLoop: false })
  loop.wake()
  assert.equal(counters.sleep, 1)
  assert.equal(counters.wake, 1)
  assert.equal(loop.frame, 6)
})

test('requesting zero frames is a no-op', () => {
  const { game, loop, counters, steps } = createFakeGame()
  assert.equal(stepGameFrames(game, 0), 0)
  assert.equal(loop.frame, 0)
  assert.equal(counters.sleep, 0)
  assert.equal(counters.wake, 0)
  assert.equal(steps.length, 0)
})
