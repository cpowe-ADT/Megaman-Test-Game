// Scenario 46-gamepad-and-remap (part 12i, prompt 08 §8.4 = prompt 04 §4.3, EVAL-P8-005). Playwright cannot
// press a pad, so `stageDebug.injectPadState` feeds the hub's pad poll (the path a real pad takes): A jumps,
// X shoots, the stick deadzone holds, Start pauses and B backs out. A hidden tab opens the pause menu once.
// Then a key is remapped on the Controls screen and survives a reload, a conflict swaps, reset restores the
// defaults, and Pixel scaling INTEGER letterboxes a 700x400 window to a 448x252 canvas and persists.
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

async function openPage(browser, readState, dir, viewport) {
  const page = await browser.newPage({ viewport })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const capture = async (label, fullPage = false) => {
    await (fullPage ? page.screenshot({ path: path.join(dir, `shot-${label}.png`) }) : page.locator('canvas').screenshot({ path: path.join(dir, `shot-${label}.png`) }))
    fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify(await readState(page), null, 2))
  }
  return { page, errors, capture }
}

const setVisibility = (page, state) => page.evaluate((value) => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => value })
  document.dispatchEvent(new Event('visibilitychange'))
}, state)
const pad = (page, state) => page.evaluate((value) => window.stageDebug.injectPadState(value), state)
const controls = (page) => page.evaluate(() => window.__phaserGame.scene.getScene('Controls').getDebugState())
// The remap screen opens on BACK (row 14 of 15); Down wraps to the first action.
const REMAP_ROW_COUNT = 15
async function moveToRow(page, tapKey, target) {
  const { row } = await controls(page)
  for (let step = 0; step < (target - row + REMAP_ROW_COUNT) % REMAP_ROW_COUNT; step += 1) await tapKey(page, 'ArrowDown')
  assert.equal((await controls(page)).row, target, `the remap cursor reached row ${target}`)
}

async function padInGame(browser, { url, readState, waitForState, advanceFrames }, dir) {
  const { page, errors, capture } = await openPage(browser, readState, dir, { width: 448, height: 252 })
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(url)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'tutorial_sentinel', bossId: 'sentinel_rook', runtimeBossConfigId: 'sentinel_rook' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'tutorial_sentinel', 15000)
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const open = await page.evaluate(() => {
        const scene = window.__phaserGame.scene.getScene('Game')
        if (!scene?.dialogueOverlay?.isActive?.()) return false
        scene.dialogueOverlay.skip()
        return true
      })
      if (!open) break
      await advanceFrames(page, 2)
    }
    const grounded = await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true, 15000, 'hero grounded')

    assert.deepEqual(await pad(page, { buttons: ['A'] }), ['A'], 'the injected pad holds A')
    await advanceFrames(page, 6)
    const jumped = await readState(page)
    assert.ok(jumped.player.y < grounded.player.y - 2, `pad A jumps: y ${grounded.player.y} -> ${jumped.player.y}`)
    await pad(page, { buttons: [] })
    await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true, 15000, 'landed after the pad jump')

    const shotsBefore = (await readState(page)).combatDebug?.player?.shotsFiredTotal ?? 0
    await pad(page, { buttons: ['X'] })
    await advanceFrames(page, 4)
    await pad(page, { buttons: [] })
    const shot = await waitForState(page, (state) => (state.combatDebug?.player?.shotsFiredTotal ?? 0) > shotsBefore, 5000, 'pad X fires')
    await capture('pad-shot')

    const still = await readState(page)
    await pad(page, { axes: [0.2, 0] })
    await advanceFrames(page, 8)
    const inDeadzone = await readState(page)
    assert.ok(Math.abs(inDeadzone.player.x - still.player.x) < 1, `a 0.2 tilt is inside the 0.25 deadzone: x ${still.player.x} -> ${inDeadzone.player.x}`)
    await pad(page, { axes: [0.9, 0] })
    await advanceFrames(page, 8)
    const moved = await readState(page)
    assert.ok(moved.player.x > inDeadzone.player.x + 2, `a 0.9 tilt walks right: x ${inDeadzone.player.x} -> ${moved.player.x}`)
    await pad(page, { buttons: [] })

    await pad(page, { buttons: ['Start'] })
    await waitForState(page, (state) => state.activeScenes?.includes('SystemMenu'), 5000, 'Start opens the pause menu')
    await pad(page, { buttons: [] })
    await advanceFrames(page, 2)
    await pad(page, { buttons: ['B'] })
    await waitForState(page, (state) => !state.activeScenes?.includes('SystemMenu'), 5000, 'B backs out of the pause menu')
    await pad(page, null)
    await advanceFrames(page, 4)

    await setVisibility(page, 'hidden')
    const hidden = await waitForState(page, (state) => state.activeScenes?.includes('SystemMenu'), 5000, 'a hidden tab opens the pause menu')
    await setVisibility(page, 'visible')
    await setVisibility(page, 'hidden')
    await advanceFrames(page, 4)
    const hiddenTwice = await readState(page)
    assert.ok(hiddenTwice.activeScenes.includes('SystemMenu'), 'a second hide leaves the open pause menu open')
    await setVisibility(page, 'visible')
    await capture('hidden-tab-pause')
    assert.deepEqual(errors, [])
    return { jumpY: [grounded.player.y, jumped.player.y], shots: [shotsBefore, shot.combatDebug.player.shotsFiredTotal], deadzoneX: [still.player.x, inDeadzone.player.x, moved.player.x], hiddenTabMenu: hidden.systemMenu ?? true }
  } finally {
    await page.close()
  }
}

