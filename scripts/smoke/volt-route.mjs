// Smoke 56-volt-route (EVAL-P6-010, Power District rebuilt to the Heat Works standard). Runs with storyIntro=on
// so the checkpoint-2 radio and the mid-boss callout reach the lane. The rails and the swap platforms follow the
// stage clock: to reach a phase the smoke sets that clock test-side (`setClock`), as it warps the hero between
// steps (`place`), instead of waiting out each beat. Steps, each with a capture:
// (a) from the spawn, real input (hold right, jump at fixed x's) over the intro step and the idle rail, then
//     over the teach rails and their sockets in a quiet beat, to the ferry pit; the hero is shielded;
// (b) a teach rail does not hurt while quiet and takes 2 HP while arcing;
// (c) the ferry: on real input the hero hops onto the low platform at the left rim, rides it over the pit
//     while it slides, walks off at the right rim and on to checkpoint 2;
// (d) a yard belt carries a standing hero; the heart tops the chimney in its tall room (warp plus assert;
//     the wall-kick climb is audited in tests/volt-hopper-stage.test.ts);
// (e) the rail room locks (camera held, the mid-boss callout on the radio lane), walking into its gate does
//     not pass, and it opens only after the sentry twins fall; walking on crosses checkpoint 3;
// (f) a charged shot breaks the chamber wall and walking in collects the sub tank; the capsule (the air dash)
//     is on the bulkhead;
// (g) the master corridor off the beat (rails quiet, platforms at their stations) and on it: unshielded, the
//     hero walks off a pylon onto the low platform, rides it over the arcing rails unhurt and steps onto the
//     next pylon; from a pylon top a dash jump falls short of the next pylon (the same jump with an air dash at its
//     apex is recorded beside it: the air dash ends the dash jump's carry, so it does not carry it further);
// (h) one capture per screen for the route contact sheet (`route-00.png` to `route-12.png`);
// (i) real input from the end of the rail lane over the last pit crosses checkpoint 4 into the boss
//     room, and the boss is on screen and takes damage.
// Placement between steps is test-side; order follows the checkpoints so each crossing is real. The shield
// blocks damage, not knockback: a walk that tests the terrain removes each enemy it comes within 240px of
// (`clearEnemies`, once each, never the twins), as a player's shots would.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

/** One hero position per 448px screen for the route sheet (on solid ground, off pits and rails). */
const ROUTE_SHOTS = [[224, 180], [616, 188], [1000, 214], [1420, 214], [1796, 214], [2344, 214], [2720, 214], [3200, 214], [3676, 176], [3964, 176], [4600, 214], [5040, 214], [5690, 214]]
const TWINS = 'volt_mid_twins'

