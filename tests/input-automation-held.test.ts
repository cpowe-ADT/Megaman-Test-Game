import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import { EventEmitter } from 'node:events'
import ts from 'typescript'

/**
 * Loads `src/input/InputActions.ts` through `vm` (as `tests/input-blur.test.ts` does) so
 * `SceneInputActions.setAutomationHeld`/`cancelPendingInput` run against the real `ActionState`
 * latching logic without a Phaser scene (prompt 05a, 5.1c: MERGED.md 2026-09-23-5.1b-replay,
 * "no unit test for setAutomationHeld latching").
 */
function fixture() {
  const load = (file: string, dependencies: Record<string, unknown> = {}) => {
    const exports: Record<string, any> = {}
    const code = ts.transpileModule(fs.readFileSync(file, 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 }
    }).outputText
    vm.runInNewContext(code, {
      exports,
      window: { addEventListener: () => {}, removeEventListener: () => {} },
      require: (id: string) => {
        if (!(id in dependencies)) throw new Error(`Unexpected import: ${id}`)
        return dependencies[id]
      }
    })
    return exports
  }
  const action = load('src/input/ActionState.ts')
  const settings = load('src/systems/Settings.ts', { '../input/ActionState': action, '../config/renderPolicy': load('src/config/renderPolicy.ts') })
  const input = load('src/input/InputActions.ts', {
    '../audio': { default: { unlock: () => {} } },
    '../systems/Settings': settings,
    './ActionState': action,
    './visibilityPause': load('src/input/visibilityPause.ts')
  })
  const scene: any = { events: new EventEmitter() }
  const game = { events: new EventEmitter(), loop: { frame: 0 }, scene: { getScenes: () => [scene] } }
  scene.game = game
  const actions = input.InputActions.forScene(scene)
  return { actions, game }
}

// `assert.deepEqual` on a whole snapshot object would fail spuriously: the module runs in a
// separate `vm` realm, so its frozen `ActionButton` objects have a different `Object.prototype`
// than plain object literals here. Compare the primitive fields instead, as `input-blur.test.ts` does.
function dashButton(actions: any) {
  const dash = actions.snapshot().dash
  return { held: dash.held, pressed: dash.pressed, released: dash.released }
}

test('setAutomationHeld latches a press then a release through captureSourceChange exactly once each', () => {
  const { actions, game } = fixture()

  actions.setAutomationHeld({ dash: true })
  assert.deepEqual(dashButton(actions), { held: true, pressed: true, released: false })

  game.loop.frame += 1
  assert.deepEqual(dashButton(actions), { held: true, pressed: false, released: false })

  actions.setAutomationHeld({})
  game.loop.frame += 1
  assert.deepEqual(dashButton(actions), { held: false, pressed: false, released: true })

  game.loop.frame += 1
  assert.deepEqual(dashButton(actions), { held: false, pressed: false, released: false })
})

test('cancelPendingInput clears a latched automation-held action', () => {
  const { actions, game } = fixture()
  actions.setAutomationHeld({ moveRight: true, dash: true })
  actions.snapshot()
  game.loop.frame += 1
  actions.cancelPendingInput()
  const after = actions.snapshot()
  assert.equal(after.dash.held, false)
  assert.equal(after.moveRight.held, false)
})
