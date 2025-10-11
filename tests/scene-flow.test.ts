import { describe, expect, it, vi } from 'vitest'
import { SceneManager } from '../src/core/SceneManager'
import { StageSelectHeadlessScene, StageSelectInputBridge } from '../src/scenes/stage-select/StageSelectHeadlessScene'
import { JumpController } from '../src/scenes/game/JumpController'

describe('Stage Select -> Game flow', () => {
  it('pressing confirm transitions to the Game scene', () => {
    const manager = new SceneManager()
    const input: StageSelectInputBridge = {
      isPressed: (action) => action === 'confirm',
      isDown: () => false
    }
    const stageSelect = new StageSelectHeadlessScene(input)
    manager.start(stageSelect)

    manager.update(16)

    expect(manager.currentName()).toBe('Game')
  })

  it('holding jump does not trigger a transition from Stage Select', () => {
    const manager = new SceneManager()
    const input: StageSelectInputBridge = {
      isPressed: () => false,
      isDown: (action) => action === 'jump'
    }
    const stageSelect = new StageSelectHeadlessScene(input)
    manager.start(stageSelect)

    manager.update(16)

    expect(manager.currentName()).toBe('StageSelect')
  })
})

describe('Gameplay jump handling', () => {
  it('applies an upward velocity when jump is held and grounded', () => {
    const controller = new JumpController()
    const setVelocityY = vi.fn()
    const player = { setVelocityY }

    const jumped = controller.update(player, true, true)

    expect(jumped).toBe(true)
    expect(setVelocityY).toHaveBeenCalledWith(-420)
  })
})
