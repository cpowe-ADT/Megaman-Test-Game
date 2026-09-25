// Part 12i (prompt 08 §8.4 = prompt 04 §4.3, EVAL-P8-005): pad map, remap rules, settings migration,
// pixel scaling, display options, the hidden-tab pause and the hazard strip pattern.
import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BINDINGS, DEFAULT_PAD_BINDINGS, padSampleFromNames, readPadInputs, resolvePadActions, type PadInput } from '../src/input/ActionState'
import { explosionFlashStyle, SettingsStore, validateSettings } from '../src/systems/Settings'
import { resolveGameZoom, setPixelScalingSource, currentPixelScaling } from '../src/config/renderPolicy'
import { bindingText, conflictsFor, keyLabel, listConflicts, padLabel, rebind, rebindMessage } from '../src/ui/menu/remapModel'
import { applyDisplayOptionChange, displayOptionsRows, withDisplayRows } from '../src/ui/menu/displayOptions'
import { bindVisibilityPause, shouldPauseOnHidden } from '../src/input/visibilityPause'
import { hazardStripPattern, HAZARD_TOOTH_PERIOD_PX } from '../src/mechanics/mechanicsVisuals'

const held = (sample: Parameters<typeof readPadInputs>[0]) => [...readPadInputs(sample)].sort()

test('12i pad: standard-mapped buttons, analogue triggers past half travel, left stick past the 0.25 deadzone', () => {
  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, value: 0 }))
  buttons[0] = { pressed: true, value: 1 }
  buttons[7] = { pressed: false, value: 0.8 }
  buttons[14] = { pressed: true, value: 1 }
  assert.deepEqual(held({ buttons, axes: [0, 0] }), ['A', 'DpadLeft', 'RT'])
  assert.deepEqual(held({ axes: [0.2, 0.1] }), [], 'inside the deadzone holds nothing')
  assert.deepEqual(held({ axes: [0.3, 0] }), ['LStickRight'])
  assert.deepEqual(held({ axes: [0.9, -0.3] }), ['LStickRight'], 'a slight upward tilt while running does not aim up')
  assert.deepEqual(held({ axes: [0.7, -0.7] }), ['LStickRight', 'LStickUp'], 'a diagonal holds both directions')
  assert.deepEqual(held({ axes: [0, 1] }), ['LStickDown'])
  assert.deepEqual(held({ axes: [-1, 0] }), ['LStickLeft'])
})

test('12i pad: the default map is A jump, X shoot, Y saber, B dash, LB/RB weapons, Start pause, Select options', () => {
  const resolve = (...inputs: PadInput[]) => resolvePadActions(new Set(inputs), DEFAULT_PAD_BINDINGS)
  assert.equal(resolve('A').jump, true)
  assert.equal(resolve('A').confirm, true, 'menus accept A as confirm')
  assert.equal(resolve('B').dash, true)
  assert.equal(resolve('B').cancel, true, 'menus accept B as back')
  assert.equal(resolve('X').shoot, true)
  assert.equal(resolve('Y').saber, true)
  assert.equal(resolve('LB').weaponPrev, true)
  assert.equal(resolve('RB').weaponNext, true)
  assert.equal(resolve('Start').pause, true)
  assert.equal(resolve('Select').options, true)
  assert.equal(resolve('DpadLeft').moveLeft, true)
  assert.equal(resolve('LStickUp').aimUp, true)
  assert.deepEqual(resolvePadActions(new Set(), DEFAULT_PAD_BINDINGS), {})
})

test('12i pad: injected names become a standard sample; an unknown name throws', () => {
  assert.deepEqual(held(padSampleFromNames({ buttons: ['X', 'LStickLeft'] })), ['LStickLeft', 'X'])
  assert.deepEqual(held(padSampleFromNames({ axes: [0.2, 0] })), [])
  assert.throws(() => padSampleFromNames({ buttons: ['Triangle'] }), /unknown pad input "Triangle"/)
})

