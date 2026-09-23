import test from 'node:test'
import assert from 'node:assert/strict'
import { JumpController } from '../src/scenes/game/JumpController'

test('JumpController does not repeatedly jump while button is held', () => {
  const controller = new JumpController()
  const velocities: number[] = []
  const player = {
    setVelocityY(value: number) {
      velocities.push(value)
    }
  }

  const first = controller.update(player, true, true)
  const second = controller.update(player, true, true)

  assert.equal(first, true)
  assert.equal(second, false)
  assert.deepEqual(velocities, [-420])
})

test('JumpController reset allows jumping again', () => {
  const controller = new JumpController()
  const velocities: number[] = []
  const player = {
    setVelocityY(value: number) {
      velocities.push(value)
    }
  }

  controller.update(player, true, true)
  controller.reset()
  const jumpedAfterReset = controller.update(player, true, true)

  assert.equal(jumpedAfterReset, true)
  assert.deepEqual(velocities, [-420, -420])
})
