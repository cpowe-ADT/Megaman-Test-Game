// Smoke 54-mire-route (EVAL-P6-010, Medicine District, 12d). Runs with storyIntro=on so the checkpoint-2
// radio and the mid-boss callout reach the lane. Steps, each with a capture:
// (a) from the spawn, real input (hold right, jump at fixed x's) over the crate step, the first acid pit,
//     the crates and the walkway pit to checkpoint 2; shielded, so thorns and enemies cannot stop the walk;
// (b) the intro thorns take 2 HP (their definition);
// (c) real input off crate A into the dip collects the capsule (on the route, escalate segment);
// (d) the serpent's room locks (camera held, the mid-boss callout on the radio lane), walking into its gate
//     does not pass, and it opens only after the drill serpent falls (its fight is smoke 43);
// (e) real input through the gate crosses checkpoint 3; a charged shot breaks the crate wall and walking in
//     collects the heart tank;
// (f) the filter tower: a real dash jump from the launch ledge collects the sub tank with the acid still
//     dormant; walking through the hatch trips the filter switch and the acid rises; from the climb's top
//     ledge real input clears the right wall onto the works floor; the acid kills and the checkpoint-3
//     respawn resets it (the switch re-armed); an acid pit kills; after each death the hero stands;
// (g) real input over the last pit crosses checkpoint 4 into the boss room; the boss is on screen and takes damage.
// Placement between steps is test-side (`place`); order follows the checkpoints so each crossing is real.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

