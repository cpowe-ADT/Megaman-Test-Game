import test from 'node:test'
import assert from 'node:assert/strict'
import { createFreshProgressionState, getLocationCheckId } from '../src/progression/index.ts'
import { Save, validateActiveRun } from '../src/systems/Save'

function emptySave() {
  return {
    weaponsUnlocked: [],
    gameOverCounts: {},
    clearedBosses: [],
    tutorialCleared: false,
    finalBossCleared: false,
    gameCompleted: false,
    ...createFreshProgressionState(),
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
  save.weaponsUnlocked = [
    'FlameSerpent',
    'HydroLance',
    'ThunderSpike',
    'QuakeKnuckle',
    'MagcutDisc',
    'AcidGlob',
    'AeroDarts',
    'FrostShatter'
  ]
  save.upgradeUnlocks = ['armor_helmet', 'armor_arms', 'armor_body', 'armor_legs']
  save.heartTanks = 8
  save.subTanks = 4
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

test('Save persists checkpoint unlocks and selection', () => {
  Save.save(emptySave())

  Save.unlockCheckpoint('pyro_maw', 'pyro_mid_a')
  Save.setSelectedCheckpoint('pyro_maw', 'pyro_mid_a')

  const state = Save.load()
  assert.deepEqual(state.unlockedCheckpoints.pyro_maw, ['pyro_mid_a'])
  assert.equal(state.selectedCheckpointByStage.pyro_maw, 'pyro_mid_a')
})

test('Save exports progression payload with collected locations and received items', () => {
  const save = emptySave()
  save.collectedChecks = [getLocationCheckId('tutorial_sentinel', 'boss_clear')]
  Save.save(save)

  const exported = Save.exportProgression()

  assert.equal(exported.checkedLocations.length, 1)
  assert.equal(exported.receivedItems.length, 1)
})

test('Save imports progression payload into the active save state', () => {
  const before = emptySave()
  before.activeRun = {
    version: 2,
    savedAt: 1,
    stageId: 'pyro_maw',
    bossId: 'pyro_maw',
    playerHp: 8,
    playerMaxHp: 8,
    playerLives: 3,
    currentWeaponIndex: 0,
    currentWeaponId: 'Buster',
    checkpointId: 'pyro_start',
    checkpointIndex: 0,
    weaponEnergyById: { Buster: 28 }
  }
  Save.save(before)

  Save.importProgression({
    version: 1,
    slotData: {
      seed: 'import-seed',
      startingStageIds: ['tutorial_sentinel', 'pyro_maw'],
      weaknessStrictness: 'only_weakness',
      finalGate: {
        rules: [{ category: 'medals', required: 6 }]
      }
    },
    checkedLocations: [getLocationCheckId('tutorial_sentinel', 'boss_clear')],
    receivedItems: ['access_pyro_maw'],
    checkpoints: {
      pyro_maw: ['pyro_mid_a']
    }
  })

  const state = Save.load()
  assert.equal(state.progressionWorld?.seed, 'import-seed')
  assert.deepEqual(state.collectedChecks, [getLocationCheckId('tutorial_sentinel', 'boss_clear')])
  assert.deepEqual(state.unlockedCheckpoints.pyro_maw, ['pyro_mid_a'])
  assert.equal(state.tutorialCleared, true)
  assert.equal(state.activeRun, null)
})

test('validateActiveRun rejects stage and boss identity mismatches', () => {
  const save = emptySave()
  const unknownStage = validateActiveRun(save, {
    version: 2,
    savedAt: 1,
    stageId: 'not_a_stage',
    bossId: 'pyro_maw'
  })
  const wrongBoss = validateActiveRun(save, {
    version: 2,
    savedAt: 1,
    stageId: 'pyro_maw',
    bossId: 'tide_reaver'
  })

  assert.deepEqual(unknownStage, { valid: false, run: null, reason: 'invalid_stage' })
  assert.deepEqual(wrongBoss, { valid: false, run: null, reason: 'boss_stage_mismatch' })
})

test('validateActiveRun migrates legacy Omega Fortress runs to Omega Core', () => {
  const result = validateActiveRun(emptySave(), {
    version: 2,
    savedAt: 1,
    stageId: 'omega_fortress',
    bossId: 'volt_hopper',
    playerHp: 28,
    playerLives: 3,
    currentWeaponIndex: 0
  })

  assert.equal(result.valid, true)
  assert.equal(result.run?.stageId, 'omega_fortress')
  assert.equal(result.run?.bossId, 'omega_core')
})

test('validateActiveRun normalizes resources, weapon energy, and checkpoints against live content', () => {
  const save = emptySave()
  save.weaponsUnlocked = ['FlameSerpent']

  const result = validateActiveRun(save, {
    version: 2,
    savedAt: Number.NaN,
    stageId: 'pyro_maw',
    bossId: 'pyro_maw',
    playerHp: 999,
    playerMaxHp: -4,
    playerLives: -7,
    currentWeaponIndex: 999,
    currentWeaponId: 'unknown_weapon',
    weaponEnergyById: {
      Buster: 999,
      FlameSerpent: -50,
      unknown_weapon: 999
    },
    checkpointIndex: 999,
    checkpointId: 'not_a_checkpoint'
  })

  assert.equal(result.valid, true)
  if (!result.valid) {
    return
  }
  assert.equal(result.run.playerMaxHp, 8)
  assert.equal(result.run.playerHp, 8)
  assert.equal(result.run.playerLives, 0)
  assert.equal(result.run.currentWeaponId, 'Buster')
  assert.equal(result.run.currentWeaponIndex, 0)
  assert.deepEqual(result.run.weaponEnergyById, { Buster: 28, FlameSerpent: 0 })
  assert.equal(result.run.checkpointId, 'pyro_start')
  assert.equal(result.run.checkpointIndex, 0)
  assert.equal(result.run.savedAt, 0)
})

test('Save drops a corrupt active run before menus or scenes can consume it', () => {
  const save = emptySave()
  save.activeRun = {
    version: 2,
    savedAt: 1,
    stageId: 'not_a_stage',
    bossId: 'not_a_boss',
    playerHp: 999,
    playerMaxHp: -1,
    playerLives: -5,
    currentWeaponIndex: 999
  }

  Save.save(save)

  assert.equal(Save.hasActiveRun(), false)
  assert.equal(Save.loadActiveRun(), null)
  assert.equal(Save.load().activeRun, null)
})
