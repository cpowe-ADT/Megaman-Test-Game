import test from 'node:test'
import assert from 'node:assert/strict'
import {
  claimLocationCheck,
  createFreshProgressionState,
  evaluateFinalGate,
  exportProgressionTransport,
  formatCheckpointLabel,
  generateProgressionWorld,
  getAccessibleCheckpointIds,
  getBossWeaknessLabel,
  getBossWeaknessProfile,
  getFinalGateProgressLabel,
  getFinalGateStatusLabel,
  getLocationCheckId,
  getProgressionItemLabel,
  getStageBossRewardLabel,
  importProgressionTransport,
  parseProgressionTransport,
  resolveBossDamageMultiplier
} from '../src/progression/index.ts'
import { getWeaponDisplayName } from '../src/content/weapons.ts'

function makeSave(seed = 'test-seed') {
  return {
    weaponsUnlocked: [],
    gameOverCounts: {},
    clearedBosses: [],
    tutorialCleared: false,
    finalBossCleared: false,
    gameCompleted: false,
    ...createFreshProgressionState(seed),
    activeRun: null
  }
}

test('generateProgressionWorld is deterministic for a seed', () => {
  const first = generateProgressionWorld('alpha')
  const second = generateProgressionWorld('alpha')

  assert.deepEqual(first, second)
})

test('tutorial boss clear grants the first access item in the progression chain', () => {
  const save = makeSave()

  const claim = claimLocationCheck(save, getLocationCheckId('tutorial_sentinel', 'boss_clear'))

  assert.equal(claim.duplicate, false)
  assert.ok(claim.itemId?.startsWith('access_'))
  assert.equal(claim.nextSave.stageAccessUnlocked.includes(String(claim.itemId).replace(/^access_/, '')), true)
  assert.equal(claim.nextSave.tutorialCleared, true)
})

test('boss clear claims are the canonical clear and completion authority', () => {
  const robotStages = [
    'pyro_maw',
    'tide_reaver',
    'volt_hopper',
    'basalt_titan',
    'ferro_blade',
    'mire_wraith',
    'gale_vixen',
    'glacier_ronin'
  ] as const
  let save = claimLocationCheck(
    makeSave('canonical-clear-seed'),
    getLocationCheckId('tutorial_sentinel', 'boss_clear')
  ).nextSave

  for (const stageId of robotStages) {
    save = claimLocationCheck(save, getLocationCheckId(stageId, 'boss_clear')).nextSave
  }
  save = claimLocationCheck(save, getLocationCheckId('omega_fortress', 'boss_clear')).nextSave

  assert.equal(save.tutorialCleared, true)
  assert.deepEqual(save.clearedBosses, [...robotStages])
  assert.equal(save.finalBossCleared, true)
  assert.equal(save.gameCompleted, true)
  assert.equal(evaluateFinalGate(save).unlocked, true)
})

test('checkpoint access respects unlocked checkpoints and helmet override', () => {
  const save = makeSave()
  save.unlockedCheckpoints.pyro_maw = ['pyro_mid_b']

  const restricted = getAccessibleCheckpointIds(save, 'pyro_maw', [
    'pyro_start',
    'pyro_mid_a',
    'pyro_mid_b',
    'pyro_mid_c'
  ])
  assert.deepEqual(restricted, ['pyro_start', 'pyro_mid_b'])

  save.upgradeUnlocks = ['armor_helmet']
  const helmet = getAccessibleCheckpointIds(save, 'pyro_maw', [
    'pyro_start',
    'pyro_mid_a',
    'pyro_mid_b',
    'pyro_mid_c'
  ])
  assert.deepEqual(helmet, ['pyro_start', 'pyro_mid_a', 'pyro_mid_b', 'pyro_mid_c'])
})

test('final gate evaluation uses configured rule bundles', () => {
  const save = makeSave()
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
  save.weaponsUnlocked = ['FlameSerpent', 'HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob']
  save.upgradeUnlocks = ['armor_helmet', 'armor_arms', 'armor_body', 'armor_legs']
  save.heartTanks = 8
  save.subTanks = 4

  const gate = evaluateFinalGate(save)

  assert.equal(gate.unlocked, true)
})

test('final gate requires tutorial, all masters, and every configured rule', () => {
  const save = makeSave('strict-final-gate')
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
  save.progressionWorld!.finalGate.rules = [{ category: 'weapons', required: 1 }]

  assert.equal(evaluateFinalGate(save).unlocked, false)

  save.weaponsUnlocked = ['FlameSerpent']
  assert.equal(evaluateFinalGate(save).unlocked, true)

  save.tutorialCleared = false
  assert.equal(evaluateFinalGate(save).unlocked, false)
})

