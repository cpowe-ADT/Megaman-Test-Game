import test from 'node:test'
import assert from 'node:assert/strict'
import { getBossDefinitionById, validateBossDefinition } from '../src/boss/config/index'
import { TimedAttackModule } from '../src/boss/framework/AttackModules'
import type { BossAttackDefinition } from '../src/boss/framework/types'
import { TUTORIAL_STAGE_ID, getCampaignStage, getRobotMasterStages } from '../src/content/campaign'

const gameplayStageIds = [TUTORIAL_STAGE_ID, ...getRobotMasterStages().map((stage) => stage.id)]

test('every tutorial and robot-master stage resolves an identity-matched authored runtime config', () => {
  gameplayStageIds.forEach((stageId) => {
    const stage = getCampaignStage(stageId)
    const definition = getBossDefinitionById(stage.runtimeBossConfigId ?? '')

    assert.ok(definition, `${stageId} should resolve a registered runtime boss config`)
    assert.equal(definition.boss_id, stage.bossId)
    assert.equal(definition.attacks.length >= 3, true)
    assert.equal(definition.phases.length >= 2, true)
    assert.equal(validateBossDefinition(definition).length, 0)
  })
})

test('roster runtime configs preserve attack spawn identity and phase unlocks', () => {
  const pyro = getBossDefinitionById('pyro_maw')!
  const tide = getBossDefinitionById('tide_reaver')!
  const glacier = getBossDefinitionById('glacier_ronin')!

  assert.equal(pyro.attacks.find((attack) => attack.id === 'serpent_stream')?.params?.spawns, 'flame_cone')
  assert.equal(tide.attacks.find((attack) => attack.id === 'riptide_crash')?.type, 'hazard')
  assert.equal(glacier.attacks.find((attack) => attack.id === 'glacier_slide')?.type, 'dash')
  assert.deepEqual(pyro.phases[0].unlockAttacks, ['serpent_stream', 'blaze_lob'])
  assert.deepEqual(pyro.phases[1].unlockAttacks, ['ignition_dash'])
})

test('boss definition validation rejects malformed timing, ranges, phase thresholds, and unlocks', () => {
  const malformed = structuredClone(getBossDefinitionById('pyro_maw')!)
  malformed.attacks[0].windupTime = -1
  malformed.attacks[0].rangeMax = -2
  malformed.phases[0].threshold = 0
  malformed.phases[1].unlockAttacks = ['missing_attack']

  const errors = validateBossDefinition(malformed)
  assert.equal(errors.some((error) => error.includes('timing')), true)
  assert.equal(errors.some((error) => error.includes('range')), true)
  assert.equal(errors.some((error) => error.includes('threshold')), true)
  assert.equal(errors.some((error) => error.includes('unknown attack')), true)
})

test('timed attack modules emit dash and slam execution events', () => {
  const base: BossAttackDefinition = {
    id: 'test',
    type: 'dash',
    windupTime: 10,
    activeTime: 20,
    recoveryTime: 30,
    cooldown: 40,
    rangeMin: 0,
    rangeMax: 200,
    weight: 1,
    hit: { damageAmount: 2, damageType: 'impact' }
  }
  const context = {} as any
  const dash = new TimedAttackModule(base)
  dash.Enter(context)
  assert.equal(dash.Tick(11, context).spawnedHitbox, true)

  const slam = new TimedAttackModule({ ...base, id: 'slam', type: 'slam' })
  slam.Enter(context)
  assert.equal(slam.Tick(11, context).spawnedHazard, true)
})

test('Omega phases expose deterministic authored pattern decks', () => {
  const omega = getBossDefinitionById('omega_core')!
  assert.deepEqual(omega.phases[0].patternDeck, ['directive_volley', 'lockdown_pulse'])
  assert.deepEqual(omega.phases[1].patternDeck, ['directive_volley', 'core_ram', 'lockdown_pulse'])
  assert.deepEqual(omega.phases[2].patternDeck, [
    'override_cascade',
    'core_ram',
    'directive_volley',
    'lockdown_pulse'
  ])
})
