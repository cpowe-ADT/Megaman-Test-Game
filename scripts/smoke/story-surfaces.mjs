// Story-surface scenarios (prompt 01, Phase 1.4). These run with storyIntro=on; every other
// scenario runs with storyIntro=off so the surfaces never block existing automation.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const ROBOT_MASTERS = ['pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin']
const DIALOGUE = JSON.parse(fs.readFileSync(new URL('../../src/content/dialogue/dialogue.v2.json', import.meta.url), 'utf8'))
/** The Heat Works checkpoint intrusion as written; 12g's phase-two line must neither replace nor replay it. */
const PYRO_CHECKPOINT_INTRUSION = 'Unit 09. The heat you feel is a solved equation. Leave it solved.'

function authored(sequenceId, index = 0, callsign = '') {
  const line = DIALOGUE.sequences.find((entry) => entry.id === sequenceId)?.lines[index]
  assert.ok(line, `${sequenceId}[${index}] is authored`)
  return line.text.replaceAll('{hero}', callsign)
}

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
    assert.equal(omega.ticker.text, PYRO_CHECKPOINT_INTRUSION, 'the checkpoint intrusion is unchanged by the phase-two trigger (12g)')
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

/**
 * 12g (prompt 07 section 7.6 B, EVAL-P7-009): the capsule card's cache log, OMEGA's phase-two line, the weapon-get
 * registry line, the game-over rotation, and the epilogue secret on an eight-cache save.
 */