test('boss weakness strictness blocks non-matching weapons when configured', () => {
  const blocked = resolveBossDamageMultiplier({
    strictness: 'only_weakness',
    profile: { bossId: 'pyro_maw', weaknessWeaponIds: ['HydroLance'] },
    weaponId: 'Buster',
    chargeLevel: 0,
    hasArmsUpgrade: false
  })
  const weak = resolveBossDamageMultiplier({
    strictness: 'only_weakness',
    profile: { bossId: 'pyro_maw', weaknessWeaponIds: ['HydroLance'] },
    weaponId: 'HydroLance',
    chargeLevel: 0,
    hasArmsUpgrade: false
  })

  assert.equal(blocked, 0)
  assert.equal(weak > 1, true)
})

test('progression transport round-trips collected checks and checkpoints', () => {
  const save = makeSave()
  save.collectedChecks = [getLocationCheckId('tutorial_sentinel', 'capsule')]
  save.unlockedCheckpoints.pyro_maw = ['pyro_mid_a', 'pyro_mid_b']

  const exported = exportProgressionTransport(save)
  const imported = importProgressionTransport(makeSave(), exported)

  assert.deepEqual(imported.collectedChecks, save.collectedChecks)
  assert.deepEqual(imported.unlockedCheckpoints.pyro_maw, ['pyro_mid_a', 'pyro_mid_b'])
})

test('progression transport rebuilds seeded world and canonical completion truth on a fresh profile', () => {
  const sourceSeed = 'source-world-seed'
  const robotStages = [
    'pyro_maw',
    'tide_reaver',
    'volt_hopper',
    'basalt_titan',
    'ferro_blade',
    'mire_wraith',
    'gale_vixen',
    'glacier_ronin'
  ] as const
  let source = makeSave(sourceSeed)
  source = claimLocationCheck(source, getLocationCheckId('tutorial_sentinel', 'boss_clear')).nextSave
  for (const stageId of robotStages) {
    source = claimLocationCheck(source, getLocationCheckId(stageId, 'boss_clear')).nextSave
  }
  source = claimLocationCheck(source, getLocationCheckId('omega_fortress', 'boss_clear')).nextSave
  source.unlockedCheckpoints.pyro_maw = ['pyro_mid_a', 'pyro_mid_b']

  const imported = importProgressionTransport(makeSave('different-target-seed'), exportProgressionTransport(source))
  const expectedWorld = generateProgressionWorld(sourceSeed)

  assert.equal(imported.progressionWorld?.seed, sourceSeed)
  assert.deepEqual(imported.progressionWorld?.stageChain, expectedWorld.stageChain)
  assert.deepEqual(imported.progressionWorld?.placements, expectedWorld.placements)
  assert.deepEqual(imported.progressionWorld?.weaknessProfiles, expectedWorld.weaknessProfiles)
  assert.equal(imported.tutorialCleared, true)
  assert.deepEqual(imported.clearedBosses, [...robotStages])
  assert.equal(imported.finalBossCleared, true)
  assert.equal(imported.gameCompleted, true)
  assert.equal(evaluateFinalGate(imported).unlocked, true)
  assert.deepEqual(imported.unlockedCheckpoints.pyro_maw, ['pyro_mid_a', 'pyro_mid_b'])
})

test('progression transport preserves repeated received items and replaces stale target inventory', () => {
  const target = makeSave('stale-target')
  target.weaponsUnlocked = ['FrostShatter']
  target.upgradeUnlocks = ['armor_body']
  target.heartTanks = 8
  target.subTanks = 4

  const imported = importProgressionTransport(target, {
    version: 1,
    slotData: {
      seed: 'received-items-seed',
      startingStageIds: ['tutorial_sentinel', 'pyro_maw'],
      weaknessStrictness: 'weakness_and_buster',
      finalGate: { rules: [{ category: 'medals', required: 8 }] }
    },
    checkedLocations: [],
    receivedItems: ['heart_tank', 'heart_tank', 'sub_tank', 'FlameSerpent'],
    checkpoints: {}
  })

  assert.equal(imported.heartTanks, 2)
  assert.equal(imported.subTanks, 1)
  assert.deepEqual(imported.weaponsUnlocked, ['FlameSerpent'])
  assert.deepEqual(imported.upgradeUnlocks, [])
})

test('progression presentation helpers format items and checkpoints for UI text', () => {
  assert.equal(getProgressionItemLabel('access_pyro_maw'), 'Pyro Maw Access')
  assert.equal(getProgressionItemLabel('armor_arms'), 'Arms Armor')
  assert.equal(getProgressionItemLabel('FlameSerpent'), 'Flame Serpent')
  assert.equal(formatCheckpointLabel('tutorial_boss_gate'), 'Boss Gate')
  assert.equal(formatCheckpointLabel('pyro_mid'), 'Mid')
})

