import test from 'node:test'
import assert from 'node:assert/strict'
import { dialoguePanelLayout, OVERLAY_TOP, PLAY_OVERLAY_MAX_BOTTOM, toastLaneTop } from '../src/ui/overlayLayout.ts'
import { GAMEPLAY_VIEWPORT_TOP } from '../src/config/gameplayLayout.ts'
import { GAME_HEIGHT } from '../src/config/renderPolicy.ts'

// 05c playtest: the tutorial briefing hid the hero standing on the floor, and the lane covered the floor row.
// The hero stands with its feet on about y 230 and is drawn from about y 190 (probe tutorial-start/t04.png).
const HERO_ON_FLOOR = { top: 190, bottom: 230 }

test('the play dialogue panel sits under the HUD band and clears a hero standing on the floor', () => {
  const panel = dialoguePanelLayout('top')
  assert.ok(panel.top >= GAMEPLAY_VIEWPORT_TOP, `panel top ${panel.top} is inside the HUD band`)
  assert.ok(panel.bottom <= PLAY_OVERLAY_MAX_BOTTOM, `panel bottom ${panel.bottom} reaches the floor row`)
  assert.ok(panel.bottom < HERO_ON_FLOOR.top, 'the hero on the floor stays visible')
  assert.ok(panel.bodyY + panel.bodyHeight <= panel.bottom - 2, 'four body lines fit inside the panel')
  assert.ok(panel.bodyHeight >= 4 * 15, 'the body holds four 11px lines (the 180-character rule wraps to four at most)')
  assert.ok(panel.speakerY + 13 <= panel.bodyY, 'the speaker row does not overlap the body')
})

test('the Stage Select panel keeps its bottom layout', () => {
  const panel = dialoguePanelLayout('bottom')
  assert.equal(panel.height, 112)
  assert.equal(panel.bottom, GAME_HEIGHT - 7)
  assert.equal(panel.progressOriginY, 1)
})

test('the toast lane hangs from the HUD band', () => {
  assert.equal(toastLaneTop(), OVERLAY_TOP)
  assert.ok(toastLaneTop() >= GAMEPLAY_VIEWPORT_TOP)
  // A two-line radio item with a speaker is 4 + 10 + 2 * 10 + 4 = 38px tall.
  assert.ok(toastLaneTop() + 38 < HERO_ON_FLOOR.top, 'a radio line leaves the floor row visible')
})
