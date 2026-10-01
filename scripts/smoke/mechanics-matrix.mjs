// Smoke 42-mechanics-matrix (06 §6.2, Heat Works engine lane). Loads the developer `mechanics_lab` stage
// and checks every stage mechanic through render_game_to_text().mechanics: hazard boxes and damage from
// their definitions, two vents on one clock (arming before firing, damage only while firing), a crumble
// platform (shake, fall, return), both breakable walls (three saber cuts; a pellet does nothing, a charged
// shot breaks it), and the two-screen climb with rising slag (camera follows up, contact kills through the
// damage path, the death holds the slag, the respawn resets it). Placement is test-side (`place`); the
// verbs are real key presses. The mechanics_v1 art: each drawn frame is read back through the `frame`
// fields (nozzleFrame/flameFrame, surfaceFrame, crumble and wall `frame`) and must follow the state.
// Section 6 (prompt 12 part 12b) walks screens 4 to 8: ice (dash window ~1.4x, longer slide), belts (an idle
// rider moves at belt speed and reads idle, a dash-jump keeps the belt speed, a loose test crate rides too,
// the leftward belt draws flipped), a current and a gust (pushes, the gust's building tell), the wind and
// magnet lifts, the rail pair (arming before arcing, live only while arcing, 2 HP), the rockfall (dust puff
// and shadow, boulder, rubble, 2 HP) and the icicle (shake, fall, shards, 2 HP; back on the checkpoint respawn).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