test('12i settings migration: a pre-12i settings.v1 gains pad bindings and pixel scaling, keeping everything else', () => {
  const old = { bindings: { ...DEFAULT_BINDINGS, jump: ['KeyK'] }, musicVolume: 3, sfxVolume: 8, screenShake: false, storyReplay: false, reducedFlashing: true, later: 'kept' }
  const migrated = validateSettings(JSON.parse(JSON.stringify(old)))
  assert.deepEqual(migrated.padBindings, DEFAULT_PAD_BINDINGS)
  assert.equal(migrated.pixelScaling, 'smooth')
  assert.deepEqual(migrated.bindings.jump, ['KeyK'])
  assert.equal(migrated.musicVolume, 3)
  assert.equal(migrated.reducedFlashing, true)
  assert.equal(migrated.later, 'kept')
  const invalid = validateSettings({ padBindings: { jump: ['Triangle'], shoot: ['RB'] }, pixelScaling: 'blurry' })
  assert.deepEqual(invalid.padBindings.jump, ['A'], 'an unknown pad input falls back to that action default')
  assert.deepEqual(invalid.padBindings.shoot, ['RB'])
  assert.equal(invalid.pixelScaling, 'smooth')
  let saved = ''
  const store = new SettingsStore({ getItem: () => saved || null, setItem: (_key, value) => { saved = value } })
  store.update({ padBindings: { shoot: ['RB'] } })
  store.update({ pixelScaling: 'integer' })
  const reloaded = validateSettings(JSON.parse(saved))
  assert.deepEqual(reloaded.padBindings.shoot, ['RB'], 'a pad patch persists')
  assert.deepEqual(reloaded.padBindings.jump, ['A'], 'and merges per action')
  assert.equal(reloaded.pixelScaling, 'integer')
})

test('12i pixel scaling: integer floors and letterboxes at every size; smooth keeps the under-2x fallback', () => {
  assert.equal(resolveGameZoom(700, 400, 'integer'), 1)
  assert.equal(resolveGameZoom(700, 400, 'smooth'), 700 / 448)
  assert.equal(resolveGameZoom(1920, 1080, 'integer'), 4)
  assert.equal(resolveGameZoom(1920, 1080, 'smooth'), 4)
  assert.equal(resolveGameZoom(300, 200, 'integer'), 1, 'never below 1x')
  const restore = currentPixelScaling()
  setPixelScalingSource(() => 'integer')
  assert.equal(resolveGameZoom(700, 400), 1, 'the default argument reads the registered setting')
  setPixelScalingSource(() => { throw new Error('storage gone') })
  assert.equal(currentPixelScaling(), 'smooth')
  setPixelScalingSource(() => restore)
})

test('12i remap: press-to-bind swaps a live conflict, allows cross-context sharing and reports the rest', () => {
  assert.deepEqual(conflictsFor(DEFAULT_BINDINGS, 'jump', 'Enter'), [], 'jump and confirm are never live together')
  assert.deepEqual(listConflicts(DEFAULT_BINDINGS), [], 'the defaults have no conflict')
  assert.deepEqual(listConflicts(DEFAULT_PAD_BINDINGS), [])
  const swap = rebind(DEFAULT_BINDINGS, 'jump', 'KeyZ')
  assert.deepEqual(swap.bindings.jump, ['KeyZ'])
  assert.deepEqual(swap.bindings.dash, ['Space'], 'dash lost Z and took jump old key')
  assert.equal(rebindMessage('keyboard', 'jump', 'KeyZ', swap), 'JUMP: Z   DASH TAKES SPACE')
  const keep = rebind(DEFAULT_BINDINGS, 'shoot', 'KeyE')
  assert.deepEqual(keep.bindings.weaponNext, ['KeyD'], 'an action with another key just loses the pressed one')
  const leftover = rebind(DEFAULT_BINDINGS, 'jump', 'ArrowLeft')
  assert.deepEqual(leftover.bindings.moveLeft, ['Space'])
  assert.deepEqual(listConflicts(leftover.bindings), [{ input: 'Space', actions: ['moveLeft', 'confirm'] }], 'a swap that collides in menus is reported')
  const pad = rebind(DEFAULT_PAD_BINDINGS, 'shoot', 'RB' as PadInput)
  assert.deepEqual(pad.bindings.weaponNext, ['X'])
  assert.equal(keyLabel('Space'), 'SPACE')
  assert.equal(keyLabel('KeyQ'), 'Q')
  assert.equal(keyLabel('Digit4'), '4')
  assert.equal(padLabel('LStickLeft'), 'LS LEFT')
  assert.equal(bindingText('pad', DEFAULT_PAD_BINDINGS.moveLeft), 'D-LEFT / LS LEFT')
})

