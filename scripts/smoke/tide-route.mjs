// Smoke 55-tide-route (EVAL-P6-010, Water District rebuilt to the Heat Works standard). Runs with storyIntro=on
// so the checkpoint-2 radio and the mid-boss callout reach the lane. The water levels follow the stage clock:
// to reach a phase the smoke sets that clock test-side (`setClock`), as it warps the hero between steps
// (`place`), instead of waiting out each cycle. Steps, each with a capture:
// (a) from the spawn, real input (hold right, jump at fixed x's) over the intro step, the pit inside the teach
//     current and the deck, to the first sluice; the hero is shielded, so the enemies it passes cannot stop it;
// (c) the sluice holds while the water behind it is high; at low water the same held input walks through it
//     to checkpoint 2;
// (b) a held jump from the floor inside the teach current rises about 80% of the same jump on plain floor;
//     the heart tops the chimney in its tall room (warp plus assert; the wall-kick climb is audited in
//     tests/tide-reaver-stage.test.ts);
// (e) the intake room locks (camera held, the mid-boss callout on the radio lane), walking into its gate
//     does not pass, and it opens only after the relay turret nest falls; walking on crosses checkpoint 3;
// (d) at low water a jump in the basin falls short of the sub tank ledge; at high water the hero floats up,
//     drifts onto the ledge and collects the sub tank;
// (f) the flooded shaft: the rising water floats the hero up (camera follows), the capsule alcove is reached
//     (warp plus assert), the exit sluice holds at high water, and at low water the hero walks over the right
//     wall onto the works floor;
// (h) one capture per screen for the route contact sheet (`route-00.png` to `route-11.png`);
// (g) real input from the end of the spike lane over the last pit crosses checkpoint 4 into the boss room,
//     and the boss is on screen and takes damage.
// Placement between steps is test-side; order follows the checkpoints so each crossing is real. The shield
// blocks damage, not knockback: a walk that tests the terrain removes each enemy it comes within 240px of
// (`clearEnemies`, once each, never the nest), as a player's shots would.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

/** One hero position per 448px screen for the route sheet (on solid floor, off pits; the shaft from its top ledge). */
const ROUTE_SHOTS = [[224, 214], [470, 214], [1040, 214], [1400, 214], [2016, 214], [2464, 214], [2800, 214], [3528, -172], [3700, 214], [4100, 214], [4600, 214], [5040, 214]]

