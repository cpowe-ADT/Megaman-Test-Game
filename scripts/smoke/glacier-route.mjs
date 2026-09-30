// Smoke 58-glacier-route (EVAL-P6-010, Public Archives, 12d). Runs with storyIntro=on so the checkpoint-2
// radio and the mid-boss callout reach the lane. The gallery's icicles drop on the stage clock: to reach a
// beat the smoke sets that clock test-side (`setClock`, as 55-tide-route does). Steps, each with a capture:
// (a) from the spawn, real input (hold right, jump at fixed x's) over the intro spike and the first frozen
//     pit, the ice run and the second pit, under the teach icicles (they drop behind the hero) and across the
//     ice shelves at a run (they crumble behind) to checkpoint 2; shielded, so spikes and enemies cannot stop it;
// (b) a frost spike takes 1 HP (its definition);
// (c) real input off crate A into the dip collects the capsule (on the route, before the mid-boss);
// (d) the cold store: standing on the ice launch ledge reads as ice; a real dash jump collects the sub tank
//     across the frozen pit, and the back wall stops the landing slide on the ledge;
// (e) a charged shot breaks the vault's ice wall and walking in collects the heart tank; real input then
//     runs the vault roof and drops past the secret spike;
// (f) the custodian's room locks (camera held, the mid-boss callout on the radio lane), the gate holds, it is
//     the Glacier skin, and the gate opens only after it falls (its fight is smoke 43);
// (g) real input through the gate crosses checkpoint 3; then the record gallery on real input: a dash slides
//     under each of the four stacks (walking into one does not pass), the hero ends past the exit stack;
// (h) the gallery's rhythm: a beat shakes an icicle with its floor shadow while the hero waits on a grip
//     patch, a hero under one takes 2 HP, a frozen pit kills and the checkpoint-3 respawn stands the hero;
// (j) one capture per screen, `route-00.png` to `route-11.png`, for the route contact sheet (warps, shielded);
// (i) real input over the lane's last pit and spike crosses checkpoint 4 into the boss room; the boss is on
//     screen and takes damage.
// Placement between steps is test-side (`place`); order follows the checkpoints so each crossing is real.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const PERIOD_MS = 2400

