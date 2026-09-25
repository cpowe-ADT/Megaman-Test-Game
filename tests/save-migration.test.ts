import test from 'node:test'
import assert from 'node:assert/strict'

// EVAL-P12-002: every save.v1 shape found in git history loads through the versioned migrate step.
const store = new Map<string, string>()
;(globalThis as any).window = {
  location: { search: '' },
  localStorage: { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 }
}
const { Save, SAVE_VERSION, detectSaveVersion, migrateSave } = await import('../src/systems/Save.ts')

const RUN = { savedAt: 1, stageId: 'tide_reaver', bossId: 'tide_reaver', playerHp: 5, playerMaxHp: 8, playerLives: 2, currentWeaponIndex: 0 }
const FIXTURES: Array<{ era: string; version: number; save: Record<string, unknown> }> = [
  { era: 'cd18309 weapons and game-over counts', version: 1, save: { weaponsUnlocked: ['FlameSerpent'], gameOverCounts: { pyro_maw: 2 } } },
  { era: '34bde56 clears and the active run', version: 2, save: { weaponsUnlocked: ['FlameSerpent'], gameOverCounts: {}, clearedBosses: ['pyro_maw'], tutorialCleared: true, finalBossCleared: false, gameCompleted: false, activeRun: { version: 2, ...RUN } } },
  { era: '35a1fba progression world', version: 3, save: { weaponsUnlocked: ['FlameSerpent'], gameOverCounts: {}, clearedBosses: ['pyro_maw'], tutorialCleared: true, finalBossCleared: false, gameCompleted: false, progressionWorld: { progressionMode: 'classic' }, stageAccessUnlocked: [], collectedChecks: [], unlockedCheckpoints: {}, selectedCheckpointByStage: {}, upgradeUnlocks: [], heartTanks: 0, subTanks: 0, pendingProgressionItems: [], activeRun: { version: 2, ...RUN, checkpointIndex: 0 } } },
  { era: '475ab82 difficulty, statistics, story flags', version: 4, save: { difficulty: 'veteran', stats: { playTimeMs: 4_320_000, deaths: 2, clearTimeMsByStage: {}, secretsFoundByStage: {} }, storyFlags: ['prologue'], weaponsUnlocked: ['FlameSerpent'], gameOverCounts: {}, clearedBosses: ['pyro_maw'], tutorialCleared: true, finalBossCleared: false, gameCompleted: false, progressionWorld: { progressionMode: 'classic' }, stageAccessUnlocked: [], collectedChecks: [], unlockedCheckpoints: {}, selectedCheckpointByStage: {}, upgradeUnlocks: [], heartTanks: 0, subTanks: 0, pendingProgressionItems: [], activeRun: { version: 2, ...RUN, stageElapsedMs: 900 } } },
  { era: '12bbae3 sub tank fill (unversioned current)', version: 5, save: { difficulty: 'assist', stats: { playTimeMs: 60_000 }, storyFlags: [], subTankFill: [], weaponsUnlocked: ['FlameSerpent'], gameOverCounts: {}, clearedBosses: ['pyro_maw'], tutorialCleared: true, finalBossCleared: false, gameCompleted: false, progressionWorld: { progressionMode: 'classic' } } }
]

for (const fixture of FIXTURES) {
  test(`save migration: v${fixture.version} (${fixture.era}) loads instead of being dropped`, () => {
    assert.equal(detectSaveVersion(fixture.save), fixture.version)
    const migrated = migrateSave(fixture.save)
    assert.equal(migrated.from, fixture.version)
    assert.equal(migrated.to, SAVE_VERSION)
    assert.equal(migrated.steps.length, SAVE_VERSION - fixture.version)
    store.clear()
    store.set('save.v1', JSON.stringify(fixture.save))
    const loaded = Save.load()
    assert.deepEqual(loaded.weaponsUnlocked, ['FlameSerpent'])
    assert.equal(Array.isArray(loaded.subTankFill) && loaded.subTankFill.length, loaded.subTanks)
    assert.equal(typeof loaded.stats.playTimeMs, 'number')
    if (fixture.version >= 2) {
      assert.deepEqual(loaded.clearedBosses, ['pyro_maw'])
      assert.equal(loaded.tutorialCleared, true)
    }
    if (fixture.version >= 4) assert.equal(loaded.difficulty, fixture.save.difficulty)
    if (fixture.version === 4) assert.deepEqual(loaded.storyFlags, ['prologue'])
    if (fixture.save.activeRun) assert.equal(loaded.activeRun?.stageId, 'tide_reaver', 'the saved mission survives the migration')
  })
}

test('save migration: an unversioned active run is upgraded, a newer one is still refused', () => {
  const { version: _v, ...unversioned } = { version: 2, ...RUN }
  store.clear()
  store.set('save.v1', JSON.stringify({ tutorialCleared: true, activeRun: unversioned }))
  assert.equal(Save.load().activeRun?.version, 2)
  store.set('save.v1', JSON.stringify({ tutorialCleared: true, activeRun: { version: 3, ...RUN } }))
  assert.equal(Save.load().activeRun, null)
})

test('save migration: writes are stamped; a save from a newer build loads with the fields this build knows', () => {
  store.clear()
  Save.startNewCampaign({ difficulty: 'veteran' })
  assert.equal(JSON.parse(store.get('save.v1') ?? '{}').saveVersion, SAVE_VERSION)
  assert.equal(migrateSave(JSON.parse(store.get('save.v1') ?? '{}')).steps.length, 0)
  store.set('save.v1', JSON.stringify({ ...JSON.parse(store.get('save.v1') ?? '{}'), saveVersion: SAVE_VERSION + 4, futureField: true }))
  const future = migrateSave(JSON.parse(store.get('save.v1') ?? '{}'))
  assert.equal(future.from, SAVE_VERSION + 4)
  assert.deepEqual(future.steps, [])
  assert.equal(Save.load().difficulty, 'veteran')
  assert.deepEqual(migrateSave('not an object').save, {})
})