export async function runMireRouteScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
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
  const acidOf = (state) => byId(mech(state).risingLiquids, 'mire_acid')
  const place = async (x, y) => {
    await page.evaluate(({ x, y }) => {
      const hero = window.__phaserGame.scene.getScene('Game').player
      hero.setPosition(x, y)
      hero.body?.setVelocity?.(0, 0)
    }, { x, y })
    await advanceFrames(page, 3)
  }
  const standing = (label, ms = 5000) => waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, ms, label)
  const shield = (ms) => page.evaluate((value) => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(value), ms)
  const collected = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').progressionSave?.collectedChecks ?? [])
  // Real input, one frame at a time in the page (the loop asleep, fixed 1/60s steps; see pyro-route.mjs):
  // hold right (and dash when asked); at each jump x, once grounded, hold jump for `hold` frames.
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
      let stuck = 0
      let lastX = game.player.x
      for (; frames < plan.maxFrames; frames += 1) {
        const x = game.player.x
        minY = Math.min(minY, game.player.y)
        if (x >= plan.targetX || game.playerHp <= 0) break
        const grounded = Boolean(game.player.body?.blocked?.down)
        // Pressed against a face for 20 grounded frames: jump again (`unstick`, logged), only where the plan asks.
        stuck = grounded && hold === 0 && Math.abs(x - lastX) < 0.5 ? stuck + 1 : 0
        lastX = x
        if (hold === 0 && next < jumps.length && x >= jumps[next].atX && grounded) {
          hold = jumps[next].hold
          log.push({ jumpAtX: Math.round(x), y: Math.round(game.player.y) })
          next += 1
        } else if (plan.unstick && stuck >= 20) {
          hold = 40
          stuck = 0
          log.push({ unstickAtX: Math.round(x), y: Math.round(game.player.y) })
        }
        const held = ['moveRight', ...(plan.dash ? ['dash'] : []), ...(hold > 0 ? ['jump'] : [])]
        window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }])
        if (hold > 0) hold -= 1
      }
      window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), minY: Math.round(minY), hp: game.playerHp, log }
    }
  }, plan)
  // One input script in the page, the loop asleep: the measured dash jump (output/measure-jump.mjs) holds dash
  // from frame 0 and adds jump on frame 3; the per-frame drive re-sends its rows and loses the ground dash.
  const replay = (script) => page.evaluate((script) => {
    const loop = window.__phaserGame.loop
    const wasRunning = loop.running
    if (wasRunning) loop.sleep()
    try {
      window.stageDebug.replayInputs(script)
      const game = window.__phaserGame.scene.getScene('Game')
      return { x: Math.round(game.player.x), y: Math.round(game.player.y), hp: game.playerHp }
    } finally {
      if (wasRunning) loop.wake()
    }
  }, script)
  const evidence = { timingMs: {} }
  const startedAt = Date.now()
  const mark = (label) => { evidence.timingMs[label] = Date.now() - startedAt }
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'mire_wraith' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'mire_wraith', 15000, 'mire loaded')
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    let state = await capture('spawn')
    assert.equal(state.stageRuntime.checkpointIndex, 0)
    assert.equal(acidOf(state)?.phase, 'dormant', 'the acid waits for its switch')

    // (a) Spawn to checkpoint 2 on real input: over the crate step and the thorns, the first pit onto the
    // teach crates, off them over the walkway pit, the second crate, then the teach floor to the checkpoint.
    await shield(600000)
    const walk = await drive({ targetX: 1400, maxFrames: 900, unstick: true, jumps: [{ atX: 176, hold: 40 }, { atX: 440, hold: 40 }, { atX: 790, hold: 40 }, { atX: 1090, hold: 40 }] })
    evidence.walkToCheckpoint2 = walk
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 4000, 'checkpoint 2 on real input')
    assert.ok(walk.x >= 1376 && walk.hp > 0, `walked to checkpoint 2 (${JSON.stringify(walk)})`)
    await capture('checkpoint-2')
    mark('a')

    // (b) The intro thorns: 2 HP a touch (their definition).
    await shield(0)
    const hpBefore = (await readState(page)).playerState.hp
    await place(360, 214)
    state = await waitForState(page, (next) => next.playerState?.hp < hpBefore, 6000, 'the thorns hurt')
    evidence.thorns = { hpBefore, hpAfter: state.playerState.hp }
    assert.equal(hpBefore - state.playerState.hp, 2, 'thorn damage from its definition')
    await capture('thorns-hit')
    mark('b')
    await shield(600000)

    // (c) The capsule: walking off crate A drops into the dip where it sits.
    await place(1968, 170)
    await standing('on crate A')
    const dip = await drive({ targetX: 2028, maxFrames: 90 })
    await advanceFrames(page, 20)
    const capsuleChecks = await collected()
    evidence.capsule = { dip, collected: capsuleChecks }
    assert.ok(capsuleChecks.includes('mire_wraith:capsule'), `capsule collected in the dip (${capsuleChecks})`)
    await capture('capsule')
    mark('c')

    // (d) The serpent's room: locks on entry, holds the camera, plays the callout; opens only after the serpent falls.
    await place(2256, 214)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'locked', 3000, 'the serpent room locks')
    assert.equal(mech(state).roomLocks[0].cameraHeld, true, 'the camera is held to the room')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /drilling through the walls/i.test(next.ticker.text ?? ''), 20000, 'mid-boss callout on the radio lane')
    assert.equal(callout.dialogue?.active ?? false, false, 'the callout never blocks')
    await capture('midboss-locked')
    const pushed = await drive({ targetX: 2720, maxFrames: 200 })
    assert.ok(pushed.x < 2688, `the closed gate holds (x ${pushed.x})`)
    evidence.pushed = pushed
    await waitForState(page, (next) => (next.enemySpawner?.activeMarkers ?? 0) >= 1, 4000, 'the serpent spawned')
    // It cannot be hurt while burrowed: hit it until it falls (each try a surfaced window or a no-op).
    let tries = 0
    for (; tries < 40; tries += 1) {
      const hit = await page.evaluate(() => {
        const game = window.__phaserGame.scene.getScene('Game')
        const entity = game.enemySpawner.getEntities().find((entry) => entry.id === 'mire_mid_serpent')
        if (!entity || !entity.sprite.active) return 'gone'
        game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_54' })
        return 'hit'
      })
      if (hit === 'gone') break
      await advanceFrames(page, 15)
      if (mech(await readState(page)).roomLocks?.[0]?.phase === 'open') break
    }
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'open' && !mech(next).roomLocks[0].gateClosed, 6000, 'the gate opens after the serpent')
    evidence.midboss = { lock: mech(state).roomLocks[0], tries }
    await capture('midboss-open')
    mark('d')

    // (e) Through the gate to checkpoint 3, then the crate room: a charged shot breaks its wall, the heart inside.
    const through = await drive({ targetX: 2790, maxFrames: 200 })
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2, 4000, 'checkpoint 3 on real input')
    evidence.checkpoint3 = through
    assert.equal(byId(mech(state).breakableWalls, 'mire_crate_wall')?.phase, 'intact')
    await tapKey(page, 'ArrowRight', 2)
    await capture('crate-wall')
    await page.keyboard.down('x')
    await advanceFrames(page, 50)
    await page.keyboard.up('x')
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'mire_crate_wall')?.phase === 'broken', 4000, 'a charged shot breaks the crate wall')
    const heartWalk = await drive({ targetX: 2950, maxFrames: 240 })
    await advanceFrames(page, 20)
    const heartChecks = await collected()
    evidence.heart = { walk: heartWalk, collected: heartChecks }
    assert.ok(heartChecks.includes('mire_wraith:heart_tank'), `heart tank collected (${heartChecks})`)
    await capture('heart-room')
    mark('e')

    // (f) The filter tower. The sub tank: a real dash jump from the launch ledge, before the switch is tripped.
    // Onto the tower floor first (the tall room raises the world's ceiling), then up onto the launch ledge.
    await place(3176, 214)
    await place(3160, 60)
    await standing('on the launch ledge')
    state = await capture('tower-launch')
    assert.equal(byId(mech(state).verticalSegments, 'mire_filter_tower')?.cameraHeld, true, 'camera held to the tower')
    const dashJump = await replay([{ frame: 0, held: ['moveRight', 'dash'] }, { frame: 3, held: ['moveRight', 'dash', 'jump'] }, { frame: 70, held: ['moveRight'] }, { frame: 90, held: [] }])
    await advanceFrames(page, 20)
    const subChecks = await collected()
    state = await readState(page)
    evidence.subTank = { dashJump, collected: subChecks, acid: acidOf(state) }
    assert.ok(subChecks.includes('mire_wraith:sub_tank'), `sub tank collected by the dash jump (${JSON.stringify(dashJump)})`)
    assert.equal(acidOf(state)?.phase, 'dormant', 'the acid is still dormant: the switch is past the sub tank')
    await capture('subtank')
    // The switch: the floor under the sub tank is safe; walking through the hatch trips it.
    await place(3470, 214)
    await standing('on the pre-chamber floor')
    assert.equal(acidOf(await readState(page))?.phase, 'dormant')
    // The acid covers the shaft floor about 1.4s after the trip: the loop sleeps while the trip is read
    // and captured, and the hero goes up to the fourth ledge (covered about 7s after the trip) before it wakes.
    const hatch = await drive({ targetX: 3566, maxFrames: 120 })
    await page.evaluate(() => window.__phaserGame.loop.sleep())
    state = await capture('switch-tripped')
    evidence.switch = { hatch, acid: acidOf(state) }
    assert.equal(acidOf(state)?.phase, 'rising', `walking through the hatch trips the switch (${JSON.stringify(hatch)})`)
    await page.evaluate(() => {
      const hero = window.__phaserGame.scene.getScene('Game').player
      hero.setPosition(3704, 40)
      hero.body?.setVelocity?.(0, 0)
      window.__phaserGame.loop.wake()
    })
    await advanceFrames(page, 150)
    state = await capture('acid-rising')
    assert.ok(acidOf(state).phase === 'rising' && acidOf(state).surfaceY < 236, `the acid is over the floor (surface ${acidOf(state).surfaceY})`)
    assert.ok(state.playerState?.hp > 0, 'the hero on the fourth ledge is above it')
    evidence.acidRising = acidOf(state)
    // The climb's top: the camera followed up; real input from the exit ledge (never covered) clears the right wall.
    await place(3824, -180)
    await advanceFrames(page, 10)
    state = await capture('tower-top')
    assert.ok(state.camera.scrollY < -100, `camera followed up (scrollY ${state.camera.scrollY})`)
    const exit = await drive({ targetX: 3950, maxFrames: 240, jumps: [{ atX: 3824, hold: 40 }] })
    state = await waitForState(page, (next) => next.newPlayer?.locomotion?.grounded === true && next.player.x > 3896, 4000, 'landed on the works floor past the right wall')
    evidence.towerExit = { exit, landed: state.player }
    await capture('tower-exit')
    // The acid kills; the checkpoint-3 respawn resets it and re-arms the switch; the hero stands.
    await place(3600, 214)
    state = await waitForState(page, (next) => next.playerState?.hp === 0, 8000, 'the acid kills')
    await capture('acid-death')
    state = await waitForState(page, (next) => next.playerState?.hp > 0 && acidOf(next)?.phase === 'dormant', 12000, 'respawn resets the acid')
    assert.ok(Math.abs(state.player.x - 2736) < 24, `respawned at checkpoint 3 (x ${state.player.x})`)
    evidence.acidReset = acidOf(state)
    await capture('respawn-checkpoint-3')
    const holdsAfterRespawn = async (label) => {
      await advanceFrames(page, 60)
      const held = await readState(page)
      assert.ok(held.playerState?.hp > 0, `${label}: alive a second after the respawn (hp ${held.playerState?.hp})`)
      assert.equal(held.newPlayer?.locomotion?.grounded, true, `${label}: standing after the respawn`)
      assert.ok(Math.abs(held.player.y - 214) <= 2, `${label}: feet on the floor (y ${held.player.y})`)
      return held.player
    }
    evidence.respawnHoldsAfterAcid = await holdsAfterRespawn('acid')
    await place(5192, 150)
    await waitForState(page, (next) => next.playerState?.hp === 0, 8000, 'the acid pit kills')
    await waitForState(page, (next) => next.playerState?.hp > 0, 12000, 'respawn after the pit')
    evidence.respawnHoldsAfterPit = await holdsAfterRespawn('pit')
    mark('f')

    // (g) Over the last pit, checkpoint 4, the boss room, the boss on screen.
    await standing('alive before the boss approach', 15000)
    await shield(600000)
    await place(5100, 214)
    await standing('standing before the last pit')
    const approach = await drive({ targetX: 5300, maxFrames: 200, jumps: [{ atX: 5116, hold: 20 }] })
    evidence.bossApproach = approach
    await waitForState(page, (next) => next.stageRuntime?.bossRoom?.cameraLocked === true, 45000, 'boss room camera lock')
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const next = await readState(page)
      if (!next.dialogue?.active) break
      await page.evaluate(() => window.stageDebug.skipDialogue())
      await advanceFrames(page, 4)
    }
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
    const bossHpBefore = (await readState(page)).bossState?.hp?.current
    await page.evaluate(() => window.bossDebug?.damage?.(1))
    await advanceFrames(page, 10)
    const bossHpAfter = (await readState(page)).bossState?.hp?.current
    assert.ok(bossHpAfter < bossHpBefore, `the boss takes damage (${bossHpBefore} -> ${bossHpAfter})`)
    evidence.boss = { ...boss, hpBefore: bossHpBefore, hpAfter: bossHpAfter }
    mark('g')

    assert.deepEqual(errors, [], 'no page errors')
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    return { artifacts: dir, evidence }
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
}
