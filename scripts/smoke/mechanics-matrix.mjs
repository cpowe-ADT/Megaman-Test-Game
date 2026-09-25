// Smoke 42-mechanics-matrix (06 §6.2, Heat Works engine lane). Loads the developer `mechanics_lab` stage
// and checks every stage mechanic through render_game_to_text().mechanics: hazard boxes and damage from
// their definitions, two vents on one clock (arming before firing, damage only while firing), a crumble
// platform (shake, fall, return), both breakable walls (three saber cuts; a pellet does nothing, a charged
// shot breaks it), and the two-screen climb with rising slag (camera follows up, contact kills through the
// damage path, the death holds the slag, the respawn resets it). Placement is test-side (`place`); the
// verbs are real key presses. The mechanics_v1 art: each drawn frame is read back through the `frame`
// fields (nozzleFrame/flameFrame, surfaceFrame, crumble and wall `frame`) and must follow the state.
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
    for (let sample = 0; sample < 6; sample += 1) {
      await advanceFrames(page, 5)
      const slag = byId(mech(await readState(page)).risingLiquids, 'lab_slag')
      assert.equal(slag.surfaceArtTop, slag.surfaceY - 8, 'the surface strip\'s liquid edge sits on the kill line')
      slagFrames.add(slag.surfaceFrame)
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

    assert.deepEqual(errors, [], 'no page errors')
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    return { artifacts: dir, evidence }
  } finally {
    await browser.close()
  }
}
