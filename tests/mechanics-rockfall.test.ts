import test from 'node:test'
import assert from 'node:assert/strict'
import { rockfallFrameIndex } from '../src/mechanics/mechanicsV2Visuals.ts'
import { createRockfallState, crossedTrigger, resetRockfall, stepRockfall, type RockfallDefinition, type RockfallState } from '../src/mechanics/rockfall.ts'

const rock: RockfallDefinition = { id: 'k', x: 300, topY: 51, floorY: 225, triggerX: 280 }
const FRAME = 1000 / 60

function runUntil(def: RockfallDefinition, state: RockfallState, done: (s: RockfallState) => boolean, hero: { left: number; right: number; top: number; bottom: number } | null = null) {
  let hits = 0
  for (let frame = 0; frame < 300 && !done(state); frame += 1) {
    const result = stepRockfall(def, state, { heroX: 0, prevHeroX: 0, hero, deltaMs: FRAME })
    if (result.hit) hits += 1
    state = result.state
  }
  return { state, hits }
}

test('rockfall: crossing the trigger (either way) starts a 400ms dust warning, then the boulder falls and breaks on the floor', () => {
  let state = createRockfallState(rock)
  state = stepRockfall(rock, state, { heroX: 270, prevHeroX: 260, hero: null, deltaMs: FRAME }).state
  assert.equal(state.phase, 'waiting')
  state = stepRockfall(rock, state, { heroX: 290, prevHeroX: 270, hero: null, deltaMs: FRAME }).state
  assert.equal(state.phase, 'warning')
  state = stepRockfall(rock, state, { heroX: 290, prevHeroX: 290, hero: null, deltaMs: 390 }).state
  assert.equal(state.phase, 'warning')
  state = stepRockfall(rock, state, { heroX: 290, prevHeroX: 290, hero: null, deltaMs: 20 }).state
  assert.deepEqual([state.phase, state.y, state.drops], ['falling', 51, 1])
  const landed = runUntil(rock, state, (s) => s.phase !== 'falling')
  assert.deepEqual([landed.state.phase, landed.state.y, landed.hits], ['rubble', 225, 0])
  const cleared = stepRockfall(rock, landed.state, { heroX: 290, prevHeroX: 290, hero: null, deltaMs: 700 }).state
  assert.deepEqual([cleared.phase, cleared.y], ['waiting', 51])
  assert.equal(crossedTrigger(280, 290, 270), true, 'leftward crossing')
})

test('rockfall: a hero under it is hit once and the boulder breaks there', () => {
  const falling = { ...createRockfallState(rock), phase: 'falling' as const }
  const hero = { left: 292, right: 308, top: 206, bottom: 236 }
  const result = runUntil(rock, falling, (s) => s.phase !== 'falling', hero)
  assert.deepEqual([result.hits, result.state.hits, result.state.phase], [1, 1, 'rubble'])
  assert.ok(result.state.y < rock.floorY, `broke at ${result.state.y.toFixed(1)}`)
})

test('rockfall: with no trigger it drops every intervalMs; the respawn resets it and keeps the counts', () => {
  const timed: RockfallDefinition = { id: 't', x: 0, topY: 0, floorY: 100, intervalMs: 1000 }
  let state = stepRockfall(timed, createRockfallState(timed), { heroX: 0, prevHeroX: 0, hero: null, deltaMs: 999 }).state
  assert.equal(state.phase, 'waiting')
  state = stepRockfall(timed, state, { heroX: 0, prevHeroX: 0, hero: null, deltaMs: 1 }).state
  assert.equal(state.phase, 'warning')
  const reset = resetRockfall(timed, { ...state, phase: 'falling', y: 60, drops: 3, hits: 2 })
  assert.deepEqual([reset.phase, reset.y, reset.drops, reset.hits], ['waiting', 0, 3, 2])
})

test('rockfall art: nothing while waiting, the dust puff, the tumbling boulder, the rubble', () => {
  assert.deepEqual(
    [rockfallFrameIndex('waiting', 0), rockfallFrameIndex('warning', 0), rockfallFrameIndex('falling', 0), rockfallFrameIndex('falling', 90), rockfallFrameIndex('rubble', 0)],
    [null, 0, 1, 2, 3]
  )
})
