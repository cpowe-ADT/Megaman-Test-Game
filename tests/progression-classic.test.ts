import { WeaknessTable } from '../src/bosses/types'
import { BOSS_ROSTER } from '../src/bosses/roster'
import { getWeaponConfig } from '../src/content/weapons'
import test from 'node:test'
import assert from 'node:assert/strict'
import { CAMPAIGN_STAGES, ROBOT_MASTER_STAGE_IDS, TUTORIAL_STAGE_ID } from '../src/content/campaign'
import { generateClassicWorld, createFreshProgressionState, ensureProgressionState, claimLocationCheck, evaluateFinalGate, exportProgressionTransport, importProgressionTransport } from '../src/progression/index'
import { Save } from '../src/systems/Save'

const fresh = (mode: 'classic' | 'relay_randomizer' = 'classic') => ({ weaponsUnlocked: [], clearedBosses: [], tutorialCleared: false, finalBossCleared: false, gameCompleted: false, ...createFreshProgressionState('test-seed', mode) })
const weapons = ['FlameSerpent','HydroLance','ThunderSpike','QuakeKnuckle','MagcutDisc','AcidGlob','AeroDarts','FrostShatter']
const capsules = ['chip_buster_plus','chip_quick_charge','armor_legs','armor_body','armor_arms','chip_weapon_plus','chip_speedster','armor_helmet']

test('Classic uses one authored world with nine accessible starts and the entire fixed placement table', () => {
  const world = generateClassicWorld()
  assert.equal(world.progressionMode, 'classic')
  assert.equal(world.seed, 'classic')
  assert.deepEqual(world.startingStageIds, [TUTORIAL_STAGE_ID,...ROBOT_MASTER_STAGE_IDS])
  assert.deepEqual(world.stageChain, ROBOT_MASTER_STAGE_IDS)
  assert.deepEqual(world.finalGate.rules, [{ category: 'medals', required: 8 }])
  assert.equal(world.weaknessStrictness, 'weakness_and_buster')
  assert.equal(world.placements[`${TUTORIAL_STAGE_ID}:boss_clear`], 'arc_slash')
  assert.equal(world.placements[`${TUTORIAL_STAGE_ID}:capsule`], 'hp_refill_large')
  assert.equal(world.placements[`${TUTORIAL_STAGE_ID}:pickup_bonus`], 'hp_refill_large')
  ROBOT_MASTER_STAGE_IDS.forEach((id, i) => {
    assert.equal(world.placements[`${id}:boss_clear`], weapons[i])
    assert.equal(world.placements[`${id}:capsule`], capsules[i])
    assert.equal(world.placements[`${id}:sub_tank`], i % 2 ? 'sub_tank' : 'hp_refill_large')
    assert.equal(world.placements[`${id}:heart_tank`], 'heart_tank')
    assert.equal(world.placements[`${id}:pickup_bonus`], 'hp_refill_large')
    assert.equal(getWeaponConfig(world.weaknessProfiles[CAMPAIGN_STAGES[id].bossId].weaknessWeaponIds[0]).element, WeaknessTable[BOSS_ROSTER[CAMPAIGN_STAGES[id].bossId].element])
  })
  assert.equal(Object.keys(world.placements).length, 43)
})

test('Classic claims tutorial arc as upgrade, deduplicates tanks and opens gate only at eight medals', () => {
  let save = claimLocationCheck(fresh(), `${TUTORIAL_STAGE_ID}:boss_clear`).nextSave
  assert.ok(save.upgradeUnlocks?.includes('arc_slash'))
  assert.ok(!save.weaponsUnlocked.includes('ArcSlash'))
  for (const id of ROBOT_MASTER_STAGE_IDS) {
    save = claimLocationCheck(save, `${id}:heart_tank`).nextSave
    save = claimLocationCheck(save, `${id}:heart_tank`).nextSave
    save = claimLocationCheck(save, `${id}:sub_tank`).nextSave
  }
  assert.equal(save.heartTanks, 8); assert.equal(save.subTanks, 4)
  for (const id of ROBOT_MASTER_STAGE_IDS.slice(0,7)) save = claimLocationCheck(save, `${id}:boss_clear`).nextSave
  assert.equal(evaluateFinalGate(save).unlocked, false)
  save = claimLocationCheck(save, `${ROBOT_MASTER_STAGE_IDS[7]}:boss_clear`).nextSave
  assert.equal(evaluateFinalGate(save).unlocked, true)
  assert.deepEqual(new Set(save.weaponsUnlocked), new Set(weapons))
})

