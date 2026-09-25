import test from 'node:test'
import assert from 'node:assert/strict'
import {
  buildProfileExport,
  DEFAULT_PILOT_NAME,
  exportFileName,
  formatPlayTime,
  loadProfiles,
  newProfileMeta,
  parseProfileExport,
  recordStageBest,
  serializeProfiles,
  slotSaveKey,
  summarizeSlot,
  validatePilotName,
  withSlot,
  withoutSlot
} from '../src/progression/profiles.ts'

const NOW = 1_790_000_000_000
const WARDENS = ['pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin']

test('profiles: slot 1 keeps the legacy save key, slots 2 and 3 get their own', () => {
  assert.equal(slotSaveKey(1), 'save.v1')
  assert.equal(slotSaveKey(2), 'save.v1.slot2')
  assert.equal(slotSaveKey(3), 'save.v1.slot3')
})

test('profiles: pilot names are 2 to 10 of A-Z, 0-9 and space, upper-cased', () => {
  assert.deepEqual(validatePilotName(' ava '), { ok: true, name: 'AVA' })
  assert.deepEqual(validatePilotName('unit  09'), { ok: true, name: 'UNIT 09' })
  assert.equal(validatePilotName('A').ok, false)
  assert.equal(validatePilotName('ELEVENCHARS').ok, false)
  assert.equal(validatePilotName('AVA!').ok, false)
  assert.equal(validatePilotName(42).ok, false)
  assert.equal(newProfileMeta(2, '!!', NOW).pilotName, DEFAULT_PILOT_NAME, 'an invalid name falls back to WREN')
})

test('profiles: a legacy save.v1 becomes slot 1, WREN, started when it shows progress', () => {
  const started = loadProfiles(null, { tutorialCleared: true, clearedBosses: [] }, NOW)
  assert.equal(started.activeSlot, 1)
  assert.equal(started.slots[1]?.pilotName, 'WREN')
  assert.equal(started.slots[1]?.campaignStarted, true)
  assert.equal(started.slots[2], undefined)
  const fresh = loadProfiles(null, { tutorialCleared: false, clearedBosses: [], storyFlags: [] }, NOW)
  assert.equal(fresh.slots[1]?.campaignStarted, false, 'a save written by an Options visit is not a campaign')
  assert.deepEqual(loadProfiles(null, null, NOW).slots, {}, 'no save, no profile')
})

test('profiles: three slots round-trip and junk is dropped', () => {
  let state = loadProfiles(null, null, NOW)
  state = withSlot(state, newProfileMeta(1, 'wren', NOW))
  state = withSlot(state, { ...newProfileMeta(2, 'ava', NOW), campaignStarted: true, playTimeMs: 3_900_000 })
  state = withSlot(state, newProfileMeta(3, 'kit', NOW))
  state = { ...state, activeSlot: 2 }
  const back = loadProfiles(serializeProfiles(state), null, NOW + 1)
  assert.deepEqual(back, state)
  assert.deepEqual(Object.keys(withoutSlot(back, 3).slots), ['1', '2'])
  const junk = loadProfiles(JSON.stringify({ version: 1, activeSlot: 7, slots: { 1: { pilotName: '<script>' }, 4: {} } }), null, NOW)
  assert.equal(junk.activeSlot, 1)
  assert.equal(junk.slots[1]?.pilotName, 'WREN')
  assert.equal(loadProfiles('{not json', { tutorialCleared: true }, NOW).slots[1]?.campaignStarted, true, 'corrupt profiles fall back to the legacy save')
})

test('profiles: a card derives wardens from the slot save and says EMPTY for an unused slot', () => {
  const meta = { ...newProfileMeta(2, 'AVA', NOW), playTimeMs: 3_900_000 }
  const card = summarizeSlot(2, meta, { clearedBosses: ['pyro_maw', 'tide_reaver', 'sentinel_rook'], difficulty: 'normal' }, WARDENS)
  assert.deepEqual(card, { slot: 2, empty: false, pilotName: 'AVA', wardensCleared: 2, wardensTotal: 8, playTime: '1:05', difficulty: 'normal' })
  assert.equal(summarizeSlot(3, undefined, null, WARDENS).pilotName, 'EMPTY')
  assert.equal(formatPlayTime(59_999), '0:00')
})

