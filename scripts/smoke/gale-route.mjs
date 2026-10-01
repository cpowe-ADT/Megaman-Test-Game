// Smoke 60-gale-route (EVAL-P6-010, Weather District, 12d). Runs with storyIntro=on so the checkpoint-2 radio
// and the mid-boss callout reach the lane. The gusts and the carriers run on the stage clock, which the smoke
// sets test-side (`setClock`, as 55 and 56 do) before each timed crossing; every jump and ride is real input,
// one frame at a time, with the air dash switched off test-side (the route never needs it). Steps:
// (a) from the spawn, real input over the intro spikes (the idle gust) and the crate; a running jump the teach
//     gust carries over the first gap; the teach ferry boarded at the left rim and ridden over the gap; on to
//     checkpoint 2; shielded, so spikes and enemies cannot stop it;
// (b) a cable spike takes 1 HP (its definition);
// (c) the wide gap: a dash jump in the calm falls short into the storm (the life ends, the hero stands again at
//     checkpoint 2); a running jump the gust carries lands on the dock;
// (d) the heart: from the launch ledge a running jump in the heart gust falls short to the dock; a dash jump in
//     the gust collects the heart tank and lands on its ledge;
// (e) the twins' room locks (camera held, the mid-boss callout on the radio lane), they are the Gale skin, the
//     room gust pushes the hero while it blows, the gate holds, and it opens only after they fall (fight: 43);
// (f) real input through the gate crosses checkpoint 3; a charged shot breaks the dock office's wall and walking
//     in collects the sub tank; real input runs the office roof into the mast;
// (g) the relay mast on real input: carrier 1's high lane boarded and ridden to ledge A, the gust's streaks and
//     then the gust firing across the widest gap, a running jump it carries lands on ledge B, carrier 2 ridden to
//     ledge C, the capsule in the alcove, the second gust to ledge D, over the right wall onto the cable landing;
// (j) one capture per screen, `route-00.png` to `route-12.png`, for the route contact sheet (warps, shielded);
// (i) real input over the last pit and spike crosses checkpoint 4 into the boss room; the boss is on screen and
//     takes damage.
// Placement between steps is test-side (`place`); order follows the checkpoints so each crossing is real.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BEAT_MS = 3600
/** Route gusts blow in the second half of the beat; the mast's in the first (while the carriers hold). */
const ROUTE_BLOW_MS = 1800
const MIDBOSS_MARKER = 'gale_mid_twins'

