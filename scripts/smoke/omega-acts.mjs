// Smoke 61-omega-three-acts (EVAL-P6-011 / EVAL-P2-007, prompt 12 part 12e): the Central Core in three acts, story on so
// the radio and the finale lines reach the lane. The campaign is the eight wardens cleared. Steps, each with captures:
// (a) act 1: one capture per screen for the contact sheet (`act1-00.png` to `act1-09.png`), crossing checkpoint 2 (the
//     OMEGA radio: Iona, then OMEGA) on the way; then real input off the flood run over the act-1 checkpoint (the archive);
// (b) act 2: the hub (eight doors by element, the exit sealed); door 1 by real input (Up) re-enters Game as the Fire
//     rematch in the Core's room at maxHp x0.7; `bossDebug.damage(999)`; back at its door with two refills; door 2 the
//     same, and the second clear is a checkpoint (the save holds two clears); a pause-menu save, a page reload, a load:
//     `rematchCleared` has length 2 and the hub shows two doors CLEAR; a game over there on Normal keeps the run at
//     the archive, and Continue starts there with the two clears;
// (c) the other six doors (door entry by the adapter, the gate crossing by `stageDebug`), a time per rematch; the exit opens;
// (d) act 3: real input through the exit over checkpoint 4 (the save has act 3 and eight clears), one capture per screen
//     (`act3-00.png` to `act3-03.png`), then the Core's door and room;
// (e) the finale: damage through the Core's three transitions, each `finale_phase` line seen; the Core falls, the defeat
//     dialogue, the victory card, and the ending's cards.
// Placement between steps is test-side (warps), as in the route smokes; the timings are this run's, not play times.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const WARDENS = ['pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin']
const WEAPONS = ['FlameSerpent', 'HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob', 'AeroDarts', 'FrostShatter']
/** One hero position per act-1 screen (on what it stands on; the climb and the shaft from inside). */
const ACT1_SHOTS = [[120, 214], [560, 214], [1052, 182], [1700, 214], [1880, 214], [2616, -90], [2952, 78], [3490, 214], [3996, 214], [4144, 166]]
const ACT3_SHOTS = [[5720, 214], [6150, 214], [6600, 214], [6940, 214]]

