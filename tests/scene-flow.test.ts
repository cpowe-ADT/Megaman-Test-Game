import test from 'node:test'
import assert from 'node:assert/strict'
import { SceneManager } from '../src/core/SceneManager'
import { StageSelectHeadlessScene, StageSelectInputBridge } from '../src/scenes/stage-select/StageSelectHeadlessScene'
import { JumpController } from '../src/scenes/game/JumpController'
import { evaluatePauseState } from '../src/scenes/game/pauseLogic'

test('Stage Select transitions to Game when confirm is pressed once', () => {
  const manager = new SceneManager()
  const input: StageSelectInputBridge = {
    confirmPressedOnce: () => true,
    isDownJump: () => false
  }
  const stageSelect = new StageSelectHeadlessScene(input)
  manager.start(stageSelect)

  manager.update(16)
  manager.update(16)

  assert.equal(manager.currentName(), 'Game')
})

test('Stage Select transitions to Game when NumpadEnter confirm fires once', () => {
  const manager = new SceneManager()
  let numpadConfirmPending = true
  let confirmCalls = 0
  const input: StageSelectInputBridge = {
    confirmPressedOnce: () => {
      confirmCalls += 1
      if (!numpadConfirmPending) {
        return false
      }
      numpadConfirmPending = false
      return true
    },
    isDownJump: () => false
  }
  const stageSelect = new StageSelectHeadlessScene(input)
  manager.start(stageSelect)

  manager.update(16)
  manager.update(16)

  assert.equal(manager.currentName(), 'Game')
  assert.equal(confirmCalls, 1)
})

test('Stage Select ignores jump input while confirming missions', () => {
  const manager = new SceneManager()
  const input: StageSelectInputBridge = {
    confirmPressedOnce: () => false,
    isDownJump: () => true
  }
  const stageSelect = new StageSelectHeadlessScene(input)
  manager.start(stageSelect)

  manager.update(16)

  assert.equal(manager.currentName(), 'StageSelect')
})

test('Gameplay jump applies upward velocity only when grounded', () => {
  const controller = new JumpController()
  const recorded: number[] = []
  const player = {
    setVelocityY(value: number) {
      recorded.push(value)
    }
  }

  const jumped = controller.update(player, true, true)

  assert.equal(jumped, true)
  assert.deepEqual(recorded, [-420])
})

test('Pause toggle blocks gameplay updates while active', () => {
  let paused = false

  const firstStep = evaluatePauseState(paused, true)
  paused = firstStep.paused
  assert.equal(paused, true)
  assert.equal(firstStep.skipUpdate, true)

  const secondStep = evaluatePauseState(paused, true)
  paused = secondStep.paused
  assert.equal(paused, false)
  assert.equal(secondStep.skipUpdate, false)
})
