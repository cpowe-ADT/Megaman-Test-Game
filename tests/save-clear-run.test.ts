import test, { type TestContext } from 'node:test'
import assert from 'node:assert/strict'
import { Save } from '../src/systems/Save'

function storageFixture(t: TestContext) {
  const values = new Map<string, string>()
  const previous = Object.getOwnPropertyDescriptor(globalThis, 'window')
  let writes = 0
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { localStorage: {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { writes += 1; values.set(key, value) }
  } } })
  t.after(() => previous ? Object.defineProperty(globalThis, 'window', previous) : Reflect.deleteProperty(globalThis, 'window'))
  return { values, writes: () => writes }
}

test('clearing an absent run cannot create a campaign and bypass first-launch choice', t => {
  const storage = storageFixture(t)
  assert.equal(Save.exists(), false)
  Save.clearActiveRun()
  assert.equal(storage.values.get('save.v1'), undefined)
  assert.equal(storage.writes(), 0)
  assert.equal(Save.exists(), false)
})

test('clearing a real active run preserves campaign and statistics', t => {
  storageFixture(t)
  Save.startNewCampaign({ difficulty: 'veteran' })
  const state = Save.load(); state.stats.playTimeMs = 1234; state.storyFlags = ['existing-story']
  Save.save(state)
  assert.equal(Save.saveActiveRun({ version: 2, savedAt: 1000, stageId: 'pyro_maw', bossId: 'pyro_maw', playerHp: 7.25, playerMaxHp: 8, playerLives: 2, currentWeaponIndex: 0 }), true)
  const before = Save.load()
  Save.clearActiveRun()
  assert.deepEqual(Save.load(), { ...before, activeRun: null })
  assert.equal(Save.hasActiveRun(), false)
})
