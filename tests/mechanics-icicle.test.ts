import test from 'node:test'
import assert from 'node:assert/strict'
import { ICICLE_LENGTH, createIcicleState, icicleBox, icicleShakeOffset, isHeroUnderIcicle, resetIcicle, stepIcicle, type IcicleState } from '../src/mechanics/icicle.ts'
import { icicleFrameIndex } from '../src/mechanics/mechanicsV2Visuals.ts'

const icicle = { id: 'i', x: 400, y: 40, floorY: 236 }
const FRAME = 1000 / 60
const heroAt = (x: number) => ({ left: x - 8, right: x + 8, top: 206, bottom: 236 })

function fall(state: IcicleState, hero: ReturnType<typeof heroAt> | null) {
  let hits = 0
  for (let frame = 0; frame < 300 && state.phase === 'falling'; frame += 1) {
    const result = stepIcicle(icicle, state, { hero, deltaMs: FRAME })
    if (result.hit) hits += 1
    state = result.state
  }
  return { state, hits }
}

test('icicle: hangs until the hero passes under, shakes 400ms, then falls and shatters on the floor', () => {
  let state = stepIcicle(icicle, createIcicleState(icicle), { hero: heroAt(300), deltaMs: FRAME }).state
  assert.equal(state.phase, 'hanging')
  state = stepIcicle(icicle, state, { hero: heroAt(410), deltaMs: FRAME }).state
  assert.equal(state.phase, 'shaking')
  state = stepIcicle(icicle, state, { hero: null, deltaMs: 40 }).state
  assert.notEqual(icicleShakeOffset(state), 0)
  state = stepIcicle(icicle, state, { hero: null, deltaMs: 360 }).state
  assert.equal(state.phase, 'falling', 'it falls even after the hero left')
  const landed = fall(state, null)
  assert.deepEqual([landed.state.phase, landed.state.dropY, landed.hits], ['shattered', icicle.floorY - icicle.y - ICICLE_LENGTH, 0])
  assert.equal(stepIcicle(icicle, landed.state, { hero: heroAt(400), deltaMs: 5000 }).state.phase, 'shattered', 'gone until the respawn')
})

test('icicle: a hero under it is hit once and it shatters on the hero', () => {
  const result = fall({ ...createIcicleState(icicle), phase: 'falling' }, heroAt(400))
  assert.deepEqual([result.hits, result.state.hits, result.state.phase], [1, 1, 'shattered'])
  assert.ok(icicleBox(icicle, result.state).bottom > 206)
})

test('icicle: the checkpoint respawn hangs it again; a hero above the ceiling line or beside it never triggers it', () => {
  const reset = resetIcicle(icicle, { ...createIcicleState(icicle), phase: 'shattered', dropY: 172, hits: 1 })
  assert.deepEqual([reset.phase, reset.dropY, reset.hits], ['hanging', 0, 1])
  assert.equal(isHeroUnderIcicle(icicle, { left: 392, right: 408, top: 10, bottom: 38 }), false)
  assert.equal(isHeroUnderIcicle(icicle, heroAt(421)), false)
  assert.equal(isHeroUnderIcicle(icicle, heroAt(420)), true)
  assert.deepEqual(icicleBox(icicle, { dropY: 0 }), { left: 395, right: 405, top: 40, bottom: 64 })
})

test('icicle art: the spike 000 until it shatters, then the shards 001', () => {
  assert.deepEqual(['hanging', 'shaking', 'falling', 'shattered'].map((phase) => icicleFrameIndex(phase as IcicleState['phase'])), [0, 0, 0, 1])
})