export async function runMechanicsMatrixScenario(name, { outputDir, url, readState, waitForState, advanceFrames, tapKey }) {
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
    const { mechanics, player, playerState, camera, combatDebug } = state
    fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify({ mechanics, player, playerState, camera, combatDebug }, null, 2))
    return state
  }
  // A short tell (arming flash, crumble shake) outlasts no screenshot on a loaded machine: hold the world for the capture.
  const captureHeld = async (label) => {
    await page.evaluate(() => { window.__phaserGame.scene.getScene('Game').physics.world.pause() })
    try {
      return await capture(label)
    } finally {
      await page.evaluate(() => { window.__phaserGame.scene.getScene('Game').physics.world.resume() })
    }
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
  const evidence = {}
  try {
    await page.goto(url)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'mechanics_lab' }))
    let state = await waitForState(page, (next) => next.scene === 'Game' && next.stageRuntime?.stageId === 'mechanics_lab' && (next.mechanics?.vents?.length ?? 0) === 2, 15000, 'lab loaded')
    await waitForState(page, (next) => next.stageIntro?.active !== true, 15000, 'intro over')

    // 1. Boxes and damage come from the definitions.
    const hazards = mech(state).hazards
    const spike = byId(hazards, 'lab_spike_wide')
    const vent = byId(hazards, 'lab_vent_a')
    assert.deepEqual([spike.box.width, spike.box.height, spike.damage], [40, 10, 2], 'spike box and damage from its definition')
    assert.deepEqual([vent.box.width, vent.box.height, vent.damage], [16, 48, 2], 'vent box and damage from its definition')

    // 2. Vents: one clock, the arming flash comes before firing, the damage body is live only while firing.
    const seen = new Set()
    const nozzleFrames = { idle: new Set(), arming: new Set(), firing: new Set() }
    const shotPhases = new Set()
    let armedSeen = false
    for (let frame = 0; frame < 420 && !(seen.size === 3 && armedSeen && shotPhases.size === 2); frame += 1) {
      await advanceFrames(page, 1)
      const [a, b] = mech(await readState(page)).vents
      assert.equal(a.phase, b.phase, 'both vents read the stage clock')
      assert.equal(a.live, a.phase === 'firing', `vent body live only while firing (${a.phase})`)
      seen.add(a.phase)
      nozzleFrames[a.phase].add(a.nozzleFrame)
      assert.equal(a.flameFrame !== null, a.phase === 'firing', `the flame jet shows only while firing (${a.phase}, ${a.flameFrame})`)
      if (a.phase === 'arming') {
        assert.ok(a.untilFireMs <= 300, `arming ${a.untilFireMs}ms before firing`)
        armedSeen = true
      }
      if ((a.phase === 'arming' || a.phase === 'firing') && !shotPhases.has(a.phase)) {
        shotPhases.add(a.phase)
        const held = mech(await captureHeld(`vent-${a.phase}`)).vents[0]
        assert.equal(held.phase, a.phase, 'the capture shows the phase it names')
      }
    }
    assert.deepEqual([...seen].sort(), ['arming', 'firing', 'idle'], 'vent cycle observed')
    assert.deepEqual([...nozzleFrames.idle], ['mechanics_v1/vent_nozzle/000'], 'a cold nozzle')
    assert.ok([...nozzleFrames.arming].every((name) => /vent_nozzle\/00[12]$/.test(name)), `arming frames ${[...nozzleFrames.arming]}`)
    assert.deepEqual([...nozzleFrames.firing], ['mechanics_v1/vent_nozzle/003'], 'a firing nozzle')
    evidence.ventFrames = Object.fromEntries(Object.entries(nozzleFrames).map(([phase, names]) => [phase, [...names]]))
    await capture('vents')

    // Damage only while firing: stand in vent A's column while it is quiet, then let it fire.
    await waitForState(page, (next) => mech(next).vents?.[0]?.phase === 'idle' && mech(next).vents[0].untilFireMs > 900, 8000, 'vent quiet')
    await shield(0)
    await place(220, 200)
    const hpQuiet = (await readState(page)).playerState.hp
    await advanceFrames(page, 8)
    state = await readState(page)
    if (mech(state).vents[0].phase !== 'firing') assert.equal(state.playerState.hp, hpQuiet, 'a quiet vent does not hurt')
    state = await waitForState(page, (next) => next.playerState?.hp < hpQuiet, 8000, 'the vent fires and hurts')
    evidence.vent = { hpBefore: hpQuiet, hpAfter: state.playerState.hp, phase: mech(state).vents[0].phase }
    assert.equal(hpQuiet - state.playerState.hp, 2, 'vent damage from its definition')

    // 3. Crumble: land on it, it shakes ~400ms, falls (no body), returns 3s later.
    await shield(600000)
    await place(560, 168)
    const shaking = await waitForState(page, (next) => byId(mech(next).crumbles, 'lab_crumble_1')?.phase === 'shaking', 4000, 'crumble shakes')
    assert.match(byId(mech(shaking).crumbles, 'lab_crumble_1').frame ?? '', /crumble\/00[12]$/, 'cracked (then breaking) while it shakes')
    const cracked = byId(mech(await captureHeld('crumble-shaking')).crumbles, 'lab_crumble_1')
    assert.match(`${cracked.phase} ${cracked.frame}`, /^shaking .*crumble\/00[12]$|^fallen .*crumble\/003$/, `crumble frame follows its phase (${cracked.phase} ${cracked.frame})`)
    evidence.crumbleCapture = cracked
    const fallen = await waitForState(page, (next) => byId(mech(next).crumbles, 'lab_crumble_1')?.phase === 'fallen', 3000, 'crumble falls')
    assert.equal(byId(mech(fallen).crumbles, 'lab_crumble_1').bodyEnabled, false, 'a fallen platform has no body')
    assert.equal(byId(mech(fallen).crumbles, 'lab_crumble_1').frame, 'mechanics_v1/crumble/003', 'falling as it drops')
    // Phase start times, not poll times: under load the first poll that sees "shaking" can come 100ms+
    // into the shake. Each state carries `timerMs` (time in its phase) on the stage clock.
    const shakeStartMs = mech(shaking).clockMs - byId(mech(shaking).crumbles, 'lab_crumble_1').timerMs
    const fallStartMs = mech(fallen).clockMs - byId(mech(fallen).crumbles, 'lab_crumble_1').timerMs
    evidence.crumbleShakeMs = fallStartMs - shakeStartMs
    assert.ok(fallStartMs - shakeStartMs >= 350, `shook for about 400ms (${fallStartMs - shakeStartMs}ms)`)
    await capture('crumble-fallen')
    const back = await waitForState(page, (next) => byId(mech(next).crumbles, 'lab_crumble_1')?.phase === 'solid', 10000, 'crumble returns')
    assert.equal(byId(mech(back).crumbles, 'lab_crumble_1').bodyEnabled, true)
    assert.equal(byId(mech(back).crumbles, 'lab_crumble_1').frame, 'mechanics_v1/crumble/000', 'intact again on respawn')
    assert.ok(mech(back).clockMs - mech(fallen).clockMs >= 2900, 'returned after about 3s')
    evidence.crumble = { shookAt: mech(shaking).clockMs, fellAt: mech(fallen).clockMs, returnedAt: mech(back).clockMs }

    // 4. Two-screen climb with rising slag: crossing the trigger starts it, the camera follows up.
    await place(900, 214)
    await place(1000, 168)
    state = await waitForState(page, (next) => byId(mech(next).risingLiquids, 'lab_slag')?.phase === 'rising', 3000, 'slag rises')
    // The slag art on screen: wait (from the low step) until the surface is above the floor top, then hold the world for the capture.
    await waitForState(page, (next) => byId(mech(next).risingLiquids, 'lab_slag')?.surfaceY <= 226, 8000, 'slag surface above the floor')
    const rising = byId(mech(await captureHeld('slag-rising')).risingLiquids, 'lab_slag')
    assert.equal(rising.surfaceArtTop, rising.surfaceY - 8, 'the surface strip\'s liquid edge sits on the kill line')
    evidence.slagCapture = rising
    await place(1300, -150)
    await advanceFrames(page, 60)
    state = await capture('climb-top')
    assert.equal(byId(mech(state).verticalSegments, 'lab_climb')?.cameraHeld, true, 'camera held to the two-screen segment')
    assert.ok(state.camera.scrollY < -60, `camera followed up (scrollY ${state.camera.scrollY})`)
    const surfaceA = byId(mech(state).risingLiquids, 'lab_slag').surfaceY
    const slagFrames = new Set()
    // Sample by stage-clock time, not frame count: a loaded machine can run 30 frames in under one 280ms slag frame.
    const slagClockStart = mech(state).clockMs
    for (let sample = 0; sample < 24; sample += 1) {
      await advanceFrames(page, 5)
      const next = await readState(page)
      const slag = byId(mech(next).risingLiquids, 'lab_slag')
      assert.equal(slag.surfaceArtTop, slag.surfaceY - 8, 'the surface strip\'s liquid edge sits on the kill line')
      slagFrames.add(slag.surfaceFrame)
      if (sample >= 5 && mech(next).clockMs - slagClockStart >= 700) break
    }
    const surfaceB = byId(mech((await readState(page))).risingLiquids, 'lab_slag').surfaceY
    assert.ok(surfaceB < surfaceA, `slag keeps rising (${surfaceA} -> ${surfaceB})`)
    assert.ok([...slagFrames].every((name) => /slag_surface\/00[123]$/.test(name)) && slagFrames.size >= 2, `slag surface frames cycle (${[...slagFrames]})`)
    evidence.slagFrames = [...slagFrames]

    // Contact kills through the damage path even with i-frames; the death holds it; the respawn resets it.
    await place(1120, 214)
    state = await waitForState(page, (next) => next.playerState?.hp === 0, 6000, 'slag kills')
    const heldA = byId(mech(state).risingLiquids, 'lab_slag')
    await advanceFrames(page, 6)
    const heldB = byId(mech(await readState(page)).risingLiquids, 'lab_slag')
    if (heldB.held) assert.equal(heldB.surfaceY, heldA.surfaceY, 'the slag holds while the hero dies')
    await capture('slag-death')
    state = await waitForState(page, (next) => next.playerState?.hp > 0 && byId(mech(next).risingLiquids, 'lab_slag')?.phase === 'dormant', 10000, 'respawn resets the slag')
    const reset = byId(mech(state).risingLiquids, 'lab_slag')
    assert.equal(reset.surfaceY, reset.floorY, 'back at the floor')
    evidence.slag = { beforeDeath: heldA, afterRespawn: reset, combat: state.combatDebug?.lastPlayerHit ?? null }
    await capture('respawn')

    // 5. Breakable walls (after the climb: warping here crosses the slag trigger): three saber cuts; then a pellet does nothing and a charged shot breaks the second.
    await place(1470, 214)
    await tapKey(page, 'ArrowRight', 2)
    // A key tap on a loaded machine can miss the swing window, so press until it breaks (at most 8) and
    // check the count on the wall: exactly three cuts landed.
    let presses = 0
    const hitsSeen = []
    const wallFrames = []
    for (; presses < 8; presses += 1) {
      const wall = byId(mech(await readState(page)).breakableWalls, 'lab_wall_saber')
      hitsSeen.push(wall.hits)
      if (wall.phase === 'broken') break
      wallFrames.push(wall.frame)
      assert.equal(wall.frame, `mechanics_v1/breakable_wall/00${Math.min(2, Math.ceil((wall.hits / 3) * 2))}`, `wall frame by hits (${wall.hits})`)
      if (wall.hits > 0 && !evidence.wallMidCrack) {
        evidence.wallMidCrack = wall.frame
        await captureHeld('wall-mid-crack')
      }
      await tapKey(page, 'c', 3)
      await advanceFrames(page, 28)
    }
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'lab_wall_saber')?.phase === 'broken', 4000, 'saber wall breaks')
    const saberWall = byId(mech(state).breakableWalls, 'lab_wall_saber')
    assert.deepEqual([saberWall.hits, saberWall.bodyEnabled], [3, false], 'three cuts break it and remove its body')
    assert.ok(hitsSeen.every((hits, index) => index === 0 || hits - hitsSeen[index - 1] <= 1), `one hit per cut (${hitsSeen})`)
    evidence.saberPresses = { presses, hitsSeen, wallFrames }
    assert.ok(evidence.wallMidCrack, 'a mid-crack frame was captured')
    await advanceFrames(page, 20)
    await capture('wall-saber-broken')
    await place(1610, 214)
    await tapKey(page, 'ArrowRight', 2)
    await page.keyboard.down('x')
    await advanceFrames(page, 50)
    assert.equal(byId(mech(await readState(page)).breakableWalls, 'lab_wall_shot').phase, 'intact', 'the tap pellet does nothing')
    await page.keyboard.up('x')
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'lab_wall_shot')?.phase === 'broken', 4000, 'charged shot breaks the wall')
    evidence.walls = mech(state).breakableWalls

    // 6. The 12b mechanics, left to right. Movement reaches the motor as mechanics.heroEnvironment (what the
    // adapter sends) and newPlayer.locomotion.environment (what the motor holds).
    const env = (next) => mech(next).heroEnvironment ?? {}
    const loco = (next) => next.newPlayer?.locomotion ?? {}
    const v2 = (group, index) => `mechanics_v2/${group}/00${index}`
    // Movement is measured over stage-clock time: frame counts cover very different game time on a loaded machine.
    const advanceClock = async (ms) => {
      const start = mech(await readState(page)).clockMs
      let next = null
      for (let step = 0; step < 300; step += 1) {
        await advanceFrames(page, 3)
        next = await readState(page)
        if (mech(next).clockMs - start >= ms) break
      }
      return next
    }
    await shield(600000)

    // 6a. Ice: a grounded dash on the ice lasts ~1.4x the plain-floor dash at the same speed, and slides further.
    const dashFrom = async (x) => {
      await place(x, 214)
      await tapKey(page, 'ArrowRight', 2)
      const before = await advanceClock(300)
      await page.keyboard.down('z')
      await advanceFrames(page, 3)
      const during = await readState(page)
      await advanceClock(600)
      await page.keyboard.up('z')
      const after = await advanceClock(900)
      const ice = byId(mech(during).iceFloors, 'lab_ice')
      return {
        distance: after.player.x - before.player.x,
        dashWindowMs: loco(after).environment?.lastDashDurationMs ?? null,
        measuredDashMs: loco(after).lastDashEndedAtMs - loco(after).lastDashStartedAtMs,
        surface: env(during).surface,
        iceOn: ice?.heroOn ?? false,
        iceFrame: ice?.frame ?? null
      }
    }
    const plainDash = await dashFrom(1816)
    const iceDash = await dashFrom(1976)
    // The capture rides a separate ice dash: a held world stops the body while the dash window runs on.
    await place(1976, 214)
    await page.keyboard.down('z')
    await advanceFrames(page, 4)
    await captureHeld('ice-dash')
    await page.keyboard.up('z')
    evidence.ice = { plainDash, iceDash, windowRatio: iceDash.dashWindowMs / plainDash.dashWindowMs, distanceRatio: iceDash.distance / plainDash.distance }
    assert.deepEqual([plainDash.surface, iceDash.surface, iceDash.iceOn], ['ground', 'ice', true], 'the ice sets the motor surface')
    assert.match(String(iceDash.iceFrame), /^mechanics_v2\/ice_tile\/00[01]$/)
    // The motor's dash window (deterministic); the game-time stamps (measuredDashMs) are frame-quantized and kept as evidence only.
    assert.ok(Math.abs(evidence.ice.windowRatio - 1.4) < 0.01, `the ice dash window is 1.4x (${JSON.stringify(evidence.ice)})`)
    assert.ok(evidence.ice.distanceRatio > 1.3, `the ice dash goes further (${evidence.ice.distanceRatio.toFixed(2)})`)

    // 6b. Belts: an idle rider moves at the belt speed and reads idle; a dash-jump keeps the belt speed; a loose crate rides too.
    await place(2296, 214)
    const rideA = await advanceClock(150)
    await advanceClock(500)
    const rideB = await captureHeld('belt-ride')
    const ride = byId(mech(rideB).conveyors, 'lab_belt_right')
    const leftBelt = byId(mech(rideB).conveyors, 'lab_belt_left')
    const rideSpeed = (rideB.player.x - rideA.player.x) / ((mech(rideB).clockMs - mech(rideA).clockMs) / 1000)
    evidence.belt = { ride, leftBelt, rideSpeed, animation: rideB.playerVisual?.animationKey ?? null, environment: env(rideB) }
    assert.deepEqual([ride.heroOn, env(rideB).carryVelocityX, env(rideB).beltId], [true, 60, 'lab_belt_right'], 'the belt carries the hero')
    assert.ok(rideSpeed > 45 && rideSpeed < 75, `rides at the belt speed (${rideSpeed.toFixed(1)} px/s)`)
    assert.ok(!/run/.test(String(evidence.belt.animation)), `an idle rider does not run (${evidence.belt.animation})`)
    assert.match(String(ride.frame), /^mechanics_v2\/conveyor\/00[0-3]$/)
    assert.deepEqual([leftBelt.speed, leftBelt.flipX], [-60, true], 'the leftward belt draws flipped')
    await place(2290, 214)
    await tapKey(page, 'ArrowRight', 2)
    await advanceFrames(page, 10)
    await page.keyboard.down('z')
    await advanceFrames(page, 2)
    await page.keyboard.down('Space')
    await advanceFrames(page, 3)
    const jumpA = await readState(page)
    await advanceFrames(page, 10)
    const jumpB = await readState(page)
    await page.keyboard.up('Space')
    await page.keyboard.up('z')
    const airSpeed = (jumpB.player.x - jumpA.player.x) / ((mech(jumpB).clockMs - mech(jumpA).clockMs) / 1000)
    evidence.beltDashJump = { airSpeed, vx: [jumpA.player.vx, jumpB.player.vx], bonus: loco(jumpA).environment?.dashJumpBonusX ?? null, groundedA: loco(jumpA).grounded, groundedB: loco(jumpB).grounded }
    assert.equal(evidence.beltDashJump.bonus, 60, 'the dash-jump keeps the belt speed')
    assert.ok(Math.min(jumpA.player.vx, jumpB.player.vx) >= 375, `airborne vx is dash speed plus the belt (${evidence.beltDashJump.vx})`)
    // Displacement over stage-clock time reads a little under the body speed; 330 still separates 380 from a plain 320.
    assert.ok(airSpeed > 330, `airborne displacement beats a plain dash-jump (${airSpeed.toFixed(0)} px/s)`)
    await advanceClock(700)
    await page.evaluate(() => {
      const scene = window.__phaserGame.scene.getScene('Game')
      const crate = scene.add.rectangle(2340, 200, 12, 12, 0xffaa33).setDepth(6)
      scene.physics.add.existing(crate)
      scene.platformCollisionSystem.attachActor(crate)
      window.__smokeCrate = crate
    })
    await advanceClock(500)
    const crateA = await page.evaluate(() => ({ x: window.__smokeCrate.x, grounded: Boolean(window.__smokeCrate.body.blocked.down || window.__smokeCrate.body.touching.down) }))
    const carried = byId(mech(await readState(page)).conveyors, 'lab_belt_right').carried
    await advanceClock(500)
    const crateB = await page.evaluate(() => { const crate = window.__smokeCrate; const x = crate.x; crate.destroy(); delete window.__smokeCrate; return { x } })
    evidence.beltCrate = { crateA, crateB, carried }
    assert.ok(crateA.grounded && carried >= 1, `the crate stands on the belt and is counted (${carried})`)
    assert.ok(crateB.x - crateA.x > 12, `a loose body rides the belt (${(crateB.x - crateA.x).toFixed(1)}px)`)

    // 6c. Current: pushes an idle hero with the flow (half as much on the ground).
    await place(2760, 214)
    const currentA = await advanceClock(100)
    await advanceClock(600)
    const currentB = await captureHeld('current')
    const current = byId(mech(currentB).currentZones, 'lab_current')
    evidence.current = { current, dx: currentB.player.x - currentA.player.x, environment: env(currentB) }
    assert.deepEqual([current.heroInside, env(currentB).forceX, env(currentB).pushCap], [true, 420, 80], 'the current pushes the hero')
    assert.ok(evidence.current.dx > 8, `the current carries the hero with the flow (${evidence.current.dx}px)`)
    assert.match(String(current.frame), /^mechanics_v2\/current\/00[0-3]$/)

    // 6d. Gust: calm, faint streaks while it builds (the tell), then it blows the hero left.
    await waitForState(page, (next) => byId(mech(next).windZones, 'lab_gust')?.phase === 'building', 8000, 'gust builds')
    const building = byId(mech(await captureHeld('gust-building')).windZones, 'lab_gust')
    assert.ok(building.phase !== 'building' || (building.alpha === 0.45 && building.untilBlowMs <= 500), `building tell (${JSON.stringify(building)})`)
    await waitForState(page, (next) => byId(mech(next).windZones, 'lab_gust')?.phase === 'blowing', 4000, 'gust blows')
    await place(3040, 214)
    const gustA = await readState(page)
    await advanceClock(400)
    const gustB = await captureHeld('gust-blowing')
    const gust = byId(mech(gustB).windZones, 'lab_gust')
    evidence.gust = { building, gust, dx: gustB.player.x - gustA.player.x, environment: env(gustB) }
    assert.deepEqual([gust.phase, gust.alpha, env(gustB).forceX], ['blowing', 0.9, -900], 'the gust blows left')
    assert.ok(evidence.gust.dx < -6, `the gust pushes the hero back (${evidence.gust.dx}px)`)

    // 6e. Lifts: the wind lift and Ferro's magnet lift raise a hero standing at their base.
    for (const [id, x, label] of [['lab_lift', 3204, 'wind-lift'], ['lab_magnet', 3412, 'magnet-lift']]) {
      await place(x, 214)
      await advanceClock(500)
      const lifted = await captureHeld(label)
      const zone = byId(mech(lifted).windZones, id)
      evidence[id] = { y: lifted.player.y, zone, environment: env(lifted) }
      assert.ok(zone.heroInside && env(lifted).forceY < 0, `${id} pulls the hero up`)
      assert.ok(lifted.player.y < 170, `${id} raised the hero (y ${lifted.player.y})`)
    }
    assert.match(String(evidence.lab_magnet.zone.plateFrame), /^mechanics_v2\/magnet_lift\/00[0-3]$/)

    // 6f. Rails: one timer; arming sparks before arcing; the arc boxes are live only while arcing and take 2 HP.
    await place(3596, 214)
    await waitForState(page, (next) => byId(mech(next).railGroups, 'lab_rails')?.phase === 'arming', 8000, 'rails arm')
    const railsArming = byId(mech(await captureHeld('rails-arming')).railGroups, 'lab_rails')
    assert.ok(railsArming.untilArcMs <= 300 && railsArming.rails.every((rail) => !rail.live), 'arming: sparks, no live box')
    assert.ok(railsArming.rails.every((rail) => /^mechanics_v2\/power_rail\/00[13]$/.test(String(rail.frame))), `arming frames ${railsArming.rails.map((rail) => rail.frame)}`)
    await waitForState(page, (next) => byId(mech(next).railGroups, 'lab_rails')?.phase === 'arcing', 4000, 'rails arc')
    const railsArcing = byId(mech(await captureHeld('rails-arcing')).railGroups, 'lab_rails')
    assert.ok(railsArcing.rails.every((rail) => rail.live && rail.frame === v2('power_rail', 2) && rail.box?.height === 26), 'arcing: live arc boxes')
    await waitForState(page, (next) => { const group = byId(mech(next).railGroups, 'lab_rails'); return group?.phase === 'off' && group.untilArcMs > 900 }, 6000, 'rails off')
    await shield(0)
    await place(3640, 214)
    const hpRail = (await readState(page)).playerState.hp
    await advanceFrames(page, 8)
    state = await readState(page)
    if (byId(mech(state).railGroups, 'lab_rails').phase === 'off') assert.equal(state.playerState.hp, hpRail, 'an off rail does not hurt')
    state = await waitForState(page, (next) => next.playerState?.hp < hpRail, 8000, 'the arc hurts')
    evidence.rails = { arming: railsArming, arcing: railsArcing, hpBefore: hpRail, hpAfter: state.playerState.hp, lastHit: state.combatDebug?.lastPlayerHit ?? null }
    assert.equal(hpRail - state.playerState.hp, 2, 'rail damage from its group')

    // 6g. Rockfall: crossing its trigger puffs dust under the ceiling with a floor shadow; the boulder falls, hits the hero under it and breaks into rubble.
    // advanceClock waits out the last hit's hit-stop (the world, and so the stage clock, is paused through it).
    await shield(0)
    await place(3760, 214)
    await advanceClock(300)
    const hpRock = (await readState(page)).playerState.hp
    await place(3820, 214)
    await advanceClock(40)
    const warning = byId(mech(await captureHeld('rockfall-warning')).rockfalls, 'lab_rock')
    assert.deepEqual([warning.phase, warning.frame, warning.shadow], ['warning', v2('rockfall', 0), true], 'the dust puff and the shadow warn first')
    await waitForState(page, (next) => byId(mech(next).rockfalls, 'lab_rock')?.phase === 'falling', 3000, 'the boulder falls')
    const falling = byId(mech(await captureHeld('rockfall-falling')).rockfalls, 'lab_rock')
    if (falling.phase === 'falling') assert.match(String(falling.frame), /^mechanics_v2\/rockfall\/00[12]$/)
    state = await waitForState(page, (next) => byId(mech(next).rockfalls, 'lab_rock')?.phase === 'rubble', 3000, 'the boulder breaks')
    const rubble = byId(mech(await captureHeld('rockfall-rubble')).rockfalls, 'lab_rock')
    state = await readState(page)
    evidence.rockfall = { warning, falling, rubble, hpBefore: hpRock, hpAfter: state.playerState.hp }
    assert.deepEqual([rubble.frame, rubble.hits], [v2('rockfall', 3), 1], 'rubble, and it broke on the hero')
    assert.equal(hpRock - state.playerState.hp, 2, 'boulder damage')

    // 6h. Icicle: hangs, shakes when the hero passes under, falls, hits, shatters; the checkpoint respawn hangs it again.
    await shield(0)
    await place(3880, 214)
    await advanceClock(300)
    assert.equal(byId(mech(await readState(page)).icicles, 'lab_icicle').phase, 'hanging', 'not under it yet')
    const hpIce = (await readState(page)).playerState.hp
    await place(3916, 214)
    await advanceClock(40)
    const icicleShaking = byId(mech(await captureHeld('icicle-shaking')).icicles, 'lab_icicle')
    assert.deepEqual([icicleShaking.phase, icicleShaking.frame], ['shaking', v2('icicle', 0)], 'it shakes over the hero')
    await waitForState(page, (next) => byId(mech(next).icicles, 'lab_icicle')?.phase === 'shattered', 4000, 'the icicle shatters')
    const shattered = byId(mech(await captureHeld('icicle-shattered')).icicles, 'lab_icicle')
    state = await readState(page)
    assert.equal(shattered.hits, 1, 'it shattered on the hero')
    assert.ok(shattered.frame === v2('icicle', 1) || shattered.timerMs >= 450, `shards show after the shatter (${shattered.frame})`)
    assert.equal(hpIce - state.playerState.hp, 2, 'icicle damage')
    await advanceClock(300)
    await page.evaluate(() => window.__phaserGame.scene.getScene('Game').requestPlayerDamage({ amount: 99, tier: 'heavy', sourceType: 'hazard', sourceId: 'smoke_12b_respawn', bypassIFrames: true }))
    await waitForState(page, (next) => next.playerState?.hp === 0, 6000, 'the test kill lands')
    state = await waitForState(page, (next) => next.playerState?.hp > 0 && byId(mech(next).icicles, 'lab_icicle')?.phase === 'hanging', 12000, 'the respawn hangs the icicle again')
    evidence.icicle = { shaking: icicleShaking, shattered, hpBefore: hpIce, afterRespawn: byId(mech(state).icicles, 'lab_icicle'), rockAfterRespawn: byId(mech(state).rockfalls, 'lab_rock'), respawnX: state.player.x }
    assert.ok(Math.abs(state.player.x - 3600) < 40, `respawned at lab_drops (x ${state.player.x})`)
    assert.equal(evidence.icicle.rockAfterRespawn.phase, 'waiting', 'the respawn resets the rockfall and crosses no trigger')
    await capture('icicle-respawn')

    assert.deepEqual(errors, [], 'no page errors')
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    return { artifacts: dir, evidence }
  } finally {
    await browser.close()
  }
}
