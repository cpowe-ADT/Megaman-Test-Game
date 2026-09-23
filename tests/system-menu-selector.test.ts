import test from 'node:test'
import assert from 'node:assert/strict'
import { buildSystemMenuOptions, describeSubTank, selectMenuIndex } from '../src/scenes/menu/systemMenuSelector'
import { advanceDeleteConfirmation, applyOptionsChange, optionsRows } from '../src/scenes/menu/optionsModel'
import { GAME_OVER_AUTO_CONTINUE_MS, LIVES_PER_STAGE_ENTRY, gameOverChoices, resolveContinueCheckpoint } from '../src/scenes/game/gameOverLogic'

const inventory = {
  weapons: [
    { id: 'Buster', label: 'Buster', energy: { current: 28, max: 28 } },
    { id: 'FlameSerpent', label: 'Flame Serpent', energy: { current: 17, max: 28 } }
  ],
  currentWeaponIndex: 1,
  subTankFill: [1, 0.5],
  selectedSubTank: 1,
  heartTanks: 3,
  upgrades: ['armor_body', 'chip_speedster']
}

test('pause menu: weapon and sub tank rows lead, actions follow, one linear cursor', () => {
  const options = buildSystemMenuOptions('Game', inventory)
  assert.deepEqual(options.map((option) => option.id), ['weapon', 'sub_tank', 'resume', 'controls', 'options', 'stage_select'])
  assert.equal(options[0].kind, 'cycle')
  assert.match(options[0].label, /Flame Serpent  17\/28/)
  assert.match(options[1].label, /TANK 2\/2  50%/)
  assert.equal(options[1].enabled, true)
  assert.equal(buildSystemMenuOptions('Game', { ...inventory, subTankFill: [] })[1].enabled, false)
  assert.equal(describeSubTank([], 0), 'NONE')
  assert.equal(selectMenuIndex(5, 1, 6), 0)
  assert.equal(selectMenuIndex(0, -1, 6), 5)
  assert.equal(buildSystemMenuOptions('Game', null).some((option) => ['save_game', 'load_game', 'progression'].includes(option.id)), false)
})

test('route console: controls, options, new campaign, back; progression only for automation', () => {
  assert.deepEqual(buildSystemMenuOptions('StageSelect').map((option) => option.id), ['controls', 'options', 'new_game', 'back'])
  assert.deepEqual(buildSystemMenuOptions('StageSelect', null, true).map((option) => option.id), ['controls', 'options', 'new_game', 'progression', 'back'])
})

test('options model: rows, cycling with clamps and wrap, typed delete confirmation', () => {
  const state = { settings: { musicVolume: 10, sfxVolume: 0, screenShake: true, storyReplay: false }, difficulty: 'normal' as const }
  const rows = optionsRows(state)
  assert.deepEqual(rows.map((row) => row.id), ['musicVolume', 'sfxVolume', 'screenShake', 'storyReplay', 'difficulty', 'controls', 'delete', 'back'])
  assert.deepEqual(applyOptionsChange(state, 'musicVolume', 1), { settings: { musicVolume: 10 } })
  assert.deepEqual(applyOptionsChange(state, 'sfxVolume', -1), { settings: { sfxVolume: 0 } })
  assert.deepEqual(applyOptionsChange(state, 'screenShake', 1), { settings: { screenShake: false } })
  assert.deepEqual(applyOptionsChange(state, 'difficulty', 1), { difficulty: 'veteran' })
  assert.deepEqual(applyOptionsChange(state, 'difficulty', -1), { difficulty: 'assist' })
  assert.deepEqual(applyOptionsChange(state, 'back', 1), {})
  let typed = ''
  for (const key of ['d', 'E', 'l', 'e', 't']) typed = advanceDeleteConfirmation(typed, key)
  assert.equal(typed, 'DELET')
  assert.equal(advanceDeleteConfirmation(typed, 'x'), '')
  assert.equal(advanceDeleteConfirmation(typed, 'e'), 'DELETE')
})

test('death economy: continue from the checkpoint, stage start on veteran, five-second auto continue', () => {
  assert.equal(resolveContinueCheckpoint('normal', 'pyro_mid'), 'pyro_mid')
  assert.equal(resolveContinueCheckpoint('assist', 'pyro_mid'), 'pyro_mid')
  assert.equal(resolveContinueCheckpoint('veteran', 'pyro_mid'), undefined)
  assert.equal(resolveContinueCheckpoint('normal', null), undefined)
  assert.deepEqual(gameOverChoices().map((choice) => choice.id), ['continue', 'quit'])
  assert.equal(GAME_OVER_AUTO_CONTINUE_MS, 5000)
  assert.equal(LIVES_PER_STAGE_ENTRY, 3)
})
