// Smoke 49-tutorial-verbs (prompt 05 §5.7, EVAL-P5-009). Runs with storyIntro=on so Rook's recorded
// prompts reach the lane. Each teach lock must stay shut until its own verb was performed inside its
// room (a wrong verb first, then the right one, replayed from scripts/smoke/inputs/tutorial-*.json),
// the lane must show every key hint and every Rook line, and walking into a closed gate must not pass
// it. The debug warps (setPlayerX, crossBossGate) stay automation tools: smoke 5 and the sweep use them.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const INPUTS = path.resolve('scripts/smoke/inputs')
const HINTS = ['JUMP: SPACE', 'DASH: Z', 'WALL: JUMP OFF THE WALL', 'HOLD X TO CHARGE', 'SABER: C']
const ROOK_STEPS = ['Step one.', 'Step two.', 'Step three.', 'Step four.', 'Step five.']

function readRows(file) {
  return JSON.parse(fs.readFileSync(path.join(INPUTS, `tutorial-${file}.json`), 'utf8')).rows
}

function assertLaneInBounds(state, label) {
  const bounds = state.ticker?.bounds
  assert.ok(bounds, `${label}: lane bounds reported`)
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 448, `${label}: lane inside the frame horizontally`)
  assert.ok(bounds.y >= 58 && bounds.y + bounds.height <= 252, `${label}: lane below the HUD band`)
}

