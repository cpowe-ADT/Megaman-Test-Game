// Smoke 45-beats-flow (part 12i, EVAL-P8-004, extended part 13g EVAL-P13-012/014; prompt 08 phase 8.3 with prompt 04
// phase 4.2). Real time through Stage Select's own confirm and the pre-stage boss card (`?bossIntro=on`), mid-type
// captured; then stepped frames: the loop sleeps and window.stepFrames(1, { manageLoop: false }) drives every frame,
// keys included. One stage (Pyro Maw, story on, briefing and boss intro seen) from the intro card (skipped with
// Enter) through READY (three blinks, 1.2 s, then control), the low-HP pulse and its Reduced Flashing switch, a
// heart tank and a death with the 600 ms respawn READY, the boss door and WARNING, the name card, the bar fill, the
// defeat, the weapon-get card, the stage results (their hold runs the victory return) and Stage Select, where the
// return debrief plays once before the eighth-clear milestone; then the ending's CAMPAIGN RECORD card, the credits
// pace and the OMEGA RELAY title card. Each phase is asserted in render_game_to_text and captured (canvas at 2x, 896x504).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const WARDENS_CLEARED = ['tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin']
const SAVE = {
  tutorialCleared: true,
  clearedBosses: WARDENS_CLEARED,
  weaponsUnlocked: ['HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob', 'AeroDarts', 'FrostShatter'],
  heartTanks: 8,
  subTanks: 4,
  upgradeUnlocks: ['armor_helmet', 'armor_arms', 'armor_body', 'armor_legs', 'chip_quick_charge', 'chip_speedster', 'chip_weapon_plus', 'chip_buster_plus'],
  storyFlags: ['pyro_maw_briefing', 'pyro_maw_radio', 'pyro_maw_intro', 'pyro_maw_capsule', 'pyro_maw_phase_two'],
  stats: { playTimeMs: 3 * 3600_000 + 12 * 60_000, deaths: 3, clearTimeMsByStage: {}, secretsFoundByStage: {} },
  difficulty: 'normal',
  progressionWorld: { progressionMode: 'classic' },
  activeRun: null
}
const FRAME_MS = 1000 / 60

function installHelpers() {
  const game = window.__phaserGame
  const scene = () => game.scene.getScene('Game')
  const step = (frames = 1, { skipDialogue = false } = {}) => {
    for (let index = 0; index < frames; index += 1) {
      if (skipDialogue && scene()?.dialogueOverlay?.isActive?.()) scene().dialogueOverlay.skip()
      window.stepFrames(1, { manageLoop: false })
    }
  }
  const state = () => JSON.parse(window.render_game_to_text())
  const intro = () => scene().storyDirector.getDebugState().intro
  window.__b45 = { game, scene, step, state, intro }
}

