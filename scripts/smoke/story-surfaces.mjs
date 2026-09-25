// Story-surface scenarios (prompt 01, Phase 1.4). These run with storyIntro=on; every other
// scenario runs with storyIntro=off so the surfaces never block existing automation.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const ROBOT_MASTERS = ['pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin']

function scenarioDir(outputDir, name) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

async function open(browser, { readState }, dir) {
  const page = await browser.newPage({ viewport: { width: 448, height: 252 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const capture = async (label) => {
    await page.locator('canvas').screenshot({ path: path.join(dir, `shot-${label}.png`) })
    fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify(await readState(page), null, 2))
  }
  return { page, errors, capture }
}

/** Skips the stage card and the briefing however far the intro has progressed. */
async function skipStageIntro(page, { readState, advanceFrames }) {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await readState(page)
    if (state.scene !== 'Game') return state
    if (!state.stageIntro?.active) return state
    await page.evaluate(() => {
      if (window.__phaserGame?.scene?.getScene?.('Game')?.dialogueOverlay?.isActive?.()) window.stageDebug?.skipDialogue?.()
      else window.stageDebug?.skipStageIntro?.()
    })
    await advanceFrames(page, 4)
  }
  throw new Error('Stage intro did not finish after skipping')
}

export async function runPrologueFlowScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const { page, errors, capture } = await open(browser, { readState }, dir)
  try {
    await page.goto(storyUrl)
    await waitForState(page, (state) => state.scene === 'Title')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'NewCampaign')
    await advanceFrames(page, 3)
    await tapKey(page, 'Enter')
    const prologue = await waitForState(page, (state) => state.scene === 'Prologue' && state.prologue?.pageCount > 0)
    assert.equal(prologue.prologue.pageCount, 7)
    assert.equal(prologue.prologue.pageIndex, 0)
    await capture('prologue-page-1')
    await tapKey(page, 'Enter')
    await tapKey(page, 'Enter')
    const advanced = await waitForState(page, (state) => state.prologue?.pageIndex === 2)
    assert.equal(advanced.prologue.sequenceId, 'prologue')
    await page.evaluate(() => window.narrativeDebug?.skip?.())
    const card = await waitForState(page, (state) => state.scene === 'Game' && state.stageIntro?.phase === 'card', 8000)
    assert.equal(card.stageRuntime.stageId, 'tutorial_sentinel')
    assert.equal(card.playerState.paused, false)
    await capture('stage-card')
    const briefing = await waitForState(page, (state) => state.stageIntro?.phase === 'briefing' && state.dialogue?.active === true, 4000)
    assert.equal(briefing.dialogue.sequenceId, 'tutorial_sentinel_briefing')
    assert.equal(briefing.dialogue.lineCount, 3)
    await capture('briefing')
    // The overlay ignores advance for 160ms of scene time after a line opens (one key press must not skip two
    // lines). Retry against the state instead of guessing a delay: a fixed wait is timing-dependent (09 review).
    for (let attempt = 0; attempt < 40; attempt += 1) {
      await page.evaluate(() => window.stageDebug?.advanceDialogue?.())
      if ((await readState(page))?.dialogue?.lineIndex === 1) break
      await advanceFrames(page, 2)
    }
    await waitForState(page, (state) => state.dialogue?.lineIndex === 1)
    await page.evaluate(() => window.stageDebug?.skipDialogue?.())
    const control = await waitForState(page, (state) => state.stageIntro?.phase === 'done' && state.newPlayer?.locomotion?.grounded === true, 6000)
    assert.ok(control.save.storyFlags.includes('prologue'))
    assert.ok(control.save.storyFlags.includes('tutorial_sentinel_briefing'))
    await capture('control')
    assert.deepEqual(errors, [])
    return control
  } finally { await browser.close() }
}

// The ticker's wrapped text must stay inside its lane, the lane inside the 448x252 frame and below the HUD band.
function assertTickerInBounds(state, label) {
  const bounds = state.ticker?.bounds
  assert.ok(bounds, `${label}: ticker bounds reported`)
  assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= 448, `${label}: lane inside the frame horizontally`)
  assert.ok(bounds.y >= 58 && bounds.y + bounds.height <= 252, `${label}: lane below the HUD band and above the frame bottom`)
  assert.ok(bounds.textRight <= bounds.x + bounds.width - 4, `${label}: text ends inside the lane (right ${bounds.textRight})`)
  assert.ok(bounds.textBottom <= bounds.y + bounds.height, `${label}: text ends inside the lane (bottom ${bounds.textBottom})`)
}

export async function runRadioTickerScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const { page, errors, capture } = await open(browser, { readState }, dir)
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'pyro_maw')
    await skipStageIntro(page, { readState, advanceFrames })
    await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true)
    await capture('before-cross')
    const crossed = await page.evaluate(() => window.stageDebug?.crossNextCheckpoint?.())
    await advanceFrames(page, 2)
    await capture('after-cross')
    fs.writeFileSync(path.join(dir, 'crossed.json'), JSON.stringify(crossed))
    // The toast is 900ms; assert the ordering from the deterministic capture, not from a poll.
    const afterCross = JSON.parse(fs.readFileSync(path.join(dir, 'state-after-cross.json'), 'utf8'))
    assert.equal(afterCross.stageRuntime.checkpointIndex, 1)
    assert.equal(afterCross.ticker.kind, 'toast')
    assert.equal(afterCross.ticker.text, 'Checkpoint 2')
    assert.ok(afterCross.ticker.queued >= 2, 'radio lines queue behind the checkpoint toast')
    assert.ok(afterCross.save.storyFlags.includes('pyro_maw_radio'))
    const iona = await waitForState(page, (state) => state.ticker?.kind === 'radio' && /iona/i.test(state.ticker.speaker ?? ''), 9000)
    assert.equal(iona.playerState.paused, false)
    assert.equal(iona.dialogue.active, false, 'radio never blocks')
    await capture('radio-iona')
    assertTickerInBounds(iona, 'Iona radio line')
    const omega = await waitForState(page, (state) => state.ticker?.kind === 'radio' && /omega/i.test(state.ticker.speaker ?? ''), 12000)
    assert.match(omega.ticker.text, /Unit 09/)
    await capture('radio-omega')
    assertTickerInBounds(omega, 'OMEGA radio line')
    assert.ok(omega.save.storyFlags.includes('pyro_maw_radio'))
    assert.deepEqual(errors, [])
    return omega
  } finally { await browser.close() }
}