export async function runTutorialVerbsScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames }) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 448, height: 252 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const capture = async (label) => {
    await page.locator('canvas').screenshot({ path: path.join(dir, `shot-${label}.png`) })
    const state = await readState(page)
    fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify(state, null, 2))
    return state
  }
  const locksOf = (state) => state.mechanics?.roomLocks ?? []
  const replay = (file) => page.evaluate((rows) => window.stageDebug.replayInputs(rows), readRows(file))
  const warp = async (x) => { await page.evaluate((value) => window.stageDebug.setPlayerX(value), x); await advanceFrames(page, 3) }
  const lock = async (index) => locksOf(await readState(page))[index]
  // The hero is sampled for verbs, not for survival: long i-frames keep enemies from knocking the run off script.
  const shield = () => page.evaluate(() => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(600000))
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: false, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'tutorial_sentinel', bossId: 'sentinel_rook', runtimeBossConfigId: 'sentinel_rook' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'tutorial_sentinel', 15000)
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (!state.stageIntro?.active) break
      await page.evaluate(() => {
        if (window.__phaserGame?.scene?.getScene?.('Game')?.dialogueOverlay?.isActive?.()) window.stageDebug?.skipDialogue?.()
        else window.stageDebug?.skipStageIntro?.()
      })
      await advanceFrames(page, 4)
    }
    await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true && locksOf(state)[0]?.phase === 'locked', 15000)
    // Record every item the lane shows for the rest of the run. Replays step many frames inside one
    // evaluate, so a timer would miss short items: wrap the lane's own advance instead (test-side only).
    await page.evaluate(() => {
      const lane = window.__phaserGame.scene.getScene('Game').toastLane
      const record = () => {
        const item = lane.current
        if (item) window.__laneLog.push({ kind: item.kind, speaker: item.speaker ?? null, text: item.text, bounds: lane.getBounds() })
      }
      window.__laneLog = []
      record()
      const advance = lane.next.bind(lane)
      lane.next = () => { advance(); record() }
    })
    await shield()
    const armed = await capture('armed-jump')
    assert.deepEqual(locksOf(armed).map((entry) => entry.requiredInput), ['jump', 'dash', 'wall_jump', 'charge', 'saber'])
    assert.deepEqual(locksOf(armed).map((entry) => entry.phase), ['locked', 'dormant', 'dormant', 'dormant', 'dormant'])
    assert.ok(locksOf(armed).every((entry) => entry.gateClosed), 'every gate starts closed')
    const hint = await waitForState(page, (state) => state.ticker?.kind === 'hint' && state.ticker.text === HINTS[0], 8000)
    assertLaneInBounds(hint, 'jump key hint')

    // 1 jump: walking into the closed gate does not pass it; a jump opens it.
    await warp(400)
    await replay('walk-right')
    const blocked = await capture('gate-blocks')
    assert.ok(blocked.player.x < 448, `a closed gate blocks the walk (x ${blocked.player.x})`)
    assert.equal(locksOf(blocked)[0].phase, 'locked')
    await replay('dash')
    assert.equal((await lock(0)).phase, 'locked', 'a dash does not open the jump lock')
    await replay('jump')
    assert.equal((await lock(0)).phase, 'open', 'the jump opens the jump lock')
    await replay('walk-right')
    assert.ok((await readState(page)).player.x > 448, 'the open gate lets the hero through')

    // 2 dash: a jump is the wrong verb, the dash is the right one.
    await advanceFrames(page, 2)
    assert.equal((await lock(1)).phase, 'locked')
    await replay('jump')
    assert.equal((await lock(1)).phase, 'locked', 'a jump does not open the dash lock')
    await replay('dash')
    assert.equal((await lock(1)).phase, 'open', 'the dash opens the dash lock')

    // 3 wall kick in the two-screen shaft: a ground jump does not count, a kick off the wall face does.
    await warp(1080)
    await shield()
    const shaft = await readState(page)
    assert.equal(locksOf(shaft)[2].phase, 'locked')
    assert.equal(locksOf(shaft)[2].cameraHeld, true, 'the camera is held to the shaft')
    assert.ok(locksOf(shaft)[2].room.height >= 504)
    await replay('jump')
    assert.equal((await lock(2)).phase, 'locked', 'a ground jump does not open the wall lock')
    for (let attempt = 0; attempt < 3 && (await lock(2)).phase !== 'open'; attempt += 1) {
      await warp(1100)
      await advanceFrames(page, 40)
      await replay('wall-kick')
    }
    await capture('wall-kick')
    assert.equal((await lock(2)).phase, 'open', 'a wall kick opens the shaft lock')

    // 4 charge: a pellet does not count, a charged shot does.
    await warp(1400)
    await shield()
    await capture('armed-charge')
    assert.equal((await lock(3)).phase, 'locked')
    await replay('pellet')
    assert.equal((await lock(3)).phase, 'locked', 'an uncharged pellet does not open the charge lock')
    await replay('charge')
    await capture('charge')
    assert.equal((await lock(3)).phase, 'open', 'a charged shot opens the charge lock')

    // 5 saber: the scrap gate blocks, a pellet does nothing, three cuts bring it down.
    await warp(2180)
    await shield()
    await replay('walk-right')
    const scrap = await readState(page)
    assert.ok(scrap.player.x < 2240, `the scrap gate blocks the walk (x ${scrap.player.x})`)
    await replay('pellet')
    assert.equal((await lock(4)).phase, 'locked', 'a pellet does not break the scrap gate')
    await replay('saber')
    const cut = await capture('saber')
    assert.deepEqual([locksOf(cut)[4].phase, locksOf(cut)[4].progress], ['open', 3], 'three saber cuts break the scrap gate')
    await replay('walk-right')
    const through = await capture('through')
    assert.ok(through.player.x > 2240)
    assert.ok(locksOf(through).every((entry) => entry.phase === 'open' && !entry.gateClosed))

    // The lane showed every key hint and every recorded Rook prompt, inside its bounds.
    const laneWait = page.waitForFunction(({ hints, steps }) => {
      const log = window.__laneLog ?? []
      return hints.every((text) => log.some((entry) => entry.kind === 'hint' && entry.text === text)) &&
        steps.every((step) => log.some((entry) => entry.kind === 'radio' && /rook/i.test(entry.speaker ?? '') && entry.text.startsWith(step)))
    }, { hints: HINTS, steps: ROOK_STEPS }, { timeout: 90000, polling: 250 })
    await laneWait.catch(async (error) => {
      fs.writeFileSync(path.join(dir, 'lane-log.json'), JSON.stringify(await page.evaluate(() => window.__laneLog), null, 2))
      throw error
    })
    const laneLog = await page.evaluate(() => window.__laneLog)
    fs.writeFileSync(path.join(dir, 'lane-log.json'), JSON.stringify(laneLog, null, 2))
    for (const entry of laneLog.filter((item) => item.kind === 'hint' || /rook/i.test(item.speaker ?? ''))) {
      assertLaneInBounds({ ticker: entry }, entry.text)
    }
    assert.deepEqual(errors, [])
    return { locks: locksOf(through), laneItems: laneLog.length }
  } finally {
    await browser.close()
  }
}
