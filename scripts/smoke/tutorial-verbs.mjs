// Smoke 49-tutorial-verbs (prompt 05 §5.7, EVAL-P5-009). Runs with storyIntro=on so Rook's recorded
// prompts reach the lane. Each teach lock must stay shut until its own verb was performed inside its
// room (a wrong verb first, then the right one, replayed from scripts/smoke/inputs/tutorial-*.json),
// the lane must show every key hint and every Rook line, and walking into a closed gate must not pass
// it, and the dash gap (06.P) must drop a plain jump safely on the bay floor and carry a dash jump to
// ledge B. The debug warps (setPlayerX, crossBossGate) stay automation tools: smoke 5 and the sweep use them.
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
  // 05c playtest: the lane hangs from the HUD band; at the frame bottom it covered the hero's feet.
  assert.ok(bounds.y + bounds.height <= 160, `${label}: lane ends at ${bounds.y + bounds.height}, over the floor row`)
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
  // Test-side placement above a raised deck (setPlayerX keeps the hero's y, which would bury it in the deck).
  const place = async (x, y) => {
    await page.evaluate(({ x, y }) => {
      const hero = window.__phaserGame.scene.getScene('Game').player
      hero.setPosition(x, y)
      hero.body?.setVelocity?.(0, 0)
    }, { x, y })
    await advanceFrames(page, 3)
  }
  const lock = async (index) => locksOf(await readState(page))[index]
  const coachWhileArmed = async (index) => {
    const state = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /rook/i.test(next.ticker.speaker ?? '') && String(next.ticker.text).startsWith(ROOK_STEPS[index]), 15000)
    assert.equal(locksOf(state)[index].phase, 'locked', `Rook's "${ROOK_STEPS[index]}" plays while lock ${index + 1} is still closed`)
    return state
  }
  // The hero is sampled for verbs, not for survival: long i-frames keep enemies from knocking the run off script.
  const shield = () => page.evaluate(() => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(600000))
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: false, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'tutorial_sentinel', bossId: 'sentinel_rook', runtimeBossConfigId: 'sentinel_rook' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'tutorial_sentinel', 15000)
    let briefingChecked = false
    // The stage card ends on its own and the briefing follows; wait for it so the check below cannot be skipped.
    await waitForState(page, (state) => state.dialogue?.active === true, 15000)
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (!state.stageIntro?.active) break
      // 05c playtest: the briefing panel covered the hero standing at the spawn. It now ends above them.
      if (state.dialogue?.active && !briefingChecked) {
        briefingChecked = true
        fs.writeFileSync(path.join(dir, 'briefing-panel.json'), JSON.stringify({ panel: state.dialogue.panel, player: state.player }, null, 2))
        await page.locator('canvas').screenshot({ path: path.join(dir, 'shot-briefing.png') })
        assert.ok(state.dialogue.panel && state.dialogue.panel.bottom <= state.player.y - 24, `briefing panel bottom ${state.dialogue.panel?.bottom} covers the hero at y ${state.player.y}`)
      }
      await page.evaluate(() => {
        if (window.__phaserGame?.scene?.getScene?.('Game')?.dialogueOverlay?.isActive?.()) window.stageDebug?.skipDialogue?.()
        else window.stageDebug?.skipStageIntro?.()
      })
      await advanceFrames(page, 4)
    }
    assert.ok(briefingChecked, 'the tutorial briefing was never seen, so the hero-visibility check did not run')
    await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true && locksOf(state)[0]?.phase === 'locked', 15000)
    // Record every item the lane shows for the rest of the run. Replays step many frames inside one
    // evaluate, so a timer would miss short items: wrap the lane's own advance instead (test-side only).
    await page.evaluate(() => {
      const game = window.__phaserGame.scene.getScene('Game')
      const lane = game.toastLane
      const record = () => {
        const item = lane.current
        if (item) window.__laneLog.push({ kind: item.kind, speaker: item.speaker ?? null, text: item.text, heroX: game.player.x, bounds: lane.getBounds() })
      }
      window.__laneLog = []
      window.__laneEnqueued = []
      record()
      const advance = lane.next.bind(lane)
      lane.next = () => { advance(); record() }
      // Checkpoint toasts and the stage radio arrive through enqueue (the coach goes through supersede).
      const enqueue = lane.enqueue.bind(lane)
      lane.enqueue = (item) => { window.__laneEnqueued.push({ kind: item.kind, speaker: item.speaker ?? null, text: item.text, heroX: game.player.x }); enqueue(item) }
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
    await coachWhileArmed(0)
    await replay('jump')
    assert.equal((await lock(0)).phase, 'open', 'the jump opens the jump lock')
    // A real supersede: arm the dash lock while Rook's step one still plays; the dash hint replaces it within 3 frames.
    const stepOne = await readState(page)
    assert.ok(stepOne.ticker?.kind === 'radio' && String(stepOne.ticker.text).startsWith(ROOK_STEPS[0]), `step one still plays when the dash lock arms (${stepOne.ticker?.text})`)
    await page.evaluate((value) => window.stageDebug.setPlayerX(value), 470)
    await advanceFrames(page, 3)
    const superseded = await readState(page)
    assert.equal(locksOf(superseded)[1].phase, 'locked')
    assert.equal(superseded.ticker?.text, HINTS[1], 'the dash hint replaces the stale step-one line within 3 frames')

    // 2 dash: a jump is the wrong verb, the dash is the right one.
    await advanceFrames(page, 2)
    assert.equal((await lock(1)).phase, 'locked')
    await coachWhileArmed(1)
    await replay('jump')
    assert.equal((await lock(1)).phase, 'locked', 'a jump does not open the dash lock')
    await replay('dash')
    assert.equal((await lock(1)).phase, 'open', 'the dash opens the dash lock')
    // 06.P: the dash gap teaches without killing. A plain jump off the launch deck lands on the
    // spike-free bay floor, one hop below the deck; a dash jump from the same spot lands on ledge B.
    await place(560, 160)
    await replay('gap-plain-jump')
    const bay = await capture('dash-gap-fall')
    assert.ok(bay.newPlayer?.locomotion?.grounded, 'the plain jump ends grounded')
    assert.ok(bay.player.x > 600 && bay.player.x < 816 && bay.player.y > 200, `a plain jump lands on the bay floor (x ${bay.player.x}, y ${bay.player.y})`)
    await place(560, 160)
    await replay('gap-dash-jump')
    const ledgeB = await capture('dash-gap-clear')
    assert.ok(ledgeB.newPlayer?.locomotion?.grounded, 'the dash jump ends grounded')
    assert.ok(ledgeB.player.x >= 812 && ledgeB.player.x <= 884 && ledgeB.player.y < 190, `a dash jump lands on ledge B (x ${ledgeB.player.x}, y ${ledgeB.player.y})`)

    // 3 wall kick: from x 900, one replay and no warp climbs the two-screen shaft, clears the right
    // wall and walks out past the gate at 1344; the camera must scroll up with the hero.
    await warp(900)
    await shield()
    const shaft = await readState(page)
    assert.equal(locksOf(shaft)[2].phase, 'locked')
    assert.equal(locksOf(shaft)[2].cameraHeld, true, 'the camera is held to the shaft')
    assert.ok(locksOf(shaft)[2].room.height >= 504)
    await coachWhileArmed(2)
    await capture('shaft-coach')
    await replay('jump')
    assert.equal((await lock(2)).phase, 'locked', 'a ground jump does not open the wall lock')
    await page.evaluate(() => {
      const game = window.__phaserGame.scene.getScenes(true)[0]
      window.__climb = { minScrollY: game.cameras.main.scrollY, minHeroY: game.player.y, startX: game.player.x }
      window.__climbProbe = () => {
        window.__climb.minScrollY = Math.min(window.__climb.minScrollY, game.cameras.main.scrollY)
        window.__climb.minHeroY = Math.min(window.__climb.minHeroY, game.player.y)
      }
      game.events.on('postupdate', window.__climbProbe)
    })
    await replay('wall-kick')
    const climb = await page.evaluate(() => {
      window.__phaserGame.scene.getScenes(true)[0].events.off('postupdate', window.__climbProbe)
      return window.__climb
    })
    // The climb ends in the charge room, so this frame shows the charge key hint over the armored frame.
    const climbed = await capture('shaft-exit-charge-hint')
    fs.writeFileSync(path.join(dir, 'climb.json'), JSON.stringify({ ...climb, endX: climbed.player.x, cameraBlock: climbed.camera ?? null }, null, 2))
    assert.ok(climb.startX <= 902, `the climb starts at x 900 (${climb.startX})`)
    assert.equal(locksOf(climbed)[2].phase, 'open', 'a wall kick opens the shaft lock')
    assert.ok(climb.minHeroY < -136, `the hero clears the right wall top (peak y ${climb.minHeroY})`)
    assert.ok(climb.minScrollY < -100, `the camera scrolls up with the climb (min scrollY ${climb.minScrollY})`)
    assert.ok(climbed.player.x > 1344, `the hero walks out past the shaft gate (x ${climbed.player.x})`)

    // 4 charge: the climb ends inside the charge room; a pellet does not count, a charged shot does.
    await shield()
    assert.equal((await lock(3)).phase, 'locked')
    await coachWhileArmed(3)
    await capture('armed-charge')
    await replay('pellet')
    assert.equal((await lock(3)).phase, 'locked', 'an uncharged pellet does not open the charge lock')
    await replay('charge')
    await capture('charge')
    assert.equal((await lock(3)).phase, 'open', 'a charged shot opens the charge lock')
    // The stage radio first shows after the shaft exit checkpoint queued it.
    await waitForState(page, (state) => state.ticker?.kind === 'radio' && /iona/i.test(state.ticker.speaker ?? ''), 20000)
    const radioFirst = await capture('radio-first')
    fs.writeFileSync(path.join(dir, 'radio-first.json'), JSON.stringify({ heroX: radioFirst.player.x, heroY: radioFirst.player.y, checkpointIndex: radioFirst.stageRuntime?.checkpointIndex, locks: locksOf(radioFirst).map((entry) => entry.phase) }, null, 2))

    // 5 saber: the scrap gate blocks, a pellet does nothing, three cuts bring it down.
    await warp(2180)
    await shield()
    await coachWhileArmed(4)
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
    const enqueued = await page.evaluate(() => window.__laneEnqueued)
    fs.writeFileSync(path.join(dir, 'lane-enqueued.json'), JSON.stringify(enqueued, null, 2))
    const stageRadio = enqueued.filter((item) => item.kind === 'radio')
    assert.ok(stageRadio.length >= 1, 'the stage radio queued')
    assert.ok(stageRadio.every((item) => item.heroX >= 1380), `the radio queues at the shaft exit checkpoint, never before (x ${stageRadio.map((item) => Math.round(item.heroX))})`)
    const dashExit = enqueued.find((item) => item.kind === 'toast' && item.text === 'Checkpoint 2')
    assert.ok(dashExit && dashExit.heroX >= 896 && dashExit.heroX < 1000, 'checkpoint 2 at the dash exit shows its toast and queues no radio')
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