test('profiles: stage bests keep the best of each field independently', () => {
  let meta = newProfileMeta(1, 'WREN', NOW)
  meta = recordStageBest(meta, 'pyro_maw', { timeMs: 200_000, deaths: 3, secretsFound: 1, rank: 'B' })
  meta = recordStageBest(meta, 'pyro_maw', { timeMs: 240_000, deaths: 1, secretsFound: 0, rank: 'C' })
  assert.deepEqual(meta.stageBests.pyro_maw, { bestTimeMs: 200_000, fewestDeaths: 1, secretsFound: 1, rank: 'B' })
})

test('profiles: export and import round-trip into another slot; foreign files are refused', () => {
  const meta = { ...newProfileMeta(2, 'AVA', NOW), campaignStarted: true, controlsSeen: true }
  const file = JSON.stringify(buildProfileExport(meta, { kind: 'progression', version: 1 }))
  const back = parseProfileExport(file, 3, NOW + 5)
  assert.equal(back.ok, true)
  if (back.ok) {
    assert.equal(back.meta.slot, 3)
    assert.equal(back.meta.pilotName, 'AVA')
    assert.equal(back.meta.campaignStarted, true)
    assert.equal(back.meta.lastPlayedAt, NOW + 5)
    assert.deepEqual(back.progression, { kind: 'progression', version: 1 })
  }
  assert.equal(parseProfileExport('{}', 1, NOW).ok, false)
  assert.equal(parseProfileExport('nope', 1, NOW).ok, false)
  assert.equal(exportFileName('Unit 09'), 'omega-relay-unit-09.json')
})

test('profiles: the name grid starts on END with WREN, types over the default, and validates on END', async () => {
  const { activateNameCell, moveNameCursor, nameEntryCell, nameEntryKey, startNameEntry } = await import('../src/progression/profiles.ts')
  const start = startNameEntry()
  assert.equal(nameEntryCell(start), 'END')
  assert.deepEqual(activateNameCell(start), { kind: 'confirm', name: 'WREN' }, 'Enter keeps the default')
  let state = start
  for (const key of ['a', 'v', 'a']) {
    const result = nameEntryKey(state, key)
    assert.equal(result?.kind, 'edit')
    if (result?.kind === 'edit') state = result.state
  }
  assert.equal(state.name, 'AVA', 'the first typed key replaces the default')
  assert.deepEqual(nameEntryKey(state, 'Enter'), { kind: 'confirm', name: 'AVA' })
  assert.equal(nameEntryKey(state, 'Shift'), null)
  const erased = nameEntryKey(nameEntryKey(state, 'Backspace')?.kind === 'edit' ? (nameEntryKey(state, 'Backspace') as any).state : state, 'Backspace')
  assert.equal(erased?.kind === 'edit' ? erased.state.name : null, 'A')
  assert.equal(nameEntryKey({ ...state, name: 'A', pristine: false }, 'Enter')?.kind, 'invalid', 'one character is too short')
  let pad = moveNameCursor(start, 0, 1)
  assert.equal(nameEntryCell(pad), 'I', 'down from END wraps to the top row, clamped to its width')
  pad = moveNameCursor(moveNameCursor(pad, 1, 0), 1, 0)
  assert.equal(nameEntryCell(pad), 'A', 'right wraps inside a row')
  const typed = activateNameCell(pad)
  assert.equal(typed.kind === 'edit' ? typed.state.name : null, 'A')
  const spaced = nameEntryKey({ ...start, name: '', pristine: false }, ' ')
  assert.equal(spaced?.kind === 'edit' ? spaced.state.name : null, '', 'no leading space')
})