export async function runVoltRouteScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
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
  const swap = (state, id) => byId(mech(state).laneSwaps, id)
  const rails = (state, id) => byId(mech(state).railGroups, id)
  const place = async (x, y) => {
    await page.evaluate(({ x, y }) => {
      const hero = window.__phaserGame.scene.getScene('Game').player
      hero.setPosition(x, y)
      hero.body?.setVelocity?.(0, 0)
    }, { x, y })
    await advanceFrames(page, 3)
  }
  // The stage clock the rails and swap platforms read (`StageMechanicsAdapter`, scene data `stageMechanics`).
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
  // frames. A press the hard-landing lag swallows is released and pressed again, and a hero stalled on the floor
  // while holding right jumps again after 10 frames, as a player would. Stops at `targetX`, on a death, when
  // `untilGrounded` lands after leaving the floor, or at `maxFrames`. Reports the highest point, the lowest HP
  // and the belts (or swap platforms) stood on.
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
      const rode = new Set()
      let hold = 0
      let next = 0
      let frames = 0
      let minY = game.player.y
      let minHp = game.playerHp
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
            if (cleared.has(entry.id) || entry.id === 'volt_mid_twins' || !entry.sprite?.active || Math.abs(entry.sprite.x - x) > 240) continue
            cleared.add(entry.id)
            game.enemySpawner.applyDamageToSprite(entry.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_56_clear' })
          }
        }
        const grounded = Boolean(game.player.body?.blocked?.down || game.player.body?.touching?.down)
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
        minHp = Math.min(minHp, game.playerHp)
        const env = game.data.get('stageMechanics')?.getDebugState?.().heroEnvironment
        if (env?.beltId) rode.add(env.beltId)
      }
      window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), minY: Math.round(minY * 10) / 10, hp: game.playerHp, minHp, rode: [...rode], cleared: [...cleared], log }
    }
  }, plan)
  // A fixed input script, one frame at a time: each row holds `held` for `frames` frames. Stops once the hero
  // lands after leaving the ground; reports the landing and the furthest x reached above `aboveY`.
  const script = (rows, aboveY, allowAirDash) => page.evaluate(({ rows, aboveY, allowAirDash }) => {
    const loop = window.__phaserGame.loop
    const wasRunning = loop.running
    if (wasRunning) loop.sleep()
    try {
      const game = window.__phaserGame.scene.getScene('Game')
      let left = false
      let frames = 0
      let farX = game.player.x
      let airDashed = false
      const trace = []
      const runtime = game.newPlayerRuntime
      const unlocked = Boolean(runtime?.modifiers?.allowAirDash)
      // Test-side: the same jump with the air dash switched off (restored below).
      runtime.setUpgradeModifiers({ ...runtime.modifiers, allowAirDash })
      outer: for (const row of rows) {
        for (let index = 0; index < row.frames; index += 1) {
          const grounded = Boolean(game.player.body?.blocked?.down || game.player.body?.touching?.down)
          if (!grounded) left = true
          if (left && grounded) break outer
          window.stageDebug.replayInputs([{ frame: 0, held: row.held }, { frame: 1, held: row.held }])
          frames += 1
          if (game.player.y + 22 <= aboveY) farX = Math.max(farX, game.player.x)
          const snap = runtime?.lastMotorSnapshot ?? {}
          airDashed = airDashed || (!grounded && Boolean(snap.airDashing))
          trace.push([frames, row.held.join('+'), Math.round(game.player.x), Math.round(game.player.y), Math.round(game.player.body?.velocity?.x ?? 0), grounded ? 1 : 0, snap.dashing ? 1 : 0, snap.airDashing ? 1 : 0])
        }
      }
      window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
      runtime.setUpgradeModifiers({ ...runtime.modifiers, allowAirDash: unlocked })
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), farX: Math.round(farX), airDashed, allowAirDash, unlocked, trace: trace.filter((_, index) => index % 3 === 0) }
    } finally {
      if (wasRunning) loop.wake()
    }
  }, { rows, aboveY, allowAirDash })
  const standing = (label, timeout = 8000) => waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, timeout, label)
  const evidence = { timingMs: {} }
  const startedAt = Date.now()
  const mark = (label) => { evidence.timingMs[label] = Date.now() - startedAt }
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`, { timeout: 90000 })
    await waitForState(page, (state) => state.scene === 'StageSelect', 30000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'volt_hopper' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'volt_hopper', 30000, 'volt loaded')
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    let state = await capture('spawn')
    assert.equal(state.stageRuntime.checkpointIndex, 0)
    assert.equal((mech(state).laneSwaps ?? []).length, 5, 'five swap pairs on the stage')
    mark('loaded')

    // (a) Spawn to the ferry pit on real input: onto the intro step, over the idle rail, then over the teach
    // rails and their sockets inside one quiet beat each (the clock set just before each drive).
    await shield(600000)
    await setClock(0)
    const walkIntro = await drive({ clearEnemies: true, targetX: 470, maxFrames: 240, jumps: [{ atX: 112, hold: 10 }, { atX: 240, hold: 10 }] })
    // The teach rails in two quiet beats, waiting out the arc between them on the first insulated socket.
    await setClock(0)
    const walkRailsA = await drive({ clearEnemies: true, targetX: 612, maxFrames: 120, jumps: [{ atX: 536, hold: 8 }] })
    await standing('standing on the first socket')
    await setClock(0)
    const walkRailsB = await drive({ clearEnemies: true, targetX: 1000, maxFrames: 240, jumps: [{ atX: 690, hold: 14 }] })
    evidence.walkToFerry = { walkIntro, walkRailsA, walkRailsB }
    await capture('walk-end')
    assert.ok(walkRailsB.x >= 1000 && walkRailsB.minHp === walkIntro.hp, `walked to the ferry pit (${JSON.stringify(evidence.walkToFerry)})`)
    mark('a')

    // (b) A teach rail: quiet does not hurt; arcing takes 2 HP (the group's damage).
    await shield(0)
    await setClock(0)
    await place(536, 214)
    await advanceFrames(page, 10)
    state = await readState(page)
    const hpQuiet = state.playerState.hp
    assert.equal(rails(state, 'volt_teach_rails').phase, 'off')
    await setClock(1500)
    state = await waitForState(page, (next) => next.playerState?.hp < hpQuiet, 5000, 'the arcing rail hurts')
    evidence.railHit = { hpBefore: hpQuiet, hpAfter: state.playerState.hp, rails: rails(state, 'volt_teach_rails') }
    assert.equal(hpQuiet - state.playerState.hp, 2, 'rail damage from its group')
    await capture('rail-hit')
    await shield(600000)
    mark('b')

    // (c) The ferry: hop onto the low platform at the left rim, ride it over the pit, walk on to checkpoint 2.
    await place(996, 214)
    await standing('standing at the ferry pit')
    await setClock(0)
    const board = await drive({ targetX: 1040, maxFrames: 60, jumps: [{ atX: 996, hold: 8 }] })
    state = await readState(page)
    evidence.ferryBoard = { board, swap: swap(state, 'volt_ferry') }
    await setClock(1300)
    const ride = await drive({ right: false, maxFrames: 110 })
    state = await readState(page)
    evidence.ferryRide = { ride, swap: swap(state, 'volt_ferry') }
    assert.ok(ride.rode.includes('volt_ferry_low') && ride.x >= 1128 && ride.y < 214, `rode the ferry over the pit (${JSON.stringify(evidence.ferryRide)})`)
    await capture('ferry-ride')
    const toCheckpoint2 = await drive({ clearEnemies: true, targetX: 1400, maxFrames: 200 })
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 6000, 'checkpoint 2 on real input')
    evidence.toCheckpoint2 = toCheckpoint2
    await capture('checkpoint-2')
    mark('c')

    // (d) A yard belt carries a standing hero; the heart tops the chimney (in on the floor first: the tall room
    // raises the world ceiling).
    await place(1880, 214)
    await standing('standing on the first yard belt')
    const beltStart = (await readState(page)).player.x
    await advanceFrames(page, 30)
    state = await readState(page)
    evidence.belt = { from: beltStart, to: state.player.x, environment: mech(state).heroEnvironment }
    assert.equal(mech(state).heroEnvironment?.beltId, 'volt_yard_belt_1')
    assert.ok(state.player.x < beltStart - 5, `the belt carries the hero back (${JSON.stringify(evidence.belt)})`)
    await place(2344, 214)
    await place(2344, 30)
    await advanceFrames(page, 20)
    const heartChecks = await collected()
    evidence.heart = { collected: heartChecks, hero: (await readState(page)).player }
    assert.ok(heartChecks.includes('volt_hopper:heart_tank'), `heart tank collected on the chimney ledge (${heartChecks})`)
    await capture('heart')
    await skipDialogue()
    mark('d')

    // (e) The rail room: locks on entry, holds the camera, plays the callout; opens only after the twins fall.
    await place(2720, 214)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'locked', 5000, 'rail room locks')
    assert.equal(mech(state).roomLocks[0].cameraHeld, true, 'the camera is held to the room')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /sentry twins/i.test(next.ticker.text ?? ''), 30000, 'mid-boss callout on the radio lane')
    assert.equal(callout.dialogue?.active ?? false, false, 'the callout never blocks')
    await capture('midboss-locked')
    await place(3104, 214)
    const pushed = await drive({ targetX: 3160, maxFrames: 30, stallJumps: false })
    state = await readState(page)
    evidence.pushed = { pushed, lock: mech(state).roomLocks[0] }
    assert.ok(pushed.x < 3136 && mech(state).roomLocks[0].gateClosed === true, `the closed gate holds (${JSON.stringify(evidence.pushed)})`)
    const twinHits = []
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const hit = await page.evaluate((id) => {
        const game = window.__phaserGame.scene.getScene('Game')
        const entity = game.enemySpawner.getEntities().find((entry) => entry.id === id)
        if (!entity) return { gone: true }
        const before = { active: entity.sprite?.active, hp: entity.hp ?? entity.state?.hp ?? entity.runtime?.hp ?? null }
        if (entity.sprite?.active) game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_56' })
        return { gone: false, ...before }
      }, TWINS)
      twinHits.push(hit)
      if (hit.gone) break
      await advanceFrames(page, 6)
    }
    evidence.twinHits = twinHits.slice(-6)
    assert.ok(twinHits.some((hit) => hit.gone === false), 'found the sentry twins')
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'open' && !mech(next).roomLocks[0].gateClosed, 15000, 'gate opens after the twins fall')
    evidence.midboss = mech(state).roomLocks[0]
    await capture('midboss-open')
    evidence.toCheckpoint3 = await drive({ targetX: 3200, maxFrames: 120 })
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2, 6000, 'checkpoint 3')
    mark('e')

    // (f) The secret: a charged shot breaks the chamber wall; walking in collects the sub tank. The capsule
    // (the air dash) stands on the bulkhead the route crosses.
    await place(3246, 214)
    await tapKey(page, 'ArrowRight', 2)
    assert.equal(byId(mech(await readState(page)).breakableWalls, 'volt_secret_wall').phase, 'intact')
    await capture('secret-wall')
    await page.keyboard.down('x')
    await advanceFrames(page, 50)
    await page.keyboard.up('x')
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'volt_secret_wall')?.phase === 'broken', 4000, 'charged shot breaks the secret wall')
    const secretWalk = await drive({ clearEnemies: true, targetX: 3408, maxFrames: 240 })
    await advanceFrames(page, 10)
    const subChecks = await collected()
    evidence.secret = { walk: secretWalk, collected: subChecks }
    assert.ok(subChecks.includes('volt_hopper:sub_tank'), `sub tank collected (${subChecks})`)
    await capture('secret-room')
    await skipDialogue()
    await place(3520, 140)
    await advanceFrames(page, 20)
    const capsuleChecks = await collected()
    assert.ok(capsuleChecks.includes('volt_hopper:capsule'), `capsule collected on the bulkhead (${capsuleChecks})`)
    await capture('capsule')
    await skipDialogue()
    mark('f')

    // (g) The master corridor. Off the beat: rails quiet, both platforms of each bay at a station.
    await place(3676, 176)
    await standing('standing on the first pylon')
    await setClock(0)
    state = await readState(page)
    evidence.masterOff = { rails: rails(state, 'volt_master_rails')?.phase, swap: swap(state, 'volt_master_swap_1') }
    assert.equal(rails(state, 'volt_master_rails').phase, 'off')
    assert.deepEqual(swap(state, 'volt_master_swap_1').platforms.map((platform) => [platform.x, platform.velocityX]), [[3724, 0], [3916, 0]])
    await capture('master-off-beat')
    // On the beat, unshielded: walk onto the low platform, ride it over the arcing rails, step onto the next pylon.
    await shield(0)
    await setClock(0)
    const onto = await drive({ clearEnemies: true, targetX: 3716, maxFrames: 40, stallJumps: false })
    await setClock(1300)
    const rideOut = await drive({ clearEnemies: true, right: false, maxFrames: 50 })
    state = await readState(page)
    evidence.masterOn = { onto, rideOut, rails: rails(state, 'volt_master_rails')?.phase, swap: swap(state, 'volt_master_swap_1'), hp: state.playerState.hp }
    assert.equal(rails(state, 'volt_master_rails').phase, 'arcing', 'the rails arc under the ride')
    assert.equal(swap(state, 'volt_master_swap_1').platforms[0].heroOn, true, 'the hero rides the low platform')
    assert.ok(rideOut.minHp === onto.hp && state.player.x > 3740, `carried over the arcs unhurt (${JSON.stringify(evidence.masterOn)})`)
    await capture('master-on-beat')
    const rideIn = await drive({ clearEnemies: true, right: false, maxFrames: 60 })
    const stepOff = await drive({ clearEnemies: true, targetX: 3960, maxFrames: 60, stallJumps: false })
    state = await readState(page)
    evidence.masterCrossed = { rideIn, stepOff, hero: state.player, hp: state.playerState.hp }
    assert.ok(state.player.x >= 3952 && state.player.y < 190 && rideIn.minHp === onto.hp && stepOff.minHp === onto.hp, `across the bay onto the next pylon unhurt (${JSON.stringify(evidence.masterCrossed)})`)
    await capture('master-crossed')
    await shield(600000)
    // Without the ride: the same dash jump from a pylon top (dash and jump pressed on one frame, jump held),
    // then one dash press at the apex. With the air dash switched off it falls short of the next pylon (it
    // reaches the far station's platform at best). The air-dash jump is evidence only: the air dash ends the
    // dash jump's carry, so it does not carry the jump further (an open item for the play STOP).
    const jumpFromPylon = async (allowAirDash) => {
      await place(3964, 176)
      await standing('standing on the second pylon')
      await setClock(0)
      return script([
        { frames: 2, held: ['moveRight'] },
        { frames: 1, held: ['moveRight', 'dash', 'jump'] },
        { frames: 14, held: ['moveRight', 'jump'] },
        { frames: 1, held: ['moveRight', 'dash'] },
        { frames: 90, held: ['moveRight'] }
      ], 200, allowAirDash)
    }
    const dashJump = await jumpFromPylon(false)
    const airDashJump = await jumpFromPylon(true)
    evidence.pylonJumps = { dashJump, airDashJump, nextPylonLeft: 4240 }
    assert.ok(airDashJump.unlocked, 'the capsule unlocked the air dash')
    assert.ok(!dashJump.airDashed && dashJump.farX < 4240, `a dash jump from a pylon falls short of the next pylon (${JSON.stringify(dashJump)})`)
    assert.ok(airDashJump.airDashed, `the capsule's air dash fires in the air (${JSON.stringify(airDashJump)})`)
    mark('g')

    // (h) The route sheet: one capture per screen; checkpoint 4's trigger is past the last one.
    evidence.route = []
    for (const [index, [x, y]] of ROUTE_SHOTS.entries()) {
      await place(x, y)
      await advanceFrames(page, 30)
      await page.locator('canvas').screenshot({ path: path.join(dir, `route-${String(index).padStart(2, '0')}.png`) })
      const at = await readState(page)
      evidence.route.push({ screen: index, x, y, scrollX: at.camera?.scrollX, scrollY: at.camera?.scrollY, checkpointIndex: at.stageRuntime?.checkpointIndex })
    }
    assert.equal((await readState(page)).stageRuntime.checkpointIndex, 2, 'the route pass crosses no checkpoint')
    mark('h')

    // (i) From the end of the rail lane: over the last pit, checkpoint 4, the boss room, the boss on screen. The
    // rocket loader there is removed first and its rockets left to spend themselves (the shield keeps the push).
    await shield(600000)
    await place(5530, 214)
    await drive({ clearEnemies: true, right: false, maxFrames: 1 })
    await advanceFrames(page, 40)
    await place(5530, 214)
    await standing('standing at the end of the rail lane')
    const approach = await drive({ clearEnemies: true, targetX: 5760, maxFrames: 240, jumps: [{ atX: 5566, hold: 12 }] })
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
    mark('i')

    assert.deepEqual(errors, [], 'no page errors')
    return { artifacts: dir, evidence }
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
}