test('seeded presentation helpers use live weakness and boss-clear placement truth', () => {
  const save = makeSave()
  const profile = getBossWeaknessProfile(save, 'pyro_maw')
  assert.ok(profile)
  assert.equal(
    getBossWeaknessLabel(save, 'pyro_maw'),
    profile.weaknessWeaponIds.map((weaponId) => getWeaponDisplayName(weaponId)).join(' / ')
  )

  save.progressionWorld!.weaknessProfiles.pyro_maw = {
    bossId: 'pyro_maw',
    weaknessWeaponIds: ['FrostShatter']
  }
  assert.equal(getBossWeaknessLabel(save, 'pyro_maw'), 'Frost Shatter')

  save.progressionWorld!.placements[getLocationCheckId('pyro_maw', 'boss_clear')] = 'heart_tank'
  assert.equal(getStageBossRewardLabel(save, 'pyro_maw'), 'Heart Tank')
})

test('final gate presentation summarizes live progression counts', () => {
  const save = makeSave()
  save.progressionWorld!.finalGate.rules = [
    { category: 'medals', required: 8 },
    { category: 'weapons', required: 4 }
  ]

  assert.equal(getFinalGateProgressLabel(save), 'Medals 0/8 • Weapons 0/4')
  assert.equal(getFinalGateStatusLabel(save), 'FINAL • LOCKED 0/8 • Medals 0/8 • Weapons 0/4')

  save.gameCompleted = true
  assert.equal(getFinalGateStatusLabel(save), 'FINAL • COMPLETE')
})

test('progression transport parser validates and normalizes JSON snapshots', () => {
  const payload = parseProgressionTransport(
    JSON.stringify({
      version: 1,
      slotData: {
        seed: 'alpha-seed',
        startingStageIds: ['tutorial_sentinel', 'pyro_maw', 'pyro_maw'],
        weaknessStrictness: 'only_weakness',
        finalGate: {
          rules: [
            { category: 'medals', required: 6 },
            { category: 'invalid', required: 99 }
          ]
        }
      },
      checkedLocations: ['tutorial_sentinel:boss_clear', 'tutorial_sentinel:boss_clear'],
      receivedItems: ['access_pyro_maw'],
      checkpoints: {
        pyro_maw: ['pyro_mid_a', 'pyro_mid_a']
      }
    })
  )

  assert.equal(payload.slotData.seed, 'alpha-seed')
  assert.deepEqual(payload.slotData.startingStageIds, ['tutorial_sentinel', 'pyro_maw'])
  assert.equal(payload.slotData.weaknessStrictness, 'only_weakness')
  assert.deepEqual(payload.slotData.finalGate.rules, [{ category: 'medals', required: 6 }])
  assert.deepEqual(payload.checkedLocations, ['tutorial_sentinel:boss_clear'])
  assert.deepEqual(payload.receivedItems, ['access_pyro_maw'])
  assert.deepEqual(payload.checkpoints.pyro_maw, ['pyro_mid_a'])
})

test('progression transport parser preserves repeated allowed received items', () => {
  const payload = parseProgressionTransport(
    JSON.stringify({
      version: 1,
      slotData: {
        seed: 'repeat-items',
        startingStageIds: ['tutorial_sentinel'],
        weaknessStrictness: 'weakness_and_buster',
        finalGate: { rules: [] }
      },
      checkedLocations: [],
      receivedItems: ['heart_tank', 'heart_tank', 'sub_tank'],
      checkpoints: {}
    })
  )

  assert.deepEqual(payload.receivedItems, ['heart_tank', 'heart_tank', 'sub_tank'])
})

test('progression transport parser rejects oversized snapshots', () => {
  assert.throws(
    () => parseProgressionTransport(' '.repeat(50_001)),
    /too large/
  )
})

test('progression transport import drops unknown ids and clamps gate rules', () => {
  const imported = importProgressionTransport(makeSave(), {
    version: 1,
    slotData: {
      seed: 'x'.repeat(120),
      startingStageIds: ['tutorial_sentinel', 'unknown_stage' as any],
      weaknessStrictness: 'only_weakness',
      finalGate: {
        rules: [
          { category: 'medals', required: 999 },
          { category: 'invalid' as any, required: 999 }
        ]
      }
    },
    checkedLocations: [
      'tutorial_sentinel:boss_clear',
      'unknown_stage:boss_clear' as any
    ],
    receivedItems: ['access_pyro_maw', 'made_up_item' as any],
    checkpoints: {
      pyro_maw: ['pyro_mid_a', 'not_a_checkpoint'],
      made_up_stage: ['pyro_mid_a']
    }
  })

  assert.equal(imported.progressionWorld?.seed.length, 64)
  assert.deepEqual(imported.progressionWorld?.startingStageIds, ['tutorial_sentinel'])
  assert.deepEqual(imported.progressionWorld?.finalGate.rules, [{ category: 'medals', required: 8 }])
  assert.deepEqual(imported.collectedChecks, ['tutorial_sentinel:boss_clear'])
  assert.deepEqual(imported.unlockedCheckpoints.pyro_maw, ['pyro_mid_a'])
  assert.equal('made_up_stage' in imported.unlockedCheckpoints, false)
})