export async function runBeatsFlowScenario(name, { outputDir, storyUrl, readState, waitForState }) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 896, height: 504 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const evidence = { captures: [] }
  const capture = async (label, state) => {
    await page.locator('canvas').screenshot({ path: path.join(dir, `${label}.png`) })
    evidence.captures.push(`${label}.png`)
    if (state) fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify(state, null, 2))
  }
  const pressStepped = (key) => page.evaluate(() => window.__b45.step(2)).then(() => page.keyboard.down(key))
    .then(() => page.evaluate(() => window.__b45.step(2))).then(() => page.keyboard.up(key)).then(() => page.evaluate(() => window.__b45.step(2)))
  await page.addInitScript((save) => {
    if (!localStorage.getItem('save.v1')) localStorage.setItem('save.v1', JSON.stringify(save))
    if (!localStorage.getItem('settings.v1')) localStorage.setItem('settings.v1', JSON.stringify({ storyReplay: false, reducedFlashing: false }))
  }, SAVE)
  try {
    await page.goto(`${storyUrl}&bossIntro=on&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000, 'Stage Select')
    await page.evaluate(installHelpers)

    // 0. Entering the stage for real, through Stage Select's own confirm, with the pre-stage boss card on
    // (part 13g, EVAL-P13-012; `?bossIntro=on` is a smoke's explicit ask, since automation skips it by default).
    await page.evaluate(() => {
      const select = window.__b45.game.scene.getScenes(true)[0]
      select.setSelection(select.stages.findIndex((entry) => entry.id === 'pyro_maw'))
      select.confirmSelection()
    })
    const introStart = await waitForState(page, (state) => state.scene === 'BossIntro', 10000, 'the pre-stage boss card')
    assert.equal(introStart.bossIntro?.phase, 'active')
    assert.equal(introStart.bossIntro?.name, 'PYRO MAW')
    assert.equal(introStart.bossIntro?.charactersTotal, 'PYRO MAW'.length)
    let introMidType = null
    for (let attempt = 0; attempt < 30 && !introMidType; attempt += 1) {
      const snapshot = await page.evaluate(() => window.__b45.state())
      const beat = snapshot.bossIntro
      if (beat?.phase === 'active' && beat.visibleCharacters > 0 && beat.visibleCharacters < beat.charactersTotal) introMidType = snapshot
      else await page.waitForTimeout(10)
    }
    assert.ok(introMidType, 'caught the boss card mid-type (some, not all, of the name shown)')
    await capture('boss-intro-card', introMidType)
    await page.keyboard.press('Enter')
    await waitForState(page, (state) => state.scene === 'Game', 10000, 'the stage, after the card')

    // 1. The intro card, skipped by Enter long before its 900 ms are up.
    const card = await waitForState(page, (state) => state.scene === 'Game' && state.stageIntro?.phase === 'card', 20000, 'the stage card')
    await page.evaluate(() => window.__b45.game.loop.sleep())
    await capture('intro-card', card)
    await pressStepped('Enter')
    const afterSkip = await page.evaluate(() => window.__b45.intro())
    assert.equal(afterSkip.phase, 'ready', 'Enter ends the card; the briefing is seen, so READY follows')
    assert.equal(afterSkip.readyVisible, true, 'READY is lit on its first blink')
    await capture('ready', await readState(page))

    // 2. READY: three blinks over 1.2 s with the sting, then control.
    const ready = await page.evaluate(() => {
      const { step, intro, scene } = window.__b45
      const samples = [intro()]
      const elapsedBefore = 1200 - samples[0].readyRemainingMs
      for (let frame = 0; frame < 120 && intro().phase === 'ready'; frame += 1) {
        step(1)
        samples.push(intro())
      }
      let blinks = 0
      samples.forEach((sample, index) => { if (sample.readyVisible && !(samples[index - 1]?.readyVisible)) blinks += 1 })
      const frames = samples.filter((sample) => sample.phase === 'ready').length
      return { frames, totalMs: Math.round(elapsedBefore + frames * (1000 / 60)), blinks, end: intro(), blocking: scene().storyDirector.isBlocking(), paused: scene().physics.world.isPaused }
    })
    evidence.ready = ready
    assert.equal(ready.blinks, 3, 'READY blinks three times')
    assert.ok(Math.abs(ready.totalMs - 1200) <= 40, `READY lasts about 1.2 s (${ready.totalMs} ms)`)
    assert.equal(ready.end.phase, 'done')
    assert.equal(ready.blocking, false, 'control returns after READY')
    assert.equal(ready.paused, false)

    // 3. Low HP: at 25% or under the bar pulses and beeps every 1.5 s; Reduced Flashing turns both off.
    const lowHp = await page.evaluate(() => {
      const { step, scene } = window.__b45
      const s = scene()
      s.newPlayerRuntime?.resetForRespawn?.(600000)
      step(40)
      s.playerHp = Math.floor(s.playerMaxHp * 0.2)
      s.player.data?.set?.('hp', s.playerHp)
      s.hud.updatePlayerHp(s.playerHp, s.playerMaxHp)
      let dimmest = 1
      const beeps = []
      for (let frame = 0; frame < 200; frame += 1) {
        step(1)
        const low = s.hud.getLowHpState()
        dimmest = Math.min(dimmest, low.alpha)
        if (beeps.length === 0 || beeps[beeps.length - 1].beeps !== low.beeps) beeps.push({ frame, beeps: low.beeps })
      }
      for (let frame = 0; frame < 45 && s.hud.getLowHpState().alpha > 0.5; frame += 1) step(1)
      return { hp: s.playerHp, max: s.playerMaxHp, dimmest, beeps, now: s.hud.getLowHpState() }
    })
    evidence.lowHp = lowHp
    assert.ok(lowHp.hp > 0 && lowHp.hp / lowHp.max <= 0.25, `hero at ${lowHp.hp}/${lowHp.max}`)
    assert.equal(lowHp.now.active, true)
    assert.ok(lowHp.dimmest < 0.5, 'the bar pulses')
    assert.ok(lowHp.now.beeps >= 3, `a beep every 1.5 s over 200 frames (${lowHp.now.beeps})`)
    await capture('low-hp', await readState(page))
    const reduced = await page.evaluate(() => {
      const { step, scene } = window.__b45
      const s = scene()
      const key = 'settings.v1'
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) ?? '{}'), reducedFlashing: true }))
      const before = s.hud.getLowHpState().beeps
      step(120)
      const state = s.hud.getLowHpState()
      localStorage.setItem(key, JSON.stringify({ ...JSON.parse(localStorage.getItem(key) ?? '{}'), reducedFlashing: false }))
      s.playerHp = s.playerMaxHp
      s.player.data?.set?.('hp', s.playerHp)
      s.hud.updatePlayerHp(s.playerHp, s.playerMaxHp)
      step(2)
      return { state, beepsDuring: state.beeps - before, healed: s.hud.getLowHpState() }
    })
    evidence.reducedFlashing = reduced
    assert.equal(reduced.state.active, false, 'Reduced Flashing: no pulse')
    assert.equal(reduced.state.alpha, 1)
    assert.equal(reduced.beepsDuring, 0, 'Reduced Flashing: no beep')
    assert.equal(reduced.healed.active, false)

    // 4. A secret and a death: the heart tank's check, then the respawn's 600 ms READY without the card or a lock.
    const respawn = await page.evaluate(() => {
      const { step, scene, intro } = window.__b45
      const s = scene()
      s.collectProgressionLocation('pyro_maw:heart_tank')
      step(2)
      s.killPlayer('debug') // armor halves forcePlayerDeath's hit on this save
      let lit = null
      for (let frame = 0; frame < 160 && !lit; frame += 1) {
        step(1)
        const now = intro()
        if (now.respawnReadyMs > 0 && now.readyVisible) lit = { frame, ...now, blocking: s.storyDirector.isBlocking() }
      }
      return lit
    })
    evidence.respawnReady = respawn
    assert.ok(respawn, 'a respawn READY blinks')
    assert.ok(respawn.respawnReadyMs <= 600)
    assert.equal(respawn.phase, 'done', 'no card on a respawn')
    assert.equal(respawn.blocking, false, 'the respawn READY does not hold control')
    await capture('respawn-ready', await readState(page))

    // 5. The boss door, WARNING, the name card and the bar fill (12f's beats, now in render_game_to_text().bossIntro).
    const warning = await page.evaluate(() => {
      const { step, scene, state } = window.__b45
      const s = scene()
      step(60)
      window.stageDebug.crossBossGate()
      window.stageDebug.activateBossRoom()
      const room = s.activeBossRoom
      if (room) window.stageDebug.setPlayerX(room.x + 72)
      s.newPlayerRuntime?.resetForRespawn?.(600000)
      step(3)
      return state()
    })
    assert.equal(warning.bossIntro?.beat, 'warning')
    assert.equal(warning.bossIntro?.bandVisible, true)
    assert.equal(warning.stageRuntime.bossGateLocked, true, 'the door is shut behind the hero')
    assert.equal(warning.stageRuntime.bossRoom?.cameraLocked, true)
    await capture('warning', warning)
    const bossCard = await page.evaluate(() => {
      const { step, state } = window.__b45
      for (let frame = 0; frame < 150 && state().bossIntro?.beat === 'warning'; frame += 1) step(1)
      step(12)
      return state()
    })
    assert.equal(bossCard.bossIntro?.beat, 'card')
    await capture('boss-card', bossCard)
    const barFill = await page.evaluate(() => {
      const { step, state } = window.__b45
      for (let frame = 0; frame < 1500 && state().bossIntro?.beat !== 'bar_fill'; frame += 1) step(1, { skipDialogue: true })
      step(27)
      return state()
    })
    assert.equal(barFill.bossIntro?.beat, 'bar_fill')
    assert.ok(barFill.bossIntro.bar.fraction > 0 && barFill.bossIntro.bar.fraction < 1, `the bar is filling (${barFill.bossIntro.bar.fraction})`)
    await capture('bar-fill', barFill)
    const fight = await page.evaluate(() => {
      const { step, state } = window.__b45
      for (let frame = 0; frame < 120 && state().bossIntro?.beat !== 'fight'; frame += 1) step(1)
      return state()
    })
    assert.equal(fight.bossIntro?.beat, 'fight')

    // 6. The defeat, its dialogue (no registry line now), then the weapon-get card.
    const dialogue = await page.evaluate(() => {
      const { step, state } = window.__b45
      window.bossDebug.damage(999)
      for (let frame = 0; frame < 400 && !state().dialogue?.active && !state().victory?.modalOpen; frame += 1) step(1)
      step(20)
      return state()
    })
    assert.equal(dialogue.dialogue?.active, true, 'the defeat dialogue plays')
    assert.equal(dialogue.dialogue.sequenceId, 'pyro_maw_defeat')
    await capture('defeat', dialogue)
    const defeat = await page.evaluate(() => {
      const { step, state, scene } = window.__b45
      const sequences = new Set()
      for (let frame = 0; frame < 900 && !state().victory?.modalOpen; frame += 1) {
        const now = state()
        if (now.dialogue?.active) sequences.add(now.dialogue.sequenceId)
        if (frame % 12 === 0) window.stageDebug.advanceDialogue()
        step(1)
      }
      step(2)
      return { sequences: [...sequences], card: state(), weapons: [...(scene().progressionSave?.weaponsUnlocked ?? [])] }
    })
    assert.ok(!defeat.sequences.includes('pyro_maw_weapon_get'), "Iona's registry line has moved to the card")
    assert.ok(defeat.weapons.includes('FlameSerpent'), 'the claim granted the weapon before the card')
    const weaponGet = defeat.card
    assert.equal(weaponGet.victory.modalOpen, true)
    assert.equal(weaponGet.victory.card, 'weapon_get')
    const view = weaponGet.victory.weaponGet
    assert.equal(view.kind, 'weapon')
    assert.equal(view.name, 'FLAME SERPENT')
    assert.equal(view.energy, 28)
    assert.equal(view.switchHint, 'Q / E TO SWITCH')
    assert.match(view.tutorial ?? '', /flame/i, "the roster's tutorial line")
    assert.match(view.registry?.speakerName ?? '', /iona/i, "Iona's registry line")
    assert.ok(view.registry?.text)
    assert.equal(weaponGet.victory.portraitFrame, 'wren', "WREN's portrait")
    assert.match(weaponGet.victory.iconFrame ?? '', /^hud_icons_v1\//, 'the weapon icon')
    assert.ok(weaponGet.save.storyFlags.includes('pyro_maw_weapon_get'))
    await capture('weapon-get', weaponGet)

    // 7. Enter: the weapon demo (13d, EVAL-P13-013) -- the hero fires Flame Serpent at a dummy, plain then
    // charged (Inferno Coil), while the name and a one-line use type out.
    await pressStepped('Enter')
    const demo = await page.evaluate(() => window.__b45.state())
    assert.equal(demo.victory.card, 'weapon_demo')
    assert.equal(demo.victory.weaponDemo?.weaponId, 'FlameSerpent')
    assert.equal(demo.victory.weaponDemo?.chargedMoveName, 'Inferno Coil')
    assert.equal(demo.weaponDemo?.weaponId, 'FlameSerpent', 'also at the top level (render_game_to_text().weaponDemo)')
    await capture('weapon-demo', demo)

    // 8. Enter skips the demo, reaching the results (time, secrets, lives used, difficulty); their hold runs the victory return.
    await pressStepped('Enter')
    const results = await page.evaluate(() => window.__b45.state())
    assert.equal(results.victory.card, 'results')
    assert.deepEqual(results.victory.cards, ['weapon_get', 'weapon_demo', 'results'])
    const figures = results.victory.results
    assert.equal(figures.stageId, 'pyro_maw')
    assert.ok(figures.timeMs > 0 && /^\d\d:\d\d\.\d\d$/.test(figures.timeLabel), figures.timeLabel)
    assert.deepEqual([figures.secretsFound, figures.secretsTotal, figures.livesUsed, figures.difficulty], [1, 2, 1, 'NORMAL'])
    await capture('results', results)
    const hold = await page.evaluate(() => {
      const { step, scene } = window.__b45
      let frames = 0
      while (frames < 400 && scene()?.victoryModal?.isOpen?.()) { step(1); frames += 1 }
      window.__b45.game.loop.wake()
      return frames
    })
    evidence.resultsHoldFrames = hold
    assert.ok(Math.abs(hold * FRAME_MS - 4000) <= 120, `the results hold about 4 s (${hold} frames)`)
    const select = await waitForState(page, (state) => state.scene === 'StageSelect', 15000, 'the Stage Select return')
    assert.ok(select.save.storyFlags.includes('pyro_maw_defeat'))

    // 7b. The return debrief (part 13g, EVAL-P13-014): Iona and WREN, before the eighth-clear milestone; skippable,
    // and played once (its own seen flag survives the capture below, so a second look would not repeat it).
    assert.equal(select.dialogue?.active, true, 'the debrief opens on the return, before Stage Select is interactive')
    assert.equal(select.dialogue?.sequenceId, 'pyro_maw_restored')
    assert.equal(select.dialogue?.speakerId, 'director_iona', 'the debrief opens on Iona\'s existing status line')
    assert.ok(select.save.storyFlags.includes('pyro_maw_restored'), 'the debrief is marked seen at once, so a replay clear would not repeat it')
    await capture('district-debrief', select)
    await page.keyboard.press('Escape')
    const afterDebrief = await waitForState(page, (state) => state.dialogue?.sequenceId !== 'pyro_maw_restored', 5000, 'the debrief closing')
    assert.equal(afterDebrief.dialogue?.sequenceId, 'robot_masters_cleared_8', 'the eighth-clear milestone follows the debrief, never before it')
    await capture('stage-select', afterDebrief)

    // 9. The ending's CAMPAIGN RECORD card, the credits pace and the OMEGA RELAY title card.
    await page.evaluate(() => window.__b45.game.scene.getScenes(true)[0].scene.start('EndingScene'))
    await waitForState(page, (state) => state.scene === 'EndingScene', 10000, 'the ending')
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const state = await readState(page)
      if (state.ending?.phase === 'record') break
      await page.evaluate(() => window.narrativeDebug?.advance?.())
    }
    const record = await waitForState(page, (state) => state.ending?.phase === 'record', 5000, 'the record card')
    const rows = Object.fromEntries(record.ending.record.map((row) => [row.label, row.value]))
    assert.deepEqual(rows, { 'PLAY TIME': rows['PLAY TIME'], HEARTS: '8/8', 'SUB TANKS': '4/4', CAPSULES: '8/8', DEATHS: '4', DIFFICULTY: 'NORMAL', RANK: 'STEADY' })
    assert.match(rows['PLAY TIME'], /^3H 1\dM$/)
    await capture('campaign-record', record)
    await page.evaluate(() => window.narrativeDebug?.advance?.())
    const credits = await waitForState(page, (state) => state.ending?.phase === 'credits', 5000, 'the credits')
    assert.ok(credits.ending.credits.lineOnScreenMs >= 2500, `a line stays ${credits.ending.credits.lineOnScreenMs} ms`)
    await page.evaluate(() => window.narrativeDebug?.skip?.())
    const title = await waitForState(page, (state) => state.ending?.phase === 'title', 5000, 'the title card')
    assert.deepEqual(title.ending.title, { title: 'OMEGA RELAY', subtitle: title.ending.title.subtitle })
    assert.ok(title.ending.title.subtitle.length > 0)
    await capture('title-card', title)
    await waitForState(page, (state) => state.scene === 'Title' || state.scene === 'StageSelect', 10000, 'the return after the title card')
    evidence.results = figures
    evidence.weaponGet = view
    evidence.record = record.ending.record
    evidence.credits = credits.ending.credits
    assert.deepEqual(errors, [])
    return evidence
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify({ ...evidence, errors }, null, 2))
    await browser.close()
  }
}
