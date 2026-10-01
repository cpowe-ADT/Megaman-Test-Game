// Scenario 67-touch-mode (post-v1.0 touch mode task card). Replaces 4c-touch-controls (part 12i),
// which drove the retired Phaser-drawn `GameplayTouchControls` directly through its scene API; that
// API no longer exists, so 4c is removed from `scripts/smoke-test.mjs` rather than patched.
//
// A phone context (844x390 landscape, `hasTouch: true`) plays the whole title-to-tutorial flow with
// no keyboard: `page.touchscreen.tap` for every quick press (OK, BACK, PAUSE, jump), and a manual
// pointerdown/pointerup pair dispatched on the DOM button (Playwright's `touchscreen` has no hold
// duration) for anything held across frames (walking, charging a shot). Both reach the overlay's own
// listeners, so the game only ever sees the `KeyboardEvent`s `TouchOverlay` dispatches.
//
// The app's menu graph has no live "return to Title" action once a campaign starts (Game's and
// StageSelect's pause menus both stop at "Quit to Warden Select" / "Back"), so the "return to the
// title through the menu" beat runs first: NEW GAME's BACK returns to Title before the real run
// commits a campaign, proving Title is reachable and leavable with the menu set alone.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

function scenarioDir(outputDir, name) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function rectFor(page, action) {
  return page.evaluate((action) => {
    const el = document.querySelector(`.touch-btn[data-action="${action}"]`)
    if (!el) return null
    const r = el.getBoundingClientRect()
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
  }, action)
}

async function tap(page, action) {
  const at = await rectFor(page, action)
  if (!at) throw new Error(`No touch button for action "${action}"`)
  await page.touchscreen.tap(at.x, at.y)
}

/** Taps a game object directly, in game pixels (448x252) mapped onto the canvas's CSS rect: "tap menu
 * items directly" (v2), not just the overlay's own buttons -- e.g. Title's own PRESS START button. */
async function tapCanvas(page, gx, gy) {
  const at = await page.evaluate(
    ({ gx, gy }) => {
      const rect = window.__phaserGame.canvas.getBoundingClientRect()
      return { x: rect.left + (gx * rect.width) / 448, y: rect.top + (gy * rect.height) / 252 }
    },
    { gx, gy }
  )
  await page.touchscreen.tap(at.x, at.y)
}

/** A hold across frames: Playwright's `touchscreen.tap` has no duration, so this dispatches the same
 * pointer events the overlay's own buttons listen for, directly on the element a real finger would hit. */
async function holdSet(page, action, down) {
  await page.evaluate(
    ({ action, down }) => {
      const el = document.querySelector(`.touch-btn[data-action="${action}"]`)
      if (!el) return
      el.dispatchEvent(new PointerEvent(down ? 'pointerdown' : 'pointerup', { bubbles: true, cancelable: true, pointerId: 101, pointerType: 'touch', isPrimary: true }))
    },
    { action, down }
  )
}

