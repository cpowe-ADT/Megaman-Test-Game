// Smoke 59-ferro-route (EVAL-P6-010, Transit Security rebuilt to the Heat Works standard). Runs with storyIntro=on
// so the checkpoint-2 radio and the mid-boss callout reach the lane. The cutter lanes follow the stage clock: to
// reach a phase the smoke sets that clock test-side (`setClock`), as it warps the hero between steps (`place`).
// Steps, each with a capture:
// (a) from the spawn, real input (hold right, jump at fixed x's) over the intro crate, the teach crate and the
//     first pit, over the blades at the end of the teach belt, up the teach magnet lift onto the press housing
//     and on to checkpoint 2; the hero is shielded;
// (b) unshielded, a hero standing still on the belt against him is carried into the blades at its end and hurt;
// (c) on real input the fast escalate belt carries the hero into the shear housing, whose magnet lift raises
//     him onto it and the catwalk over the bladed belt, unhurt;
// (d) the heart: from the wrong-way belt (running back toward its step) a plain running jump falls short of the
//     heart ledge; a dash jump against the belt reaches it and collects the heart;
// (e) the inspection station locks (camera held, the mid-boss callout on the radio lane), its belt carries a hero
//     who stands still toward the nest, walking into the gate does not pass, and it opens only after the nest
//     falls; walking on crosses checkpoint 3;
// (f) a charged shot breaks the office wall and walking in collects the sub tank; the capsule (arm parts) is on the
//     bulkhead;
// (g) the trimming hall: a buster shot fired along the floor belt rides it (its step is its own speed plus the
//     belt's); a cutter lane torch hurts a rider in its sweep; unshielded and behind the sweep, the hero rides the
//     upper belt unhurt, drops at its end onto the floor belt (carried back), walks into the magnet lift and is
//     lifted onto the next housing;
// (h) one capture per screen for the route contact sheet (`route-00.png` to `route-12.png`);
// (i) real input from the end of the full-speed lane over the last pit crosses checkpoint 4 into the boss
//     room, and the boss is on screen and takes damage.
// Placement between steps is test-side; order follows the checkpoints so each crossing is real. The shield
// blocks damage, not knockback: a walk that tests the terrain removes each enemy it comes within 240px of
// (`clearEnemies`, once each, never the nest), as a player's shots would.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

/** One hero position per 448px screen for the route sheet (on solid ground, off pits, belts' blades and lifts). */
const ROUTE_SHOTS = [[216, 190], [664, 190], [1208, 102], [1420, 214], [1832, 174], [2268, 158], [2760, 214], [3200, 214], [3600, 146], [4048, 146], [4496, 146], [5008, 214], [5690, 214]]
const NEST = 'ferro_mid_nest'

