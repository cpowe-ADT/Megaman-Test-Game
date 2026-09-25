// Smoke 50-pyro-route (EVAL-P6-009, Heat Works pilot stage). Runs with storyIntro=on so the checkpoint-2
// radio and the mid-boss callout reach the lane. Steps, each with a capture:
// (a) from the spawn, real input (hold right, jump at fixed x's) over the first step, pit and deck to
//     checkpoint 2; the hero is shielded, so the vents and enemies it passes cannot stop the walk;
// (b) the intro vent does not hurt while quiet and takes 2 HP when it fires;
// (d) a charged shot breaks the secret wall and walking in collects the sub tank;
// (e) the catwalk room locks (camera held, the mid-boss callout on the radio lane), walking into its gate
//     does not pass, and it opens only after the custodian walker falls (its fight is smoke 43);
// (c) from checkpoint 3, walking in starts the slag; from the top ledge real input clears the right wall
//     onto the works floor; the capsule alcove is reachable (warp plus assert); the slag kills and resets;
// (f) real input from the end of the vent lane over the last pit crosses checkpoint 4 into the boss room,
//     and the boss is on screen and takes damage.
// Placement between steps is test-side (`place`); order follows the checkpoints so each crossing is real.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

export async function runPyroRouteScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
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
  const place = async (x, y) => {
    await page.evaluate(({ x, y }) => {
      const hero = window.__phaserGame.scene.getScene('Game').player
      hero.setPosition(x, y)
      hero.body?.setVelocity?.(0, 0)
    }, { x, y })
    await advanceFrames(page, 3)
  }
  const shield = (ms) => page.evaluate((value) => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(value), ms)
  const collected = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').progressionSave?.collectedChecks ?? [])
  // Real input, one frame at a time in the page: hold right (and dash when asked); at each jump x, once
  // grounded, hold jump for `hold` frames. Stops at `targetX`, on a death, or at `maxFrames`. The game
  // loop sleeps for the whole drive: a per-call wake would run an extra real-time frame between the
  // fixed 1/60s steps, and on a loaded machine that frame's delta changed the jumps.
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
    for (; frames < plan.maxFrames; frames += 1) {
      const x = game.player.x
      if (x >= plan.targetX || game.playerHp <= 0) break
      const grounded = Boolean(game.player.body?.blocked?.down)
      if (hold === 0 && next < jumps.length && x >= jumps[next].atX && grounded) {
        hold = jumps[next].hold
        log.push({ jumpAtX: Math.round(x), y: Math.round(game.player.y) })
        next += 1
      }
      const held = ['moveRight', ...(plan.dash ? ['dash'] : []), ...(hold > 0 ? ['jump'] : [])]
      window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }])
      if (hold > 0) hold -= 1
    }
    window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
    return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), hp: game.playerHp, log }
    }
  }, plan)
  const evidence = { timingMs: {} }
  const startedAt = Date.now()
  const mark = (label) => { evidence.timingMs[label] = Date.now() - startedAt }
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'pyro_maw' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'pyro_maw', 15000, 'pyro loaded')
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    let state = await capture('spawn')
    assert.equal(state.stageRuntime.checkpointIndex, 0)

    // (a) Spawn to checkpoint 2 on real input: a short hop over the intro vent onto the step, a jump off
    // the step over the first pit, a jump onto the teach deck, then the heart room floor to the checkpoint.
    await shield(600000)
    const walk = await drive({ targetX: 1400, maxFrames: 900, jumps: [{ atX: 286, hold: 8 }, { atX: 476, hold: 10 }, { atX: 744, hold: 14 }] })
    evidence.walkToCheckpoint2 = walk
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 4000, 'checkpoint 2 on real input')
    assert.ok(walk.x >= 1376 && walk.hp > 0, `walked to checkpoint 2 (${JSON.stringify(walk)})`)
    await capture('checkpoint-2')
    mark('a')

    // (b) The intro vent: quiet does not hurt, firing takes 2 HP (its definition).
    await waitForState(page, (next) => byId(mech(next).vents, 'pyro_vent_intro')?.phase === 'idle' && byId(mech(next).vents, 'pyro_vent_intro').untilFireMs > 900, 10000, 'intro vent quiet')
    await shield(0)
    await place(320, 214)
    const hpQuiet = (await readState(page)).playerState.hp
    await advanceFrames(page, 8)
    state = await readState(page)
    if (byId(mech(state).vents, 'pyro_vent_intro').phase !== 'firing') assert.equal(state.playerState.hp, hpQuiet, 'a quiet vent does not hurt')
    state = await waitForState(page, (next) => next.playerState?.hp < hpQuiet, 8000, 'the vent fires and hurts')
    evidence.vent = { hpBefore: hpQuiet, hpAfter: state.playerState.hp, phase: byId(mech(state).vents, 'pyro_vent_intro').phase }
    assert.equal(hpQuiet - state.playerState.hp, 2, 'vent damage from its definition')
    await capture('vent-hit')
    mark('b')
    await shield(600000)

    // (d) The secret: a charged shot breaks the chamber wall; walking in collects the sub tank.
    await place(2262, 214)
    await tapKey(page, 'ArrowRight', 2)
    assert.equal(byId(mech(await readState(page)).breakableWalls, 'pyro_secret_wall').phase, 'intact')
    await capture('secret-wall')
    await page.keyboard.down('x')
    await advanceFrames(page, 50)
    await page.keyboard.up('x')
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'pyro_secret_wall')?.phase === 'broken', 4000, 'charged shot breaks the secret wall')
    const secretWalk = await drive({ targetX: 2508, maxFrames: 240 })
    await waitForState(page, () => true, 1000)
    const checksAfterSecret = await collected()
    evidence.secret = { wall: byId(mech(state).breakableWalls, 'pyro_secret_wall'), walk: secretWalk, collected: checksAfterSecret }
    assert.ok(checksAfterSecret.includes('pyro_maw:sub_tank'), `sub tank collected (${checksAfterSecret})`)
    await capture('secret-room')
    mark('d')

    // (e) The catwalk room: locks on entry, holds the camera, plays the callout; opens only after the mini-boss falls.
    await place(3232, 214)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'locked', 3000, 'catwalk room locks')
    assert.equal(mech(state).roomLocks[0].cameraHeld, true, 'the camera is held to the room')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /custodian walker/i.test(next.ticker.text ?? ''), 20000, 'mid-boss callout on the radio lane')
    assert.equal(callout.dialogue?.active ?? false, false, 'the callout never blocks')
    await capture('midboss-locked')
    mark('e-locked')
    // Over the catwalk step, then into the closed gate.
    const pushed = await drive({ targetX: 3700, maxFrames: 220, jumps: [{ atX: 3246, hold: 10 }] })
    assert.ok(pushed.x < 3648, `the closed gate holds (x ${pushed.x})`)
    evidence.pushed = { ...pushed, stream: (await readState(page)).enemySpawner, entities: await page.evaluate(() => window.__phaserGame.scene.getScene('Game').enemySpawner.getEntities().map((entry) => [entry.id, Math.round(entry.sprite.x), Math.round(entry.sprite.y), entry.sprite.active])) }
    mark('e-pushed')
    state = await waitForState(page, (next) => (next.enemySpawner?.activeMarkers ?? 0) >= 1, 4000, 'mini-boss spawned')
    mark('e-spawned')
    const killStandIn = (id) => page.evaluate((id) => {
      const game = window.__phaserGame.scene.getScene('Game')
      const entity = game.enemySpawner.getEntities().find((entry) => entry.id === id)
      if (!entity) return false
      game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_50' })
      return true
    }, id)
    const ids = ['pyro_mid_custodian']
    for (const [index, id] of ids.entries()) {
      assert.ok(await killStandIn(id), `found stand-in ${id}`)
      await advanceFrames(page, 20)
      const lock = mech(await readState(page)).roomLocks[0]
      if (index < ids.length - 1) assert.deepEqual([lock.phase, lock.gateClosed], ['locked', true], `still locked after ${id}`)
    }
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'open' && !mech(next).roomLocks[0].gateClosed, 4000, 'gate opens after the mini-boss')
    evidence.midboss = mech(state).roomLocks[0]
    await capture('midboss-open')
    mark('e')

    // (c) Checkpoint 3 and the climb: the slag starts at its trigger, the top clears the right wall, the capsule alcove.
    const through = await drive({ targetX: 3790, maxFrames: 200 })
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2 && byId(mech(next).risingLiquids, 'pyro_slag')?.phase === 'rising', 4000, 'checkpoint 3 and the slag rises')
    evidence.climbEntry = { through, slag: byId(mech(state).risingLiquids, 'pyro_slag') }
    await place(3776, -236)
    await advanceFrames(page, 20)
    const capsuleChecks = await collected()
    assert.ok(capsuleChecks.includes('pyro_maw:capsule'), `capsule collected in the alcove (${capsuleChecks})`)
    await place(3904, -140)
    await advanceFrames(page, 10)
    state = await capture('climb-top')
    assert.equal(byId(mech(state).verticalSegments, 'pyro_climb')?.cameraHeld, true, 'camera held to the climb')
    assert.ok(state.camera.scrollY < -100, `camera followed up (scrollY ${state.camera.scrollY})`)
    const exit = await drive({ targetX: 4150, maxFrames: 240, jumps: [{ atX: 3904, hold: 12 }] })
    state = await waitForState(page, (next) => next.newPlayer?.locomotion?.grounded === true && next.player.x > 4096, 4000, 'landed on the works floor past the right wall')
    evidence.climbExit = { exit, landed: state.player }
    await capture('climb-exit')
    await place(3800, 214)
    state = await waitForState(page, (next) => next.playerState?.hp === 0, 8000, 'the slag kills')
    await capture('slag-death')
    state = await waitForState(page, (next) => next.playerState?.hp > 0 && byId(mech(next).risingLiquids, 'pyro_slag')?.phase === 'dormant', 12000, 'respawn resets the slag')
    assert.ok(Math.abs(state.player.x - 3680) < 24, `respawned at checkpoint 3 (x ${state.player.x})`)
    evidence.slagReset = byId(mech(state).risingLiquids, 'pyro_slag')
    await capture('respawn-checkpoint-3')
    // Craig: "when I dropped in the lava I kept on spawning in the lava and dying". The beam-in scale
    // (0.2 x 1.8) used to stretch the physics body 14px into the floor, so the hero sank and died again.
    // After a slag death and after a pit death the hero must stand on the floor a second later, alive.
    const holdsAfterRespawn = async (label) => {
      await advanceFrames(page, 60)
      const held = await readState(page)
      assert.ok(held.playerState?.hp > 0, `${label}: alive a second after the respawn (hp ${held.playerState?.hp})`)
      assert.equal(held.newPlayer?.locomotion?.grounded, true, `${label}: standing after the respawn`)
      assert.ok(Math.abs(held.player.y - 214) <= 2, `${label}: feet on the floor, not sunk into it (y ${held.player.y})`)
      return held.player
    }
    evidence.respawnHoldsAfterSlag = await holdsAfterRespawn('slag')
    await place(4312, 150)
    await waitForState(page, (next) => next.playerState?.hp === 0, 8000, 'the pit over slag kills')
    await waitForState(page, (next) => next.playerState?.hp > 0, 12000, 'respawn after the pit')
    evidence.respawnHoldsAfterPit = await holdsAfterRespawn('pit')
    mark('c')

    // (f) From the end of the vent lane: over the last pit, checkpoint 4, the boss room, the boss on screen.
    // The respawn sequence finishes on real frames: wait until the hero is alive and standing first.
    await waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, 15000, 'alive before the boss approach')
    await shield(600000)
    await place(5140, 214)
    await waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, 5000, 'standing at the end of the vent lane')
    const approach = await drive({ targetX: 5300, maxFrames: 200, jumps: [{ atX: 5150, hold: 12 }] })
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
    const hpBefore = (await readState(page)).bossState?.hp?.current
    await page.evaluate(() => window.bossDebug?.damage?.(1))
    await advanceFrames(page, 10)
    const hpAfter = (await readState(page)).bossState?.hp?.current
    assert.ok(hpAfter < hpBefore, `the boss takes damage (${hpBefore} -> ${hpAfter})`)
    evidence.boss = { ...boss, hpBefore, hpAfter }

    assert.deepEqual(errors, [], 'no page errors')
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    return { artifacts: dir, evidence }
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
}
