import test from 'node:test'
import assert from 'node:assert/strict'
import {
  boxesOverlap,
  createCrumbleStates,
  crumbleBox,
  crumbleShakeOffset,
  crumbleTiming,
  isStandingOn,
  stepCrumble
} from '../src/mechanics/crumbleGroup.ts'

const GROUP = { id: 'g', platforms: [{ id: 'p1', x: 100, y: 196, width: 48 }, { id: 'p2', x: 200, y: 170, width: 48 }] }
const TIMING = crumbleTiming(GROUP)

test('defaults: 400ms shake, 3s respawn, one state per platform', () => {
  assert.deepEqual(TIMING, { shakeMs: 400, respawnMs: 3000 })
  assert.deepEqual(createCrumbleStates(GROUP).map((state) => [state.id, state.phase]), [['p1', 'solid'], ['p2', 'solid']])
})

test('landing starts the shake; it falls after 400ms even if the hero jumps off', () => {
  let [state] = createCrumbleStates(GROUP)
  state = stepCrumble(state, { heroStanding: false, heroOverlapping: false, deltaMs: 1000 }, TIMING)
  assert.equal(state.phase, 'solid')
  state = stepCrumble(state, { heroStanding: true, heroOverlapping: false, deltaMs: 16 }, TIMING)
  assert.equal(state.phase, 'shaking')
  assert.notEqual(crumbleShakeOffset(state), 0)
  state = stepCrumble(state, { heroStanding: false, heroOverlapping: false, deltaMs: 399 }, TIMING)
  assert.equal(state.phase, 'shaking')
  state = stepCrumble(state, { heroStanding: false, heroOverlapping: false, deltaMs: 1 }, TIMING)
  assert.equal(state.phase, 'fallen')
  assert.equal(crumbleShakeOffset(state), 0)
})

test('it returns after 3s only once the hero is out of its box', () => {
  let state = { id: 'p1', groupId: 'g', phase: 'fallen' as const, timerMs: 0 }
  let next = stepCrumble(state, { heroStanding: false, heroOverlapping: true, deltaMs: 3000 }, TIMING)
  assert.equal(next.phase, 'fallen', 'the hero is inside its box')
  next = stepCrumble(next, { heroStanding: false, heroOverlapping: false, deltaMs: 16 }, TIMING)
  assert.equal(next.phase, 'solid')
  state = { ...state, timerMs: 0 }
  assert.equal(stepCrumble(state, { heroStanding: false, heroOverlapping: false, deltaMs: 2999 }, TIMING).phase, 'fallen')
})

test('standing means grounded, over the platform, feet at its top', () => {
  const box = crumbleBox(GROUP.platforms[0])
  assert.deepEqual(box, { left: 76, right: 124, top: 192, bottom: 200 })
  const hero = { left: 90, right: 106, top: 160, bottom: 192 }
  assert.equal(isStandingOn(hero, box, true), true)
  assert.equal(isStandingOn(hero, box, false), false, 'airborne')
  assert.equal(isStandingOn({ ...hero, bottom: 236, top: 204 }, box, true), false, 'on the floor below')
  assert.equal(isStandingOn({ ...hero, left: 124, right: 140 }, box, true), false, 'beside it')
  assert.equal(boxesOverlap({ left: 90, right: 106, top: 180, bottom: 212 }, box), true)
})