export async function runTideRouteScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames }) {
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
    const { mechanics, player, playerState, camera, stageRuntime, ticker } = state
    fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify({ mechanics, player, playerState, camera, stageRuntime, ticker }, null, 2))
    return state
  }
  const mech = (state) => state.mechanics ?? {}
  const byId = (list, id) => (list ?? []).find((entry) => entry.id === id)
  const water = (state, id) => byId(mech(state).waterLevelGates, id)
  const place = async (x, y) => {
    await page.evaluate(({ x, y }) => {
      const hero = window.__phaserGame.scene.getScene('Game').player
      hero.setPosition(x, y)
      hero.body?.setVelocity?.(0, 0)
    }, { x, y })
    await advanceFrames(page, 3)
  }
  // The stage clock the water cycles read (`StageMechanicsAdapter`, scene data `stageMechanics`).
  const setClock = async (ms) => {
    await page.evaluate((value) => { window.__phaserGame.scene.getScene('Game').data.get('stageMechanics').clockMs = value }, ms)
    await advanceFrames(page, 2)
  }
  const shield = (ms) => page.evaluate((value) => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(value), ms)
  const collected = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').progressionSave?.collectedChecks ?? [])
  const skipDialogue = async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!(await readState(page)).dialogue?.active) return
      await page.evaluate(() => window.stageDebug.skipDialogue())
      await advanceFrames(page, 4)
    }
  }
  // Real input, one frame at a time in the page (the loop sleeps for the whole drive, so every step is a fixed
  // 1/60s): hold right unless `right: false`; at each jump x, once grounded for 4 frames, hold jump for `hold`
  // frames. A press the hard-landing lag swallows (the hero still grounded when it ends) is released for a frame
  // and pressed again, and a hero stalled on the floor while holding right (knocked back by a shot the shield
  // blocks the damage of, not the push) jumps again after 10 frames, as a player would. Stops at `targetX`, on a
  // death, when `untilGrounded` lands after
  // leaving the floor, or at `maxFrames`. Reports the highest point (`minY`).
  const drive = (plan) => page.evaluate((plan) => {
    const loop = window.__phaserGame.loop
    const wasRunning = loop.running
    if (wasRunning) loop.sleep()
    try {
      return driveAsleep(plan)
    } finally {
      if (wasRunning) loop.wake()
    }
    function driveAsleep(plan) {
      const game = window.__phaserGame.scene.getScene('Game')
      const jumps = [...(plan.jumps ?? [])].sort((a, b) => a.atX - b.atX)
      const log = []
      let hold = 0
      let next = 0
      let frames = 0
      let minY = game.player.y
      let left = false
      let groundedFor = 0
      let released = true
      let pressed = null
      let stalled = 0
      const cleared = new Set()
      let lastX = game.player.x
      for (; frames < plan.maxFrames; frames += 1) {
        const x = game.player.x
        if (x >= (plan.targetX ?? Infinity) || game.playerHp <= 0) break
        if (plan.clearEnemies) {
          for (const entry of game.enemySpawner.getEntities()) {
            if (cleared.has(entry.id) || entry.id === 'tide_mid_nest' || !entry.sprite?.active || Math.abs(entry.sprite.x - x) > 240) continue
            cleared.add(entry.id)
            game.enemySpawner.applyDamageToSprite(entry.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_55_clear' })
          }
        }
        const grounded = Boolean(game.player.body?.blocked?.down)
        if (!grounded) left = true
        if (plan.untilGrounded && left && grounded) break
        groundedFor = grounded ? groundedFor + 1 : 0
        if (pressed && !grounded) pressed = null
        if (pressed && hold === 0 && grounded) {
          log.push({ retryAtX: Math.round(x), frame: frames })
          pressed = null
          next -= 1
        }
        if (hold === 0 && released && next < jumps.length && x >= jumps[next].atX && grounded && groundedFor >= 4) {
          hold = jumps[next].hold
          pressed = jumps[next]
          log.push({ jumpAtX: Math.round(x), y: Math.round(game.player.y), frame: frames })
          next += 1
        }
        stalled = grounded && plan.right !== false && Math.abs(x - lastX) < 0.5 ? stalled + 1 : 0
        lastX = x
        if (stalled >= 10 && hold === 0 && released && plan.stallJumps !== false) {
          hold = 14
          stalled = 0
          log.push({ stallJumpAtX: Math.round(x), frame: frames })
        }
        const jumpHeld = hold > 0
        const held = [...(plan.right === false ? [] : ['moveRight']), ...(jumpHeld ? ['jump'] : [])]
        window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }])
        released = !jumpHeld
        if (hold > 0) hold -= 1
        minY = Math.min(minY, game.player.y)
        if (plan.trace && next === jumps.length && frames % 6 === 0 && log.length < 80) log.push([frames, Math.round(game.player.x), Math.round(game.player.y), grounded ? 1 : 0, Math.round(game.player.body?.velocity?.x ?? 0), Math.round(game.player.body?.velocity?.y ?? 0)])
      }
      window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), minY: Math.round(minY * 10) / 10, hp: game.playerHp, cleared: [...cleared], log }
    }
  }, plan)
  const standing = (label, timeout = 8000) => waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, timeout, label)
  const evidence = { timingMs: {} }
  const startedAt = Date.now()
  const mark = (label) => { evidence.timingMs[label] = Date.now() - startedAt }
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`, { timeout: 90000 })
    await waitForState(page, (state) => state.scene === 'StageSelect', 30000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'tide_reaver' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'tide_reaver', 30000, 'tide loaded')
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    let state = await capture('spawn')
    assert.equal(state.stageRuntime.checkpointIndex, 0)
    mark('loaded')

    // (a) Spawn to the first sluice on real input: a hop onto the intro step, a jump over the pit inside the
    // teach current, a jump onto the deck, then the floor.
    await shield(600000)
    const walk = await drive({ trace: true, clearEnemies: true, targetX: 1060, maxFrames: 420, jumps: [{ atX: 262, hold: 10 }, { atX: 604, hold: 9 }, { atX: 780, hold: 14 }] })
    evidence.walkToSluice = walk
    await capture('walk-end')
    assert.ok(walk.x >= 1060 && walk.hp > 0, `walked to the first sluice (${JSON.stringify(walk)})`)
    mark('a')

    // (c) The sluice: shut while the water behind it is high (1.5s high, then 2s falling), open at low water (3s).
    await setClock(17000)
    const held = await drive({ targetX: 1140, maxFrames: 40, stallJumps: false })
    state = await readState(page)
    evidence.teachGateClosed = { held, water: water(state, 'tide_lock_teach') }
    assert.ok(held.x < 1096 && water(state, 'tide_lock_teach').gateClosed === true, `the sluice holds while the water is up (${JSON.stringify(evidence.teachGateClosed)})`)
    await capture('teach-sluice-closed')
    // Each phase-dependent step sets the clock just before its stepped drive, and asserts on a state read before
    // its capture: under load a screenshot or a real-time wait can outlast a 3s hold.
    await setClock(20500)
    state = await readState(page)
    assert.deepEqual([water(state, 'tide_lock_teach').phase, water(state, 'tide_lock_teach').gateClosed], ['low', false], 'low water opens the sluice')
    await capture('teach-sluice-open')
    await setClock(20500)
    const through = await drive({ clearEnemies: true, targetX: 1400, maxFrames: 150 })
    evidence.teachGateOpen = { through, water: water(state, 'tide_lock_teach') }
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 6000, 'checkpoint 2 on real input')
    assert.ok(through.x >= 1376 && through.hp > 0, `through the open sluice to checkpoint 2 (${JSON.stringify(through)})`)
    await capture('checkpoint-2')
    mark('c')

    // (b) The current's jump penalty: the same held jump from the floor, inside the teach current and on plain floor.
    const heldJump = async (x) => {
      await place(x, 214)
      await standing(`standing at ${x}`)
      const before = await readState(page)
      const jump = await drive({ right: false, maxFrames: 90, untilGrounded: true, jumps: [{ atX: -1e6, hold: 40 }] })
      return { x, startY: before.player.y, minY: jump.minY, rise: Math.round((before.player.y - jump.minY) * 10) / 10, jumpRiseScale: before.newPlayer?.locomotion?.environment?.jumpRiseScale ?? null }
    }
    const inCurrent = await heldJump(500)
    const onFloor = await heldJump(1000)
    evidence.currentJump = { inCurrent, onFloor, ratio: Math.round((inCurrent.rise / onFloor.rise) * 1000) / 1000 }
    assert.deepEqual([inCurrent.jumpRiseScale, onFloor.jumpRiseScale], [0.8, 1], 'the motor holds the current jump scale inside only')
    assert.ok(onFloor.rise > 110 && evidence.currentJump.ratio > 0.74 && evidence.currentJump.ratio < 0.86, `a jump in the current rises about 80% (${JSON.stringify(evidence.currentJump)})`)
    // The heart: in on the floor first (the tall room raises the world ceiling), then onto the chimney's ledge.
    await place(2024, 214)
    await place(2024, 30)
    await advanceFrames(page, 20)
    const heartChecks = await collected()
    evidence.heart = { collected: heartChecks, hero: (await readState(page)).player }
    assert.ok(heartChecks.includes('tide_reaver:heart_tank'), `heart tank collected on the chimney ledge (${heartChecks})`)
    await capture('heart')
    await skipDialogue()
    mark('b')

    // (e) The intake room: locks on entry, holds the camera, plays the callout; opens only after the nest falls.
    await place(2272, 214)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'locked', 5000, 'intake room locks')
    assert.equal(mech(state).roomLocks[0].cameraHeld, true, 'the camera is held to the room')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /turret nest/i.test(next.ticker.text ?? ''), 30000, 'mid-boss callout on the radio lane')
    assert.equal(callout.dialogue?.active ?? false, false, 'the callout never blocks')
    await capture('midboss-locked')
    // Into the closed gate from beside it (the nest's bursts knock a hero on the housing back; its fight is
    // smoke 43's kind of work, not this route's).
    await place(2672, 214)
    const pushed = await drive({ targetX: 2720, maxFrames: 30, stallJumps: false })
    state = await readState(page)
    evidence.pushed = { pushed, lock: mech(state).roomLocks[0] }
    assert.ok(pushed.x < 2688 && mech(state).roomLocks[0].gateClosed === true, `the closed gate holds (${JSON.stringify(evidence.pushed)})`)
    // The nest falls: hit it until its entity is gone (a hit inside its invulnerability window does not count).
    const nestHits = []
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const hit = await page.evaluate(() => {
        const game = window.__phaserGame.scene.getScene('Game')
        const entity = game.enemySpawner.getEntities().find((entry) => entry.id === 'tide_mid_nest')
        if (!entity) return { gone: true }
        const before = { active: entity.sprite?.active, hp: entity.hp ?? entity.state?.hp ?? entity.runtime?.hp ?? null }
        if (entity.sprite?.active) game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_55' })
        return { gone: false, ...before }
      })
      nestHits.push(hit)
      if (hit.gone) break
      await advanceFrames(page, 6)
    }
    evidence.nestHits = nestHits.slice(-6)
    state = await readState(page)
    evidence.lockAfterKill = mech(state).roomLocks[0]
    assert.ok(nestHits.some((hit) => hit.gone === false), 'found the relay turret nest')
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'open' && !mech(next).roomLocks[0].gateClosed, 15000, 'gate opens after the nest falls')
    evidence.midboss = mech(state).roomLocks[0]
    await capture('midboss-open')
    const toCheckpoint3 = await drive({ targetX: 2760, maxFrames: 120 })
    evidence.toCheckpoint3 = toCheckpoint3
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2, 6000, 'checkpoint 3')
    mark('e')

    // (d) The float basin: at low water the sub tank ledge is out of reach; at high water the hero floats up to it.
    await place(2950, 214)
    await standing('standing in the drained basin')
    await setClock(27000)
    const dryJump = await drive({ right: false, maxFrames: 90, untilGrounded: true, jumps: [{ atX: -1e6, hold: 40 }] })
    const afterDry = await readState(page)
    evidence.dryJump = { dryJump, landedY: afterDry.player.y, basin: water(afterDry, 'tide_float_basin') }
    assert.equal(water(afterDry, 'tide_float_basin').phase, 'low')
    assert.ok(afterDry.player.y > 200 && !(await collected()).includes('tide_reaver:sub_tank'), `the ledge is out of reach at low water (${JSON.stringify(evidence.dryJump)})`)
    await capture('basin-low')
    await setClock(33000)
    await place(2930, 200)
    state = await waitForState(page, (next) => next.player.y < 90 && water(next, 'tide_float_basin')?.heroUnder === true, 12000, 'floated up the basin')
    evidence.float = { hero: state.player, basin: water(state, 'tide_float_basin'), environment: mech(state).heroEnvironment }
    assert.ok(water(state, 'tide_float_basin').surfaceY <= 90 && mech(state).heroEnvironment.forceY < 0, `floating under the high line (${JSON.stringify(evidence.float)})`)
    await capture('basin-high-float')
    await setClock(33000)
    const swim = await drive({ clearEnemies: true, targetX: 3012, maxFrames: 120 })
    await advanceFrames(page, 10)
    const subChecks = await collected()
    evidence.subTank = { swim, collected: subChecks }
    assert.ok(subChecks.includes('tide_reaver:sub_tank'), `sub tank collected (${subChecks})`)
    await capture('sub-tank')
    await skipDialogue()
    mark('d')

    // (f) The flooded shaft: the rising water floats the hero up; the exit sluice holds at high water, opens at low.
    await place(3312, 214)
    await setClock(35500)
    state = await waitForState(page, (next) => next.player.y < -120, 30000, 'floated up the shaft on the rising water')
    state = await capture('shaft-high')
    evidence.shaftFloat = { hero: state.player, camera: state.camera, water: water(state, 'tide_shaft_water'), segment: byId(mech(state).verticalSegments, 'tide_shaft'), environment: mech(state).heroEnvironment }
    assert.equal(byId(mech(state).verticalSegments, 'tide_shaft')?.cameraHeld, true, 'camera held to the shaft')
    assert.ok(state.camera.scrollY < -100, `camera followed up (scrollY ${state.camera.scrollY})`)
    assert.equal(water(state, 'tide_shaft_water').gateClosed, true, 'the exit sluice is shut while the water is up')
    await place(3208, -236)
    await advanceFrames(page, 20)
    const capsuleChecks = await collected()
    assert.ok(capsuleChecks.includes('tide_reaver:capsule'), `capsule collected in the alcove (${capsuleChecks})`)
    await capture('capsule')
    await skipDialogue()
    await setClock(39000)
    await place(3528, -172)
    const blocked = await drive({ targetX: 3620, maxFrames: 40 })
    state = await readState(page)
    evidence.shaftBlocked = { blocked, water: water(state, 'tide_shaft_water') }
    assert.ok(blocked.x < 3568 && water(state, 'tide_shaft_water').gateClosed === true, `the exit sluice holds at high water (${JSON.stringify(evidence.shaftBlocked)})`)
    await setClock(45000)
    await standing('standing on the top ledge at low water')
    await setClock(45000)
    state = await readState(page)
    assert.deepEqual([water(state, 'tide_shaft_water').phase, water(state, 'tide_shaft_water').gateClosed], ['low', false], 'low water opens the exit sluice')
    await capture('shaft-low')
    await setClock(45000)
    const exit = await drive({ targetX: 3640, maxFrames: 120 })
    state = await waitForState(page, (next) => next.newPlayer?.locomotion?.grounded === true && next.player.x > 3584, 8000, 'landed on the works floor past the right wall')
    evidence.shaftExit = { exit, landed: state.player }
    assert.ok(Math.abs(state.player.y - 214) <= 3, `on the works floor (y ${state.player.y})`)
    await capture('shaft-exit')
    mark('f')

    // (h) The route sheet: one capture per screen; checkpoint 4's trigger is past the last one.
    evidence.route = []
    for (const [index, [x, y]] of ROUTE_SHOTS.entries()) {
      if (y < 0) await place(3360, 214)
      await place(x, y)
      await advanceFrames(page, 30)
      await page.locator('canvas').screenshot({ path: path.join(dir, `route-${String(index).padStart(2, '0')}.png`) })
      const at = await readState(page)
      evidence.route.push({ screen: index, x, y, scrollX: at.camera?.scrollX, scrollY: at.camera?.scrollY, checkpointIndex: at.stageRuntime?.checkpointIndex })
    }
    assert.equal((await readState(page)).stageRuntime.checkpointIndex, 2, 'the route pass crosses no checkpoint')
    mark('h')

    // (g) From the end of the spike lane: over the last pit, checkpoint 4, the boss room, the boss on screen.
    await shield(600000)
    await place(5010, 214)
    await standing('standing at the end of the spike lane')
    const approach = await drive({ clearEnemies: true, targetX: 5300, maxFrames: 240, jumps: [{ atX: 5086, hold: 12 }] })
    evidence.bossApproach = approach
    await waitForState(page, (next) => next.stageRuntime?.bossRoom?.cameraLocked === true, 45000, 'boss room camera lock')
    await skipDialogue()
    await advanceFrames(page, 30)
    state = await capture('boss-room')
    assert.equal(state.stageRuntime.checkpointIndex, 3, 'checkpoint 4 crossed')
    const boss = await page.evaluate(() => {
      const game = window.__phaserGame.scene.getScene('Game')
      const body = game.bossTarget ?? game.bossBody
      const cam = game.cameras.main
      return { active: game.bossEncounterActive, x: body?.x, visible: body?.visible, alpha: body?.alpha, camLeft: cam.scrollX, camRight: cam.scrollX + 448 }
    })
    assert.equal(boss.active, true, 'the encounter starts')
    assert.ok(boss.visible && boss.alpha > 0 && boss.x > boss.camLeft && boss.x < boss.camRight, `the boss is on screen (${JSON.stringify(boss)})`)
    const hpBefore = (await readState(page)).bossState?.hp?.current
    await page.evaluate(() => window.bossDebug?.damage?.(1))
    await advanceFrames(page, 10)
    const hpAfter = (await readState(page)).bossState?.hp?.current
    assert.ok(hpAfter < hpBefore, `the boss takes damage (${hpBefore} -> ${hpAfter})`)
    evidence.boss = { ...boss, hpBefore, hpAfter }
    mark('g')

    assert.deepEqual(errors, [], 'no page errors')
    return { artifacts: dir, evidence }
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
}