export async function runStoryTriggersScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const { page, errors, capture } = await open(browser, { readState }, dir)
  // The checkpoint radio pair is 35's; seeding it seen keeps the lane short when the gate warp crosses its checkpoint.
  await page.addInitScript(() => {
    if (!localStorage.getItem('save.v1')) localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, storyFlags: ['pyro_maw_radio'], progressionWorld: { progressionMode: 'classic' } }))
  })
  const evidence = {}
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'pyro_maw')
    await skipStageIntro(page, { readState, advanceFrames })
    const ready = await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true)
    const callsign = ready.identity.heroCallsign

    // capsule_pickup: one card, Pyro Maw's recorded cache log above the effect label.
    await page.evaluate(() => window.__phaserGame.scene.getScene('Game').collectProgressionLocation('pyro_maw:capsule'))
    const card = await waitForState(page, (state) => state.ticker?.kind === 'radio' && /CACHE LOG/.test(state.ticker.speaker ?? ''), 8000)
    await capture('capsule-card')
    const [log, label] = card.ticker.text.split('\n')
    assert.equal(card.ticker.speaker, 'Pyro Maw · CACHE LOG')
    assert.equal(log, authored('pyro_maw_capsule', 0, callsign))
    assert.match(label ?? '', / · /, 'the effect label sits under the log')
    assertTickerInBounds(card, 'capsule card')
    assert.ok(card.save.storyFlags.includes('pyro_maw_capsule'))
    evidence.capsule = card.ticker

    // warden_phase: OMEGA's line on the ticker as Pyro Maw enters phase two (threshold 0.55).
    await page.evaluate(() => window.stageDebug.crossBossGate())
    await waitForState(page, (state) => state.stageRuntime?.bossEncounterActive === true, 8000)
    await page.evaluate(() => {
      window.bossDebug.unlockIntro()
      window.__phaserGame.scene.getScene('Game').newPlayerRuntime?.resetForRespawn?.(600000)
    })
    let phaseIndex = 0
    for (let attempt = 0; attempt < 12 && phaseIndex !== 1; attempt += 1) {
      phaseIndex = await page.evaluate(() => {
        const controller = window.__phaserGame.scene.getScene('Game').bossController
        const hp = controller.hp
        const target = Math.floor(hp.max * 0.5)
        if (hp.current > target) controller.applyDamage({ amount: hp.current - target, type: 'normal', source: 'smoke_story_phase', iFrameMs: 0 })
        return controller.getDebugState?.()?.phaseIndex ?? 0
      })
      if (phaseIndex !== 1) await advanceFrames(page, 10)
    }
    assert.equal(phaseIndex, 1, 'Pyro Maw reached phase two')
    // It queues behind the capsule card and the checkpoint toasts the gate warp crosses (the radio pair is seeded seen).
    const phaseLine = authored('pyro_maw_phase_two')
    const omega = await waitForState(page, (state) => state.ticker?.kind === 'radio' && state.ticker.text === phaseLine, 20000)
    await capture('phase-two-omega')
    assert.match(omega.ticker.speaker ?? '', /omega/i)
    assert.notEqual(omega.ticker.text, PYRO_CHECKPOINT_INTRUSION, 'a distinct line, not the checkpoint intrusion replayed')
    assertTickerInBounds(omega, 'phase-two line')
    assert.ok(omega.save.storyFlags.includes('pyro_maw_phase_two'))
    evidence.phaseTwo = omega.ticker

    // weapon_get: Iona's registry line closes the defeat dialogue; the card contract is in story.weaponGetCard.
    await page.evaluate(() => window.bossDebug.damage(999))
    await waitForState(page, (state) => state.dialogue?.active === true && state.dialogue.sequenceId === 'pyro_maw_defeat', 15000)
    let registry = null
    for (let attempt = 0; attempt < 60 && !registry; attempt += 1) {
      const state = await readState(page)
      if (state.dialogue?.sequenceId === 'pyro_maw_weapon_get') registry = state
      else {
        await page.evaluate(() => window.stageDebug?.advanceDialogue?.())
        await advanceFrames(page, 12)
      }
    }
    assert.ok(registry, 'the registry line closes the defeat dialogue')
    await capture('weapon-get-line')
    assert.equal(registry.dialogue.speakerId, 'director_iona')
    assert.equal(registry.dialogue.lineIndex, registry.dialogue.lineCount - 1)
    assert.equal(registry.dialogue.text, authored('pyro_maw_weapon_get', 0, callsign))
    const contract = registry.story.weaponGetCard
    assert.deepEqual(
      { weaponId: contract.weaponId, weaponName: contract.weaponName, sourceStageId: contract.sourceStageId },
      { weaponId: 'FlameSerpent', weaponName: 'Flame Serpent', sourceStageId: 'pyro_maw' }
    )
    assert.equal(contract.registry.text, registry.dialogue.text)
    evidence.weaponGet = { dialogue: registry.dialogue, contract }
    await page.evaluate(() => window.stageDebug?.skipDialogue?.())
    const victory = await waitForState(page, (state) => state.victory?.modalOpen === true, 8000)
    for (const id of ['pyro_maw_defeat', 'pyro_maw_weapon_get']) assert.ok(victory.save.storyFlags.includes(id), id)

    // game_over: the first game over on this save shows OMEGA's line over the Continue row, the second Iona's.
    await page.evaluate(() => {
      window.__phaserGame.scene.stop('Game')
      window.__phaserGame.scene.start('GameOver', { stageId: 'pyro_maw' })
    })
    // The screen stays up for its five-second countdown (it used to continue at once; see GameOverScene.update).
    const first = await waitForState(page, (state) => state.scene === 'GameOver' && Boolean(state.gameOver?.line), 8000)
    await capture('game-over-1')
    assert.ok(first.gameOver.remainingMs > 1000, `the countdown is running (${first.gameOver.remainingMs} ms left)`)
    assert.equal(first.gameOver.line.speakerId, 'omega_core')
    assert.equal(first.gameOver.line.index, 0)
    assert.equal(first.gameOver.line.text, authored('game_over', 0))
    assert.ok(first.gameOver.line.bottom < first.gameOver.continueRowTop, 'the line sits over the Continue row')
    assert.ok(first.gameOver.continueRowTop + 60 <= 252, 'the rows and the countdown stay inside the frame')
    await page.evaluate(() => window.__phaserGame.scene.getScene('GameOver').scene.restart({ stageId: 'pyro_maw' }))
    const second = await waitForState(page, (state) => state.scene === 'GameOver' && state.gameOver?.line?.index === 1, 8000)
    await capture('game-over-2')
    assert.equal(second.gameOver.line.speakerId, 'director_iona')
    assert.equal(second.gameOver.line.text, authored('game_over', 1, callsign))
    assert.ok(second.gameOver.line.bottom < second.gameOver.continueRowTop)
    assert.ok(second.save.storyFlags.includes('game_over'))
    evidence.gameOver = [first.gameOver, second.gameOver]

    // epilogue_secret: with all eight capsule caches, a ninth card (the Drill Hangar), then Iona's line opens the close.
    await page.evaluate((save) => localStorage.setItem('save.v1', JSON.stringify(save)), {
      weaponsUnlocked: ['FlameSerpent', 'HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob', 'AeroDarts', 'FrostShatter'],
      clearedBosses: ROBOT_MASTERS, tutorialCleared: true, gameCompleted: false, heartTanks: 8, subTanks: 4,
      collectedChecks: ROBOT_MASTERS.map((stageId) => `${stageId}:capsule`),
      progressionWorld: { progressionMode: 'classic' }
    })
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'f')
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'omega_fortress')
    await skipStageIntro(page, { readState, advanceFrames })
    await waitForState(page, (state) => state.newPlayer?.locomotion?.grounded === true)
    await page.evaluate(() => window.bossDebug?.forceVictory?.())
    await waitForState(page, (state) => state.scene === 'Game' && state.victory?.modalOpen === true, 10000)
    await tapKey(page, 'Enter')
    const cards = await waitForState(page, (state) => state.scene === 'EndingScene' && state.ending?.phase === 'cards', 8000)
    assert.equal(cards.ending.pageCount, 9, 'eight district cards and the Drill Hangar')
    for (let index = 0; index < 8; index += 1) await page.evaluate(() => window.narrativeDebug?.advance?.())
    const secret = await waitForState(page, (state) => state.ending?.phase === 'cards' && state.ending.page === 8)
    assert.equal(secret.ending.card, 'tutorial_sentinel')
    await capture('secret-card')
    await page.evaluate(() => window.narrativeDebug?.advance?.())
    const close = await waitForState(page, (state) => state.ending?.phase === 'close')
    assert.equal(close.ending.pageCount, 4, "Iona's secret line opens the close")
    await capture('secret-close')
    assert.ok(close.save.storyFlags.includes('epilogue_secret'))
    evidence.secret = { cards: cards.ending, card: secret.ending, close: close.ending }
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    assert.deepEqual(errors, [])
    return evidence
  } finally { await browser.close() }
}