test('transport roundtrip carries mode and rejects both cross-mode imports without mutation', () => {
  const classic = claimLocationCheck(fresh(), `${TUTORIAL_STAGE_ID}:boss_clear`).nextSave
  const relay = fresh('relay_randomizer')
  for (const [source,target] of [[classic,relay],[relay,classic]]) {
    const before = JSON.stringify(target)
    assert.throws(() => importProgressionTransport(target, exportProgressionTransport(source)), /mode/i)
    assert.equal(JSON.stringify(target), before)
  }
  const payload = exportProgressionTransport(classic)
  assert.equal(payload.slotData.progressionMode, 'classic')
  const roundtrip = importProgressionTransport(fresh(), payload)
  assert.ok(roundtrip.upgradeUnlocks?.includes('arc_slash'))
})

test('legacy mode-less worlds and transports remain Randomizer, unknown explicit mode rejects', () => {
  const relay = fresh('relay_randomizer')
  const legacy = structuredClone(relay)
  delete legacy.progressionWorld!.progressionMode
  assert.equal(ensureProgressionState(legacy).progressionWorld.progressionMode, 'relay_randomizer')
  const payload = exportProgressionTransport(relay)
  delete payload.slotData.progressionMode
  assert.equal(importProgressionTransport(relay, payload).progressionWorld?.progressionMode, 'relay_randomizer')
  assert.throws(() => importProgressionTransport(fresh(), payload), /mode/i)
  assert.throws(() => importProgressionTransport(relay, { ...payload, slotData: { ...payload.slotData, progressionMode: 'mystery' } } as any), /mode/i)
  assert.equal(createFreshProgressionState('old').progressionWorld?.seed, 'old')
})

test('Save preserves fractional HP, difficulty, story flags and statistics over repeated reloads', () => {
  Save.save({ ...fresh(), gameOverCounts: {}, difficulty: 'veteran', storyFlags: ['seen-test'], stats: { playTimeMs: 1234, deaths: 2, clearTimeMsByStage: { pyro_maw: 300 }, secretsFoundByStage: { pyro_maw: 1 } }, activeRun: { version: 2, savedAt: 1, stageId: 'pyro_maw', bossId: 'pyro_maw', playerHp: 7.25, playerMaxHp: 8, playerLives: 3, currentWeaponIndex: 0 } })
  for (let i=0;i<4;i++) { const loaded = Save.load(); assert.equal(loaded.activeRun?.playerHp, 7.25); Save.save(loaded) }
  const result = Save.load()
  assert.equal(result.difficulty, 'veteran'); assert.equal(result.stats.playTimeMs, 1234)
  assert.equal(result.stats.deaths, 2); assert.deepEqual(result.storyFlags, ['seen-test'])
})

test('stored explicit Classic repairs tampered authored rules while legacy snapshots retain theirs', () => {
  const save=fresh()
  save.progressionWorld!.seed='tampered'
  save.progressionWorld!.placements['pyro_maw:boss_clear']='armor_body'
  save.progressionWorld!.finalGate.rules=[]
  assert.deepEqual(ensureProgressionState(save).progressionWorld,generateClassicWorld())
  const relay=fresh('relay_randomizer')
  relay.progressionWorld!.placements['pyro_maw:boss_clear']='armor_body'
  assert.equal(ensureProgressionState(relay).progressionWorld!.placements['pyro_maw:boss_clear'],'armor_body')
})

test('Classic transport keeps repeated tanks and Save preserves sub-one positive HP but repairs corrupt nonpositive HP', () => {
  let save=fresh()
  for(const id of ROBOT_MASTER_STAGE_IDS) for(const kind of ['heart_tank','sub_tank','boss_clear'] as const) save=claimLocationCheck(save,`${id}:${kind}`).nextSave
  const restored=importProgressionTransport(fresh(),exportProgressionTransport(save))
  assert.equal(restored.heartTanks,8);assert.equal(restored.subTanks,4)
  assert.deepEqual(new Set(restored.weaponsUnlocked),new Set(weapons))
  Save.save({...fresh(),gameOverCounts:{},activeRun:{version:2,savedAt:1,stageId:'pyro_maw',bossId:'pyro_maw',playerHp:.25,playerMaxHp:8,playerLives:3,currentWeaponIndex:0}})
  assert.equal(Save.loadActiveRun()?.playerHp,.25)
  Save.saveActiveRun({...Save.loadActiveRun()!,playerHp:-2})
  assert.equal(Save.loadActiveRun()?.playerHp,1)
})
