import test from 'node:test'
import assert from 'node:assert/strict'

// EVAL-P6-011 (12e): save v6 gives the active run the Central Core's act and its Warden Archive clears. A v5 save
// (3ac9b03, stamped) walks forward one step; validation keeps the two fields consistent with the checkpoint.
const store = new Map<string, string>()
;(globalThis as any).window = {
  location: { search: '' },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 }
}
const { Save, SAVE_VERSION, detectSaveVersion, migrateSave, validateActiveRun } = await import('../src/systems/Save.ts')

const PROGRESS = { difficulty: 'normal', stats: { playTimeMs: 1000 }, storyFlags: [], subTankFill: [1], weaponsUnlocked: ['FlameSerpent'], gameOverCounts: {}, clearedBosses: ['pyro_maw'], tutorialCleared: true, finalBossCleared: false, gameCompleted: false, progressionWorld: { progressionMode: 'classic' }, subTanks: 1 }
const run = (fields: Record<string, unknown>) => ({ version: 2, savedAt: 1, playerHp: 5, playerMaxHp: 8, playerLives: 2, currentWeaponIndex: 0, ...fields })
/** 3ac9b03's Central Core was a 1088px stub with six checkpoints (`omega_mid_b` was its third). */
const V5_OMEGA = { ...PROGRESS, saveVersion: 5, activeRun: run({ stageId: 'omega_fortress', bossId: 'omega_core', checkpointId: 'omega_mid_b', checkpointIndex: 2 }) }
const V5_WARDEN = { ...PROGRESS, saveVersion: 5, activeRun: run({ stageId: 'tide_reaver', bossId: 'tide_reaver', checkpointIndex: 0 }) }

test('save v6: SAVE_VERSION is 6 and a stamped v5 save takes exactly the central-core step', () => {
  assert.equal(SAVE_VERSION, 6)
  assert.equal(detectSaveVersion(V5_OMEGA), 5)
  const migrated = migrateSave(V5_OMEGA)
  assert.deepEqual(migrated.steps, ['v5->v6: central core act and rematch clears'])
  assert.equal((migrated.save.activeRun as any).omegaAct, 1)
  assert.deepEqual((migrated.save.activeRun as any).rematchCleared, [])
})

test('save v6: the stub-era Central Core run loads at the fortress start, act 1, no clears', () => {
  store.clear()
  store.set('save.v1', JSON.stringify(V5_OMEGA))
  const loaded = Save.load()
  assert.equal(loaded.activeRun?.stageId, 'omega_fortress')
  assert.equal(loaded.activeRun?.checkpointId, 'omega_start', 'a checkpoint id the new route lacks falls back to the start')
  assert.equal(loaded.activeRun?.omegaAct, 1)
  assert.deepEqual(loaded.activeRun?.rematchCleared, [])
  assert.deepEqual(loaded.subTankFill, [1], 'the migration leaves the sub tanks alone')
})

test('save v6: a warden run migrates with act 1 and no clears and still loads', () => {
  store.clear()
  store.set('save.v1', JSON.stringify(V5_WARDEN))
  const loaded = Save.load()
  assert.equal(loaded.activeRun?.stageId, 'tide_reaver')
  assert.equal(loaded.activeRun?.omegaAct, 1)
  assert.deepEqual(loaded.activeRun?.rematchCleared, [])
})

test('save v6: an unstamped run carrying the new fields is dated v6 and takes no step', () => {
  const unstamped = { ...PROGRESS, activeRun: run({ stageId: 'omega_fortress', bossId: 'omega_core', checkpointId: 'omega_archive', omegaAct: 2, rematchCleared: ['pyro_maw'] }) }
  assert.equal(detectSaveVersion(unstamped), 6)
  assert.deepEqual(migrateSave(unstamped).steps, [])
})

test('save v6: validateActiveRun keeps the act on the checkpoint and cleans the clears', () => {
  const save = Save.load()
  const archive = validateActiveRun(save, run({ stageId: 'omega_fortress', bossId: 'omega_core', checkpointId: 'omega_archive', omegaAct: 2, rematchCleared: ['tide_reaver', 'pyro_maw', 'pyro_maw', 'omega_core', 'not_a_boss', 7] }))
  assert.equal(archive.valid, true)
  assert.equal(archive.run?.omegaAct, 2)
  assert.deepEqual(archive.run?.rematchCleared, ['pyro_maw', 'tide_reaver'], 'wardens only, once each, in door order')
  const mismatched = validateActiveRun(save, run({ stageId: 'omega_fortress', bossId: 'omega_core', checkpointId: 'omega_core', omegaAct: 1, rematchCleared: ['pyro_maw'] }))
  assert.equal(mismatched.run?.omegaAct, 3, 'the checkpoint places the hero, so it decides the act')
  const act1 = validateActiveRun(save, run({ stageId: 'omega_fortress', bossId: 'omega_core', checkpointId: 'omega_spire_mid', omegaAct: 2, rematchCleared: ['pyro_maw'] }))
  assert.equal(act1.run?.omegaAct, 1)
  assert.deepEqual(act1.run?.rematchCleared, [], 'act 1 has no clears')
  const garbage = validateActiveRun(save, run({ stageId: 'omega_fortress', bossId: 'omega_core', checkpointId: 'omega_archive', omegaAct: 'two', rematchCleared: 'pyro_maw' }))
  assert.equal(garbage.run?.omegaAct, 2)
  assert.deepEqual(garbage.run?.rematchCleared, [])
  const warden = validateActiveRun(save, run({ stageId: 'pyro_maw', bossId: 'pyro_maw', omegaAct: 3, rematchCleared: ['pyro_maw'] }))
  assert.equal(warden.run?.omegaAct, 1)
  assert.deepEqual(warden.run?.rematchCleared, [])
})

test('save v6: two clears saved at the archive survive a write and a reload', () => {
  store.clear()
  store.set('save.v1', JSON.stringify({ ...PROGRESS, saveVersion: 6 }))
  assert.equal(Save.saveActiveRun(run({ stageId: 'omega_fortress', bossId: 'omega_core', checkpointId: 'omega_archive', omegaAct: 2, rematchCleared: ['volt_hopper', 'pyro_maw'] }) as any), true)
  assert.equal(JSON.parse(store.get('save.v1') ?? '{}').saveVersion, 6)
  const reloaded = Save.loadActiveRun()
  assert.equal(reloaded?.omegaAct, 2)
  assert.deepEqual(reloaded?.rematchCleared, ['pyro_maw', 'volt_hopper'])
})