export async function runOmegaActsScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 448, height: 252 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const omega = () => page.evaluate(() => window.__phaserGame?.scene?.getScene?.('Game')?.data?.get?.('omegaActs')?.getDebugState?.() ?? null)
  const savedRun = () => page.evaluate(() => JSON.parse(localStorage.getItem('save.v1') ?? '{}').activeRun ?? null)
  const capture = async (label) => {
    await page.locator('canvas').screenshot({ path: path.join(dir, `${label}.png`) })
    const state = await readState(page)
    fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify({ omega: await omega(), player: state.player, stageRuntime: state.stageRuntime, bossState: state.bossState, ticker: state.ticker, camera: state.camera }, null, 2))
    return state
  }
  const until = async (check, label, maxSteps = 300) => {
    for (let step = 0; step < maxSteps; step += 1) {
      const value = await check()
      if (value) return value
      await advanceFrames(page, 4)
    }
    throw new Error(`timed out: ${label}`)
  }
  const place = async (x, y) => {
    await page.evaluate(({ x, y }) => {
      const hero = window.__phaserGame.scene.getScene('Game').player
      hero.setPosition(x, y)
      hero.body?.reset?.(x, y)
      hero.body?.setVelocity?.(0, 0)
    }, { x, y })
    await advanceFrames(page, 3)
  }
  const shield = (ms = 600000) => page.evaluate((value) => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(value), ms)
  const heroX = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').player.x)
  const walkRightTo = async (targetX, maxFrames = 600) => {
    await page.keyboard.down('ArrowRight')
    try {
      for (let frames = 0; frames < maxFrames && (await heroX()) < targetX; frames += 4) await advanceFrames(page, 4)
    } finally {
      await page.keyboard.up('ArrowRight')
    }
    return heroX()
  }
  const settle = async (label) => {
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) return state
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    throw new Error(`never settled: ${label}`)
  }
  const evidence = { timingMs: {}, rematches: [] }
  const startedAt = Date.now()
  const mark = (label) => { evidence.timingMs[label] = Date.now() - startedAt }

  /** In a rematch scene: into the Core's room, the fight, `damage(999)`, and back at the door. Returns the time. */
  const fightRematch = async (door, label) => {
    const began = Date.now()
    const entered = await until(async () => { const state = await omega(); return state?.mode === 'rematch' && state.door === door ? state : null }, `rematch ${door}`)
    await shield()
    await page.evaluate(() => window.stageDebug?.crossBossGate?.())
    await until(async () => (await readState(page)).stageRuntime?.bossEncounterActive === true, `encounter ${door}`)
    await page.evaluate(() => window.bossDebug?.unlockIntro?.())
    await advanceFrames(page, 30)
    const fight = await readState(page)
    const boss = await page.evaluate(() => {
      const game = window.__phaserGame.scene.getScene('Game')
      return { id: game.bossController?.blueprint?.id, baseMaxHp: game.bossController?.blueprint?.baseStats?.maxHp, phaseIndex: game.bossController?.phaseIndex ?? null }
    })
    assert.equal(boss.id, entered.doors[door].bossId, `door ${door} fights its warden`)
    assert.equal(fight.bossState?.hp?.max, Math.round(boss.baseMaxHp * 0.7), `${boss.id} at maxHp x0.7`)
    assert.equal(fight.stageRuntime.stageId, 'omega_fortress')
    assert.ok(fight.stageRuntime.bossRoom?.x >= 7168, 'the fight is in the Core room')
    if (label) await capture(label)
    for (let hit = 0; hit < 20 && Number((await readState(page)).bossState?.hp?.current ?? 1) > 0; hit += 1) {
      await page.evaluate(() => window.bossDebug?.damage?.(999))
      await advanceFrames(page, 12)
    }
    const back = await until(async () => {
      await page.evaluate(() => window.stageDebug?.skipDialogue?.())
      const state = await omega()
      return state?.mode === 'return' && state.door === door ? state : null
    }, `return ${door}`)
    const seconds = (Date.now() - began) / 1000
    evidence.rematches.push({ door, bossId: boss.id, maxHp: fight.bossState.hp.max, seconds, cleared: back.cleared.length, checkpointSaved: back.checkpointSaved })
    return back
  }

  await page.addInitScript((save) => { if (!localStorage.getItem('save.v1')) localStorage.setItem('save.v1', JSON.stringify(save)) }, {
    weaponsUnlocked: WEAPONS, clearedBosses: WARDENS, tutorialCleared: true, gameCompleted: false, heartTanks: 8, subTanks: 4,
    progressionWorld: { progressionMode: 'classic' }
  })
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`, { timeout: 90000 })
    await waitForState(page, (state) => state.scene === 'StageSelect', 30000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'omega_fortress' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'omega_fortress', 30000, 'central core loaded')
    await settle('act 1 start')
    let state = await capture('act1-start')
    assert.equal(state.stageRuntime.checkpointIndex, 0)
    assert.equal((await omega())?.act, 1)
    mark('loaded')

    // (a) Act 1: the contact sheet, crossing checkpoint 2 (the radio) on the way; real input over the act-1 checkpoint.
    await shield()
    for (const [index, [x, y]] of ACT1_SHOTS.entries()) {
      await place(x, y)
      await advanceFrames(page, 20)
      await capture(`act1-${String(index).padStart(2, '0')}`)
      if (index === 4) {
        state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 6000, 'checkpoint 2')
        const flags = await until(async () => { const story = (await readState(page)).story; return story?.flags?.includes('omega_fortress_radio') ? story.flags : null }, 'the OMEGA radio at checkpoint 2', 60)
        evidence.radio = flags.includes('omega_fortress_radio')
      }
    }
    await place(4420, 214)
    await shield()
    const crossedAt = await walkRightTo(4530)
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2, 6000, 'the act-1 checkpoint')
    assert.ok(crossedAt >= 4496, `walked over the archive door (${crossedAt})`)
    const act1Run = await savedRun()
    assert.equal(act1Run?.checkpointId, 'omega_archive')
    assert.equal(act1Run?.omegaAct, 2)
    assert.deepEqual(act1Run?.rematchCleared, [])
    mark('act1')

    // (b) Act 2: the hub, door 1 by real input, door 2, the checkpoint, save, reload, load.
    let hub = await until(async () => { const value = await omega(); return value?.act === 2 ? value : null }, 'act 2')
    assert.equal(hub.doors.length, 8)
    assert.deepEqual(hub.doors.map((door) => door.label), ['FIRE', 'WATER', 'LIGHTNING', 'EARTH', 'METAL', 'TOXIC', 'WIND', 'ICE'])
    assert.equal(hub.gateClosed, true, 'the exit is sealed')
    // OMEGA's act lines (prompt 07 7.6 item 14 "OMEGA acts"; EVAL-P6-011 open item): the archive door, once,
    // on the radio lane; wait for its own turn in the queue (other items are already ahead of it) so the
    // capture shows the line itself, not whatever the lane happens to be on.
    assert.ok((await readState(page)).story?.flags?.includes('omega_fortress_act_two'), 'the archive-door line fired entering act 2')
    const act2Line = await until(
      async () => { const next = await readState(page); return next.ticker?.text?.includes('Eight originals are free') ? next : null },
      'the archive-door line reaches the ticker',
      450
    )
    evidence.omegaActTwoLine = act2Line.ticker
    await capture('act2-omega-line')
    await place(4760, 214)
    await advanceFrames(page, 20)
    await capture('act2-hub')
    const act2StartedAt = Date.now()
    await place(hub.doors[0].x, 214)
    await until(async () => (await readState(page)).newPlayer?.locomotion?.grounded === true, 'grounded at door 1', 60)
    await tapKey(page, 'ArrowUp', 3)
    hub = await fightRematch(0, 'rematch-fire')
    assert.deepEqual(hub.cleared, ['pyro_maw'])
    assert.deepEqual(hub.refills.sort(), ['energy', 'hp'], 'a large HP and a full weapon-energy refill by the door')
    assert.equal(hub.checkpointSaved, false, 'one clear is not a checkpoint')
    await advanceFrames(page, 10)
    await capture('act2-return-1')
    await page.evaluate(() => window.__phaserGame.scene.getScene('Game').data.get('omegaActs').enterDoor(1))
    hub = await fightRematch(1)
    assert.deepEqual(hub.cleared, ['pyro_maw', 'tide_reaver'])
    assert.equal(hub.checkpointSaved, true, 'the second clear is a checkpoint')
    assert.deepEqual((await savedRun())?.rematchCleared, ['pyro_maw', 'tide_reaver'])
    await page.evaluate(() => window.__phaserGame.scene.getScene('Game').onSystemMenuAction('save_game'))
    await advanceFrames(page, 10)
    await page.reload({ timeout: 90000 })
    await waitForState(page, (next) => next.scene === 'StageSelect', 30000, 'reloaded')
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'omega_fortress', bossId: 'omega_core', loadFromSave: true }))
    await waitForState(page, (next) => next.scene === 'Game' && next.stageRuntime?.stageId === 'omega_fortress', 30000, 'loaded from the save')
    await settle('after reload')
    const reloadedRun = await savedRun()
    assert.equal(reloadedRun?.rematchCleared?.length, 2, 'rematchCleared survives the reload')
    hub = await omega()
    assert.equal(hub.act, 2)
    assert.deepEqual(hub.doors.filter((door) => door.cleared).map((door) => door.label), ['FIRE', 'WATER'], 'the hub shows the two clears')
    assert.equal(hub.gateClosed, true)
    await place(4700, 214)
    await advanceFrames(page, 20)
    await capture('act2-hub-reloaded')
    mark('act2-two-doors')

    // (b2) A game over in the archive on Normal, then Continue: the two clears survive (Veteran's rule, where the run
    // is not kept, is the unit test `keepRunOnGameOver`).
    await page.evaluate(() => { window.stageDebug?.setLives?.(0); window.stageDebug?.forcePlayerDeath?.() })
    await waitForState(page, (next) => next.scene === 'GameOver', 30000, 'game over in the archive')
    const kept = await savedRun()
    assert.equal(kept?.checkpointId, 'omega_archive', 'the game over keeps the run at the archive')
    assert.deepEqual(kept?.rematchCleared, ['pyro_maw', 'tide_reaver'])
    await page.locator('canvas').screenshot({ path: path.join(dir, 'act2-game-over.png') })
    await tapKey(page, 'Enter')
    await waitForState(page, (next) => next.scene === 'Game' && next.stageRuntime?.stageId === 'omega_fortress', 30000, 'continued')
    await settle('after the continue')
    hub = await omega()
    assert.equal(hub.act, 2)
    assert.deepEqual(hub.cleared, ['pyro_maw', 'tide_reaver'], 'the continue starts at the archive with the two clears')
    assert.equal((await readState(page)).stageRuntime.checkpointIndex, 2)
    evidence.continueAfterGameOver = { checkpointId: kept.checkpointId, cleared: hub.cleared }
    await capture('act2-continued')
    mark('act2-continue')

    // (c) The other six doors, in reverse order (any order opens).
    for (const door of [7, 6, 5, 4, 3, 2]) {
      await page.evaluate((index) => window.__phaserGame.scene.getScene('Game').data.get('omegaActs').enterDoor(index), door)
      hub = await fightRematch(door)
    }
    assert.equal(hub.cleared.length, 8)
    assert.equal(hub.exitOpen, true)
    assert.equal(hub.gateClosed, false, 'the exit opens after the eighth')
    await place(5160, 214)
    await advanceFrames(page, 20)
    await capture('act2-exit-open')
    evidence.act2Seconds = (Date.now() - act2StartedAt) / 1000
    mark('act2')

    // (d) Act 3: through the exit on real input, the contact sheet, the Core's door.
    await place(5300, 214)
    await shield()
    await walkRightTo(5420)
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 3, 6000, 'the act-3 checkpoint')
    const act3Run = await savedRun()
    assert.equal(act3Run?.omegaAct, 3)
    assert.equal(act3Run?.rematchCleared?.length, 8)
    assert.equal((await omega()).act, 3)
    // OMEGA's act lines: the Core's approach, once, on the radio lane.
    assert.ok((await readState(page)).story?.flags?.includes('omega_fortress_act_three'), 'the Core-approach line fired entering act 3')
    const act3Line = await until(
      async () => { const next = await readState(page); return next.ticker?.text?.includes('Eight copies, eight losses') ? next : null },
      'the Core-approach line reaches the ticker',
      450
    )
    evidence.omegaActThreeLine = act3Line.ticker
    await capture('act3-omega-line')
    for (const [index, [x, y]] of ACT3_SHOTS.entries()) {
      await place(x, y)
      await advanceFrames(page, 20)
      await capture(`act3-${String(index).padStart(2, '0')}`)
    }
    // Real input over checkpoint 5; a knockback on the way (the shield blocks damage, not knockback) walks it again.
    evidence.coreDoorWalks = []
    for (let attempt = 0; attempt < 3 && !(await readState(page)).stageRuntime?.bossEncounterActive; attempt += 1) {
      await place(7020, 214)
      await shield()
      evidence.coreDoorWalks.push(await walkRightTo(7120))
      await advanceFrames(page, 8)
    }
    state = await capture('core-door')
    evidence.coreDoor = { x: state.player?.x, checkpointIndex: state.stageRuntime?.checkpointIndex, active: state.stageRuntime?.bossEncounterActive, dialogue: state.dialogue?.active ?? null }
    await until(async () => (await readState(page)).stageRuntime?.bossRoom?.cameraLocked === true, 'the Core room')
    mark('act3')

    // (e) The finale: the three transitions and their lines, the Core falls, the ending.
    await until(async () => {
      await page.evaluate(() => window.stageDebug?.skipDialogue?.())
      const next = await readState(page)
      return next.bossState?.hp?.max > 0 && !next.dialogue?.active ? next : null
    }, 'the Core fight')
    await page.evaluate(() => window.bossDebug?.unlockIntro?.())
    await advanceFrames(page, 30)
    state = await capture('core-room')
    const coreMax = state.bossState.hp.max
    assert.equal(state.bossState.runtime?.phaseIndex ?? 0, 0)
    for (const [phase, ratio] of [[1, 0.6], [2, 0.28], [3, 0.18]]) {
      for (let hit = 0; hit < 40 && Number((await readState(page)).bossState?.hp?.current ?? 0) > coreMax * ratio; hit += 1) {
        await page.evaluate(() => window.bossDebug?.damage?.(4))
        await advanceFrames(page, 16)
      }
      await until(async () => { const next = await readState(page); return next.story?.flags?.includes(`finale_phase_${phase}`) ? next : null }, `finale_phase_${phase}`, 120)
      await advanceFrames(page, 20)
      if (phase === 3) await capture('finale')
    }
    evidence.finaleLines = ['finale_phase_1', 'finale_phase_2', 'finale_phase_3']
    for (let hit = 0; hit < 20 && Number((await readState(page)).bossState?.hp?.current ?? 1) > 0; hit += 1) {
      await page.evaluate(() => window.bossDebug?.damage?.(999))
      await advanceFrames(page, 12)
    }
    await until(async () => {
      await page.evaluate(() => window.stageDebug?.skipDialogue?.())
      return (await readState(page)).victory?.modalOpen === true
    }, 'the victory card')
    await tapKey(page, 'Enter')
    const ending = await waitForState(page, (next) => next.scene === 'EndingScene' && next.ending?.phase === 'cards', 15000, 'the ending')
    await capture('ending')
    evidence.ending = { phase: ending.ending.phase, pageCount: ending.ending.pageCount }
    mark('ending')

    assert.deepEqual(errors, [], 'no page errors')
    return { artifacts: dir, evidence }
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
}
