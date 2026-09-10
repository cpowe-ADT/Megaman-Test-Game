import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemMenuOptions } from '../src/scenes/menu/systemMenuSelector'

test('game system menu exposes controls near the top of the menu', () => {
  const options = buildSystemMenuOptions('Game', true)

  assert.equal(options[0]?.id, 'resume')
  assert.equal(options[1]?.id, 'controls')
  assert.equal(options[1]?.enabled, true)
  assert.equal(options[2]?.id, 'progression')
  assert.equal(options[2]?.enabled, true)
})

test('stage select system menu exposes controls even without a save', () => {
  const options = buildSystemMenuOptions('StageSelect', false)
  const controls = options.find((option) => option.id === 'controls')
  const progression = options.find((option) => option.id === 'progression')

  assert.ok(controls)
  assert.equal(controls.enabled, true)
  assert.ok(progression)
  assert.equal(progression.enabled, true)
})
