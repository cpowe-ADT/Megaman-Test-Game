// Smoke 47-full-campaign (prompt 13 part 13h.2, EVAL-P8-008; long-tier only, SMOKE_LONG=1). The whole game through the
// automation hooks, from an empty save: Title -> New Campaign -> the prologue -> the tutorial and Rook -> the eight
// wardens in an order other than the Stage Select menu order -> the Central Core in three acts (act 1, the eight
// rematch doors, act 3 and the Omega Core) -> the ending, its record and the credits. Every beat the player sees
// (the boss intro, READY, the door WARNING, the weapon-get card and demo, the results, the return debrief, the
// milestone lines) is driven through its real state machine at least once and asserted there; most stage entries
// past that first proof use `stageDebug`/`bossDebug` warps (`crossBossGate`, `activateBossRoom`, `bossDebug.damage`,
// `bossDebug.unlockIntro`) instead of a route walk, per AGENTS.md's automation-over-play rule for this scenario.
// Runs the whole route twice -- 'skip' (skipDialogue everywhere) and 'read' (advanceDialogue until every line
// completes, then advances) -- and diffs the two final save states: AGENTS.md rule 8 says skip and full-read must
// converge, and TESTING.md's "Story flags mark at the moment a sequence starts" already predicts an exact match.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

// The menu's warden set (also hardcoded this way in scripts/smoke/omega-acts.mjs and story-surfaces.mjs); the
// scenario still reads Stage Select's own live order at runtime and asserts our route differs from it rather than
// assuming this listing order is the menu order.
const WARDEN_IDS = ['pyro_maw', 'tide_reaver', 'volt_hopper', 'basalt_titan', 'ferro_blade', 'mire_wraith', 'gale_vixen', 'glacier_ronin']
const DOOR_LABELS = ['FIRE', 'WATER', 'LIGHTNING', 'EARTH', 'METAL', 'TOXIC', 'WIND', 'ICE']
const SAVE_EQUAL_KEYS = ['clearedBosses', 'weaponsUnlocked', 'upgradeUnlocks', 'heartTanks', 'subTanks', 'storyFlags', 'tutorialCleared', 'gameCompleted']

function sortedArrayOrValue(value) {
  return Array.isArray(value) ? [...value].sort() : value
}