test('12i options: Fullscreen, Pixel scaling and Reduced flashing sit before Controls and toggle', () => {
  const state = { fullscreen: 'off' as const, pixelScaling: 'smooth' as const, reducedFlashing: false }
  const rows = displayOptionsRows(state)
  assert.deepEqual(rows.map((row) => `${row.id}=${row.value}`), ['fullscreen=OFF', 'pixelScaling=SMOOTH', 'reducedFlashing=OFF'])
  assert.deepEqual(applyDisplayOptionChange(state, 'fullscreen'), { fullscreen: true })
  assert.deepEqual(applyDisplayOptionChange({ ...state, fullscreen: 'unavailable' }, 'fullscreen'), {})
  assert.deepEqual(applyDisplayOptionChange(state, 'pixelScaling'), { settings: { pixelScaling: 'integer' } })
  assert.deepEqual(applyDisplayOptionChange(state, 'reducedFlashing'), { settings: { reducedFlashing: true } })
  const merged = withDisplayRows([{ id: 'musicVolume' }, { id: 'difficulty' }, { id: 'controls' }, { id: 'back' }], rows)
  assert.deepEqual(merged.map((row) => row.id), ['musicVolume', 'difficulty', 'fullscreen', 'pixelScaling', 'reducedFlashing', 'controls', 'back'])
  assert.deepEqual(explosionFlashStyle(true), { additive: false, alphaScale: 0.55 })
  assert.deepEqual(explosionFlashStyle(false), { additive: true, alphaScale: 1 })
})

test('12i hidden tab: pauses a running Game once, never over an open menu, dialogue or modal', () => {
  const base = { hidden: true, sceneRunning: true, menuOpen: false, blocked: false }
  assert.equal(shouldPauseOnHidden(base), true)
  assert.equal(shouldPauseOnHidden({ ...base, hidden: false }), false)
  assert.equal(shouldPauseOnHidden({ ...base, menuOpen: true }), false)
  assert.equal(shouldPauseOnHidden({ ...base, blocked: true }), false)
  assert.equal(shouldPauseOnHidden({ ...base, sceneRunning: false }), false)
  const listeners = new Map<string, () => void>()
  const doc = { visibilityState: 'visible' as DocumentVisibilityState,
    addEventListener: (name: string, fn: () => void) => listeners.set(name, fn), removeEventListener: (name: string) => listeners.delete(name) }
  let menuOpen = false
  const shutdown: Array<() => void> = []
  const scene = { sys: { isActive: () => true }, scene: { isActive: () => menuOpen }, events: { once: (_name: string, fn: () => void) => shutdown.push(fn) } }
  let pauses = 0
  let cancels = 0
  bindVisibilityPause(scene as never, { pause: () => { pauses += 1; menuOpen = true } }, () => { cancels += 1 }, doc as never)
  listeners.get('visibilitychange')!()
  assert.equal(pauses, 0, 'becoming visible does nothing')
  doc.visibilityState = 'hidden'
  listeners.get('visibilitychange')!()
  listeners.get('visibilitychange')!()
  assert.equal(pauses, 1, 'the second hide finds the menu open')
  assert.equal(cancels, 2, 'every hide drops held input and the pending charge')
  shutdown.forEach((fn) => fn())
  assert.equal(listeners.has('visibilitychange'), false, 'the listener goes at shutdown')
})

test('12i colour-blind: the pit slag strip carries teeth and a dotted crust inside its box', () => {
  const pattern = hazardStripPattern(100, 64, 242, 10)
  assert.equal(pattern.teeth.length, Math.floor(64 / HAZARD_TOOTH_PERIOD_PX))
  assert.equal(pattern.dots.length, Math.ceil(pattern.teeth.length / 2))
  for (const [x1, y1, x2, , , y3] of pattern.teeth) {
    assert.ok(x1 >= 100 && x2 <= 164, 'teeth stay inside the gap')
    assert.ok(y1 === 244 && y3 > y1 && y3 < 252, 'teeth hang under the 2px surface line')
  }
  for (const dot of pattern.dots) assert.ok(dot.y + dot.height <= 252, 'dots stay inside the strip')
  assert.deepEqual(hazardStripPattern(0, 4, 0, 10).teeth, [], 'a sliver narrower than a tooth stays plain')
})