export async function runEndingFlowScenario(name, { outputDir, storyUrl, readState, waitForState, waitForPageCheck, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const { page, errors, capture } = await open(browser, { readState }, dir)
  await page.addInitScript((save) => localStorage.setItem('save.v1', JSON.stringify(save)), {
    weaponsUnlocked: ['FlameSerpent', 'HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob', 'AeroDarts', 'FrostShatter'],
    clearedBosses: ROBOT_MASTERS, tutorialCleared: true, gameCompleted: false, heartTanks: 8, subTanks: 4,
    progressionWorld: { progressionMode: 'classic' }
  })
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'f')
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'omega_fortress')
    await skipStageIntro(page, { readState, advanceFrames })
    await waitForPageCheck(page, () => Boolean(window.bossDebug?.forceVictory))
    await page.evaluate(() => window.bossDebug?.forceVictory?.())
    await waitForState(page, (state) => state.scene === 'Game' && state.victory?.modalOpen === true)
    await tapKey(page, 'Enter')
    const cards = await waitForState(page, (state) => state.scene === 'EndingScene' && state.ending?.phase === 'cards', 8000)
    assert.equal(cards.ending.pageCount, 8)
    await capture('card-1')
    for (let index = 0; index < 8; index += 1) await page.evaluate(() => window.narrativeDebug?.advance?.())
    const close = await waitForState(page, (state) => state.ending?.phase === 'close')
    assert.equal(close.ending.pageCount, 3, "Iona's reckoning, the network holding, WREN's last line (12g gave the reckoning its own page)")
    for (const closePage of [1, 2]) {
      await page.evaluate(() => window.narrativeDebug?.advance?.())
      await waitForState(page, (state) => state.ending?.phase === 'close' && state.ending.page === closePage)
    }
    await capture('close-last-line')
    await page.evaluate(() => window.narrativeDebug?.advance?.())
    const record = await waitForState(page, (state) => state.ending?.phase === 'record')
    await capture('record')
    await page.evaluate(() => window.narrativeDebug?.advance?.())
    await waitForState(page, (state) => state.ending?.phase === 'credits')
    // The credits start below the screen and scroll up: capture once they are on screen, not the empty start.
    await advanceFrames(page, 120)
    await capture('credits')
    await page.evaluate(() => window.narrativeDebug?.skip?.())
    const done = await waitForState(page, (state) => (state.scene === 'Title' || state.scene === 'StageSelect') && state.save?.gameCompleted === true, 10000)
    for (const id of ['epilogue', 'credits', 'omega_fortress_defeat']) assert.ok(done.save.storyFlags.includes(id), id)
    assert.equal(done.save.hasActiveRun, false)
    assert.deepEqual(errors, [])
    return { record: record.ending, done: done.save }
  } finally { await browser.close() }
}

export async function runStoryReplaySkipScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const { page, errors, capture } = await open(browser, { readState }, dir)
  const seen = ['pyro_maw_briefing', 'pyro_maw_intro', 'pyro_maw_radio']
  // Init scripts run on every navigation; seed only when absent so the replay half can override both keys.
  await page.addInitScript((flags) => {
    if (!localStorage.getItem('save.v1')) localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, storyFlags: flags, progressionWorld: { progressionMode: 'classic' } }))
    if (!localStorage.getItem('settings.v1')) localStorage.setItem('settings.v1', JSON.stringify({ storyReplay: false }))
  }, seen)
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    const card = await waitForState(page, (state) => state.scene === 'Game' && state.stageIntro?.phase === 'card')
    assert.equal(card.dialogue.active, false)
    const done = await waitForState(page, (state) => state.stageIntro?.phase === 'done', 4000)
    assert.equal(done.dialogue.active, false, 'a seen briefing does not replay')
    await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true)
    await page.evaluate(() => window.stageDebug?.crossBossGate?.())
    const boss = await waitForState(page, (state) => state.stageRuntime?.bossEncounterActive === true, 6000)
    await advanceFrames(page, 20)
    const afterGate = await readState(page)
    assert.equal(afterGate.dialogue.active, false, 'a seen boss intro does not replay')
    await capture('replay-off')
    // Replay on: the same fresh entry (first checkpoint) plays the briefing again.
    await page.evaluate((flags) => {
      localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, storyFlags: flags, progressionWorld: { progressionMode: 'classic' } }))
      localStorage.setItem('settings.v1', JSON.stringify({ storyReplay: true }))
    }, seen)
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    const replay = await waitForState(page, (state) => state.scene === 'Game' && state.stageIntro?.phase === 'briefing' && state.dialogue?.active === true, 8000)
    assert.equal(replay.dialogue.sequenceId, 'pyro_maw_briefing')
    assert.equal(replay.settings.storyReplay, true)
    await capture('replay-on')
    assert.deepEqual(errors, [])
    return { boss: boss.stageRuntime, replay: replay.dialogue }
  } finally { await browser.close() }
}
