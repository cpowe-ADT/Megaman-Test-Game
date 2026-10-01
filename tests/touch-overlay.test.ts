import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BINDINGS } from '../src/input/ActionState'
import { keyEventInitFor, keyInfoForCode, primaryCodeForAction } from '../src/input/touch/touchKeyMap'
import { cssBoxForSpec, touchButtonsFor, touchSetForScene, type TouchButtonSpec } from '../src/input/touch/touchButtonSets'
import { getHudLayout } from '../src/ui/hudLayout'
import { GAME_HEIGHT, GAME_WIDTH } from '../src/config/renderPolicy'

test('touch key map: an action dispatches its own binding, remapped or default, as a real key', () => {
  assert.equal(primaryCodeForAction('jump', DEFAULT_BINDINGS), 'Space')
  const remapped = { ...DEFAULT_BINDINGS, jump: ['KeyJ'] }
  assert.equal(primaryCodeForAction('jump', remapped), 'KeyJ')
  assert.deepEqual(keyInfoForCode('KeyJ'), { key: 'j', keyCode: 74 })
  assert.deepEqual(keyInfoForCode('Digit3'), { key: '3', keyCode: 51 })
  assert.deepEqual(keyInfoForCode('ArrowLeft'), { key: 'ArrowLeft', keyCode: 37 })
  assert.deepEqual(keyInfoForCode('Enter'), { key: 'Enter', keyCode: 13 })
  const init = keyEventInitFor('confirm', DEFAULT_BINDINGS)
  assert.equal(init.code, 'Enter')
  assert.equal(init.key, 'Enter')
  assert.equal(init.repeat, false)
})

function overlaps(a: TouchButtonSpec, b: TouchButtonSpec): boolean {
  if (a.round && b.round) return Math.hypot(a.x - b.x, a.y - b.y) < a.width / 2 + b.width / 2
  if (!a.round && !b.round) {
    return Math.abs(a.x - b.x) < (a.width + b.width) / 2 && Math.abs(a.y - b.y) < (a.height + b.height) / 2
  }
  const [circle, rect] = a.round ? [a, b] : [b, a]
  const nearestX = Math.min(Math.max(circle.x, rect.x - rect.width / 2), rect.x + rect.width / 2)
  const nearestY = Math.min(Math.max(circle.y, rect.y - rect.height / 2), rect.y + rect.height / 2)
  return Math.hypot(circle.x - nearestX, circle.y - nearestY) < circle.width / 2
}

test('touch button sets: the play set adds the face buttons and system row; the menu set is just the d-pad, OK and BACK', () => {
  const play = touchButtonsFor('play')
  const menu = touchButtonsFor('menu')
  assert.deepEqual(play.map((b) => b.action).sort(), ['aimDown', 'aimUp', 'dash', 'jump', 'moveLeft', 'moveRight', 'pause', 'saber', 'shoot', 'weaponNext', 'weaponPrev'].sort())
  assert.deepEqual(menu.map((b) => b.action).sort(), ['aimDown', 'aimUp', 'cancel', 'confirm', 'moveLeft', 'moveRight'].sort())
  for (const layout of [play, menu]) {
    layout.forEach((spec) => {
      assert.ok(spec.x - spec.width / 2 >= 0 && spec.x + spec.width / 2 <= GAME_WIDTH, `${spec.action} inside the frame horizontally`)
      assert.ok(spec.y - spec.height / 2 >= 0 && spec.y + spec.height / 2 <= GAME_HEIGHT, `${spec.action} inside the frame vertically`)
    })
    layout.forEach((a, i) => layout.slice(i + 1).forEach((b) => assert.equal(overlaps(a, b), false, `${a.action} overlaps ${b.action}`)))
  }
  const hudBottom = getHudLayout(GAME_WIDTH).height
  play.filter((spec) => spec.action === 'weaponPrev' || spec.action === 'weaponNext' || spec.action === 'pause')
    .forEach((spec) => assert.ok(spec.y - spec.height / 2 > hudBottom, `${spec.action} clears the HUD band`))
})

test('touch button sets: the d-pad in both sets presses the same move/aim actions a keyboard or a remapped scheme already reads', () => {
  const play = touchButtonsFor('play')
  const menu = touchButtonsFor('menu')
  const dpadActions = (set: TouchButtonSpec[]) => set.filter((b) => ['moveLeft', 'moveRight', 'aimUp', 'aimDown'].includes(b.action))
  assert.deepEqual(dpadActions(play), dpadActions(menu))
})

test('touch set for scene: Game in control gets the play set; a dialogue, pause, card or results (and every other scene) gets the menu set; Boot and Preload hide', () => {
  assert.equal(touchSetForScene({ sceneKey: 'Game', playInputActive: true }), 'play')
  assert.equal(touchSetForScene({ sceneKey: 'Game', playInputActive: false }), 'menu')
  assert.equal(touchSetForScene({ sceneKey: 'Title', playInputActive: true }), 'menu')
  assert.equal(touchSetForScene({ sceneKey: 'Profiles', playInputActive: true }), 'menu')
  assert.equal(touchSetForScene({ sceneKey: 'SystemMenu', playInputActive: true }), 'menu')
  assert.equal(touchSetForScene({ sceneKey: 'Boot', playInputActive: true }), null)
  assert.equal(touchSetForScene({ sceneKey: 'Preload', playInputActive: true }), null)
})

test('touch button sets: the CSS box scales a game-pixel spec to the canvas rect, centred the same way', () => {
  const spec: TouchButtonSpec = { action: 'jump', label: 'JUMP', x: 100, y: 50, width: 20, height: 10, round: true, alpha: 0.2, fontScale: 2 }
  assert.deepEqual(cssBoxForSpec(spec, 2), { left: 180, top: 90, width: 40, height: 20 })
})
