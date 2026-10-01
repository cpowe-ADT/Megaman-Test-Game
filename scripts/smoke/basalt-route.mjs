// Smoke 57-basalt-route (EVAL-P6-010, Structural Works rebuilt to the Heat Works standard). Runs with storyIntro=on
// so the checkpoint-2 radio and the mid-boss callout reach the lane. Steps, each with a capture:
// (a) from the spawn, real input (hold right, jump at fixed x's) over the intro step and its crumble slab, the
//     first pit, the teach deck, the crumble-bridge pit and the gallery to checkpoint 2; shielded, so the drops
//     and enemies it passes cannot stop it;
// (b) a hero standing on the intro slab: it shakes, falls 350ms after the landing, the hero drops to the floor;
// (c) the gallery: crossing a trigger drops a boulder, its shadow on the floor through the warning and the fall;
// (d) support pad A: the room locks (camera held), its gate holds, the first wave falls, the second wave drops in
//     (`wave` 1), and the gate opens only after it falls too;
// (e) a charged shot breaks the crew hut's wall and walking in collects the heart; the capsule alcove over the
//     roof collects the capsule (warp plus assert);
// (f) the shaft head locks with the camera held and the `basalt_titan_miniboss` callout on the radio lane; the
//     custodian walker's stomp shakes the slabs on the side it faces and not the other; its gate holds, and opens
//     once it falls; walking on crosses checkpoint 3;
// (g) the headframe (warp to the top, camera held and scrolled up), then real input from the top ledge over the
//     right wall and down the shaft: the landing, the launch crumble, the crumbling ledge, the load-lined ledge,
//     the floor, and on under the casing into pad B's room; a capture of the shaft rain with a boulder's shadow;
// (h) the side shaft: a plain jump off the launch crumble falls short of the casing; a dash jump off it (real
//     input, before it falls) clears the casing, lands in the mouth and drops to the sub tank shelf; walking off
//     the shelf drops into pad B's room, which locks and runs its two waves;
// (i) one capture per screen for the route contact sheet (`route-00.png` to `route-11.png`);
// (j) real input from the end of the lane over the last pit crosses checkpoint 4 into the boss room, and the boss
//     is on screen and takes damage.
// Placement between steps is test-side; order follows the checkpoints so each crossing is real. The shield blocks
// damage, not knockback: a walk that tests the terrain removes each enemy it comes within 240px of (once each,
// never a locked room's markers), as a player's shots would.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

/** One hero position per 448px screen for the route sheet (on what it stands on; tall rooms from inside). */
const ROUTE_SHOTS = [[200, 214], [672, 214], [1110, 214], [1440, 214], [2016, 190], [2400, 146], [2720, 182], [3392, -134], [3830, 78], [4200, 190], [4600, 214], [5000, 214]]
/** Markers the walks never clear: the locked rooms' own. */
const KEEP = ['basalt_pad_a_hopper_1', 'basalt_pad_a_hauler', 'basalt_pad_a_hopper_2', 'basalt_mid_custodian', 'basalt_pad_b_hauler', 'basalt_pad_b_hopper']

