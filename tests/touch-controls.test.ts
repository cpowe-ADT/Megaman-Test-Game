import test from 'node:test'
import assert from 'node:assert/strict'
import { SettingsStore, validateSettings } from '../src/systems/Settings'
import { touchControlsVisible } from '../src/input/touch/touchButtonSets'
import { cycleTouchControls, touchOptionsRow, withTouchRow } from '../src/ui/menu/touchOptions'
import { menuRowAt, menuTapIntent } from '../src/ui/menu/menuTap'

test('12i touch setting migration: a pre-12i settings.v1 reads AUTO, a bad value falls back, a choice survives a reload', () => {
  const old = { musicVolume: 3, sfxVolume: 7, screenShake: false, pixelScaling: 'integer', futureKey: 'kept' }
  const migrated = validateSettings(JSON.parse(JSON.stringify(old)))
  assert.equal(migrated.touchControls, 'auto')
  assert.equal(migrated.musicVolume, 3)
  assert.equal(migrated.pixelScaling, 'integer')
  assert.equal(migrated.futureKey, 'kept', 'unknown keys survive')
  assert.equal(validateSettings({ touchControls: 'sometimes' }).touchControls, 'auto')
  assert.equal(validateSettings({ touchControls: 1 }).touchControls, 'auto')
  let raw: string | null = JSON.stringify(old)
  const storage = { getItem: () => raw, setItem: (_key: string, value: string) => { raw = value } }
  new SettingsStore(storage).update({ touchControls: 'off' })
  assert.equal(JSON.parse(raw!).touchControls, 'off')
  assert.equal(new SettingsStore(storage).get().touchControls, 'off', 'a new store (a reload) reads OFF back')
  assert.equal(JSON.parse(raw!).futureKey, 'kept')
})

test('12i touch visibility: OFF hides, ON shows, AUTO follows the device or the automation flag', () => {
  const cases: Array<[Parameters<typeof touchControlsVisible>[0], boolean]> = [
    [{ mode: 'auto', touchScreen: false, forced: false }, false],
    [{ mode: 'auto', touchScreen: true, forced: false }, true],
    [{ mode: 'auto', touchScreen: false, forced: true }, true],
    [{ mode: 'on', touchScreen: false, forced: false }, true],
    [{ mode: 'off', touchScreen: true, forced: true }, false]
  ]
  cases.forEach(([input, expected]) => assert.equal(touchControlsVisible(input), expected, JSON.stringify(input)))
})

test('12i Options row: TOUCH CONTROLS cycles AUTO, ON, OFF both ways and sits just before Controls', () => {
  assert.deepEqual(touchOptionsRow('auto'), { id: 'touchControls', label: 'Touch Controls', value: 'AUTO', kind: 'cycle' })
  assert.equal(cycleTouchControls('auto', 1), 'on')
  assert.equal(cycleTouchControls('on', 1), 'off')
  assert.equal(cycleTouchControls('off', 1), 'auto')
  assert.equal(cycleTouchControls('auto', -1), 'off')
  const rows = withTouchRow([{ id: 'difficulty' }, { id: 'reducedFlashing' }, { id: 'controls' }, { id: 'delete' }, { id: 'back' }], touchOptionsRow('on'))
  assert.deepEqual(rows.map((row) => row.id), ['difficulty', 'reducedFlashing', 'touchControls', 'controls', 'delete', 'back'])
})

test('12i menu taps: the plate is the target; cycle rows step with their outer thirds', () => {
  const plates = [{ x: 64, y: 40, width: 320, height: 16 }, { x: 64, y: 59, width: 320, height: 16 }]
  assert.equal(menuRowAt(plates, 70, 48), 0)
  assert.equal(menuRowAt(plates, 380, 66), 1)
  assert.equal(menuRowAt(plates, 30, 48), -1)
  assert.equal(menuTapIntent(10, 320, 'cycle'), 'previous')
  assert.equal(menuTapIntent(160, 320, 'cycle'), 'activate')
  assert.equal(menuTapIntent(300, 320, 'cycle'), 'next')
  assert.equal(menuTapIntent(10, 320, 'action'), 'activate')
})