/** One run of the whole campaign in the given dialogue mode. Opens its own browser so the save starts empty. */
async function runOnce(mode, { runDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir = path.join(runDir, mode)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 448, height: 252 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

  const evidence = { mode, timingMs: {}, milestones: {} }
  const startedAt = Date.now()
  const mark = (label) => { evidence.timingMs[label] = Date.now() - startedAt }
  const capture = async (label) => {
    await page.locator('canvas').screenshot({ path: path.join(dir, `shot-${label}.png`) })
  }
  const savedRun = () => page.evaluate(() => JSON.parse(localStorage.getItem('save.v1') ?? '{}'))

  // A generous default: this scenario's own multi-minute length shows the shared machine's other concurrent
  // lanes can slow wall-clock advanceTime well below 60fps, so a budget proven fine in a lighter-loaded
  // scenario (omega-acts.mjs's own 300) still starved here on a real (non-bug) beat, not a stuck state.
  const until = async (check, label, maxSteps = 900, stepFrames = 4) => {
    for (let step = 0; step < maxSteps; step += 1) {
      const value = await check()
      if (value) return value
      await advanceFrames(page, stepFrames)
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
  /** Drains the active dialogue sequence: skip (once through) in 'skip' mode, or repeated advance (which
   * completes a typing line, then advances) in 'read' mode, so a multi-line sequence is read line by line.
   * `stageDebug.skipDialogue`/`advanceDialogue` only exist on the Game scene (GameDebugHooks.ts) -- the
   * post-stage debrief and clear-count milestones play on Stage Select instead (StageSelect.ts's own
   * `dialogueOverlay`), so this reaches the scene `render_game_to_text` says is active and calls its
   * `dialogueOverlay` directly, the same object those hooks wrap (and what beats-flow.mjs already does
   * for this exact debrief: scripts/smoke/beats-flow.mjs skips it with a raw Escape key instead). */
  const drainDialogue = async (label, maxSteps = 200) => {
    const seen = new Set()
    const first = await readState(page)
    if (!first.dialogue?.active) return seen
    // Stop at the first sequence this call started on, not just "inactive": a skip's onComplete can chain
    // straight into a new sequence in the same tick (StageSelect.playDebrief's `after` opens the clear-count
    // milestone this way), and a generic "until inactive" loop would silently swallow that one too before the
    // caller gets to look at it (full-campaign.mjs's own milestone check, right after the debrief drain).
    const sequenceId = first.dialogue.sequenceId
    for (let step = 0; step < maxSteps; step += 1) {
      const state = await readState(page)
      if (!state.dialogue?.active || state.dialogue.sequenceId !== sequenceId) return seen
      seen.add(state.dialogue.sequenceId)
      await page.evaluate(({ sceneKey, method }) => {
        window.__phaserGame.scene.getScene(sceneKey)?.dialogueOverlay?.[method]?.()
      }, { sceneKey: state.scene, method: mode === 'read' ? 'advance' : 'skip' })
      await advanceFrames(page, 3)
    }
    throw new Error(`dialogue never drained: ${label}`)
  }
  /** Stage card + briefing, however far the intro has progressed, stopping at 'ready' instead of skipping through
   * it. Uses `stageDebug.advanceStageIntro()` (`StageIntroSequence#advance()`), not `skipStageIntro()`
   * (`#skip()`): `skip()` jumps straight from *any* active phase, 'ready' included, to 'done' unconditionally, so
   * calling it during 'card' would blow past an about-to-start briefing and READY unseen; `advance()` only ends
   * the card early ("during the briefing the overlay owns confirm; READY runs its course"). */
  const drainStageIntro = async (label, maxSteps = 60) => {
    for (let attempt = 0; attempt < maxSteps; attempt += 1) {
      const state = await readState(page)
      if (state.scene !== 'Game' || !state.stageIntro?.active || state.stageIntro.phase === 'ready') return state
      if (state.dialogue?.active) await drainDialogue(`${label} briefing`, 40)
      else await page.evaluate(() => window.stageDebug?.advanceStageIntro?.())
      await advanceFrames(page, 4)
    }
    throw new Error(`stage intro never finished: ${label}`)
  }
  /** Enters a stage from Stage Select's own confirm (real flow), through the pre-stage boss card when it shows
   * (wardens only; TESTING.md: the tutorial and a resumed run never get one). `detailed` catches it mid-type and
   * asserts it once, as `45-beats-flow` does, instead of racing a single stale read against the scene switch. */
  const enterStage = async (stageId, { detailed = false } = {}) => {
    await page.evaluate((id) => {
      const select = window.__phaserGame.scene.getScenes(true)[0]
      select.setSelection(select.stages.findIndex((entry) => entry.id === id))
      select.confirmSelection()
    }, stageId)
    const afterConfirm = await until(async () => {
      const state = await readState(page)
      return state.scene === 'BossIntro' || state.scene === 'Game' ? state : null
    }, `${stageId} post-confirm scene`, 60)
    if (afterConfirm.scene === 'BossIntro') {
      if (detailed) {
        const midType = await until(async () => {
          const state = await readState(page)
          const beat = state.bossIntro
          return beat?.phase === 'active' && beat.visibleCharacters > 0 && beat.visibleCharacters < beat.charactersTotal ? state : null
        }, `${stageId} boss intro mid-type`, 400, 1)
        assert.equal(midType.bossIntro.phase, 'active', 'the boss intro card')
        await capture(`${stageId}-boss-intro`)
      }
      await tapKey(page, 'Enter')
    }
    return waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === stageId, 30000, `${stageId} loaded`)
  }
  /** Warps to the boss room and fights it. `detailed` (the one proof pass) steps WARNING -> card -> bar_fill by
   * hand instead of `bossDebug.unlockIntro()`'s straight-to-fight shortcut, and returns the beat states seen. */
  const fightBoss = async (stageId, { detailed = false } = {}) => {
    await page.evaluate(() => { window.stageDebug?.crossBossGate?.(); window.stageDebug?.activateBossRoom?.() })
    await until(async () => (await readState(page)).stageRuntime?.bossEncounterActive === true, `${stageId} boss room active`)
    let beats = null
    if (detailed) {
      const warning = await readState(page)
      assert.equal(warning.bossIntro?.beat, 'warning', 'the door WARNING beat')
      assert.equal(warning.stageRuntime.bossGateLocked, true, 'the door shuts behind the hero')
      await capture(`${stageId}-warning`)
      const card = await until(async () => { const s = await readState(page); return s.bossIntro?.beat === 'card' ? s : null }, `${stageId} name card`)
      await capture(`${stageId}-card`)
      // The card is followed by the boss intro dialogue (BossBeats#triggerBossActive -> storyDirector.playBossIntro);
      // nothing advances it by itself, so skip it like every other sequence while polling, same as
      // boss-beats.mjs's own step() helper. The bar then fills for ~900ms; `advanceTime` waits on real rAF
      // callbacks (src/main.ts), so on a loaded machine a single widely-spaced poll (stepFrames=4) can step
      // clean over that whole window -- poll one frame at a time, and accept catching 'fight' with
      // 'bar_fill' already in the recorded beat trace (BossPresentation.beats, `getDebugState`) as proof it
      // ran even if the live beat itself was missed.
      let barFill = null
      for (let step = 0; step < 3600 && !barFill; step += 1) {
        const s = await readState(page)
        const beat = s.bossIntro?.beat
        if (beat === 'bar_fill') { barFill = s; break }
        if (beat === 'fight' && s.bossIntro.beats?.some((entry) => entry.beat === 'bar_fill')) { barFill = s; break }
        if (s.dialogue?.active) await page.evaluate(() => window.stageDebug?.skipDialogue?.())
        await advanceFrames(page, 1)
      }
      if (!barFill) throw new Error(`timed out: ${stageId} bar fill`)
      if (barFill.bossIntro.beat === 'bar_fill') {
        assert.ok(barFill.bossIntro.bar.fraction >= 0 && barFill.bossIntro.bar.fraction < 1, 'the HP bar is filling')
      } else {
        assert.equal(barFill.bossIntro.bar.fraction, 1, 'the HP bar finished filling (caught on the trace, not live)')
      }
      await capture(`${stageId}-bar-fill`)
      await until(async () => (await readState(page)).bossIntro?.beat === 'fight', `${stageId} fight begins`)
      beats = { warning: warning.bossIntro, card: card.bossIntro, barFill: barFill.bossIntro }
    } else {
      await page.evaluate(() => window.bossDebug?.unlockIntro?.())
      await advanceFrames(page, 20)
    }
    for (let hit = 0; hit < 30 && Number((await readState(page)).bossState?.hp?.current ?? 1) > 0; hit += 1) {
      await page.evaluate(() => window.bossDebug?.damage?.(999))
      await advanceFrames(page, 10)
    }
    // HP hitting 0 does not itself open dialogue or the victory modal: the death sequence runs its own
    // freeze/burst/flash timeline first (44-boss-beats: defeat frames, hit-stop, a ~900ms freeze) before the
    // defeat dialogue (or, on a sequence-less clear, the victory modal directly) starts. `dialogue.active` is
    // still whatever it was before the fight (here, false, left over from the stage briefing already drained),
    // so waiting for the death sequence to actually produce one avoids draining nothing and moving on too soon.
    await until(async () => { const s = await readState(page); return s.dialogue?.active === true || s.victory?.modalOpen === true ? s : null }, `${stageId} death sequence settles`)
    await drainDialogue(`${stageId} defeat`)
    return beats
  }
  /** Weapon-get -> (weapon-demo if it is a real weapon, not the tutorial's arc_slash item) -> results -> the hold
   * that returns to Stage Select; asserted in detail on the one proof pass. */
  const clearVictoryCards = async (stageId, { detailed = false } = {}) => {
    const weaponGet = await until(async () => { const s = await readState(page); return s.victory?.modalOpen && s.victory.card === 'weapon_get' ? s : null }, `${stageId} weapon-get card`)
    let demoView = null
    if (detailed) {
      assert.equal(weaponGet.victory.weaponGet.kind, 'weapon', 'the proof pass clears a warden, not the tutorial')
      assert.ok(weaponGet.victory.weaponGet.registry?.text, "Iona's registry line")
      await capture(`${stageId}-weapon-get`)
    }
    await tapKey(page, 'Enter')
    const afterGet = await until(async () => { const s = await readState(page); return s.victory?.card !== 'weapon_get' ? s : null }, `${stageId} past weapon-get`)
    if (afterGet.victory?.card === 'weapon_demo') {
      if (detailed) {
        demoView = afterGet.victory.weaponDemo
        assert.equal(afterGet.weaponDemo?.weaponId, demoView?.weaponId, 'the top-level weaponDemo mirrors the card')
        await capture(`${stageId}-weapon-demo`)
      }
      await tapKey(page, 'Enter')
    }
    const results = await until(async () => { const s = await readState(page); return s.victory?.card === 'results' ? s : null }, `${stageId} results`)
    if (detailed) {
      assert.equal(results.victory.results.stageId, stageId)
      await capture(`${stageId}-results`)
    }
    await until(async () => (await readState(page)).victory?.modalOpen !== true, `${stageId} results hold ends`, 400)
    const select = await waitForState(page, (state) => state.scene === 'StageSelect', 15000, `${stageId} Stage Select return`)
    return { weaponGet: weaponGet.victory.weaponGet, demoView, results: results.victory.results, select }
  }

  try {
    // 1. New Campaign, from a genuinely empty save (a fresh incognito browser: nothing seeded).
    await page.goto(`${storyUrl}&bossIntro=on`, { timeout: 90000 })
    await waitForState(page, (state) => state.scene === 'Title', 30000, 'Title')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'NewCampaign', 15000, 'New Campaign')
    await advanceFrames(page, 3)
    await tapKey(page, 'Enter')
    mark('new_campaign')

    // 2. The prologue, read or skipped by mode.
    const prologue = await waitForState(page, (state) => state.scene === 'Prologue' && state.prologue?.pageCount > 0, 15000, 'the prologue')
    const pageCount = prologue.prologue.pageCount
    if (mode === 'read') {
      for (let advanced = 0; advanced < pageCount + 2; advanced += 1) {
        await page.evaluate(() => window.narrativeDebug?.advance?.())
        await advanceFrames(page, 3)
      }
    } else {
      await page.evaluate(() => window.narrativeDebug?.skip?.())
    }
    mark('prologue')

    // 3. The tutorial and Rook: the stage card and briefing, READY (asserted here; it recurs identically on every
    // stage), the boss warp, the defeat, and the item card (arc_slash is not a special weapon id, so no demo).
    const card = await waitForState(page, (state) => state.scene === 'Game' && state.stageIntro?.phase === 'card', 20000, 'the tutorial stage card')
    assert.equal(card.stageRuntime.stageId, 'tutorial_sentinel')
    await drainStageIntro('tutorial')
    const ready = await waitForState(page, (state) => state.stageIntro?.phase === 'ready', 10000, 'READY')
    assert.equal(ready.stageIntro.readyVisible, true, 'READY is lit on its first blink')
    await capture('tutorial-ready')
    await until(async () => (await readState(page)).stageIntro?.phase === 'done', 'READY clears')
    await fightBoss('tutorial_sentinel')
    const tutorialCards = await clearVictoryCards('tutorial_sentinel')
    assert.equal(tutorialCards.weaponGet.kind, 'item', 'the tutorial reward is ArcSlash, an item card')
    assert.equal(tutorialCards.demoView, null, 'no weapon demo follows an item card')
    mark('tutorial')

    // 4. The eight wardens, in an order other than Stage Select's own menu order.
    const menuOrder = (await page.evaluate(() => window.__phaserGame.scene.getScenes(true)[0].stages.map((entry) => entry.id)))
      .filter((id) => WARDEN_IDS.includes(id))
    assert.equal(menuOrder.length, 8, 'all eight wardens are open after the tutorial')
    const order = [...menuOrder].reverse()
    assert.notDeepEqual(order, menuOrder, 'the route order differs from the menu order')
    evidence.menuOrder = menuOrder
    evidence.playedOrder = order
    let clearedCount = 0
    for (const [index, stageId] of order.entries()) {
      const detailed = index === 0
      await enterStage(stageId, { detailed })
      await drainStageIntro(stageId)
      await page.evaluate(() => window.stageDebug?.skipStageIntro?.())
      // Every warden warps straight to its boss room (`fightBoss`'s own crossBossGate/activateBossRoom, per
      // this file's header), so the route's heart tank and capsule are never actually walked past; grant them
      // the same way a real pickup overlap would (Game.ts's own collectProgressionLocation) so the ending's
      // CAMPAIGN RECORD card sees 8/8 HEARTS and 8/8 CAPSULES instead of 0/8.
      await page.evaluate((id) => {
        const scene = window.__phaserGame.scene.getScene('Game')
        scene.collectProgressionLocation(`${id}:heart_tank`)
        scene.collectProgressionLocation(`${id}:capsule`)
      }, stageId)
      await fightBoss(stageId, { detailed })
      const cards = await clearVictoryCards(stageId, { detailed })
      clearedCount += 1
      // The return debrief (`<stageId>_restored`) and, once each, the 1st/4th/8th clear-count milestones.
      const afterReturn = await readState(page)
      if (afterReturn.dialogue?.active && afterReturn.dialogue.sequenceId === `${stageId}_restored`) {
        if (detailed) await capture(`${stageId}-debrief`)
        await drainDialogue(`${stageId} debrief`)
      }
      const milestoneState = await readState(page)
      if (milestoneState.dialogue?.active && milestoneState.dialogue.sequenceId.startsWith('robot_masters_cleared_')) {
        evidence.milestones[milestoneState.dialogue.sequenceId] = milestoneState.dialogue.speakerId
        if (clearedCount === 1) {
          assert.equal(milestoneState.dialogue.sequenceId, 'robot_masters_cleared_1')
          assert.equal(milestoneState.dialogue.speakerId, 'director_iona')
          await capture('milestone-cleared-1')
        }
        await drainDialogue(`milestone after ${stageId}`)
      }
      if (detailed) {
        evidence.detailedWarden = { stageId, weaponGet: cards.weaponGet, demoView: cards.demoView, results: cards.results }
      }
      mark(`warden_${clearedCount}_${stageId}`)
    }
    assert.equal(clearedCount, 8)
    assert.ok('robot_masters_cleared_1' in evidence.milestones, 'the first-clear milestone fired')
    assert.ok('robot_masters_cleared_8' in evidence.milestones, 'the eighth-clear milestone fired')
    mark('wardens')

    // 5. The Central Core in three acts.
    const act1Start = Date.now()
    await enterStage('omega_fortress')
    // Unlike the warden loop (which drains this right after `enterStage`), the Core's own card/briefing/READY
    // sequence was never cleared here: the player stayed frozen under it, so `place`/`walkRightTo` below moved
    // nothing and the act-1 checkpoint wait timed out on a hero stuck at the placed x with vx 0.
    await drainStageIntro('omega_fortress')
    await page.evaluate(() => window.stageDebug?.skipStageIntro?.())
    await capture('omega_fortress-act1')
    let omega = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game')?.data?.get?.('omegaActs')?.getDebugState?.() ?? null)
    assert.equal((await omega())?.act, 1)
    await place(4420, 214)
    await shield()
    await walkRightTo(4530)
    await waitForState(page, (state) => state.stageRuntime?.checkpointIndex === 2, 10000, 'the act-1 checkpoint')
    evidence.timingMs.omega_act1 = Date.now() - act1Start

    // Act 2: the hub, its eight doors (any order opens it; door order is fixed by element, not by the warden
    // clear order above), then the exit.
    const act2Start = Date.now()
    let hub = await until(async () => { const value = await omega(); return value?.act === 2 ? value : null }, 'the Central Core hub')
    assert.equal(hub.doors.length, 8)
    assert.deepEqual(hub.doors.map((door) => door.label), DOOR_LABELS)
    await place(4760, 214)
    await capture('omega_fortress-hub')
    for (let door = 0; door < 8; door += 1) {
      await page.evaluate((index) => window.__phaserGame.scene.getScene('Game').data.get('omegaActs').enterDoor(index), door)
      await until(async () => { const s = await omega(); return s?.mode === 'rematch' && s.door === door ? s : null }, `rematch door ${door}`)
      await shield()
      await page.evaluate(() => window.stageDebug?.crossBossGate?.())
      await until(async () => (await readState(page)).stageRuntime?.bossEncounterActive === true, `rematch ${door} encounter`)
      await page.evaluate(() => window.bossDebug?.unlockIntro?.())
      await advanceFrames(page, 20)
      for (let hit = 0; hit < 30 && Number((await readState(page)).bossState?.hp?.current ?? 1) > 0; hit += 1) {
        await page.evaluate(() => window.bossDebug?.damage?.(999))
        await advanceFrames(page, 10)
      }
      hub = await until(async () => { await page.evaluate(() => window.stageDebug?.skipDialogue?.()); const s = await omega(); return s?.mode === 'return' && s.door === door ? s : null }, `rematch ${door} return`)
    }
    assert.equal(hub.cleared.length, 8)
    assert.equal(hub.exitOpen, true)
    evidence.timingMs.omega_act2 = Date.now() - act2Start

    // Act 3: through the exit, the checkpoint, the Core's door and room.
    const act3Start = Date.now()
    await place(5300, 214)
    await shield()
    await walkRightTo(5420)
    await waitForState(page, (state) => state.stageRuntime?.checkpointIndex === 3, 10000, 'the act-3 checkpoint')
    assert.equal((await omega()).act, 3)
    await capture('omega_fortress-act3')
    await place(7020, 214)
    await shield()
    await page.evaluate(() => { window.stageDebug?.crossBossGate?.(); window.stageDebug?.activateBossRoom?.() })
    await until(async () => (await readState(page)).stageRuntime?.bossRoom?.cameraLocked === true, 'the Core room')
    evidence.timingMs.omega_act3 = Date.now() - act3Start

    // The finale: the Core's three transitions, then victory and the ending.
    const finaleStart = Date.now()
    await until(async () => { await page.evaluate(() => window.stageDebug?.skipDialogue?.()); const s = await readState(page); return s.bossState?.hp?.max > 0 && !s.dialogue?.active ? s : null }, 'the Core fight')
    await page.evaluate(() => window.bossDebug?.unlockIntro?.())
    await advanceFrames(page, 20)
    const coreMax = (await readState(page)).bossState.hp.max
    for (const [phase, ratio] of [[1, 0.6], [2, 0.28], [3, 0.18]]) {
      for (let hit = 0; hit < 40 && Number((await readState(page)).bossState?.hp?.current ?? 0) > coreMax * ratio; hit += 1) {
        await page.evaluate(() => window.bossDebug?.damage?.(4))
        await advanceFrames(page, 14)
      }
      await until(async () => { const s = await readState(page); return s.story?.flags?.includes(`finale_phase_${phase}`) ? s : null }, `finale_phase_${phase}`, 150)
    }
    await capture('omega_fortress-finale')
    for (let hit = 0; hit < 20 && Number((await readState(page)).bossState?.hp?.current ?? 1) > 0; hit += 1) {
      await page.evaluate(() => window.bossDebug?.damage?.(999))
      await advanceFrames(page, 12)
    }
    await until(async () => { await page.evaluate(() => window.stageDebug?.skipDialogue?.()); return (await readState(page)).victory?.modalOpen === true }, 'the victory card')
    await tapKey(page, 'Enter')
    evidence.timingMs.omega_finale = Date.now() - finaleStart
    mark('omega_fortress')

    // 6. The ending: the record, the credits pace, the title card.
    const endingStart = Date.now()
    await waitForState(page, (state) => state.scene === 'EndingScene', 15000, 'the ending')
    for (let attempt = 0; attempt < 30 && (await readState(page)).ending?.phase !== 'record'; attempt += 1) {
      await page.evaluate(() => window.narrativeDebug?.advance?.())
      await advanceFrames(page, 3)
    }
    const record = await waitForState(page, (state) => state.ending?.phase === 'record', 8000, 'the CAMPAIGN RECORD card')
    assert.equal(record.ending.record.find((row) => row.label === 'HEARTS')?.value, '8/8')
    assert.equal(record.ending.record.find((row) => row.label === 'CAPSULES')?.value, '8/8')
    await capture('ending-record')
    await page.evaluate(() => window.narrativeDebug?.advance?.())
    const credits = await waitForState(page, (state) => state.ending?.phase === 'credits', 8000, 'the credits')
    evidence.creditsLineMs = credits.ending.credits.lineOnScreenMs
    await page.evaluate(() => window.narrativeDebug?.skip?.())
    const title = await waitForState(page, (state) => state.ending?.phase === 'title', 8000, 'the title card')
    evidence.endingTitle = title.ending.title
    evidence.timingMs.ending = Date.now() - endingStart
    mark('total')

    evidence.finalSave = await savedRun()
    assert.deepEqual(errors, [], 'no page errors')
    return evidence
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify({ ...evidence, errors }, null, 2))
    await browser.close()
  }
}

export async function runFullCampaignScenario(name, deps) {
  const dir = path.join(deps.outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })

  const skip = await runOnce('skip', { runDir: dir, ...deps })
  const read = await runOnce('read', { runDir: dir, ...deps })

  const diff = {}
  for (const key of SAVE_EQUAL_KEYS) {
    const a = sortedArrayOrValue(skip.finalSave[key])
    const b = sortedArrayOrValue(read.finalSave[key])
    assert.deepEqual(a, b, `save.${key} matches between the skip and read runs`)
  }
  for (const key of Object.keys({ ...skip.finalSave, ...read.finalSave })) {
    if (SAVE_EQUAL_KEYS.includes(key)) continue
    const a = JSON.stringify(sortedArrayOrValue(skip.finalSave[key]))
    const b = JSON.stringify(sortedArrayOrValue(read.finalSave[key]))
    if (a !== b) diff[key] = { skip: skip.finalSave[key], read: read.finalSave[key] }
  }

  const evidence = { skip, read, otherSaveDiff: diff }
  fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
  return { artifacts: dir, evidence }
}