async function remapAndPersist(browser, { titleUrl, readState, waitForState, tapKey }, dir) {
  const { page, errors, capture } = await openPage(browser, readState, dir, { width: 896, height: 504 })
  try {
    await page.goto(titleUrl)
    await waitForState(page, (state) => state.scene === 'Title', 15000)
    await tapKey(page, 'c')
    await waitForState(page, (state) => state.activeScenes?.includes('Controls'), 5000, 'Controls opens')
    assert.equal((await controls(page)).row, 14, 'the remap screen opens on BACK')
    await moveToRow(page, tapKey, 4)
    await tapKey(page, 'Enter')
    assert.deepEqual((await controls(page)).listening, { device: 'keyboard', action: 'jump' })
    await tapKey(page, 'k')
    const bound = await waitForState(page, (state) => state.settings?.bindings?.jump?.[0] === 'KeyK', 5000, 'jump rebound to K')
    assert.deepEqual(bound.settings.bindings.jump, ['KeyK'])
    assert.equal((await controls(page)).message, 'JUMP: K')
    await tapKey(page, 'ArrowRight')
    await capture('remap-screen')

    await page.reload()
    await waitForState(page, (state) => state.scene === 'Title', 15000)
    const reloaded = await readState(page)
    assert.deepEqual(reloaded.settings.bindings.jump, ['KeyK'], 'the remap survives a reload')
    await tapKey(page, 'c')
    await waitForState(page, (state) => state.activeScenes?.includes('Controls'), 5000, 'Controls reopens')
    const shown = await controls(page)
    assert.equal(shown.rows[4].shown[0], 'K', 'the keyboard column shows the stored key')
    assert.equal(shown.rows[4].shown[1], 'A', 'the pad column shows A for jump')

    await moveToRow(page, tapKey, 6)
    await tapKey(page, 'Enter')
    await tapKey(page, 'z')
    const swapped = await waitForState(page, (state) => state.settings?.bindings?.shoot?.[0] === 'KeyZ', 5000, 'shoot rebound to Z')
    assert.deepEqual(swapped.settings.bindings.dash, ['KeyX'], 'dash lost Z and took X: the conflict swapped')
    assert.equal((await controls(page)).message, 'SHOOT / CHARGE: Z   DASH TAKES X')
    assert.deepEqual((await controls(page)).conflicts, [])

    await moveToRow(page, tapKey, 13)
    await tapKey(page, 'Enter')
    const reset =await waitForState(page, (state) => state.settings?.bindings?.jump?.[0] === 'Space', 5000, 'reset to default')
    assert.deepEqual(reset.settings.bindings.shoot, ['KeyX'])
    assert.deepEqual(reset.settings.bindings.dash, ['KeyZ'])
    await tapKey(page, 'Escape')
    await waitForState(page, (state) => state.scene === 'Title' && !state.activeScenes?.includes('Controls'), 5000, 'Controls closes')
    assert.deepEqual(errors, [])
    return { reboundJump: bound.settings.bindings.jump, afterReload: reloaded.settings.bindings.jump, swap: { shoot: swapped.settings.bindings.shoot, dash: swapped.settings.bindings.dash } }
  } finally {
    await page.close()
  }
}