export async function runFerroRouteScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
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
  // The stage clock the torches read (`StageMechanicsAdapter`, scene data `stageMechanics`).
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
  // frames (with `dash`, dash is pressed on the jump's first frame: a dash jump). A press the landing lag
  // swallows is pressed again, and a hero stalled on the floor while holding right jumps again after 10 frames
  // (unless `stallJumps: false`). Stops at `targetX`, on a death, when `untilGrounded` lands after leaving the
  // floor, or at `maxFrames`. Reports the highest point, the furthest x, the lowest HP, the belts stood on and the
  // zones entered.
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
      const zones = new Set()
      let hold = 0
      let dashFrame = false
      let next = 0
      let frames = 0
      let minY = game.player.y
      let maxX = game.player.x
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
            if (cleared.has(entry.id) || entry.id === 'ferro_mid_nest' || !entry.sprite?.active || Math.abs(entry.sprite.x - x) > 240) continue
            cleared.add(entry.id)
            game.enemySpawner.applyDamageToSprite(entry.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_59_clear' })
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
          dashFrame = Boolean(jumps[next].dash)
          pressed = jumps[next]
          log.push({ jumpAtX: Math.round(x), y: Math.round(game.player.y), dash: dashFrame, frame: frames })
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
        const held = [...(plan.right === false ? [] : ['moveRight']), ...(jumpHeld ? ['jump'] : []), ...(dashFrame ? ['dash'] : [])]
        dashFrame = false
        window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }])
        released = !jumpHeld
        if (hold > 0) hold -= 1
        minY = Math.min(minY, game.player.y)
        maxX = Math.max(maxX, game.player.x)
        minHp = Math.min(minHp, game.playerHp)
        const env = game.data.get('stageMechanics')?.getDebugState?.().heroEnvironment
        if (env?.beltId) rode.add(env.beltId)
        for (const id of env?.zoneIds ?? []) zones.add(id)
      }
      window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), minY: Math.round(minY * 10) / 10, maxX: Math.round(maxX), hp: game.playerHp, minHp, rode: [...rode], zones: [...zones], cleared: [...cleared], log }
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
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'ferro_blade' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'ferro_blade', 30000, 'ferro loaded')
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    let state = await capture('spawn')
    assert.equal(state.stageRuntime.checkpointIndex, 0)
    assert.equal((mech(state).windZones ?? []).filter((zone) => zone.style === 'magnet').length, 5, 'five magnet lifts on the stage')
    mark('loaded')

    // (a) Spawn to checkpoint 2 on real input: over the intro crate, over the teach crate and the first pit in one
    // jump, over the blades at the teach belt's end, up the magnet lift onto the press housing and on.
    await shield(600000)
    const walkTeach = await drive({ clearEnemies: true, targetX: 1400, maxFrames: 600, jumps: [{ atX: 160, hold: 10 }, { atX: 598, hold: 24 }, { atX: 930, hold: 14 }] })
    evidence.walkTeach = walkTeach
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 6000, 'checkpoint 2 on real input')
    await capture('checkpoint-2')
    assert.ok(walkTeach.zones.includes('ferro_lift_teach') && walkTeach.minY < 110 && walkTeach.minHp === walkTeach.hp, `lifted onto the press and on to checkpoint 2 (${JSON.stringify(walkTeach)})`)
    mark('a')

    // (b) Standing still on the belt against the hero carries him into the blades at its end.
    await skipDialogue()
    await shield(0)
    await place(1580, 214)
    await standing('standing on the belt against the hero')
    state = await readState(page)
    const beltHp = state.playerState.hp
    const beltFrom = state.player.x
    state = await waitForState(page, (next) => next.playerState?.hp < beltHp, 8000, 'the belt carries the hero into the blades')
    evidence.bladeBelt = { from: beltFrom, to: state.player.x, hpBefore: beltHp, hpAfter: state.playerState.hp }
    assert.ok(state.player.x < beltFrom - 40, `carried back into the blades (${JSON.stringify(evidence.bladeBelt)})`)
    await capture('belt-blades')
    await shield(600000)
    mark('b')

    // (c) The fast belt carries the hero into the magnet lift, which lifts him onto the catwalk over the blades.
    await shield(0)
    await place(1880, 214)
    await standing('standing on the fast belt')
    const liftRide = await drive({ clearEnemies: true, targetX: 2080, maxFrames: 240, stallJumps: false })
    evidence.escalateLift = liftRide
    assert.ok(liftRide.rode.includes('ferro_escalate_belt_fast') && liftRide.zones.includes('ferro_lift_escalate'), `the belt fed the lift (${JSON.stringify(liftRide)})`)
    assert.ok(liftRide.minY < 130 && liftRide.x >= 2040 && liftRide.minHp === liftRide.hp, `lifted onto the shear housing and over the blades, unhurt (${JSON.stringify(liftRide)})`)
    await capture('escalate-lift')
    await shield(600000)
    mark('c')

    // (d) The heart: a plain running jump off the wrong-way belt falls short of the ledge; a dash jump against it lands.
    const heartTry = async (dash) => {
      // In on the floor first: the tall room raises the world ceiling once the hero is inside it.
      await place(2300, 214)
      await advanceFrames(page, 4)
      await place(2300, 70)
      await standing('standing on the wrong-way belt')
      return drive({ targetX: 2720, maxFrames: 150, untilGrounded: true, stallJumps: false, jumps: [{ atX: 2352, hold: 24, dash }] })
    }
    const plainJump = await heartTry(false)
    const plainChecks = await collected()
    const dashJump = await heartTry(true)
    await advanceFrames(page, 10)
    const heartChecks = await collected()
    evidence.heart = { plainJump, dashJump, plainChecks, heartChecks }
    assert.ok(plainJump.log[0]?.y < 90 && dashJump.log[0]?.y < 90, `both jumps leave the wrong-way belt (${JSON.stringify(evidence.heart)})`)
    assert.ok(!plainChecks.includes('ferro_blade:heart_tank') && plainJump.y > 150, `a plain jump falls short (${JSON.stringify(plainJump)})`)
    assert.ok(dashJump.rode.includes('ferro_heart_belt') && heartChecks.includes('ferro_blade:heart_tank'), `the dash jump against the belt collects the heart (${JSON.stringify(dashJump)})`)
    await capture('heart')
    await skipDialogue()
    mark('d')

    // (e) The inspection station: locks on entry, holds the camera, plays the callout; its belt carries a still hero
    // toward the nest; the gate opens only after the nest falls.
    await place(2740, 214)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'locked', 5000, 'the station locks')
    assert.equal(mech(state).roomLocks[0].cameraHeld, true, 'the camera is held to the room')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /turret nest/i.test(next.ticker.text ?? ''), 30000, 'mid-boss callout on the radio lane')
    assert.equal(callout.dialogue?.active ?? false, false, 'the callout never blocks')
    await capture('midboss-locked')
    await place(2760, 214)
    await standing('standing on the inspection belt')
    const feedFrom = (await readState(page)).player.x
    await advanceFrames(page, 40)
    state = await readState(page)
    evidence.inspectionBelt = { from: feedFrom, to: state.player.x, environment: mech(state).heroEnvironment }
    assert.ok(state.player.x > feedFrom + 10 && mech(state).heroEnvironment?.beltId === 'ferro_mid_belt', `the belt carries the hero toward the nest (${JSON.stringify(evidence.inspectionBelt)})`)
    await place(3104, 214)
    const pushed = await drive({ targetX: 3160, maxFrames: 30, stallJumps: false })
    state = await readState(page)
    evidence.pushed = { pushed, lock: mech(state).roomLocks[0] }
    assert.ok(pushed.x < 3136 && mech(state).roomLocks[0].gateClosed === true, `the closed gate holds (${JSON.stringify(evidence.pushed)})`)
    const nestHits = []
    for (let attempt = 0; attempt < 60; attempt += 1) {
      const hit = await page.evaluate((id) => {
        const game = window.__phaserGame.scene.getScene('Game')
        const entity = game.enemySpawner.getEntities().find((entry) => entry.id === id)
        if (!entity) return { gone: true }
        const before = { active: entity.sprite?.active, typeKey: entity.typeKey }
        if (entity.sprite?.active) game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_59' })
        return { gone: false, ...before }
      }, NEST)
      nestHits.push(hit)
      if (hit.gone) break
      await advanceFrames(page, 6)
    }
    evidence.nestHits = nestHits.slice(-6)
    assert.ok(nestHits.some((hit) => hit.gone === false && hit.typeKey === 'relay_turret_nest_ferro'), 'found the Ferro nest')
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'open' && !mech(next).roomLocks[0].gateClosed, 15000, 'gate opens after the nest falls')
    evidence.midboss = mech(state).roomLocks[0]
    await capture('midboss-open')
    evidence.toCheckpoint3 = await drive({ targetX: 3200, maxFrames: 120 })
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2, 6000, 'checkpoint 3')
    mark('e')

    // (f) The secret: a charged shot breaks the office wall; walking in collects the sub tank. The capsule (arm
    // parts) stands on the bulkhead the route crosses.
    await place(3246, 214)
    await tapKey(page, 'ArrowRight', 2)
    assert.equal(byId(mech(await readState(page)).breakableWalls, 'ferro_office_wall').phase, 'intact')
    await capture('secret-wall')
    await page.keyboard.down('x')
    await advanceFrames(page, 50)
    await page.keyboard.up('x')
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'ferro_office_wall')?.phase === 'broken', 4000, 'charged shot breaks the office wall')
    const secretWalk = await drive({ clearEnemies: true, targetX: 3408, maxFrames: 240 })
    await advanceFrames(page, 10)
    const subChecks = await collected()
    evidence.secret = { walk: secretWalk, collected: subChecks }
    assert.ok(subChecks.includes('ferro_blade:sub_tank'), `sub tank collected (${subChecks})`)
    await capture('secret-room')
    await skipDialogue()
    await place(3536, 140)
    await advanceFrames(page, 20)
    const capsuleChecks = await collected()
    assert.ok(capsuleChecks.includes('ferro_blade:capsule'), `capsule collected on the bulkhead (${capsuleChecks})`)
    await capture('capsule')
    await skipDialogue()
    mark('f')

    // (g) The trimming hall. A buster shot fired along the floor belt (running left) rides it: each 1/60s step
    // is the shot's own velocity plus the belt's -60px/s.
    await place(3700, 214)
    await standing('standing on the first floor belt')
    const shotTrack = await page.evaluate(() => {
      const loop = window.__phaserGame.loop
      const wasRunning = loop.running
      if (wasRunning) loop.sleep()
      try {
        const game = window.__phaserGame.scene.getScene('Game')
        const mechanics = () => game.data.get('stageMechanics').getDebugState()
        const beltFrames = () => mechanics().conveyors.find((entry) => entry.id === 'ferro_hall_floor_1').shotFrames
        const framesBefore = beltFrames()
        const activeShots = () => game.playerBullets.getChildren().filter((child) => child.active)
        const before = new Set(activeShots())
        window.stageDebug.replayInputs([{ frame: 0, held: ['moveRight'] }, { frame: 1, held: ['moveRight', 'shoot'] }, { frame: 2, held: [] }])
        const shot = activeShots().find((child) => !before.has(child))
        if (!shot) return { fired: false }
        const steps = []
        let lastX = shot.x
        for (let frame = 0; frame < 24 && shot.active; frame += 1) {
          window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
          const vx = shot.body.velocity.x
          const dx = shot.x - lastX
          lastX = shot.x
          steps.push({ x: Math.round(shot.x * 10) / 10, y: Math.round(shot.y), vx: Math.round(vx), extra: Math.round((dx - vx / 60) * 100) / 100 })
        }
        return { fired: true, projectileId: shot.data?.get?.('projectileId'), steps, shotFrames: beltFrames() - framesBefore }
      } finally {
        if (wasRunning) loop.wake()
      }
    })
    evidence.shotOnBelt = shotTrack
    assert.ok(shotTrack.fired, 'the buster fired')
    const overBelt = shotTrack.steps.filter((step) => step.x > 3624 && step.x < 4024)
    const meanExtra = overBelt.reduce((sum, step) => sum + step.extra, 0) / Math.max(1, overBelt.length)
    evidence.shotOnBelt.meanExtraPerStep = Math.round(meanExtra * 100) / 100
    assert.ok(overBelt.length >= 6 && shotTrack.shotFrames >= overBelt.length - 2, `the belt counted the shot (${JSON.stringify(shotTrack)})`)
    assert.ok(Math.abs(meanExtra + 1) < 0.35, `each step adds the belt's -1px (60px/s) to the shot's own (${JSON.stringify(evidence.shotOnBelt)})`)
    await place(3700, 214)
    await standing('standing on the first floor belt again')
    await page.evaluate(() => window.stageDebug.replayInputs([{ frame: 0, held: ['moveRight'] }, { frame: 1, held: ['moveRight', 'shoot'] }, { frame: 2, held: [] }, { frame: 8, held: [] }]))
    await capture('hall-shot-on-belt')
    // A cutter torch hurts a rider in its sweep (torch 2 fires from 2150ms of the 2.4s cycle).
    await shield(0)
    await setClock(1900)
    await place(3736, 146)
    state = await readState(page)
    const torchHp = state.playerState.hp
    state = await waitForState(page, (next) => next.playerState?.hp < torchHp, 4000, 'a cutter torch hurts a rider in its sweep')
    evidence.torchHit = { hpBefore: torchHp, hpAfter: state.playerState.hp }
    await capture('hall-sweep-hit')
    await shield(600000)
    await advanceFrames(page, 30)
    // Behind the sweep, unshielded: ride the upper belt to its end, drop onto the floor belt (it carries the hero
    // back), walk into the magnet lift and get lifted onto the next housing.
    await shield(0)
    await place(3600, 146)
    await standing('standing on the entry housing')
    await setClock(2500)
    const ride = await drive({ clearEnemies: true, targetX: 3912, maxFrames: 120, stallJumps: false })
    state = await readState(page)
    evidence.hallRide = { ride, hero: state.player }
    assert.ok(ride.rode.includes('ferro_hall_upper_1') && ride.minHp === ride.hp && ride.x >= 3900, `rode the upper belt behind the sweep, unhurt (${JSON.stringify(evidence.hallRide)})`)
    await capture('hall-upper-ride')
    const drop = await drive({ right: false, maxFrames: 50, stallJumps: false })
    state = await readState(page)
    evidence.hallDrop = { drop, hero: state.player }
    assert.ok(drop.rode.includes('ferro_hall_floor_1') && state.player.y > 200 && state.player.x < ride.x, `dropped onto the floor belt and carried back (${JSON.stringify(evidence.hallDrop)})`)
    await capture('hall-drop')
    const lift = await drive({ clearEnemies: true, targetX: 4040, maxFrames: 240, stallJumps: false })
    await advanceFrames(page, 20)
    state = await readState(page)
    evidence.hallLift = { lift, hero: state.player, hp: state.playerState.hp }
    assert.ok(lift.zones.includes('ferro_lift_hall_1') && lift.minY < 150, `the magnet lift raised the hero (${JSON.stringify(evidence.hallLift)})`)
    assert.ok(state.player.x >= 4032 && state.player.y < 168 && lift.minHp === ride.hp, `onto the next housing, unhurt (${JSON.stringify(evidence.hallLift)})`)
    await capture('hall-lifted')
    await shield(600000)
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

    // (i) From the end of the full-speed lane: over the last pit, checkpoint 4, the boss room, the boss on screen.
    await shield(600000)
    await place(5560, 214)
    await standing('standing at the end of the full-speed lane')
    const approach = await drive({ clearEnemies: true, targetX: 5760, maxFrames: 240, jumps: [{ atX: 5572, hold: 12 }] })
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
