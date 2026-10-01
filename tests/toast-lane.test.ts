import test from 'node:test'
import assert from 'node:assert/strict'
import { ToastLane } from '../src/ui/ToastLane.ts'

/** A chainable stand-in for the scene's display factory: every call returns the stub, sizes read 0 and y sits low in the frame (the lane's playfield guard). */
function fakeScene(): any {
  const stub: any = new Proxy(function () {}, {
    get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'y' ? 240 : ['x', 'width', 'height'].includes(String(key)) ? 0 : stub),
    apply: () => stub
  })
  return stub
}

const toast = (text: string) => ({ kind: 'toast' as const, text, durationMs: 900 })
const radio = (text: string) => ({ kind: 'radio' as const, speaker: 'Iona', text, durationMs: 4500 })
const hint = (text: string) => ({ kind: 'hint' as const, text, durationMs: 2400 })

function play(lane: ToastLane, steps: number): string[] {
  const shown: string[] = []
  for (let step = 0; step < steps; step += 1) {
    const text = lane.getDebugState().text
    if (text && shown[shown.length - 1] !== text) shown.push(text)
    lane.update(100)
  }
  return shown
}

test('toast lane supersede: a playing coach item ends now and the new coach plays next, ahead of queued radio', () => {
  const lane = new ToastLane(fakeScene())
  lane.supersede('coach', [hint('JUMP: SPACE'), radio('Step one.')])
  lane.enqueue(toast('Checkpoint 2'))
  lane.enqueue(radio('Iona line'))
  assert.equal(lane.getDebugState().text, 'JUMP: SPACE')
  lane.supersede('coach', [hint('DASH: Z'), radio('Step two.')])
  assert.equal(lane.getDebugState().text, 'DASH: Z', 'the stale coach item ends at once')
  assert.deepEqual(play(lane, 200), ['DASH: Z', 'Step two.', 'Checkpoint 2', 'Iona line'], 'stale coach dropped, nothing else lost')
})

test('toast lane supersede: never drops or interrupts a non-coach item', () => {
  const lane = new ToastLane(fakeScene())
  lane.enqueue(radio('Iona line'))
  lane.supersede('coach', [hint('DASH: Z')])
  lane.enqueue(toast('Checkpoint 3'))
  lane.supersede('coach', [hint('SABER: C'), radio('Step five.')])
  assert.equal(lane.getDebugState().text, 'Iona line', 'a playing radio line finishes')
  assert.deepEqual(play(lane, 200), ['Iona line', 'SABER: C', 'Step five.', 'Checkpoint 3'])
})

test('toast lane: an item tall enough to reach the floor row is refused (5.8 review: the guard used the frame bottom)', () => {
  // A stand-in whose text measures 120px tall: 61 + 8 + 10 + 120 = 199, past the floor line at 160 but inside the frame.
  const tall: any = new Proxy(function () {}, {
    get: (_target, key) => (key === Symbol.toPrimitive ? () => 0 : key === 'height' ? 120 : key === 'y' ? 100 : ['x', 'width'].includes(String(key)) ? 0 : tall),
    apply: () => tall
  })
  const lane = new ToastLane(tall)
  assert.throws(() => lane.enqueue(radio('A radio line long enough to wrap past the floor row')), /too long for the playfield/)
})