export async function runGlacierRouteScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
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
  const standing = (label, ms = 5000) => waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, ms, label)
  const shield = (ms) => page.evaluate((value) => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(value), ms)
  const collected = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').progressionSave?.collectedChecks ?? [])
  // The stage clock the gallery's icicles read (`StageMechanicsAdapter`, scene data `stageMechanics`).
  const setClock = async (ms) => {
    await page.evaluate((value) => { window.__phaserGame.scene.getScene('Game').data.get('stageMechanics').clockMs = value }, ms)
  }
  // A beat on demand: once the icicle hangs again (a shattered one misses a window while it regrows), the
  // clock goes to 10ms before its next shake window.
  const beatOn = async (id, offsetMs, beforeBeat = async () => {}) => {
    await waitForState(page, (next) => byId(mech(next).icicles, id)?.phase === 'hanging', 4000, `${id} hangs`)
    await beforeBeat()
    const clock = Number(mech(await readState(page)).clockMs ?? 0)
    const next = offsetMs + (Math.floor((clock - offsetMs) / PERIOD_MS) + 2) * PERIOD_MS
    await setClock(next - 10)
    return next
  }
  // Real input, one frame at a time in the page (the loop asleep, fixed 1/60s steps; see pyro-route.mjs):
  // hold right; at each jump x, once grounded, hold jump for `hold` frames; at each dash x, once grounded,
  // hold dash for `hold` frames. `keepHeld` carries the held set from frame to frame, so a held dash is one
  // press (the default clears it after each call, which reads as a release and ends a ground dash).
  const drive = (plan) => page.evaluate((plan) => {
    const loop = window.__phaserGame.loop
    const wasRunning = loop.running
    if (wasRunning) loop.sleep()
    try {
      return driveAsleep(plan)
    } finally {
      window.stageDebug.replayInputs([{ frame: 0, held: [] }])
      if (wasRunning) loop.wake()
    }
    function driveAsleep(plan) {
      const game = window.__phaserGame.scene.getScene('Game')
      const jumps = [...(plan.jumps ?? [])].sort((a, b) => a.atX - b.atX)
      const dashes = [...(plan.dashes ?? [])].sort((a, b) => a.atX - b.atX)
      const log = []
      let jumpHold = 0
      let dashHold = 0
      let nextJump = 0
      let nextDash = 0
      let frames = 0
      let minY = game.player.y
      let minBodyHeight = game.player.body?.height ?? 22
      for (; frames < plan.maxFrames; frames += 1) {
        const x = game.player.x
        minY = Math.min(minY, game.player.y)
        minBodyHeight = Math.min(minBodyHeight, game.player.body?.height ?? 22)
        if (x >= plan.targetX || game.playerHp <= 0) break
        const grounded = Boolean(game.player.body?.blocked?.down)
        if (jumpHold === 0 && nextJump < jumps.length && x >= jumps[nextJump].atX && grounded) {
          jumpHold = jumps[nextJump].hold
          log.push({ jumpAtX: Math.round(x), y: Math.round(game.player.y) })
          nextJump += 1
        }
        if (dashHold === 0 && nextDash < dashes.length && x >= dashes[nextDash].atX && grounded) {
          dashHold = dashes[nextDash].hold
          log.push({ dashAtX: Math.round(x), y: Math.round(game.player.y) })
          nextDash += 1
        }
        const held = [...(plan.stay ? [] : ['moveRight']), ...(dashHold > 0 ? ['dash'] : []), ...(jumpHold > 0 ? ['jump'] : [])]
        window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }], { keepHeld: true })
        if (jumpHold > 0) jumpHold -= 1
        if (dashHold > 0) dashHold -= 1
      }
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), minY: Math.round(minY), minBodyHeight, hp: game.playerHp, log }
    }
  }, plan)
  // One input script in the page, the loop asleep: the measured dash jump (output/measure-jump.mjs) holds dash
  // from frame 0 and adds jump on frame 3.
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
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'glacier_ronin' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'glacier_ronin', 15000, 'glacier loaded')
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    let state = await capture('spawn')
    assert.equal(state.stageRuntime.checkpointIndex, 0)
    evidence.icicleCount = mech(state).icicles?.length
    assert.equal(mech(state).icicles?.length, 11, 'eleven icicles')

    // (a) Spawn to checkpoint 2 on real input: one jump clears the intro spike and the first pit, one clears
    // the second pit and the teach spike off the end of the ice; the ice shelves are walked at a run.
    await shield(600000)
    const walk = await drive({ targetX: 1400, maxFrames: 900, jumps: [{ atX: 328, hold: 40 }, { atX: 772, hold: 40 }] })
    evidence.walkToCheckpoint2 = walk
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 4000, 'checkpoint 2 on real input')
    assert.ok(walk.x >= 1384 && walk.hp > 0, `walked to checkpoint 2 (${JSON.stringify(walk)})`)
    const teachIcicles = ['glacier_icicle_teach_1', 'glacier_icicle_teach_2'].map((id) => byId(mech(state).icicles, id)?.phase)
    evidence.teachIcicles = teachIcicles
    assert.ok(teachIcicles.every((phase) => phase !== 'hanging'), `the teach icicles dropped as the hero passed (${teachIcicles})`)
    const shelves = (mech(state).crumbles ?? mech(state).crumbleGroups ?? [])
    evidence.shelves = shelves
    await capture('checkpoint-2')
    mark('a')

    // (b) A frost spike: 1 HP a touch (its definition).
    await shield(0)
    const hpBefore = (await readState(page)).playerState.hp
    await place(360, 214)
    state = await waitForState(page, (next) => next.playerState?.hp < hpBefore, 6000, 'the spike hurts')
    evidence.spike = { hpBefore, hpAfter: state.playerState.hp }
    assert.equal(hpBefore - state.playerState.hp, 1, 'spike damage from its definition')
    await capture('spike-hit')
    mark('b')
    await shield(600000)

    // (c) The capsule: walking off crate A drops into the dip where it sits.
    await place(1656, 170)
    await standing('on crate A')
    const dip = await drive({ targetX: 1708, maxFrames: 90 })
    await advanceFrames(page, 20)
    const capsuleChecks = await collected()
    evidence.capsule = { dip, collected: capsuleChecks }
    assert.ok(capsuleChecks.includes('glacier_ronin:capsule'), `capsule collected in the dip (${capsuleChecks})`)
    await capture('capsule')
    mark('c')

    // (d) The cold store. Onto the store floor first (the tall room raises the world's ceiling), then the launch ledge.
    await place(1808, 214)
    await place(1828, 60)
    await standing('on the ice launch ledge')
    state = await capture('store-launch')
    assert.equal(byId(mech(state).iceFloors, 'glacier_store_launch')?.heroOn, true, 'the launch ledge is ice underfoot')
    assert.equal(byId(mech(state).verticalSegments, 'glacier_cold_store')?.cameraHeld, true, 'camera held to the cold store')
    const dashJump = await replay([{ frame: 0, held: ['moveRight', 'dash'] }, { frame: 3, held: ['moveRight', 'dash', 'jump'] }, { frame: 70, held: ['moveRight'] }, { frame: 90, held: [] }])
    await advanceFrames(page, 20)
    const subChecks = await collected()
    state = await readState(page)
    evidence.subTank = { dashJump, collected: subChecks, landed: state.player }
    assert.ok(subChecks.includes('glacier_ronin:sub_tank'), `sub tank collected by the dash jump (${JSON.stringify(dashJump)})`)
    assert.ok(state.player.x > 2152 && state.player.x < 2200 && state.player.y < 90 && state.newPlayer?.locomotion?.grounded, `the back wall stopped the slide on the ledge (${JSON.stringify(state.player)})`)
    await capture('subtank')
    mark('d')

    // (e) The ice vault: a charged shot breaks its wall, the heart inside; then the roof on real input.
    await place(2296, 214)
    await standing('before the ice wall')
    assert.equal(byId(mech(await readState(page)).breakableWalls, 'glacier_ice_wall')?.phase, 'intact')
    await tapKey(page, 'ArrowRight', 2)
    await capture('ice-wall')
    await page.keyboard.down('x')
    await advanceFrames(page, 50)
    await page.keyboard.up('x')
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'glacier_ice_wall')?.phase === 'broken', 4000, 'a charged shot breaks the ice wall')
    const heartWalk = await drive({ targetX: 2456, maxFrames: 240 })
    await advanceFrames(page, 20)
    const heartChecks = await collected()
    evidence.heart = { walk: heartWalk, collected: heartChecks }
    assert.ok(heartChecks.includes('glacier_ronin:heart_tank'), `heart tank collected (${heartChecks})`)
    await capture('heart-vault')
    // Up onto the roof, over the roof spike, off the bulkhead past the secret spike.
    await place(2250, 214)
    const roof = await drive({ targetX: 2690, maxFrames: 400, jumps: [{ atX: 2290, hold: 30 }, { atX: 2466, hold: 20 }] })
    evidence.roof = roof
    assert.ok(roof.x >= 2690 && roof.minY < 150, `ran the vault roof into the mid-boss room (${JSON.stringify(roof)})`)
    mark('e')

    // (f) The custodian's room: locks on entry, holds the camera, plays the callout; opens only after it falls.
    await place(2708, 214)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'locked', 3000, 'the custodian room locks')
    assert.equal(mech(state).roomLocks[0].cameraHeld, true, 'the camera is held to the room')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /slides further than it means to/i.test(next.ticker.text ?? ''), 20000, 'mid-boss callout on the radio lane')
    assert.equal(callout.dialogue?.active ?? false, false, 'the callout never blocks')
    await waitForState(page, (next) => (next.enemySpawner?.activeMarkers ?? 0) >= 1, 4000, 'the custodian spawned')
    await advanceFrames(page, 30)
    await capture('midboss-locked')
    const custodian = await page.evaluate(() => {
      const entity = window.__phaserGame.scene.getScene('Game').enemySpawner.getEntities().find((entry) => entry.id === 'glacier_mid_custodian')
      return entity ? { typeKey: entity.definition?.typeKey ?? entity.typeKey, x: Math.round(entity.sprite.x), y: Math.round(entity.sprite.y), texture: entity.sprite.texture?.key, frame: entity.sprite.frame?.name } : null
    })
    evidence.custodian = custodian
    assert.equal(custodian?.typeKey, 'custodian_walker_glacier', `the Glacier skin (${JSON.stringify(custodian)})`)
    const pushed = await drive({ targetX: 3170, maxFrames: 200 })
    assert.ok(pushed.x < 3136, `the closed gate holds (x ${pushed.x})`)
    evidence.pushed = pushed
    let tries = 0
    for (; tries < 20; tries += 1) {
      const hit = await page.evaluate(() => {
        const game = window.__phaserGame.scene.getScene('Game')
        const entity = game.enemySpawner.getEntities().find((entry) => entry.id === 'glacier_mid_custodian')
        if (!entity || !entity.sprite.active) return 'gone'
        game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_58' })
        return 'hit'
      })
      if (hit === 'gone') break
      await advanceFrames(page, 15)
      if (mech(await readState(page)).roomLocks?.[0]?.phase === 'open') break
    }
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'open' && !mech(next).roomLocks[0].gateClosed, 6000, 'the gate opens after the custodian')
    evidence.midboss = { lock: mech(state).roomLocks[0], tries }
    await capture('midboss-open')
    mark('f')

    // (g) Through the gate to checkpoint 3, then the gallery on real input: without a dash the entrance stack
    // holds the hero; a dash slides under each of the four stacks.
    const through = await drive({ targetX: 3200, maxFrames: 200 })
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2, 4000, 'checkpoint 3 on real input')
    evidence.checkpoint3 = through
    const blocked = await drive({ targetX: 3300, maxFrames: 90 })
    evidence.stackBlocks = blocked
    assert.ok(blocked.x < 3232, `walking into the entrance stack does not pass (x ${blocked.x})`)
    await place(3180, 214)
    await standing('before the gallery')
    const gallery = await drive({ targetX: 4420, maxFrames: 900, dashes: [{ atX: 3196, hold: 30 }, { atX: 3566, hold: 30 }, { atX: 3934, hold: 30 }, { atX: 4334, hold: 30 }] })
    evidence.gallery = gallery
    assert.ok(gallery.x >= 4420 && gallery.hp > 0, `slid through the gallery (${JSON.stringify(gallery)})`)
    assert.ok(gallery.minBodyHeight <= 14, `the slide body (${gallery.minBodyHeight}px) passed the stacks`)
    assert.ok(gallery.log.filter((entry) => 'dashAtX' in entry).length === 4, 'one slide per stack')
    await capture('gallery-exit')
    mark('g')

    // (h) The rhythm. On bay 1's grip patch, a beat shakes the lane icicles with their floor shadows; a hero
    // under one takes 2 HP; a frozen pit kills and the respawn stands the hero at checkpoint 3.
    await place(3384, 214)
    await standing('on the first grip patch')
    evidence.beat1a = await beatOn('glacier_icicle_gallery_1a', 0)
    await advanceFrames(page, 12)
    state = await capture('gallery-shadow')
    const lane1a = byId(mech(state).icicles, 'glacier_icicle_gallery_1a')
    evidence.rhythm = { lane1a, hero: state.player }
    assert.ok(lane1a?.rhythm && (lane1a.phase === 'shaking' || lane1a.phase === 'falling') && lane1a.shadow === true, `the beat shakes it with its shadow (${JSON.stringify(lane1a)})`)
    assert.equal(state.playerState.hp > 0 && state.newPlayer?.locomotion?.grounded, true, 'the grip patch is safe')
    await waitForState(page, (next) => byId(mech(next).icicles, 'glacier_icicle_gallery_1a')?.phase === 'shattered', 4000, 'it shatters on the ice lane')
    await capture('gallery-shatter')
    // Bay 1's turret and mine go first (test-side), so only the icicle can hurt the hero in this check.
    await page.evaluate(() => {
      const game = window.__phaserGame.scene.getScene('Game')
      for (const entity of game.enemySpawner.getEntities().filter((entry) => ['glacier_gallery_turret_1', 'glacier_gallery_mine'].includes(entry.id) && entry.sprite.active)) {
        game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_58' })
      }
    })
    await advanceFrames(page, 30)
    const hitsBefore = byId(mech(await readState(page)).icicles, 'glacier_icicle_gallery_1b')?.hits ?? 0
    let hpIce = 0
    evidence.beat1b = await beatOn('glacier_icicle_gallery_1b', 800, async () => {
      await shield(0)
      hpIce = (await readState(page)).playerState.hp
      await place(3456, 214)
    })
    state = await waitForState(page, (next) => next.playerState?.hp < hpIce, 4000, 'the beat drops the icicle on the hero')
    const icicleAfter = byId(mech(state).icicles, 'glacier_icicle_gallery_1b')
    evidence.icicleHit = { hpBefore: hpIce, hpAfter: state.playerState.hp, hitsBefore, icicle: icicleAfter }
    assert.equal(icicleAfter?.hits, hitsBefore + 1, 'the beat dropped it on the hero')
    assert.equal(hpIce - state.playerState.hp, 2, 'icicle damage')
    await capture('gallery-hit')
    await place(5088, 150)
    await waitForState(page, (next) => next.playerState?.hp === 0, 8000, 'the frozen pit kills')
    await capture('pit-death')
    state = await waitForState(page, (next) => next.playerState?.hp > 0, 12000, 'respawn after the pit')
    await advanceFrames(page, 60)
    state = await readState(page)
    evidence.respawn = state.player
    assert.ok(Math.abs(state.player.x - 3184) < 24 && state.newPlayer?.locomotion?.grounded && Math.abs(state.player.y - 214) <= 2, `respawned standing at checkpoint 3 (${JSON.stringify(state.player)})`)
    await capture('respawn-checkpoint-3')
    mark('h')

    // (j) The route contact sheet: one capture per screen, the hero on that screen's floor (or the vault roof).
    await shield(600000)
    const screens = [[224, 214], [672, 214], [1100, 214], [1568, 214], [2130, 214], [2464, 140], [2912, 214], [3384, 214], [3752, 214], [4264, 214], [4700, 214], [5150, 214]]
    for (const [index, [x, y]] of screens.entries()) {
      await place(x, y)
      await advanceFrames(page, 30)
      await capture(`route-${String(index).padStart(2, '0')}`)
    }
    mark('j')

    // (i) Over the last pit and spike, checkpoint 4, the boss room, the boss on screen.
    await shield(600000)
    await place(5000, 214)
    await standing('standing before the last pit')
    const approach = await drive({ targetX: 5300, maxFrames: 240, jumps: [{ atX: 5016, hold: 20 }, { atX: 5150, hold: 20 }] })
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
    mark('i')

    assert.deepEqual(errors, [], 'no page errors')
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    return { artifacts: dir, evidence }
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
}
