import test from 'node:test'
import assert from 'node:assert/strict'
import { Save } from '../src/systems/Save'

function emptySave() {
  return {
    weaponsUnlocked: [],
    gameOverCounts: {},
    clearedBosses: [],
    tutorialCleared: false,
    finalBossCleared: false,
    gameCompleted: false,
    activeRun: null
  }
}

test('Save persists added weapons without duplicates', () => {
  Save.save(emptySave())

  Save.addWeapon('Fire')
  Save.addWeapon('Fire')
  Save.addWeapon('Elec')

  const state = Save.load()
  assert.deepEqual(state.weaponsUnlocked, ['Fire', 'Elec'])
})

test('Save increments game over counts per stage', () => {
  Save.save(emptySave())

  Save.addGameOver('metal')
  Save.addGameOver('metal')
  Save.addGameOver('water')

  const state = Save.load()
  assert.equal(state.gameOverCounts.metal, 2)
  assert.equal(state.gameOverCounts.water, 1)
})

test('Save tracks cleared bosses without duplicates', () => {
  Save.save(emptySave())

  Save.markBossCleared('sentinel_rook')
  Save.markBossCleared('sentinel_rook')
  Save.markBossCleared('pyro_maw')

  const state = Save.load()
  assert.deepEqual(state.clearedBosses, ['sentinel_rook', 'pyro_maw'])
})

test('Save unlocks final route after tutorial and 8 robot masters', () => {
  const save = emptySave()
  save.tutorialCleared = true
  save.clearedBosses = [
    'pyro_maw',
    'tide_reaver',
    'volt_hopper',
    'basalt_titan',
    'ferro_blade',
    'mire_wraith',
    'gale_vixen',
    'glacier_ronin'
  ]
  Save.save(save)

  assert.equal(Save.isFinalRouteUnlocked(), true)
})

test('Save does not unlock final route from duplicate or non-robot clears', () => {
  const save = emptySave()
  save.tutorialCleared = true
  save.clearedBosses = [
    'pyro_maw',
    'pyro_maw',
    'tide_reaver',
    'volt_hopper',
    'basalt_titan',
    'ferro_blade',
    'mire_wraith',
    'gale_vixen',
    'omega_fortress'
  ]
  Save.save(save)

  assert.equal(Save.isFinalRouteUnlocked(), false)
})