export async function runGaleRouteScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
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
  const standing = (label, ms = 8000) => waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, ms, label)
  const shield = (ms) => page.evaluate((value) => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(value), ms)
  const collected = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').progressionSave?.collectedChecks ?? [])
  // The stage clock the gusts and carriers read (`StageMechanicsAdapter`, scene data `stageMechanics`).
  const setClock = async (ms) => {
    await page.evaluate((value) => { window.__phaserGame.scene.getScene('Game').data.get('stageMechanics').clockMs = value }, ms)
  }
  // The route never needs the air dash: switched off test-side for the whole walk (restored at the end).
  const airDash = (allow) => page.evaluate((allow) => {
    const runtime = window.__phaserGame.scene.getScene('Game').newPlayerRuntime
    const before = Boolean(runtime?.modifiers?.allowAirDash)
    runtime?.setUpgradeModifiers?.({ ...runtime.modifiers, allowAirDash: allow })
    return before
  }, allow)
  // Real input, one frame at a time in the page (the loop asleep, fixed 1/60s steps; see volt-route.mjs): hold
  // `dir` (1 right, -1 left) unless `stay`; at each jump x (reached in the direction of travel), once grounded for
  // 4 frames, hold jump for `hold` frames. Stops at `targetX`, on a death, when `untilGrounded` lands after leaving
  // the floor, or at `maxFrames`. `clearEnemies` fells what comes within 240px (never the twins), as a player's
  // shots would. Reports the belts or carriers stood on and the gusts that pushed the hero.
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
      const dir = plan.dir ?? 1
      const reached = (x, atX) => (dir > 0 ? x >= atX : x <= atX)
      const jumps = [...(plan.jumps ?? [])].sort((a, b) => dir * (a.atX - b.atX))
      const log = []
      const rode = new Set()
      const winds = new Set()
      const cleared = new Set()
      let hold = 0
      let next = 0
      let frames = 0
      let left = false
      let groundedFor = 0
      let minY = game.player.y
      for (; frames < plan.maxFrames; frames += 1) {
        const x = game.player.x
        if ((plan.targetX !== undefined && reached(x, plan.targetX)) || game.playerHp <= 0) break
        if (plan.clearEnemies) {
          for (const entry of game.enemySpawner.getEntities()) {
            if (cleared.has(entry.id) || entry.id === 'gale_mid_twins' || !entry.sprite?.active || Math.abs(entry.sprite.x - x) > 240) continue
            cleared.add(entry.id)
            game.enemySpawner.applyDamageToSprite(entry.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_60_clear' })
          }
        }
        const grounded = Boolean(game.player.body?.blocked?.down || game.player.body?.touching?.down)
        if (!grounded) left = true
        if (plan.untilGrounded && left && grounded) break
        groundedFor = grounded ? groundedFor + 1 : 0
        if (hold === 0 && next < jumps.length && reached(x, jumps[next].atX) && grounded && groundedFor >= 4) {
          hold = jumps[next].hold
          log.push({ jumpAtX: Math.round(x), y: Math.round(game.player.y), frame: frames })
          next += 1
        }
        const move = plan.stay ? [] : [dir > 0 ? 'moveRight' : 'moveLeft']
        const held = [...move, ...(hold > 0 ? ['jump'] : [])]
        window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }], { keepHeld: true })
        if (hold > 0) hold -= 1
        minY = Math.min(minY, game.player.y)
        const env = game.data.get('stageMechanics')?.getDebugState?.().heroEnvironment
        if (env?.beltId) rode.add(env.beltId)
        for (const id of env?.zoneIds ?? []) winds.add(id)
      }
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), minY: Math.round(minY), hp: game.playerHp, rode: [...rode], winds: [...winds], cleared: [...cleared], log }
    }
  }, plan)
  // A fixed input script, one frame at a time: each row holds `held` for `frames` frames; stops once the hero
  // lands after leaving the ground. The measured dash jump holds dash from frame 0 and adds jump on frame 3.
  const script = (rows) => page.evaluate((rows) => {
    const loop = window.__phaserGame.loop
    const wasRunning = loop.running
    if (wasRunning) loop.sleep()
    try {
      const game = window.__phaserGame.scene.getScene('Game')
      const winds = new Set()
      let left = false
      let frames = 0
      outer: for (const row of rows) {
        for (let index = 0; index < row.frames; index += 1) {
          const grounded = Boolean(game.player.body?.blocked?.down || game.player.body?.touching?.down)
          if (!grounded) left = true
          if ((left && grounded) || game.playerHp <= 0) break outer
          window.stageDebug.replayInputs([{ frame: 0, held: row.held }, { frame: 1, held: row.held }], { keepHeld: true })
          frames += 1
          for (const id of game.data.get('stageMechanics')?.getDebugState?.().heroEnvironment?.zoneIds ?? []) winds.add(id)
        }
      }
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), hp: game.playerHp, winds: [...winds] }
    } finally {
      window.stageDebug.replayInputs([{ frame: 0, held: [] }])
      if (wasRunning) loop.wake()
    }
  }, rows)
  const dashJump = (key) => [{ held: [key, 'dash'], frames: 3 }, { held: [key, 'dash', 'jump'], frames: 67 }, { held: [key], frames: 30 }]
  const runJump = (key, runFrames) => [{ held: [key], frames: runFrames }, { held: [key, 'jump'], frames: 70 }, { held: [key], frames: 30 }]
  const evidence = { timingMs: {} }
  const startedAt = Date.now()
  const mark = (label) => { evidence.timingMs[label] = Date.now() - startedAt }
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'gale_vixen' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'gale_vixen', 15000, 'gale loaded')
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    let state = await capture('spawn')
    assert.equal(state.stageRuntime.checkpointIndex, 0)
    evidence.airDashBefore = await airDash(false)
    evidence.windZones = mech(state).windZones?.map((zone) => zone.id)
    assert.equal(mech(state).windZones?.length, 7, 'seven gusts')
    assert.equal(mech(state).laneSwaps?.length, 4, 'four carrier pairs')

    // (a) Spawn to checkpoint 2 on real input: over the intro spikes onto the crate and down; the teach gap on
    // a running jump the gust carries; the ferry.
    await shield(600000)
    const intro = await drive({ clearEnemies: true, targetX: 470, maxFrames: 400, jumps: [{ atX: 206, hold: 12 }, { atX: 346, hold: 14 }] })
    await standing('past the intro')
    evidence.intro = intro
    assert.ok(intro.x >= 470 && intro.hp > 0, `through the intro (${JSON.stringify(intro)})`)
    await setClock(ROUTE_BLOW_MS + 10)
    const teachGap = await drive({ clearEnemies: true, targetX: 900, maxFrames: 200, jumps: [{ atX: 540, hold: 40 }] })
    evidence.teachGap = teachGap
    assert.ok(teachGap.x >= 900 && teachGap.hp > 0 && teachGap.winds.includes('gale_gust_teach'), `the teach gust carried the jump over the first gap (${JSON.stringify(teachGap)})`)
    const toRim = await drive({ clearEnemies: true, targetX: 1036, maxFrames: 120 })
    await standing('at the ferry rim')
    await setClock(10)
    const board = await drive({ targetX: 1084, maxFrames: 60, jumps: [{ atX: 1030, hold: 8 }] })
    await standing('on the ferry')
    await setClock(1700)
    const ride = await drive({ stay: true, maxFrames: 130 })
    state = await readState(page)
    evidence.ferry = { toRim, board, ride, swap: byId(mech(state).laneSwaps, 'gale_ferry_teach') }
    assert.ok(ride.rode.includes('gale_ferry_teach_low') && ride.x >= 1270 && ride.y < 214, `rode the ferry over the gap (${JSON.stringify(evidence.ferry)})`)
    await capture('ferry-ride')
    const toCheckpoint2 = await drive({ clearEnemies: true, targetX: 1400, maxFrames: 120 })
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 6000, 'checkpoint 2 on real input')
    evidence.toCheckpoint2 = toCheckpoint2
    await capture('checkpoint-2')
    mark('a')

    // (b) A cable spike: 1 HP a touch (its definition).
    await shield(0)
    const hpBefore = (await readState(page)).playerState.hp
    await place(380, 214)
    state = await waitForState(page, (next) => next.playerState?.hp < hpBefore, 6000, 'the spike hurts')
    evidence.spike = { hpBefore, hpAfter: state.playerState.hp }
    assert.equal(hpBefore - state.playerState.hp, 1, 'spike damage from its definition')
    await capture('spike-hit')
    mark('b')

    // (c) The wide gap: a dash jump in the calm falls into the storm; a running jump the gust carries crosses.
    await place(1420, 214)
    await standing('before the wide gap')
    await setClock(10)
    const short = await script(dashJump('moveRight'))
    evidence.wideGapDashCalm = short
    state = await waitForState(page, (next) => next.playerState?.hp === 0 || (next.player?.y ?? 0) > 260, 8000, 'the storm takes the short jump')
    await capture('pit-death')
    state = await waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, 15000, 'respawn at checkpoint 2')
    await advanceFrames(page, 30)
    state = await readState(page)
    evidence.respawn = state.player
    assert.ok(Math.abs(state.player.x - 1392) < 24 && Math.abs(state.player.y - 214) <= 2, `respawned standing at checkpoint 2 (${JSON.stringify(state.player)})`)
    await capture('respawn-checkpoint-2')
    await shield(600000)
    await airDash(false)
    await place(1420, 214)
    await standing('before the wide gap again')
    await setClock(ROUTE_BLOW_MS + 10)
    const wide = await drive({ clearEnemies: true, targetX: 1860, maxFrames: 200, jumps: [{ atX: 1436, hold: 40 }] })
    evidence.wideGapGust = wide
    assert.ok(wide.x >= 1860 && wide.hp > 0 && wide.winds.includes('gale_gust_esc'), `the gust carried a running jump over the wide gap (${JSON.stringify(wide)})`)
    assert.equal((await readState(page)).stageRuntime.checkpointIndex, 1)
    mark('c')

    // (d) The heart: onto the dock inside the heart room first (it raises the world ceiling), then the launch ledge.
    const toLaunch = async () => {
      await place(1880, 214)
      await place(1918, 58)
      await standing('on the launch ledge')
    }
    await toLaunch()
    await setClock(ROUTE_BLOW_MS + 10)
    const heartRun = await script(runJump('moveRight', 4))
    await advanceFrames(page, 10)
    const afterRun = await collected()
    state = await readState(page)
    evidence.heartRunJump = { heartRun, landed: state.player, collected: afterRun }
    assert.ok(!afterRun.includes('gale_vixen:heart_tank') && state.player.y > 200, `a running jump in the gust falls short to the dock (${JSON.stringify(evidence.heartRunJump)})`)
    await toLaunch()
    await setClock(ROUTE_BLOW_MS + 10)
    const heartDash = await script(dashJump('moveRight'))
    await advanceFrames(page, 20)
    const heartChecks = await collected()
    state = await readState(page)
    evidence.heart = { heartDash, landed: state.player, collected: heartChecks }
    assert.ok(heartChecks.includes('gale_vixen:heart_tank') && heartDash.winds.includes('gale_gust_heart'), `a dash jump the gust carried collects the heart (${JSON.stringify(evidence.heart)})`)
    assert.ok(state.player.x > 2400 && state.player.x < 2496 && state.player.y < 70 && state.newPlayer?.locomotion?.grounded, `landed on the heart ledge (${JSON.stringify(state.player)})`)
    await capture('heart')
    mark('d')

    // (e) The twins' room: locks on entry, holds the camera, plays the callout; the gust blows in it; opens after they fall.
    await place(2708, 214)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'locked', 3000, 'the twins room locks')
    assert.equal(mech(state).roomLocks[0].cameraHeld, true, 'the camera is held to the room')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /sentry twins in the wind/i.test(next.ticker.text ?? ''), 20000, 'mid-boss callout on the radio lane')
    assert.equal(callout.dialogue?.active ?? false, false, 'the callout never blocks')
    await waitForState(page, (next) => (next.enemySpawner?.activeMarkers ?? 0) >= 1, 4000, 'the twins spawned')
    await place(2820, 214)
    await setClock(ROUTE_BLOW_MS + 10)
    state = await waitForState(page, (next) => byId(mech(next).windZones, 'gale_gust_midboss')?.phase === 'blowing' && byId(mech(next).windZones, 'gale_gust_midboss')?.heroInside === true, 4000, 'the room gust blows on the hero')
    evidence.roomGust = { gust: byId(mech(state).windZones, 'gale_gust_midboss'), environment: mech(state).heroEnvironment }
    await capture('midboss-locked')
    const twins = await page.evaluate((id) => {
      const entity = window.__phaserGame.scene.getScene('Game').enemySpawner.getEntities().find((entry) => entry.id === id)
      return entity ? { typeKey: entity.definition?.typeKey ?? entity.typeKey, x: Math.round(entity.sprite.x), y: Math.round(entity.sprite.y), texture: entity.sprite.texture?.key } : null
    }, MIDBOSS_MARKER)
    evidence.twins = twins
    assert.equal(twins?.typeKey, 'sentry_twin_gale', `the Gale skin (${JSON.stringify(twins)})`)
    const pushed = await drive({ targetX: 3170, maxFrames: 200 })
    assert.ok(pushed.x < 3136, `the closed gate holds (x ${pushed.x})`)
    evidence.pushed = pushed
    for (let tries = 0; tries < 20; tries += 1) {
      const hit = await page.evaluate((id) => {
        const game = window.__phaserGame.scene.getScene('Game')
        const entity = game.enemySpawner.getEntities().find((entry) => entry.id === id)
        if (!entity || !entity.sprite.active) return 'gone'
        game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_60' })
        return 'hit'
      }, MIDBOSS_MARKER)
      if (hit === 'gone') break
      await advanceFrames(page, 15)
    }
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'open', 8000, 'the gate opens once the twins fall')
    await capture('midboss-open')
    mark('e')

    // (f) Through the gate to checkpoint 3; the dock office: a charged shot breaks its wall, the sub tank inside; the roof.
    const gate = await drive({ clearEnemies: true, targetX: 3200, maxFrames: 200 })
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2, 6000, 'checkpoint 3 on real input')
    evidence.gate = gate
    await place(3250, 214)
    await standing('before the office wall')
    assert.equal(byId(mech(await readState(page)).breakableWalls, 'gale_office_wall')?.phase, 'intact')
    await tapKey(page, 'ArrowRight', 2)
    await page.keyboard.down('x')
    await advanceFrames(page, 50)
    await page.keyboard.up('x')
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'gale_office_wall')?.phase === 'broken', 4000, 'a charged shot breaks the office wall')
    const officeWalk = await drive({ clearEnemies: true, targetX: 3400, maxFrames: 240 })
    await advanceFrames(page, 20)
    const subChecks = await collected()
    evidence.subTank = { walk: officeWalk, collected: subChecks }
    assert.ok(subChecks.includes('gale_vixen:sub_tank'), `sub tank collected (${subChecks})`)
    await capture('subtank')
    await place(3230, 214)
    await standing('before the office roof')
    const roof = await drive({ clearEnemies: true, targetX: 3624, maxFrames: 400, jumps: [{ atX: 3250, hold: 20 }, { atX: 3330, hold: 16 }, { atX: 3426, hold: 16 }] })
    evidence.roof = roof
    assert.ok(roof.x >= 3624 && roof.minY < 150 && roof.hp > 0, `ran the office roof into the mast (${JSON.stringify(roof)})`)
    mark('f')

    // (g) The relay mast on the mast beat: carriers slide in the calm, the gusts blow while they hold.
    await place(3616, 214)
    await standing('at the mast base')
    state = await readState(page)
    assert.equal(byId(mech(state).verticalSegments, 'gale_mast')?.cameraHeld, true, 'camera held to the mast')
    await setClock(BEAT_MS + 100)
    const board1 = await drive({ targetX: 3656, maxFrames: 60, jumps: [{ atX: 3600, hold: 18 }] })
    await standing('on carrier 1')
    await setClock(BEAT_MS + 1700)
    const ride1 = await drive({ stay: true, maxFrames: 130 })
    evidence.carrier1 = { board1, ride1 }
    assert.ok(ride1.rode.includes('gale_mast_carrier_1_high') && ride1.x >= 3984 && ride1.y < 170, `rode carrier 1 across the mast (${JSON.stringify(evidence.carrier1)})`)
    const toA = await drive({ targetX: 4078, maxFrames: 60, jumps: [{ atX: 3980, hold: 26 }] })
    state = await standing('on ledge A')
    evidence.toA = { toA, player: state.player }
    assert.ok(Math.abs(state.player.y - 78) <= 2 && state.player.x >= 4048, `on ledge A (${JSON.stringify(evidence.toA)})`)
    await setClock(2 * BEAT_MS - 300)
    await advanceFrames(page, 4)
    state = await capture('mast-streaks')
    assert.equal(byId(mech(state).windZones, 'gale_gust_mast_1')?.phase, 'building', 'the streaks build before the gust')
    await setClock(2 * BEAT_MS + 200)
    await advanceFrames(page, 4)
    state = await capture('mast-gust')
    evidence.mastGust = byId(mech(state).windZones, 'gale_gust_mast_1')
    assert.equal(evidence.mastGust?.phase, 'blowing', 'the gust fires across the widest gap')
    await setClock(2 * BEAT_MS + 10)
    const widest = await drive({ dir: -1, targetX: 3640, maxFrames: 120, jumps: [{ atX: 4060, hold: 60 }], untilGrounded: true })
    state = await standing('on ledge B')
    evidence.widest = { widest, player: state.player }
    assert.ok(widest.winds.includes('gale_gust_mast_1') && Math.abs(state.player.y - 22) <= 2 && state.player.x <= 3728, `the gust carried the jump across the widest gap to B (${JSON.stringify(evidence.widest)})`)
    await capture('mast-ledge-b')
    await setClock(2 * BEAT_MS + 100)
    const board2 = await drive({ targetX: 3764, maxFrames: 90, jumps: [{ atX: 3700, hold: 26 }] })
    await standing('on carrier 2')
    await setClock(2 * BEAT_MS + 1700)
    const ride2 = await drive({ stay: true, maxFrames: 130 })
    evidence.carrier2 = { board2, ride2 }
    assert.ok(ride2.rode.includes('gale_mast_carrier_2_low') && ride2.x >= 3976 && ride2.y < -40, `rode carrier 2 across the mast (${JSON.stringify(evidence.carrier2)})`)
    const toC = await drive({ targetX: 4066, maxFrames: 60, jumps: [{ atX: 3976, hold: 20 }] })
    state = await standing('on ledge C')
    evidence.toC = { toC, player: state.player }
    assert.ok(Math.abs(state.player.y + 118) <= 2 && state.player.x >= 4040, `on ledge C (${JSON.stringify(evidence.toC)})`)
    const toAlcove = await drive({ dir: -1, targetX: 3992, maxFrames: 80, jumps: [{ atX: 4062, hold: 28 }] })
    await standing('in the alcove')
    await advanceFrames(page, 10)
    const capsuleChecks = await collected()
    evidence.capsule = { toAlcove, collected: capsuleChecks }
    assert.ok(capsuleChecks.includes('gale_vixen:capsule'), `capsule collected in the alcove (${JSON.stringify(evidence.capsule)})`)
    await capture('capsule')
    await airDash(false)
    const backToC = await drive({ targetX: 4064, maxFrames: 80, untilGrounded: true })
    state = await standing('back on ledge C')
    evidence.backToC = { backToC, player: state.player }
    assert.ok(Math.abs(state.player.y + 118) <= 2, `dropped back onto C (${JSON.stringify(evidence.backToC)})`)
    await setClock(3 * BEAT_MS + 10)
    const toD = await drive({ targetX: 4420, maxFrames: 120, jumps: [{ atX: 4086, hold: 60 }], untilGrounded: true })
    state = await standing('on ledge D')
    evidence.toD = { toD, player: state.player }
    assert.ok(toD.winds.includes('gale_gust_mast_2') && Math.abs(state.player.y + 142) <= 2 && state.player.x >= 4368, `the second gust carried the jump to D (${JSON.stringify(evidence.toD)})`)
    const exit = await drive({ targetX: 4520, maxFrames: 160 })
    state = await standing('on the cable landing')
    evidence.exit = { exit, player: state.player }
    assert.ok(state.player.x >= 4480 && Math.abs(state.player.y - 174) <= 2, `over the right wall onto the cable landing (${JSON.stringify(evidence.exit)})`)
    mark('g')

    // (j) The route contact sheet: one capture per screen (the mast: its base, then ledge D).
    await shield(600000)
    const screens = [[224, 214], [500, 214], [960, 214], [1420, 214], [1900, 214], [2300, 214], [2900, 214], [3240, 214], [3900, 214], [4400, -142], [4640, 174], [5160, 214], [5460, 214]]
    for (const [index, [x, y]] of screens.entries()) {
      await place(x, y < 100 ? 214 : y)
      if (y < 100) await place(x, y)
      await advanceFrames(page, 30)
      await capture(`route-${String(index).padStart(2, '0')}`)
    }
    mark('j')

    // (i) Over the last pit and spike, checkpoint 4, the boss room, the boss on screen.
    await place(5440, 214)
    await standing('before the last pit')
    const approach = await drive({ clearEnemies: true, targetX: 5790, maxFrames: 300, jumps: [{ atX: 5484, hold: 40 }] })
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
    return { artifacts: dir, evidence }
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
}
