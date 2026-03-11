import test from 'node:test'
import assert from 'node:assert/strict'
import { getRobotMasterStages } from '../src/content/campaign'
import { StageSelectLogic } from '../src/scenes/stage-select/StageSelectLogic'

test('StageSelectLogic confirm returns Game transition with selected boss', () => {
  const logic = new StageSelectLogic()
  logic.setIndex(0)

  const transition = logic.confirm()
  const firstStage = getRobotMasterStages()[0]

  assert.ok(transition)
  assert.equal(transition.scene, 'Game')
  assert.equal(transition.data.bossId, firstStage?.bossId)
  assert.equal(transition.data.stageId, firstStage?.id)
})

test('StageSelectLogic confirm returns null for out-of-range index', () => {
  const logic = new StageSelectLogic()
  logic.setIndex(999)

  const transition = logic.confirm()

  assert.equal(transition, null)
})