async function integerScaling(browser, { titleUrl, readState, waitForState, tapKey }, dir) {
  const { page, errors, capture } = await openPage(browser, readState, dir, { width: 700, height: 400 })
  try {
    await page.goto(titleUrl)
    const smooth = await waitForState(page, (state) => state.scene === 'Title', 15000)
    assert.deepEqual([smooth.view.canvasWidth, smooth.view.canvasHeight], [700, 394], 'smooth fills a window under 2x')
    await tapKey(page, 'o')
    await waitForState(page, (state) => state.scene === 'Options' || state.activeScenes?.includes('Options'), 5000, 'Options opens')
    const rows = (await readState(page)).options.rows.map((row) => row.id)
    assert.deepEqual(rows.slice(4, 9), ['difficulty', 'fullscreen', 'pixelScaling', 'reducedFlashing', 'controls'])
    for (let step = 0; step < 6; step += 1) await tapKey(page, 'ArrowDown')
    await capture('options-smooth', true)
    await tapKey(page, 'ArrowRight')
    const integer = await waitForState(page, (state) => state.settings?.pixelScaling === 'integer' && state.view?.canvasWidth === 448, 5000, 'integer scaling applies')
    assert.deepEqual([integer.view.canvasWidth, integer.view.canvasHeight, integer.view.zoom], [448, 252, 1])
    await capture('options-integer', true)
    await tapKey(page, 'ArrowDown')
    await tapKey(page, 'ArrowRight')
    const flashing = await waitForState(page, (state) => state.settings?.reducedFlashing === true, 5000, 'reduced flashing toggles')
    await tapKey(page, 'ArrowRight')
    await waitForState(page, (state) => state.settings?.reducedFlashing === false, 5000, 'reduced flashing toggles back')

    await page.reload()
    const persisted = await waitForState(page, (state) => state.scene === 'Title', 15000)
    assert.equal(persisted.settings.pixelScaling, 'integer', 'integer scaling survives a reload')
    assert.deepEqual([persisted.view.canvasWidth, persisted.view.canvasHeight], [448, 252], 'and the reloaded canvas is integer')
    await tapKey(page, 'o')
    await waitForState(page, (state) => state.activeScenes?.includes('Options'), 5000, 'Options reopens')
    for (let step = 0; step < 6; step += 1) await tapKey(page, 'ArrowDown')
    await tapKey(page, 'ArrowLeft')
    const back = await waitForState(page, (state) => state.settings?.pixelScaling === 'smooth' && state.view?.canvasWidth === 700, 5000, 'smooth restores the fill')
    assert.equal(back.view.canvasHeight, 394)
    assert.deepEqual(errors, [])
    return { smooth: [smooth.view.canvasWidth, smooth.view.canvasHeight], integer: [integer.view.canvasWidth, integer.view.canvasHeight], persisted: persisted.settings.pixelScaling, reducedFlashing: flashing.settings.reducedFlashing }
  } finally {
    await page.close()
  }
}

export async function runGamepadRemapScenario(name, deps) {
  const dir = scenarioDir(deps.outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  try {
    const summary = {
      pad: await padInGame(browser, deps, dir),
      remap: await remapAndPersist(browser, deps, dir),
      scaling: await integerScaling(browser, deps, dir)
    }
    fs.writeFileSync(path.join(dir, 'summary.json'), JSON.stringify(summary, null, 2))
  } finally {
    await browser.close()
  }
}