export async function runTouchModeScenario(name, deps) {
  const { outputDir, host, port, readState, waitForState, advanceFrames } = deps
  const dir = scenarioDir(outputDir, name)
  const touchUrl = `http://${host}:${port}?renderer=canvas&automation=1&profiles=on&touchControls=1`
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 844, height: 390 }, hasTouch: true })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const capture = async (label) => {
    await page.screenshot({ path: path.join(dir, `shot-${label}.png`) })
    const state = await readState(page)
    fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify(state, null, 2))
    return state
  }

  try {
    await page.goto(touchUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    await waitForState(page, (state) => state.scene === 'Title', 15000)

    // v2: the first screen on a touch device shows a full-screen "TAP TO START" card; one tap sets
    // touchControls to ON, unlocks audio, and continues. It must not show again this device/mode.
    await page.waitForFunction(() => document.querySelector('.touch-start-card')?.style.display !== 'none', null, { timeout: 8000 })
    await page.touchscreen.tap(422, 195)
    await page.waitForFunction(() => document.querySelector('.touch-start-card')?.style.display === 'none', null, { timeout: 4000 })
    await advanceFrames(page, 2)
    assert.equal((await readState(page)).settings?.touchControls, 'on', 'tapping the start card sets touchControls to ON')

    // 1. Title's own menu set: the cross, A (OK) and B (BACK), SELECT and START. No keyboard anywhere below.
    const titleMenuState = await capture('0-title-menu-set')
    assert.equal(titleMenuState.touch?.set, 'menu', 'Title shows the menu set')
    assert.deepEqual([...titleMenuState.touch.buttons].sort(), ['aimDown', 'aimUp', 'cancel', 'confirm', 'moveLeft', 'moveRight'], 'the menu set is the cross plus A/B (confirm/cancel also drive SELECT/START)')

    // v2: the Title row "TOUCH CONTROLS: ON/OFF", tapped directly on the canvas (not the overlay),
    // toggles the same setting off, then back on.
    await tapCanvas(page, 319, 194)
    await waitForState(page, (state) => state.settings?.touchControls === 'off', 4000, 'tapping the Title row to turn touch controls off')
    assert.equal((await readState(page)).touch?.shown, false, 'the overlay hides once touch controls are off')
    await tapCanvas(page, 319, 194)
    await waitForState(page, (state) => state.settings?.touchControls === 'on', 4000, 'tapping the Title row again to turn touch controls back on')

    // 4. A return to the title through the menu: NEW GAME opens the slot picker; BACK returns to Title
    // before any campaign exists, proving Title is reachable and leavable with the menu set alone.
    await tap(page, 'confirm')
    await waitForState(page, (state) => state.scene === 'Profiles', 8000, 'OK on Title to open the slot picker (Craig\'s "stuck on save")')
    await tap(page, 'cancel')
    await waitForState(page, (state) => state.scene === 'Title', 8000, 'BACK on the slot picker to return to Title')

    // 1 (continued), tapping the menu item directly (Title's own PRESS START button, not the overlay):
    // NEW GAME, the save slot's default name, NEW CAMPAIGN, the first-run controls page and the
    // prologue, each closed with OK alone.
    await tapCanvas(page, 224, 151)
    await waitForState(page, (state) => state.scene === 'Profiles', 8000)
    await tap(page, 'confirm') // empty slot -> name entry
    await waitForState(page, (state) => state.profiles?.screen?.mode === 'name', 8000, 'OK on an empty slot to open name entry')
    await tap(page, 'confirm') // cursor starts on END: OK alone accepts the default pilot name
    await waitForState(page, (state) => Array.isArray(state.activeScenes) && state.activeScenes.includes('NewCampaign'), 8000, 'OK on the default name to reach NEW CAMPAIGN')
    await advanceFrames(page, 4)
    await tap(page, 'confirm') // arms confirm
    await advanceFrames(page, 4)
    await tap(page, 'confirm') // starts the campaign
    await waitForState(page, (state) => state.scene !== 'NewCampaign', 8000, 'OK twice on NEW CAMPAIGN to start it')

    // The first-run controls page (if this profile has not seen it) and the Game-scene stage card and
    // tutorial briefing dialogue all close on OK; the prologue (its own paged dialogue) skips entirely
    // on BACK (`PrologueScene`: "Enter advances, Esc skips"). Loops until the overlay reports the play
    // set, i.e. `Game.isPlayInputActive()` is true and nothing is left to close.
    let tutorialState = await readState(page)
    for (let attempt = 0; attempt < 30 && !(tutorialState.scene === 'Game' && tutorialState.touch?.set === 'play'); attempt += 1) {
      await tap(page, tutorialState.scene === 'Prologue' ? 'cancel' : 'confirm')
      await advanceFrames(page, 4)
      tutorialState = await readState(page)
    }
    assert.equal(tutorialState.scene, 'Game', 'OK (and BACK on the prologue) reached the Game tutorial')
    assert.equal(tutorialState.touch?.set, 'play', 'the stage card and tutorial briefing cleared to the play set')

    // 2. The tutorial: walk, jump, shoot, with the play set (jump/dash/shoot/saber, weapon prev/next, pause).
    const playSetState = await capture('1-game-play-set')
    assert.equal(playSetState.touch?.set, 'play', 'Game in direct control shows the play set')
    assert.ok(['jump', 'dash', 'shoot', 'saber', 'weaponPrev', 'weaponNext', 'pause'].every((action) => playSetState.touch.buttons.includes(action)), 'the play set has every gameplay button')

    const beforeWalk = await readState(page)
    await holdSet(page, 'moveRight', true)
    await advanceFrames(page, 20)
    const walkedState = await waitForState(page, (state) => Number(state.player?.vx ?? 0) >= 30, 4000, 'holding RIGHT on the overlay to walk')
    await holdSet(page, 'moveRight', false)
    await advanceFrames(page, 6)

    const groundedY = Number(walkedState.player?.y ?? 0)
    await holdSet(page, 'jump', true)
    await advanceFrames(page, 3)
    await holdSet(page, 'jump', false)
    const jumpedState = await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === false && Number(state.player?.y ?? groundedY) < groundedY, 4000, 'tapping JUMP to leave the ground')
    await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true, 6000, 'landing again before shooting')

    const beforeShot = await readState(page)
    const baselineShots = Number(beforeShot?.newPlayer?.combat?.shotsFiredTotal ?? beforeShot?.combatDebug?.player?.shotsFiredTotal ?? 0)
    await holdSet(page, 'shoot', true)
    await advanceFrames(page, 4)
    await holdSet(page, 'shoot', false)
    const shotState = await waitForState(
      page,
      (state) => Number(state.newPlayer?.combat?.shotsFiredTotal ?? state.combatDebug?.player?.shotsFiredTotal ?? 0) > baselineShots,
      4000,
      'holding then releasing SHOT on the overlay to fire'
    )

    // 3. Pause and resume: PAUSE opens the pause menu (now the menu set), BACK on it resumes at once.
    await tap(page, 'pause')
    const pausedState = await waitForState(page, (state) => Array.isArray(state.activeScenes) && state.activeScenes.includes('SystemMenu'), 4000, 'tapping PAUSE to open the pause menu')
    assert.equal(pausedState.touch?.set, 'menu', 'Game with the pause menu open shows the menu set, not the play set')
    await tap(page, 'cancel')
    const resumedState = await waitForState(page, (state) => !state.activeScenes?.includes('SystemMenu') && state.touch?.set === 'play', 4000, 'tapping BACK on the pause menu to resume at once')

    const summary = { titleMenuState, playSetState, walkedState, jumpedState, shotState, pausedState, resumedState, tutorialState }
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2))
    assert.deepEqual(errors, [], `No browser errors; saw ${JSON.stringify(errors)}`)
    return summary
  } finally {
    await page.close().catch(() => {})
    await browser.close()
  }
}
