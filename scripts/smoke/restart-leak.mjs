// Smoke 63-restart-leak (prompt 04 4.4's `44-restart-leak`, renumbered: 44 is `44-boss-beats`).
// Restarts Pyro Maw ten times in one page and asserts `render_game_to_text().runtime = { listeners,
// timers }` does not grow across the cycle; average frame time over a settle period is recorded,
// not gated (4.4).
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

const PYRO_MAW_STAGE_ID = 'pyro_maw'
const RESTART_COUNT = 10
const SCENE_WAIT_MS = 20000

export async function runRestartLeakScenario(name, { outputDir, url, readState, waitForState, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const errors = []
  const runtimeSamples = []
  try {
    const page = await browser.newPage()
    await page.addInitScript(() => {
      if (!localStorage.getItem('save.v1')) {
        localStorage.setItem('save.v1', JSON.stringify({ weaponsUnlocked: [], clearedBosses: [], tutorialCleared: false, finalBossCleared: false, gameCompleted: false }))
      }
    })
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await waitForState(page, (state) => state.scene === 'StageSelect', SCENE_WAIT_MS)
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game', SCENE_WAIT_MS)
    await advanceFrames(page, 30)
    runtimeSamples.push((await readState(page))?.runtime ?? null)

    // The first entry above goes through the normal StageSelect -> Enter flow; the remaining nine
    // restart the Game scene directly (scene.start on an existing scene's own plugin can start any
    // scene by key -- scripts/smoke/mechanics-matrix.mjs starts Game the same way from StageSelect),
    // which is the shutdown/create cycle a leak would show up in.
    for (let restart = 1; restart < RESTART_COUNT; restart += 1) {
      await page.evaluate(
        (stageId) => window.__phaserGame.scene.getScene('Game').scene.start('Game', { stageId }),
        PYRO_MAW_STAGE_ID
      )
      await waitForState(
        page,
        (state) => state.scene === 'Game' && state.stageRuntime?.stageId === PYRO_MAW_STAGE_ID,
        SCENE_WAIT_MS
      )
      await advanceFrames(page, 10)
      runtimeSamples.push((await readState(page))?.runtime ?? null)
    }

    // A settle period so the average frame time reflects steady-state play after the restart churn,
    // not the restarts themselves; recorded only (4.4), not gated.
    await advanceFrames(page, 300)
    const perfAfterSettle = await page.evaluate(() => window.perfDebug?.() ?? null)
    const finalState = await readState(page)

    fs.writeFileSync(
      path.join(dir, 'restart-leak-evidence.json'),
      JSON.stringify({ runtimeSamples, perfAfterSettle, finalScene: finalState?.scene }, null, 2)
    )

    if (errors.length > 0) {
      fs.writeFileSync(path.join(dir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${dir}`)
    }

    assert.equal(runtimeSamples.length, RESTART_COUNT, 'did not capture a runtime sample for every restart')
    assert.ok(runtimeSamples.every((sample) => sample != null), 'render_game_to_text().runtime was missing on a restart')
    const first = runtimeSamples[0]
    const last = runtimeSamples[runtimeSamples.length - 1]
    assert.ok(
      last.listeners <= first.listeners,
      `listener count grew across ${RESTART_COUNT} restarts: ${first.listeners} -> ${last.listeners} (${JSON.stringify(runtimeSamples.map((sample) => sample.listeners))})`
    )
    assert.ok(
      last.timers <= first.timers,
      `timer count grew across ${RESTART_COUNT} restarts: ${first.timers} -> ${last.timers} (${JSON.stringify(runtimeSamples.map((sample) => sample.timers))})`
    )
    assert.equal(finalState?.scene, 'Game', `expected to end in Game, saw ${finalState?.scene}`)
  } finally {
    await browser.close()
  }
}