export async function runBasaltRouteScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames, tapKey }) {
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
  const lockOf = (state, id) => byId(mech(state).roomLocks, id)
  const crumbleOf = (state, id) => byId(mech(state).crumbles, id)
  const rockOf = (state, id) => byId(mech(state).rockfalls, id)
  const place = async (x, y) => {
    await page.evaluate(({ x, y }) => {
      const hero = window.__phaserGame.scene.getScene('Game').player
      hero.setPosition(x, y)
      // `reset` moves the body's previous position too, so a one-way ledge sees the hero arrive from above.
      hero.body?.reset?.(x, y)
      hero.body?.setVelocity?.(0, 0)
    }, { x, y })
    await advanceFrames(page, 3)
  }
  const shield = (ms) => page.evaluate((value) => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(value), ms)
  const collected = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').progressionSave?.collectedChecks ?? [])
  const entities = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').enemySpawner.getEntities().map((entry) => ({ id: entry.id, typeKey: entry.typeKey, x: Math.round(entry.sprite.x), y: Math.round(entry.sprite.y), facing: entry.facing, state: entry.state, active: entry.sprite.active })))
  const skipDialogue = async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      if (!(await readState(page)).dialogue?.active) return
      await page.evaluate(() => window.stageDebug.skipDialogue())
      await advanceFrames(page, 4)
    }
  }
  // Hit each listed marker until its entity is gone (a hit inside an invulnerability window does not count).
  const defeat = async (ids, label) => {
    const log = []
    for (let attempt = 0; attempt < 80; attempt += 1) {
      const left = await page.evaluate((ids) => {
        const game = window.__phaserGame.scene.getScene('Game')
        const live = game.enemySpawner.getEntities().filter((entry) => ids.includes(entry.id))
        for (const entity of live) {
          if (entity.sprite?.active) game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_57' })
        }
        return live.map((entry) => entry.id)
      }, ids)
      log.push(left)
      if (left.length === 0) break
      await advanceFrames(page, 6)
    }
    assert.ok(log.some((left) => left.length > 0), `${label}: found ${ids}`)
    return log.slice(-3)
  }
  // Real input, one frame at a time in the page (the loop sleeps for the whole drive, so every step is a fixed
  // 1/60s): hold right unless `right: false`; at each jump x, once grounded for 4 frames, hold jump for `hold`
  // frames. A press the landing lag swallows is released for a frame and pressed again, and a hero stalled on
  // the floor while holding right jumps again after 10 frames, as a player would. `dashJump` holds dash from its
  // x (once grounded) and jump 3 frames later for `hold` frames. Stops at `targetX`, on a death, when
  // `untilGrounded` lands after leaving the floor, when `untilCollected` is collected, or at `maxFrames`.
  const drive = (plan) => page.evaluate(({ plan, keep }) => {
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
      let maxY = game.player.y
      let left = false
      let groundedFor = 0
      let released = true
      let pressed = null
      let stalled = 0
      let dashFrame = -1
      const cleared = new Set()
      const landings = []
      let wasGrounded = Boolean(game.player.body?.blocked?.down)
      let lastX = game.player.x
      for (; frames < plan.maxFrames; frames += 1) {
        const x = game.player.x
        if (x >= (plan.targetX ?? Infinity) || x <= (plan.leftTo ?? -Infinity) || game.playerHp <= 0) break
        if (plan.untilCollected && (game.progressionSave?.collectedChecks ?? []).includes(plan.untilCollected)) break
        if (plan.clearEnemies) {
          for (const entry of game.enemySpawner.getEntities()) {
            if (cleared.has(entry.id) || keep.includes(entry.id) || !entry.sprite?.active || Math.abs(entry.sprite.x - x) > 240) continue
            cleared.add(entry.id)
            game.enemySpawner.applyDamageToSprite(entry.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_57_clear' })
          }
        }
        const grounded = Boolean(game.player.body?.blocked?.down)
        if (grounded && !wasGrounded) landings.push([Math.round(x), Math.round(game.player.y)])
        wasGrounded = grounded
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
        if (plan.dashJump && dashFrame < 0 && x >= plan.dashJump.atX && grounded) {
          dashFrame = frames
          log.push({ dashAtX: Math.round(x), y: Math.round(game.player.y), frame: frames })
        }
        if (dashFrame >= 0 && frames === dashFrame + 3) hold = plan.dashJump.hold
        stalled = grounded && plan.right !== false && Math.abs(x - lastX) < 0.5 ? stalled + 1 : 0
        lastX = x
        if (stalled >= 10 && hold === 0 && released && plan.stallJumps !== false) {
          hold = 14
          stalled = 0
          log.push({ stallJumpAtX: Math.round(x), frame: frames })
        }
        const jumpHeld = hold > 0
        const dashHeld = dashFrame >= 0 && frames <= dashFrame + (plan.dashJump?.dashFrames ?? 30)
        const walkHeld = plan.leftTo !== undefined ? ['moveLeft'] : plan.right === false ? [] : ['moveRight']
        const held = [...walkHeld, ...(dashHeld ? ['dash'] : []), ...(jumpHeld ? ['jump'] : [])]
        window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }])
        released = !jumpHeld
        if (hold > 0) hold -= 1
        minY = Math.min(minY, game.player.y)
        maxY = Math.max(maxY, game.player.y)
        if (plan.trace && frames % 4 === 0 && log.length < 90) log.push([frames, Math.round(game.player.x), Math.round(game.player.y), grounded ? 1 : 0, Math.round(game.player.body?.velocity?.x ?? 0)])
      }
      window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
      return { frames, x: Math.round(game.player.x), y: Math.round(game.player.y), minY: Math.round(minY), maxY: Math.round(maxY), hp: game.playerHp, cleared: [...cleared], landings: landings.slice(0, 16), log }
    }
  }, { plan, keep: KEEP })
  const standing = (label, timeout = 8000) => waitForState(page, (next) => next.playerState?.hp > 0 && next.newPlayer?.locomotion?.grounded === true, timeout, label)
  const evidence = { timingMs: {} }
  const startedAt = Date.now()
  const mark = (label) => { evidence.timingMs[label] = Date.now() - startedAt }
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`, { timeout: 90000 })
    await waitForState(page, (state) => state.scene === 'StageSelect', 30000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'basalt_titan' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'basalt_titan', 30000, 'basalt loaded')
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const state = await readState(page)
      if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
      await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
      await advanceFrames(page, 6)
    }
    let state = await capture('spawn')
    assert.equal(state.stageRuntime.checkpointIndex, 0)
    mark('loaded')

    // (a) Spawn to checkpoint 2 on real input: onto the step, over its slab, the first pit, the deck, the bridge
    // pit, then the gallery under its roof.
    await shield(600000)
    const walk = await drive({ clearEnemies: true, targetX: 1400, maxFrames: 600, jumps: [{ atX: 160, hold: 12 }, { atX: 506, hold: 26 }, { atX: 772, hold: 26 }] })
    evidence.walkToCheckpoint2 = walk
    state = await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 1, 6000, 'checkpoint 2 on real input')
    assert.ok(walk.x >= 1376 && walk.hp > 0, `walked to checkpoint 2 (${JSON.stringify(walk)})`)
    assert.ok((rockOf(state, 'basalt_rock_gallery_1')?.drops ?? 0) >= 1, 'the gallery dropped its first boulder')
    await capture('checkpoint-2')
    mark('a')

    // (b) The crumble: stand on the intro slab; it shakes, then falls 350ms after the landing, and the hero drops.
    await place(344, 170)
    const shake = []
    for (let attempt = 0; attempt < 40; attempt += 1) {
      const slab = crumbleOf(await readState(page), 'basalt_crumble_intro')
      shake.push([slab.phase, slab.timerMs])
      if (slab.phase === 'fallen') break
      if (slab.phase === 'shaking' && shake.filter(([phase]) => phase === 'shaking').length === 2) await capture('crumble-shaking')
      await advanceFrames(page, 3)
    }
    evidence.crumbleShake = shake
    const shaking = shake.filter(([phase]) => phase === 'shaking')
    assert.ok(shaking.length >= 2 && shake.at(-1)[0] === 'fallen', `the slab shook, then fell (${JSON.stringify(shake)})`)
    // `render_game_to_text` rounds `timerMs`: a shake at 349.6ms reads 350. The slab shakes up to 350ms and no longer
    // (`stepCrumble` turns it at 350), and it shook well past a jump's length before it fell.
    const lastShake = Math.max(...shaking.map(([, ms]) => ms))
    assert.ok(lastShake > 200 && lastShake <= 350, `it falls once its 350ms shake runs out (last shaking sample ${lastShake}ms)`)
    state = await standing('dropped to the floor under the slab')
    assert.ok(state.player.y > 200, `on the floor (y ${state.player.y})`)
    mark('b')

    // (c) The gallery: crossing a trigger drops a boulder; its shadow shows on the floor until it breaks.
    await place(1060, 214)
    await standing('standing in the gallery')
    const rockBefore = rockOf(await readState(page), 'basalt_rock_gallery_2')
    await drive({ targetX: 1100, maxFrames: 30, stallJumps: false })
    state = await waitForState(page, (next) => rockOf(next, 'basalt_rock_gallery_2')?.phase === 'falling', 4000, 'the gallery boulder falls')
    evidence.galleryRock = { before: rockBefore, falling: rockOf(state, 'basalt_rock_gallery_2') }
    assert.equal(rockOf(state, 'basalt_rock_gallery_2').shadow, true, 'the shadow marks the landing')
    await capture('gallery-rockfall')
    mark('c')

    // (d) Support pad A: locks, holds its gate, then two waves; the gate opens after the second.
    await place(1824, 214)
    state = await waitForState(page, (next) => lockOf(next, 'basalt_pad_a_lock')?.phase === 'locked', 5000, 'pad A locks')
    assert.equal(lockOf(state, 'basalt_pad_a_lock').cameraHeld, true, 'the camera is held to the pad')
    await capture('pad-a-locked')
    await place(2216, 214)
    const padPushed = await drive({ targetX: 2280, maxFrames: 30, stallJumps: false })
    state = await readState(page)
    assert.ok(padPushed.x < 2240 && lockOf(state, 'basalt_pad_a_lock').gateClosed === true, `pad A's gate holds (${JSON.stringify(padPushed)})`)
    evidence.padAFirst = await defeat(['basalt_pad_a_hopper_1', 'basalt_pad_a_hauler', 'basalt_pad_a_hopper_2'], 'pad A wave 1')
    state = await waitForState(page, (next) => lockOf(next, 'basalt_pad_a_lock')?.wave === 1, 5000, 'pad A second wave')
    assert.equal(lockOf(state, 'basalt_pad_a_lock').phase, 'locked', 'still locked for the second wave')
    let waveTwo = []
    for (let attempt = 0; attempt < 20 && waveTwo.length < 2; attempt += 1) {
      waveTwo = (await entities()).filter((entry) => entry.id.startsWith('basalt_pad_a_wave_'))
      if (waveTwo.length < 2) await advanceFrames(page, 4)
    }
    evidence.padAWaveTwo = waveTwo
    assert.equal(waveTwo.length, 2, 'the second wave drops in')
    await advanceFrames(page, 20)
    await capture('pad-a-wave-2')
    evidence.padASecond = await defeat(['basalt_pad_a_wave_bouncer', 'basalt_pad_a_wave_hopper'], 'pad A wave 2')
    state = await waitForState(page, (next) => lockOf(next, 'basalt_pad_a_lock')?.phase === 'open' && !lockOf(next, 'basalt_pad_a_lock').gateClosed, 15000, 'pad A opens')
    evidence.padA = lockOf(state, 'basalt_pad_a_lock')
    await capture('pad-a-open')
    mark('d')

    // (e) The heart: a charged shot breaks the hut's wall; walking in collects it. Then the capsule alcove.
    await place(2292, 214)
    await tapKey(page, 'ArrowRight', 2)
    assert.equal(byId(mech(await readState(page)).breakableWalls, 'basalt_secret_wall').phase, 'intact')
    await capture('secret-wall')
    await page.keyboard.down('x')
    await advanceFrames(page, 50)
    await page.keyboard.up('x')
    state = await waitForState(page, (next) => byId(mech(next).breakableWalls, 'basalt_secret_wall')?.phase === 'broken', 4000, 'charged shot breaks the hut wall')
    const heartWalk = await drive({ targetX: 2480, maxFrames: 200, stallJumps: false })
    await advanceFrames(page, 10)
    const heartChecks = await collected()
    evidence.heart = { walk: heartWalk, collected: heartChecks }
    assert.ok(heartChecks.includes('basalt_titan:heart_tank'), `heart tank collected in the hut (${heartChecks})`)
    await capture('secret-room')
    await skipDialogue()
    await place(2400, 146)
    await place(2448, 96)
    await advanceFrames(page, 20)
    const capsuleChecks = await collected()
    assert.ok(capsuleChecks.includes('basalt_titan:capsule'), `capsule collected in the alcove (${capsuleChecks})`)
    await capture('capsule')
    await skipDialogue()
    mark('e')

    // (f) The shaft head: locks on entry, holds the camera, plays the callout; the stomp crumbles the side faced.
    await place(2720, 182)
    state = await waitForState(page, (next) => lockOf(next, 'basalt_midboss_lock')?.phase === 'locked', 5000, 'shaft head locks')
    assert.equal(lockOf(state, 'basalt_midboss_lock').cameraHeld, true, 'the camera is held to the room')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /custodian walker/i.test(next.ticker.text ?? ''), 30000, 'mid-boss callout on the radio lane')
    assert.equal(callout.dialogue?.active ?? false, false, 'the callout never blocks')
    await capture('midboss-locked')
    let walker = (await entities()).find((entry) => entry.id === 'basalt_mid_custodian')
    assert.ok(walker && walker.typeKey === 'custodian_walker_basalt', `the Basalt walker is in the room (${JSON.stringify(walker)})`)
    // It may already have stomped at the hero on the step (held at the pad's edge it stomps 224px out): wait for the
    // slabs to return, stand on the pad in front of it, and pair the first fresh shake with its facing that frame.
    const slabKeys = ['l1', 'l2', 'r1', 'r2']
    await waitForState(page, (next) => slabKeys.every((key) => crumbleOf(next, `basalt_head_slab_${key}`)?.phase === 'solid'), 10000, 'the slabs are back')
    walker = (await entities()).find((entry) => entry.id === 'basalt_mid_custodian')
    await place(Math.max(2862, Math.min(2994, walker.x + walker.facing * 64)), 182)
    let stomp = null
    for (let attempt = 0; attempt < 90 && !stomp; attempt += 1) {
      await advanceFrames(page, 2)
      const at = await readState(page)
      const slabs = slabKeys.map((key) => crumbleOf(at, `basalt_head_slab_${key}`))
      const now = (await entities()).find((entry) => entry.id === 'basalt_mid_custodian')
      if (slabs.some((slab) => slab.phase === 'shaking')) stomp = { slabs, walker: now }
    }
    evidence.stomp = stomp
    assert.ok(stomp, 'the walker stomped and a side shook')
    const facedRight = stomp.walker.facing > 0
    const [l1, l2, r1, r2] = stomp.slabs
    assert.ok((facedRight ? [r1, r2] : [l1, l2]).every((slab) => slab.phase !== 'solid'), `the side it faces shakes (${JSON.stringify(stomp)})`)
    assert.ok((facedRight ? [l1, l2] : [r1, r2]).every((slab) => slab.phase === 'solid'), `the other side holds (${JSON.stringify(stomp)})`)
    await capture('midboss-stomp')
    await place(3116, 182)
    const headPushed = await drive({ targetX: 3160, maxFrames: 30, stallJumps: false })
    state = await readState(page)
    assert.ok(headPushed.x < 3136 && lockOf(state, 'basalt_midboss_lock').gateClosed === true, `the shaft head's gate holds (${JSON.stringify(headPushed)})`)
    evidence.walkerHits = await defeat(['basalt_mid_custodian'], 'the custodian walker')
    state = await waitForState(page, (next) => lockOf(next, 'basalt_midboss_lock')?.phase === 'open' && !lockOf(next, 'basalt_midboss_lock').gateClosed, 15000, 'the shaft head opens after the walker falls')
    evidence.midboss = lockOf(state, 'basalt_midboss_lock')
    await capture('midboss-open')
    await drive({ targetX: 3200, maxFrames: 120 })
    await waitForState(page, (next) => next.stageRuntime?.checkpointIndex === 2, 6000, 'checkpoint 3')
    mark('f')

    // (g) The headframe (warp to its top), then real input over its right wall and down the shaft to pad B's room.
    await place(3300, 214)
    await place(3512, -172)
    await standing('standing on the headframe top')
    // The vertical follow eases toward the hero, so wait for it rather than read it on the frame of the warp.
    state = await waitForState(page, (next) => next.camera?.scrollY < -100, 6000, 'camera followed up the headframe')
    assert.equal(byId(mech(state).verticalSegments, 'basalt_headframe')?.cameraHeld, true, 'camera held to the headframe')
    await capture('headframe-top')
    const descent = await drive({ clearEnemies: true, targetX: 4040, maxFrames: 420, jumps: [{ atX: 3530, hold: 8 }] })
    evidence.descent = descent
    state = await readState(page)
    assert.ok(descent.x >= 4032 && descent.hp > 0, `down the shaft into pad B's room (${JSON.stringify(descent)})`)
    assert.ok(descent.landings.some(([x, y]) => x > 3584 && y < 0) && descent.landings.some(([, y]) => y > 70 && y < 86), `landed on the shaft's ledges on the way (${JSON.stringify(descent.landings)})`)
    await capture('shaft-exit')
    // From the shaft floor the landings on the load-lined ledge and the lower crumble are in view: capture while a
    // boulder's shadow is up there (the 400ms warning, then the fall).
    await place(3760, 214)
    state = await waitForState(page, (next) => ['basalt_rock_shaft_2', 'basalt_rock_shaft_3'].some((id) => ['warning', 'falling'].includes(rockOf(next, id)?.phase) && rockOf(next, id)?.shadow), 12000, 'rain in the shaft')
    evidence.shaftRain = ['basalt_rock_shaft_1', 'basalt_rock_shaft_2', 'basalt_rock_shaft_3'].map((id) => rockOf(state, id))
    await capture('shaft-rockfall')
    mark('g')

    // (h) The side shaft: a plain jump off the launch crumble falls short; a dash jump clears the casing.
    // Placed a few px over the one-way landing so it settles onto it (placed exactly on the top it can slip through).
    await place(3600, -88)
    await standing('standing on the shaft landing')
    const plain = await drive({ targetX: 4100, maxFrames: 150, stallJumps: false, jumps: [{ atX: 3640, hold: 20 }], untilCollected: 'basalt_titan:sub_tank' })
    evidence.plainJump = plain
    assert.ok(!(await collected()).includes('basalt_titan:sub_tank') && plain.y > 0, `a plain jump off the launch falls short of the side shaft (${JSON.stringify(plain)})`)
    await capture('side-shaft-plain')
    await waitForState(page, (next) => crumbleOf(next, 'basalt_shaft_launch')?.phase === 'solid' && crumbleOf(next, 'basalt_side_mouth')?.phase === 'solid', 8000, 'the launch and the mouth are back')
    // In on the floor first: the tall room raises the world ceiling once the hero is inside it.
    await place(3700, 214)
    await place(3600, -88)
    state = await standing('back on the shaft landing')
    assert.ok(state.player.y < -70, `on the landing before the dash (${JSON.stringify(state.player)})`)
    // One timed replay, as a player's hands (the tutorial smoke's dash-jump): walk onto the launch, dash on it, jump
    // three frames into the dash (the ground dash carries into the jump), hold the jump. A per-frame drive re-presses
    // the dash each frame, which ends a ground dash, so this step is not driven frame by frame.
    await page.evaluate((rows) => window.stageDebug.replayInputs(rows), [
      { frame: 0, held: ['moveRight'] },
      { frame: 15, held: ['moveRight', 'dash'] },
      { frame: 18, held: ['moveRight', 'dash', 'jump'] },
      { frame: 50, held: ['moveRight', 'dash'] },
      { frame: 72, held: [] }
    ])
    const hero = () => page.evaluate(() => { const p = window.__phaserGame.scene.getScene('Game').player; return [Math.round(p.x), Math.round(p.y), Math.round(p.body?.velocity?.x ?? 0)] })
    const dash = []
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await advanceFrames(page, 4)
      dash.push(await hero())
      if (dash.length > 3 && dash.slice(-3).every(([x, y]) => x === dash.at(-1)[0] && y === dash.at(-1)[1])) break
    }
    // In the mouth the hero stands still: the mouth and the ledge under it crumble 350ms after each landing and drop
    // it straight onto the shelf, under the tank. A walk here would slide the hero past the tank (how far a run
    // slides once the input ends depends on the frame timing), so only a hero that settles on the shelf off the
    // tank walks to it, toward the tank's side.
    let toTank = null
    let subChecks = await collected()
    for (let attempt = 0; attempt < 40 && !subChecks.includes('basalt_titan:sub_tank'); attempt += 1) {
      await advanceFrames(page, 5)
      dash.push(await hero())
      subChecks = await collected()
      const [x, y] = dash.at(-1)
      const onShelf = y > -66 && y < -58 && dash.slice(-3).every(([sx, sy]) => sx === x && sy === y)
      if (!toTank && dash.length > 3 && onShelf && !subChecks.includes('basalt_titan:sub_tank')) {
        const walk = x < 4008 ? { targetX: 4000 } : { leftTo: 4016 }
        toTank = await drive({ ...walk, maxFrames: 60, stallJumps: false, untilCollected: 'basalt_titan:sub_tank' })
        subChecks = await collected()
      }
    }
    evidence.dashLanding = { dash, toTank }
    evidence.subTank = { dash, collected: subChecks }
    assert.ok(subChecks.includes('basalt_titan:sub_tank'), `a dash jump off the launch reaches the sub tank (${JSON.stringify(dash)})`)
    await capture('sub-tank')
    await skipDialogue()
    const offShelf = await drive({ targetX: 4060, maxFrames: 120, stallJumps: false })
    evidence.offShelf = offShelf
    state = await waitForState(page, (next) => lockOf(next, 'basalt_pad_b_lock')?.phase === 'locked', 5000, 'pad B locks')
    evidence.padBFirst = await defeat(['basalt_pad_b_hauler', 'basalt_pad_b_hopper'], 'pad B wave 1')
    state = await waitForState(page, (next) => lockOf(next, 'basalt_pad_b_lock')?.wave === 1, 5000, 'pad B second wave')
    await advanceFrames(page, 24)
    await capture('pad-b-wave-2')
    evidence.padBSecond = await defeat(['basalt_pad_b_wave_bouncer', 'basalt_pad_b_wave_mine'], 'pad B wave 2')
    state = await waitForState(page, (next) => lockOf(next, 'basalt_pad_b_lock')?.phase === 'open' && !lockOf(next, 'basalt_pad_b_lock').gateClosed, 15000, 'pad B opens')
    evidence.padB = lockOf(state, 'basalt_pad_b_lock')
    mark('h')

    // (i) The route sheet: one capture per screen; checkpoint 4's trigger is past the last one.
    evidence.route = []
    for (const [index, [x, y]] of ROUTE_SHOTS.entries()) {
      if (y < 0) await place(x - 92, 214)
      await place(x, y)
      await advanceFrames(page, 30)
      await page.locator('canvas').screenshot({ path: path.join(dir, `route-${String(index).padStart(2, '0')}.png`) })
      const at = await readState(page)
      evidence.route.push({ screen: index, x, y, scrollX: at.camera?.scrollX, scrollY: at.camera?.scrollY, checkpointIndex: at.stageRuntime?.checkpointIndex })
    }
    assert.equal((await readState(page)).stageRuntime.checkpointIndex, 2, 'the route pass crosses no checkpoint')
    mark('i')

    // (j) From the end of the lane: over the last pit, checkpoint 4, the boss room, the boss on screen.
    await shield(600000)
    await place(5160, 214)
    await standing('standing at the end of the lane')
    const approach = await drive({ clearEnemies: true, targetX: 5300, maxFrames: 240, jumps: [{ atX: 5164, hold: 12 }] })
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
    mark('j')

    assert.deepEqual(errors, [], 'no page errors')
    return { artifacts: dir, evidence }
  } finally {
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    await browser.close()
  }
}
