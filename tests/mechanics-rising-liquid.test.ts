import test from 'node:test'
import assert from 'node:assert/strict'
import {
  createRisingLiquidState,
  isInsideLiquid,
  resetRisingLiquid,
  risingLiquidSurfaceY,
  stepRisingLiquid,
  type RisingLiquidDefinition
} from '../src/mechanics/risingLiquid.ts'

const SLAG: RisingLiquidDefinition = { id: 'slag', x: 900, width: 400, floorY: 244, topY: -100, riseMs: 14000, triggerX: 930 }

test('dormant at the floor until the hero crosses the trigger x', () => {
  let state = createRisingLiquidState(SLAG)
  state = stepRisingLiquid(SLAG, state, { heroX: 929, prevHeroX: 920, deltaMs: 1000 })
  assert.deepEqual([state.phase, state.surfaceY], ['dormant', 244])
  assert.equal(stepRisingLiquid(SLAG, state, { heroX: 1400, prevHeroX: 1400, deltaMs: 16 }).phase, 'dormant', 'respawned past it')
  state = stepRisingLiquid(SLAG, state, { heroX: 930, prevHeroX: 929, deltaMs: 16 })
  assert.deepEqual([state.phase, state.elapsedMs, state.surfaceY], ['rising', 0, 244])
})

test('rises linearly from floorY to topY over riseMs, then holds full', () => {
  let state = stepRisingLiquid(SLAG, createRisingLiquidState(SLAG), { heroX: 1000, prevHeroX: 0, deltaMs: 16 })
  state = stepRisingLiquid(SLAG, state, { heroX: 0, prevHeroX: 0, deltaMs: 7000 })
  assert.equal(state.surfaceY, 72, 'halfway at half the time, even after the hero turns back')
  state = stepRisingLiquid(SLAG, state, { heroX: 0, prevHeroX: 0, deltaMs: 7000 })
  assert.deepEqual([state.phase, state.surfaceY], ['full', -100])
  assert.equal(stepRisingLiquid(SLAG, state, { heroX: 0, prevHeroX: 0, deltaMs: 5000 }), state)
  assert.equal(risingLiquidSurfaceY(SLAG, 99999), -100)
})

test('respawn restarts it from the floor, waiting for the trigger', () => {
  const reset = resetRisingLiquid(SLAG)
  assert.deepEqual([reset.phase, reset.surfaceY, reset.elapsedMs], ['dormant', 244, 0])
})

test('contact needs the feet 4px under the surface inside the liquid columns', () => {
  const hero = { left: 1000, right: 1016, bottom: 200 }
  assert.equal(isInsideLiquid(SLAG, 198, hero), false, 'a graze survives')
  assert.equal(isInsideLiquid(SLAG, 195, hero), true)
  assert.equal(isInsideLiquid(SLAG, 100, { left: 1310, right: 1330, bottom: 200 }), false, 'past the right edge')
})
