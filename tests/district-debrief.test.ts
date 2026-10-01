import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveDistrictDebriefStageId } from '../src/scenes/stage-select/districtDebrief.ts'

// Part 13g, EVAL-P13-014: which district's return debrief plays, on the way back to Stage Select.

const wardenStageIds = ['pyro_maw', 'tide_reaver', 'volt_hopper']

test('a fresh warden victory return plays that warden\'s debrief', () => {
  assert.equal(
    resolveDistrictDebriefStageId({ returnReason: 'victory', focusStageId: 'pyro_maw', wardenStageIds }),
    'pyro_maw'
  )
})

test('no debrief outside a victory return', () => {
  assert.equal(resolveDistrictDebriefStageId({ returnReason: 'menu-exit', focusStageId: 'pyro_maw', wardenStageIds }), null)
  assert.equal(resolveDistrictDebriefStageId({ returnReason: undefined, focusStageId: 'pyro_maw', wardenStageIds }), null)
})

test('no debrief with no focus stage, or a stage outside the warden list (the tutorial)', () => {
  assert.equal(resolveDistrictDebriefStageId({ returnReason: 'victory', focusStageId: null, wardenStageIds }), null)
  assert.equal(resolveDistrictDebriefStageId({ returnReason: 'victory', focusStageId: undefined, wardenStageIds }), null)
  assert.equal(
    resolveDistrictDebriefStageId({ returnReason: 'victory', focusStageId: 'tutorial_sentinel', wardenStageIds }),
    null
  )
})

test('order independence: the result depends only on the cleared stage, never on which others are down', () => {
  for (const stageId of wardenStageIds) {
    assert.equal(resolveDistrictDebriefStageId({ returnReason: 'victory', focusStageId: stageId, wardenStageIds }), stageId)
  }
})