test('profiles: exports carry difficulty; Stage Select formats a best time', async () => {
  const { formatBestTime } = await import('../src/progression/profiles.ts')
  const meta = newProfileMeta(1, 'WREN', NOW)
  const back = parseProfileExport(JSON.stringify(buildProfileExport(meta, { version: 1 }, 'veteran')), 1, NOW)
  assert.equal(back.ok && back.difficulty, 'veteran')
  assert.equal(formatBestTime({ bestTimeMs: 200_500, fewestDeaths: 0, secretsFound: 0, rank: 'A' }), 'BEST 3:20')
  assert.equal(formatBestTime(undefined), null)
})

test('profiles: storage adapter keeps legacy save.v1 as slot 1, isolates slots and round-trips export and import', async () => {
  const store = new Map<string, string>()
  const localStorage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, String(v)), removeItem: (k: string) => void store.delete(k), clear: () => store.clear(), key: () => null, length: 0 }
  ;(globalThis as any).window = { localStorage, location: { search: '' } }
  store.set('save.v1', JSON.stringify({ weaponsUnlocked: ['FlameSerpent'], clearedBosses: ['pyro_maw'], tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } }))
  const { Save, Profiles } = await import('../src/systems/Save.ts')
  const { IDENTITY } = await import('../src/content/identity.ts')
  assert.equal(Profiles.active()?.pilotName, 'WREN', 'the legacy save is slot 1, WREN')
  assert.equal(Profiles.active()?.campaignStarted, true)
  assert.equal(IDENTITY.HERO_CALLSIGN, 'WREN')
  assert.equal(Save.load().tutorialCleared, true)
  Profiles.beginNew(2, 'AVA')
  Profiles.cancelPending()
  assert.equal(Profiles.activeSlot(), 1, 'a cancelled new game changes nothing')
  Profiles.beginNew(2, 'AVA')
  Profiles.commitNewCampaign()
  Save.startNewCampaign({ difficulty: 'assist' })
  assert.equal(Profiles.activeSlot(), 2)
  assert.equal(IDENTITY.HERO_CALLSIGN, 'AVA', 'the identity adapter follows the active pilot')
  assert.ok(store.has('save.v1.slot2'))
  assert.equal(JSON.parse(store.get('save.v1') ?? '{}').tutorialCleared, true, 'slot 1 is untouched')
  assert.equal(Save.load().tutorialCleared, false)
  assert.deepEqual(Profiles.cards().map((card) => card.pilotName), ['WREN', 'AVA', 'EMPTY'])
  assert.equal(Profiles.cards()[0]?.wardensCleared, 1)
  assert.equal(JSON.parse(store.get('profiles.v1') ?? '{}').activeSlot, 2, 'profiles.v1 is persisted')
  const file = Profiles.exportSlot(2)
  assert.equal(file?.fileName, 'omega-relay-ava.json')
  Save.deleteAll()
  assert.equal(Profiles.cards()[1]?.empty, true, 'deleting empties the active slot only')
  assert.equal(store.has('save.v1.slot2'), false)
  assert.deepEqual(Profiles.importSlot(2, file!.text), { ok: true, pilotName: 'AVA' })
  assert.equal(Profiles.cards()[1]?.pilotName, 'AVA')
  assert.equal(Save.load().difficulty, 'assist', 'difficulty rides in the envelope')
  assert.equal(Profiles.importSlot(3, '{"kind":"other"}').ok, false)
  assert.deepEqual(Profiles.debugSetProfile({ slot: 3, pilotName: 'kit' }), { ok: true })
  assert.equal(IDENTITY.HERO_CALLSIGN, 'KIT')
  assert.equal(Profiles.debugSetProfile({ slot: 4 }).ok, false)
  Profiles.select(1)
  assert.equal(Save.load().tutorialCleared, true, 'selecting slot 1 reads the legacy save again')
  delete (globalThis as any).window
})
