import test from 'node:test'
import assert from 'node:assert/strict'
import { ActionState, DEFAULT_BINDINGS, resolveKeyboardActions } from '../src/input/ActionState'
import { SettingsStore } from '../src/systems/Settings'

test('actions derive press/held/release once from the union of all sources', () => {
  const state = new ActionState()
  assert.deepEqual(state.sample(1, [{ shoot: true }, {}]).shoot, { held: true, pressed: true, released: false })
  assert.equal(state.sample(2, [{ shoot: true }, { shoot: true }]).shoot.pressed, false)
  assert.deepEqual(state.sample(3, [{}, { shoot: true }]).shoot, { held: true, pressed: false, released: false })
  assert.deepEqual(state.sample(4, [{}, {}]).shoot, { held: false, pressed: false, released: true })
  assert.equal(state.sample(5, [{}]).shoot.released, false)
})

test('all consumers receive the same immutable frame even when sources change mid-frame', () => {
  const state = new ActionState()
  const frame = state.sample(10, [{ jump: true }])
  assert.equal(state.sample(10, [{}]), frame)
  assert.equal(Object.isFrozen(frame), true)
  assert.equal(Object.isFrozen(frame.jump), true)
})

test('inactive surfaces cannot receive edges and reactivation does not replay held presses', () => {
  const state = new ActionState()
  state.sample(1, [{}])
  assert.equal(state.sample(2, [{ shoot: true }], false).shoot.held, false)
  assert.deepEqual(state.sample(3, [{ shoot: true }], true).shoot, { held: true, pressed: false, released: false })
  state.sample(4, [{}])
  assert.equal(state.sample(5, [{ shoot: true }]).shoot.pressed, true)
})

test('reset preserves held-key arming and requires a real release before another press', () => {
  const state = new ActionState()
  state.reset({ confirm: true })
  assert.equal(state.sample(1, [{ confirm: true }]).confirm.pressed, false)
  assert.equal(state.sample(2, [{}]).confirm.released, true)
  assert.equal(state.sample(3, [{ confirm: true }]).confirm.pressed, true)
})

test('keyboard aliases merge Numpad Enter and Space confirm, and D/E weapon cycling', () => {
  const keys = resolveKeyboardActions(new Set(['NumpadEnter', 'KeyD', 'KeyE']), DEFAULT_BINDINGS)
  assert.equal(keys.confirm, true)
  assert.equal(keys.weaponNext, true)
  const state = new ActionState()
  state.sample(1, [keys])
  assert.equal(state.sample(2, [resolveKeyboardActions(new Set(['KeyE']), DEFAULT_BINDINGS)]).weaponNext.released, false)
  assert.equal(resolveKeyboardActions(new Set(['Space']), DEFAULT_BINDINGS).jump, true)
})

test('validated bindings persist across store recreation without losing future settings', () => {
  let saved = JSON.stringify({ futureSetting: 0.4 })
  const storage = { getItem: () => saved, setItem: (_key: string, value: string) => { saved = value } }
  new SettingsStore(storage).update({ bindings: { jump: ['KeyJ'] } })
  const settings = new SettingsStore(storage).get()
  assert.equal(settings.futureSetting, 0.4)
  assert.deepEqual(settings.bindings.jump, ['KeyJ'])
  assert.equal(resolveKeyboardActions(new Set(['KeyJ']), settings.bindings).jump, true)
  assert.equal(resolveKeyboardActions(new Set(['Space']), settings.bindings).jump, false)
  assert.deepEqual(settings.bindings.confirm, DEFAULT_BINDINGS.confirm)
})

test('malformed storage and invalid rebinds fall back without breaking controls', () => {
  const broken = new SettingsStore({ getItem: () => '{broken', setItem: () => {} })
  assert.deepEqual(broken.get().bindings, DEFAULT_BINDINGS)
  const store = new SettingsStore()
  const settings = store.update({ bindings: { jump: [], shoot: ['NotARealKey'], unknown: ['KeyK'] } })
  assert.deepEqual(settings.bindings.jump, DEFAULT_BINDINGS.jump)
  assert.deepEqual(settings.bindings.shoot, DEFAULT_BINDINGS.shoot)
  assert.equal('unknown' in settings.bindings, false)
})

test('a complete fast tap between frames retains one press and release', () => {
  const state = new ActionState()
  state.sample(1, [{}])
  state.latch({}, { confirm: true })
  state.latch({ confirm: true }, {})
  assert.deepEqual(state.sample(2, [{}]).confirm, { held: false, pressed: true, released: true })
  assert.equal(state.sample(3, [{}]).confirm.pressed, false)
})

test('sequential partial rebind updates preserve earlier custom bindings', () => {
  const store = new SettingsStore()
  store.update({ bindings: { jump: ['KeyJ'] } })
  const settings = store.update({ bindings: { shoot: ['KeyK'] } })
  assert.deepEqual(settings.bindings.jump, ['KeyJ'])
  assert.deepEqual(settings.bindings.shoot, ['KeyK'])
})

test('hitstop defers gameplay edges until the next simulation update while pause remains live', () => {
  const state = new ActionState()
  state.sample(1, [{}])
  state.latch({}, { dash: true, pause: true })
  const frozen = state.sample(2, [{ dash: true, pause: true }], true, ['dash'])
  assert.equal(frozen.dash.pressed, false)
  assert.equal(frozen.pause.pressed, true)
  assert.equal(state.sample(3, [{ dash: true }], true, ['dash']).dash.pressed, false)
  assert.equal(state.sample(4, [{ dash: true }]).dash.pressed, true)
  assert.equal(state.sample(5, [{ dash: true }]).dash.pressed, false)
})

test('changing input ownership discards gameplay edges queued during hitstop', () => {
  const state = new ActionState()
  state.sample(1, [{}])
  state.latch({}, { shoot: true })
  state.sample(2, [{ shoot: true }], true, ['shoot'])
  state.sample(3, [{ shoot: true }], false, ['shoot'])
  assert.equal(state.sample(4, [{ shoot: true }]).shoot.pressed, false)
})

test('latched keyboard and touch changes use the union before deriving transitions', () => {
  const state = new ActionState()
  state.sample(1, [{ shoot: true }])
  // Touch joins keyboard, then keyboard releases while touch remains held.
  state.latch({ shoot: true }, { shoot: true })
  state.latch({ shoot: true }, { shoot: true })
  assert.deepEqual(state.sample(2, [{}, { shoot: true }]).shoot, { held: true, pressed: false, released: false })
})
