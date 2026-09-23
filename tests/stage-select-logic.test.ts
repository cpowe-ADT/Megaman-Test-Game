import test from 'node:test'
import assert from 'node:assert/strict'
import { FINAL_STAGE_ID, getCampaignStage, getRobotMasterStages, getSelectableBossStages } from '../src/content/campaign'
import { StageSelectLogic } from '../src/scenes/stage-select/StageSelectLogic'

test('StageSelectLogic confirm returns Game transition with selected boss', () => {
  const logic = new StageSelectLogic()
  logic.setIndex(0)
  logic.setCheckpointId('pyro_start')

  const transition = logic.confirm()
  const firstStage = getRobotMasterStages()[0]

  assert.ok(transition)
  assert.equal(transition.scene, 'Game')
  assert.equal(transition.data.bossId, firstStage?.bossId)
  assert.equal(transition.data.stageId, firstStage?.id)
  assert.equal(transition.data.checkpointId, 'pyro_start')
})

test('StageSelectLogic confirm returns null for out-of-range index', () => {
  const logic = new StageSelectLogic()
  logic.setIndex(999)

  const transition = logic.confirm()

  assert.equal(transition, null)
})

test('StageSelectLogic exposes Omega Fortress as the ninth selectable tile', () => {
  const selectableStages = getSelectableBossStages()
  const logic = new StageSelectLogic()
  logic.setIndex(8)

  const transition = logic.confirm()

  assert.equal(selectableStages.length, 9)
  assert.equal(selectableStages[8]?.id, FINAL_STAGE_ID)
  assert.deepEqual(transition?.data, {
    stageId: FINAL_STAGE_ID,
    bossId: 'omega_core',
    runtimeBossConfigId: 'omega_core',
    checkpointId: undefined
  })
  assert.equal(getCampaignStage(FINAL_STAGE_ID).bossId, 'omega_core')
})
