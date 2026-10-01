import test from 'node:test'
import assert from 'node:assert/strict'
import { DEFAULT_BINDINGS } from '../src/input/ActionState'
import { keyEventInitFor, keyInfoForCode, primaryCodeForAction } from '../src/input/touch/touchKeyMap'
import { cssBoxForSpec, touchButtonsFor, touchSetForScene, type TouchButtonSpec } from '../src/input/touch/touchButtonSets'
import { getHudLayout } from '../src/ui/hudLayout'
import { GAME_HEIGHT, GAME_WIDTH, resolveGameZoom } from '../src/config/renderPolicy'

/** The three phone landscape viewports Craig's v2 note names; the smallest canvas (667x375, nearly
 * the game's own 448x252 aspect) is the tightest fit and the one the spacing rules must clear. */
const REFERENCE_VIEWPORTS: Array<{ w: number; h: number }> = [
  { w: 844, h: 390 },
  { w: 932, h: 430 },
  { w: 667, h: 375 }
]
const MIN_CSS_PX = 48
const MIN_GAP_CSS_PX = 8

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

/** AABB separation with a margin: true when the two rects' closest approach is at least `gap` on the
 * axis that separates them (round buttons are tested as their bounding square, a safe approximation
 * since every round spec here is sized well clear of its neighbours). */
function separated(a: TouchButtonSpec, b: TouchButtonSpec, gap: number): boolean {
  const gapX = Math.abs(a.x - b.x) - (a.width + b.width) / 2
  const gapY = Math.abs(a.y - b.y) - (a.height + b.height) / 2
  return gapX >= gap || gapY >= gap
}

test('touch button sets v2: the play set is the cross plus the face diamond, shoulders and SELECT/START; the menu set is the cross plus A/B and SELECT/START', () => {
  const play = touchButtonsFor('play')
  const menu = touchButtonsFor('menu')
  assert.equal(new Set(play.map((b) => b.id)).size, play.length, 'every play id is unique')
  assert.equal(new Set(menu.map((b) => b.id)).size, menu.length, 'every menu id is unique')
  assert.deepEqual(new Set(play.map((b) => b.action)), new Set(['aimUp', 'aimDown', 'moveLeft', 'moveRight', 'jump', 'shoot', 'dash', 'saber', 'weaponPrev', 'weaponNext', 'cancel', 'pause']))
  assert.deepEqual(new Set(menu.map((b) => b.action)), new Set(['aimUp', 'aimDown', 'moveLeft', 'moveRight', 'confirm', 'cancel']))
  // The cross uses arrow glyphs, not letters (Craig's v2 note).
  const glyphs = play.filter((b) => ['aimUp', 'aimDown', 'moveLeft', 'moveRight'].includes(b.action)).map((b) => b.label)
  glyphs.forEach((label) => assert.ok(['▲', '▼', '◀', '▶'].includes(label), `${label} is an arrow glyph`))
  // JUMP (play) and OK (menu) share the diamond's bottom slot and are the largest face button.
  const jump = play.find((b) => b.id === 'faceBottom')!
  const ok = menu.find((b) => b.id === 'faceBottom')!
  assert.equal(jump.action, 'jump')
  assert.equal(ok.action, 'confirm')
  ;[...play, ...menu].filter((b) => b.round).forEach((b) => assert.ok(b.width <= jump.width, `${b.id} is no bigger than the largest (bottom) slot`))

  for (const layout of [play, menu]) {
    layout.forEach((spec) => {
      assert.ok(spec.x - spec.width / 2 >= 0 && spec.x + spec.width / 2 <= GAME_WIDTH, `${spec.id} inside the frame horizontally`)
      assert.ok(spec.y - spec.height / 2 >= 0 && spec.y + spec.height / 2 <= GAME_HEIGHT, `${spec.id} inside the frame vertically`)
    })
    layout.forEach((a, i) => layout.slice(i + 1).forEach((b) => assert.ok(separated(a, b, 0), `${a.id} overlaps ${b.id}`)))
  }
  const hudBottom = getHudLayout(GAME_WIDTH).height
  play.filter((spec) => spec.id === 'shoulderL' || spec.id === 'shoulderR')
    .forEach((spec) => assert.ok(spec.y - spec.height / 2 > hudBottom, `${spec.id} clears the HUD band`))
})

test('touch button sets v2: no overlaps and at least 48 CSS px / 8 CSS px gaps at 844x390, 932x430 and 667x375', () => {
  for (const { w, h } of REFERENCE_VIEWPORTS) {
    const scale = resolveGameZoom(w, h, 'smooth')
    for (const set of ['play', 'menu'] as const) {
      const layout = touchButtonsFor(set)
      layout.forEach((spec) => {
        assert.ok(Math.min(spec.width, spec.height) * scale >= MIN_CSS_PX, `${set}/${spec.id} at ${w}x${h}: ${Math.min(spec.width, spec.height) * scale}px >= ${MIN_CSS_PX}`)
      })
      layout.forEach((a, i) => layout.slice(i + 1).forEach((b) => {
        const gapGame = MIN_GAP_CSS_PX / scale
        assert.ok(separated(a, b, gapGame), `${set}/${a.id} vs ${b.id} at ${w}x${h}: closer than ${MIN_GAP_CSS_PX}px`)
      }))
    }
  }
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
  const spec: TouchButtonSpec = { id: 'faceBottom', action: 'jump', label: 'JUMP', x: 100, y: 50, width: 20, height: 10, round: true, alpha: 0.2, fontScale: 2 }
  assert.deepEqual(cssBoxForSpec(spec, 2), { left: 180, top: 90, width: 40, height: 20 })
})
