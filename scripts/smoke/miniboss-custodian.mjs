// Smoke 43-miniboss-custodian (EVAL-P6-005, the Heat Works mini-boss). Runs with storyIntro=on so the
// mini-boss callout reaches the radio lane. Steps, each with a capture:
// (a) warp into the catwalk room: the defeat lock arms (camera held, gate closed), Iona's callout plays,
//     and the custodian walker wakes with its health bar;
// (b) the walker winds up (the leg-raise tell, 500 ms), stomps, and a shockwave leaves along the floor
//     and damages a hero standing in it (2 HP);
// (c) the next stomp: the hero jumps as the wave arrives and takes no damage;
// (d) the hero crosses behind it during a wind-up: it stomps and recovers facing the old way, then turns;
// (e) one real buster hit (hp drops, hurt flash), then debug damage: the death frames play with the gate
//     still closed, then the gate opens.
// The fight steps with the game loop asleep (`stageDebug.replayInputs` steps one frame per call), so the
// timings are game frames, not wall time; captures read the last rendered frame.
// Part 2 (12c, the mini-boss matrix) loads `miniboss_lab`, one defeat-locked room per archetype and skin,
// and per room: the lock arms (camera held, gate closed), the mini-boss wakes with its bar, its tell and
// both attacks show in its brain snapshot (`lab-<room>-*.png`), a real buster pellet hurts it, debug
// damage plays its death frames, a health pickup drops where it fell and the gate opens.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const WALKER_ID = 'pyro_mid_custodian'

export async function runMinibossCustodianScenario(name, { outputDir, storyUrl, readState, waitForState, advanceFrames }) {
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
  }
  const mech = (state) => state.mechanics ?? {}
  const shield = (ms) => page.evaluate((value) => window.__phaserGame?.scene?.getScene?.('Game')?.newPlayerRuntime?.resetForRespawn?.(value), ms)
  const setLoop = (awake) => page.evaluate((awake) => {
    const loop = window.__phaserGame.loop
    if (awake && !loop.running) loop.wake()
    if (!awake && loop.running) loop.sleep()
  }, awake)
  // One in-page drive with the loop asleep: optional placement next to the walker, an input script, then
  // empty frames (with a jump when a wave closes on the hero) until `until` holds or `maxFrames` pass.
  const drive = (plan) => page.evaluate((plan) => {
    const game = window.__phaserGame.scene.getScene('Game')
    const entity = game.enemySpawner?.getEntities().find((entry) => entry.id === 'pyro_mid_custodian')
    if (!entity?.brain) return { missing: true, met: plan.until === 'gone' }
    const log = (window.__smoke43 ??= { frame: 0, phases: [] })
    const snap = () => entity.brain.snapshot()
    const hero = game.player
    const step = (held) => {
      window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }])
      log.frame += 1
      const s = entity.sprite.active ? snap() : null
      const last = log.phases[log.phases.length - 1]
      if (s && (!last || last.phase !== s.phase || last.facing !== s.facing)) log.phases.push({ frame: log.frame, phase: s.phase, facing: s.facing })
    }
    const start = snap()
    if (plan.place) {
      const lo = 3380
      const hi = 3630
      let side = plan.place.side === 'behind' ? -start.facing : plan.place.side === 'front' ? start.facing : (start.x - plan.place.dist >= lo ? -1 : 1)
      let x = start.x + side * plan.place.dist
      if (x < lo || x > hi) { side = -side; x = start.x + side * plan.place.dist }
      hero.setPosition(Math.max(lo, Math.min(hi, x)), 214)
      hero.body?.setVelocity?.(0, 0)
    }
    const hp0 = game.playerHp
    const hits0 = start.waveHits
    const wallHp0 = start.hp
    for (const row of plan.script ?? []) for (let i = 0; i < row.frames; i += 1) step(row.held)
    let jumpHold = 0
    let jumpedAt = null
    let flashed = false
    let met = false
    let frames = 0
    let under = null
    for (; frames < plan.maxFrames; frames += 1) {
      const s = entity.sprite.active ? snap() : null
      const heroX = hero.x
      const toward = s?.waves.find((wave) => wave.alive && Math.sign(heroX - s.x) === wave.dir)
      if (plan.jumpGap && jumpedAt === null && toward && Math.abs(toward.x - heroX) <= plan.jumpGap && hero.body?.blocked?.down) {
        jumpHold = 14
        jumpedAt = { frame: log.frame, waveX: toward.x, heroX: Math.round(heroX) }
      }
      if (toward && Math.abs(toward.x - heroX) <= 4) under = { waveX: toward.x, heroX: Math.round(heroX), heroBottom: Math.round(hero.body?.bottom ?? 0), floorTop: s.floorTop }
      const until = plan.until
      met =
        (until === 'windupShown' && s?.phase === 'windup' && s.phaseMs >= 250) ||
        (until === 'windup' && s?.phase === 'windup') ||
        (until === 'walk' && s?.phase === 'walk') ||
        (until === 'waveOut' && Boolean(s?.waves.some((wave) => wave.alive && Math.abs(wave.x - s.x) >= 48))) ||
        (until === 'hit' && (s?.waveHits ?? 0) > hits0) ||
        (until === 'waveUnderHero' && under !== null) ||
        (until === 'stompDone' && s !== null && s.waves.length === 0 && s.phase !== 'stomp' && s.phase !== 'windup') ||
        (until === 'turned' && log.phases.some((entry) => entry.frame > plan.sinceFrame && entry.phase === 'turn') && s?.phase === 'walk') ||
        (until === 'hurt' && (s?.hp ?? wallHp0) < wallHp0) ||
        (until === 'gone' && !entity.sprite.active)
      if (until === 'hurt' && (s?.hp ?? wallHp0) < wallHp0) flashed = entity.sprite.isTinted
      if (met) break
      step(jumpHold > 0 ? ['jump'] : [])
      if (jumpHold > 0) jumpHold -= 1
    }
    return { met, frames, frame: log.frame, hp0, hp1: game.playerHp, jumpedAt, under, flashed, snap: entity.sprite.active ? snap() : null, anim: entity.sprite.anims?.currentAnim?.key ?? null, visible: entity.sprite.visible }
  }, plan)
  const phaseLog = () => page.evaluate(() => window.__smoke43?.phases ?? [])
  const evidence = {}
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

    // (a) Into the room: the lock arms, the callout plays, the walker wakes.
    await shield(600000)
    const place = async (x) => {
      await page.evaluate((x) => { const hero = window.__phaserGame.scene.getScene('Game').player; hero.setPosition(x, 214); hero.body?.setVelocity?.(0, 0) }, x)
      await advanceFrames(page, 3)
    }
    await place(3120)
    await place(3232)
    let state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'locked', 3000, 'catwalk room locks')
    assert.equal(mech(state).roomLocks[0].cameraHeld, true, 'the camera is held to the room')
    assert.equal(mech(state).roomLocks[0].gateClosed, true, 'the gate is closed')
    const callout = await waitForState(page, (next) => next.ticker?.kind === 'radio' && /custodian walker/i.test(next.ticker.text ?? ''), 45000, 'mini-boss callout on the radio lane (queued behind any line already playing)')
    evidence.callout = callout.ticker.text
    await waitForState(page, () => true, 200)
    const woke = await page.evaluate(async () => {
      const game = window.__phaserGame.scene.getScene('Game')
      for (let i = 0; i < 240; i += 1) {
        const entity = game.enemySpawner?.getEntities().find((entry) => entry.id === 'pyro_mid_custodian')
        const snap = entity?.brain?.snapshot?.()
        if (snap && snap.phase !== 'dormant') return { snap, texture: entity.sprite.texture.key, body: [entity.sprite.body.width, entity.sprite.body.height] }
        await window.advanceTime(1000 / 60)
      }
      return null
    })
    assert.ok(woke, 'the walker spawned and woke')
    assert.deepEqual([woke.texture, woke.body, woke.snap.maxHp, woke.snap.barVisible], ['atlas_custodian_walker', [44, 50], 20, true])
    evidence.woke = woke
    await capture('locked')

    // (b) Wind-up tell, the stomp, the wave on the floor, and a standing hero hit by it.
    await setLoop(false)
    await drive({ until: 'stompDone', maxFrames: 240 })
    await shield(0)
    const tell = await drive({ place: { dist: 80 }, until: 'windupShown', maxFrames: 240 })
    assert.ok(tell.met, `wind-up seen (${JSON.stringify(tell)})`)
    assert.equal(tell.anim, 'custodian_walker_attack_windup')
    await capture('windup')
    const out = await drive({ until: 'waveOut', maxFrames: 90 })
    assert.ok(out.met, 'a shockwave leaves along the floor')
    assert.ok(out.snap.waves.length >= 1 && out.snap.stomps >= 1, 'waves are out')
    await capture('shockwave')
    const hit = await drive({ until: 'hit', maxFrames: 90 })
    assert.ok(hit.met, `the wave hit the standing hero (${JSON.stringify(hit)})`)
    assert.equal(tell.hp0 - hit.hp1, 2, 'a wave takes 2 HP')
    evidence.standingHit = { hpBefore: tell.hp0, hpAfter: hit.hp1, snap: hit.snap }
    await capture('wave-hit')
    let phases = await phaseLog()
    const windupEntry = phases.findLast((entry) => entry.phase === 'windup')
    const stompEntry = phases.findLast((entry) => entry.phase === 'stomp')
    evidence.windupFrames = stompEntry.frame - windupEntry.frame
    assert.ok(evidence.windupFrames >= 28 && evidence.windupFrames <= 32, `a 500 ms wind-up (${evidence.windupFrames} frames)`)

    // (c) Jump the next wave: no damage.
    await shield(600000)
    await drive({ until: 'stompDone', maxFrames: 200 })
    await drive({ until: 'walk', maxFrames: 120 })
    await shield(0)
    const approach = await drive({ place: { dist: 84 }, until: 'waveUnderHero', jumpGap: 30, maxFrames: 240 })
    assert.ok(approach.met && approach.jumpedAt, `jumped as the wave arrived (${JSON.stringify(approach)})`)
    assert.ok(approach.under.heroBottom < approach.under.floorTop - 16, `the hero's feet clear the 16px wave (${JSON.stringify(approach.under)})`)
    await capture('jump-over')
    const cleared = await drive({ until: 'stompDone', maxFrames: 200 })
    assert.equal(cleared.hp1, approach.hp0, 'jumping the wave takes no damage')
    assert.equal(cleared.snap.waveHits, hit.snap.waveHits, 'no new wave hit')
    evidence.jump = { hp: cleared.hp1, jumpedAt: approach.jumpedAt, under: approach.under }

    // (d) Behind it during the wind-up: stomp and recovery keep the facing, then it turns.
    await shield(600000)
    const front = await drive({ place: { dist: 80, side: 'front' }, until: 'windup', maxFrames: 240 })
    assert.ok(front.met, 'a wind-up toward the hero')
    const facing = front.snap.facing
    const sinceFrame = front.frame
    await drive({ place: { dist: 70, side: 'behind' }, until: 'waveOut', maxFrames: 90 })
    await capture('behind')
    const turned = await drive({ until: 'turned', sinceFrame, maxFrames: 180 })
    assert.ok(turned.met, 'it turned after the stomp')
    phases = (await phaseLog()).filter((entry) => entry.frame >= sinceFrame)
    const order = phases.map((entry) => `${entry.phase}:${entry.facing}`)
    evidence.turnOrder = order
    const recoverIndex = order.indexOf(`recover:${facing}`)
    const turnIndex = order.findIndex((entry) => entry.startsWith('turn:'))
    assert.ok(order.includes(`stomp:${facing}`) && recoverIndex >= 0 && turnIndex > recoverIndex, `stomp and recover before the turn (${order})`)
    assert.equal(turned.snap.facing, -facing, 'it faces the hero after the turn')
    await capture('turned')

    // (e) One real buster hit, then debug damage: the death frames, then the gate opens.
    const toward = turned.snap.facing === 1 ? 'moveLeft' : 'moveRight'
    const shot = await drive({ place: { dist: 60, side: 'front' }, script: [{ frames: 1, held: [toward] }, { frames: 1, held: ['shoot'] }, { frames: 1, held: [] }], until: 'hurt', maxFrames: 40 })
    assert.ok(shot.met, `a real buster pellet hurts it (${JSON.stringify(shot.snap)})`)
    assert.ok(shot.snap.hp < 20 && shot.snap.hp >= 18, `one pellet's worth (${shot.snap.hp})`)
    assert.equal(shot.flashed, true, 'hurt flash on the hit')
    evidence.realHit = { hp: shot.snap.hp }
    await drive({ until: 'frames', maxFrames: 6 }) // past its 40 ms invulnerability
    await page.evaluate(() => {
      const game = window.__phaserGame.scene.getScene('Game')
      const entity = game.enemySpawner.getEntities().find((entry) => entry.id === 'pyro_mid_custodian')
      game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_43' })
    })
    const dying = await drive({ until: 'gone', maxFrames: 9 })
    assert.equal(dying.snap?.phase, 'dying')
    assert.deepEqual([dying.anim, dying.visible], ['custodian_walker_death', true], 'the death frames play')
    state = await readState(page)
    assert.deepEqual([mech(state).roomLocks[0].phase, mech(state).roomLocks[0].gateClosed], ['locked', true], 'still locked while it dies')
    await capture('death')
    const gone = await drive({ until: 'gone', maxFrames: 60 })
    assert.ok(gone.met, 'the walker is gone after its death frames')
    await setLoop(true)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[0]?.phase === 'open' && !mech(next).roomLocks[0].gateClosed, 4000, 'gate opens after the mini-boss')
    evidence.open = mech(state).roomLocks[0]
    await capture('open')

    // Part 2 (12c): the mini-boss lab matrix, a row per defeat-locked room.
    evidence.lab = await runMinibossLabMatrix(page, { storyUrl, readState, waitForState, capture, shield, setLoop, mech })
    assert.deepEqual(errors, [], `no page errors (${errors.join(' | ')})`)
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
    return { name, evidence }
  } catch (error) {
    await setLoop(true).catch(() => {})
    await capture('failure').catch(() => {})
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify({ ...evidence, errors, failure: String(error?.stack ?? error) }, null, 2))
    throw error
  } finally {
    await browser.close()
  }
}

/**
 * In-page, loop asleep: optional hero placement (absolute `x`, or `dx` from the mini-boss on a `side`),
 * an input script, then one frame per step until `until(snapshot, ctx)` is truthy (its object, if any,
 * comes back as `extra`) or `maxFrames` pass. Phases are logged per mini-boss for the tell timings.
 */
function inPageLabDrive(plan, until) {
  const game = window.__phaserGame.scene.getScene('Game')
  const entity = game.enemySpawner?.getEntities().find((entry) => entry.id === plan.id)
  if (!entity?.brain) return { missing: true, met: false }
  const hero = game.player
  const logs = (window.__smoke43lab ??= {})
  const log = (logs[plan.id] ??= { frame: 0, phases: [] })
  const snap = () => (entity.sprite.active ? entity.brain.snapshot() : null)
  const step = (held) => {
    window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }])
    log.frame += 1
    const s = snap()
    const last = log.phases[log.phases.length - 1]
    if (s && (!last || last.phase !== s.phase)) log.phases.push({ frame: log.frame, phase: s.phase })
  }
  if (plan.place) {
    const base = snap()
    let x = plan.place.x
    if (x === undefined && base) {
      const side = plan.place.side
      const dir = side === 'front' ? base.facing : side === 'behind' ? -base.facing : side === 'left' ? -1 : 1
      x = base.x + dir * plan.place.dx
    }
    const [lo, hi] = plan.place.bounds ?? [-Infinity, Infinity]
    hero.setPosition(Math.max(lo, Math.min(hi, x)), 214)
    hero.body?.setVelocity?.(0, 0)
  }
  const before = snap()
  for (const row of plan.script ?? []) for (let i = 0; i < row.frames; i += 1) step(row.held)
  const ctx = { game, hero, entity, before, start: snap(), hp0: game.playerHp }
  let met = false
  let extra = null
  let flashed = false
  let frames = 0
  for (;; frames += 1) {
    const result = until(snap(), ctx)
    if (result) {
      met = true
      extra = typeof result === 'object' ? result : null
      flashed = Boolean(entity.sprite.isTinted)
      break
    }
    if (frames >= plan.maxFrames) break
    step(plan.held ?? [])
  }
  const drops = (game.drops?.getChildren?.() ?? [])
    .filter((drop) => drop.active)
    .map((drop) => ({ x: Math.round(drop.x), y: Math.round(drop.y), type: drop.data?.get?.('dropType') ?? null }))
  return {
    met,
    frames,
    frame: log.frame,
    hp0: ctx.hp0,
    hp1: game.playerHp,
    before,
    snap: snap(),
    anim: entity.sprite.anims?.currentAnim?.key ?? null,
    visible: entity.sprite.visible,
    flashed,
    extra,
    drops,
    hero: { x: Math.round(hero.x), y: Math.round(hero.y) },
    phases: log.phases
  }
}

/** Frames from entering `from` to entering `to` (the last such pair in the log). */
function phaseGap(phases, from, to) {
  for (let i = phases.length - 1; i >= 0; i -= 1) {
    if (phases[i].phase !== from) continue
    const next = phases.slice(i + 1).find((entry) => entry.phase === to)
    return next ? next.frame - phases[i].frame : null
  }
  return null
}

const within = (value, target, slack = 2) => value !== null && Math.abs(value - target) <= slack

async function runMinibossLabMatrix(page, { storyUrl, readState, waitForState, capture, shield, setLoop, mech }) {
  const labDrive = (plan, until = '() => false') => page.evaluate(`(${inPageLabDrive.toString()})(${JSON.stringify(plan)}, ${until})`)
  const place = async (x) => {
    await page.evaluate((x) => { const hero = window.__phaserGame.scene.getScene('Game').player; hero.setPosition(x, 214); hero.body?.setVelocity?.(0, 0) }, x)
    await page.evaluate(async () => { for (let i = 0; i < 3; i += 1) await window.advanceTime(1000 / 60) })
  }
  const wake = (id) => page.evaluate(async (id) => {
    const game = window.__phaserGame.scene.getScene('Game')
    for (let i = 0; i < 300; i += 1) {
      const entity = game.enemySpawner?.getEntities().find((entry) => entry.id === id)
      const snap = entity?.brain?.snapshot?.()
      if (snap && snap.phase !== 'dormant') return { snap, typeKey: entity.typeKey, texture: entity.sprite.texture.key, body: [entity.sprite.body.width, entity.sprite.body.height] }
      await window.advanceTime(1000 / 60)
    }
    return null
  }, id)

  await setLoop(true)
  await page.goto(`${storyUrl.replace('storyIntro=on', 'storyIntro=off')}&startScene=StageSelect`)
  await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
  await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'miniboss_lab' }))
  await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'miniboss_lab', 15000, 'mini-boss lab loaded')
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const state = await readState(page)
    if (state.stageIntro?.active !== true && !state.dialogue?.active && state.newPlayer?.locomotion?.grounded) break
    await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })
    await page.evaluate(async () => { for (let i = 0; i < 6; i += 1) await window.advanceTime(1000 / 60) })
  }
  const locks = mech(await readState(page)).roomLocks ?? []
  assert.equal(locks.length, 8, `eight locked rooms (${locks.map((lock) => lock.id)})`)

  const rows = []
  for (const [index, lock] of locks.entries()) {
    const id = lock.remainingMarkers?.[0]
    assert.ok(id, `${lock.id} names its mini-boss`)
    const tag = id.replace(/^mb_lab_/, '')
    const bounds = [lock.room.x + 16, lock.gateX - 16]
    const shot = (label) => capture(`lab-${tag}-${label}`)
    const row = { tag, lock: lock.id }

    // The lock arms, the mini-boss wakes with its bar. Each row starts at full health (the hero has 8 HP
    // and three rows land a hit on purpose), so no row is fought through a death and respawn.
    await setLoop(true)
    await shield(600000)
    await page.evaluate(() => { const game = window.__phaserGame.scene.getScene('Game'); game.playerHp = game.playerMaxHp })
    await place(lock.room.x - 180)
    await place(lock.room.x + 40)
    let state = await waitForState(page, (next) => mech(next).roomLocks?.[index]?.phase === 'locked', 4000, `${tag}: the room locks`)
    assert.deepEqual([mech(state).roomLocks[index].cameraHeld, mech(state).roomLocks[index].gateClosed], [true, true], `${tag}: camera held, gate closed`)
    const woke = await wake(id)
    assert.ok(woke, `${tag}: the mini-boss spawned and woke`)
    const typeKey = woke.typeKey
    assert.equal(woke.texture, `atlas_${typeKey}`, `${tag}: its own atlas`)
    assert.equal(woke.snap.barVisible ?? woke.snap.barsVisible?.every(Boolean), true, `${tag}: its health bar shows`)
    Object.assign(row, { typeKey, maxHp: woke.snap.maxHp, body: woke.body })
    const kind = typeKey.startsWith('custodian_walker') ? 'walker' : typeKey.startsWith('relay_turret_nest') ? 'nest' : typeKey.startsWith('sentry_twin') ? 'twins' : 'serpent'
    await setLoop(false)

    if (kind === 'walker') {
      const tell = await labDrive({ id, place: { dx: 80, side: 'front', bounds }, maxFrames: 300 }, `(s) => s && s.phase === 'windup' && s.phaseMs >= 250`)
      assert.ok(tell.met, `${tag}: the leg-raise tell (${JSON.stringify(tell.snap)})`)
      assert.equal(tell.anim, `${typeKey}_attack_windup`)
      await shot('tell')
      const stomp = await labDrive({ id, maxFrames: 90 }, `(s, c) => s && s.waves.some((w) => w.alive && Math.abs(w.x - s.x) >= 48) && { frames: c.entity.brain.waves.map((w) => w.image.frame.name) }`)
      assert.ok(stomp.met && stomp.snap.stomps >= 1, `${tag}: the stomp's shockwave runs along the floor`)
      assert.ok(stomp.extra.frames.every((name) => name.startsWith(`${typeKey}/wave/`)), `${tag}: waves from its own atlas (${stomp.extra.frames})`)
      await shot('stomp')
      row.windupFrames = phaseGap(stomp.phases, 'windup', 'stomp')
      assert.ok(within(row.windupFrames, 30), `${tag}: a 500 ms tell (${row.windupFrames} frames)`)
    } else if (kind === 'nest') {
      const tell = await labDrive({ id, place: { dx: 150, side: 'front', bounds }, maxFrames: 300 }, `(s) => s && s.phase === 'burst_windup' && s.phaseMs >= 300`)
      assert.ok(tell.met, `${tag}: the barrel-glow tell (${JSON.stringify(tell.snap)})`)
      assert.equal(tell.anim, `${typeKey}_attack_windup`)
      await shot('tell')
      const burst = await labDrive({ id, maxFrames: 60 }, `(s) => s && s.shots >= 3`)
      assert.ok(burst.met, `${tag}: the three-shot burst`)
      await shot('burst')
      row.burstTellFrames = phaseGap(burst.phases, 'burst_windup', 'burst')
      assert.ok(within(row.burstTellFrames, 36), `${tag}: a 600 ms tell (${row.burstTellFrames} frames)`)
      const mortar = await labDrive({ id, maxFrames: 240 }, `(s) => s && s.shells.some((shell) => shell.stage === 'flight' && shell.markerVisible && Math.abs(shell.x - shell.targetX) <= 40)`)
      assert.ok(mortar.met, `${tag}: the mortar in flight over its floor marker`)
      const shell = mortar.snap.shells[0]
      assert.ok(Math.abs(shell.targetX - mortar.hero.x) <= 2, `${tag}: it lands where the hero stands (${shell.targetX} vs ${mortar.hero.x})`)
      await shot('mortar')
      await shield(0)
      const blast = await labDrive({ id, maxFrames: 60 }, `(s) => s && s.shellHits >= 1`)
      assert.ok(blast.met && blast.hp0 - blast.hp1 === 2 && blast.hp1 > 0, `${tag}: the blast on the marker takes 2 HP (${blast.hp0} -> ${blast.hp1})`)
      await shot('blast')
      await shield(600000)
      row.mortar = { targetX: shell.targetX, heroX: mortar.hero.x, hp: [blast.hp0, blast.hp1] }
    } else if (kind === 'twins') {
      const center = lock.room.x + 224
      const tell = await labDrive({ id, place: { x: center, bounds }, maxFrames: 200 }, `(s) => s && s.phase === 'bolt_windup' && s.phaseMs >= 300`)
      assert.ok(tell.met, `${tag}: the lens crackle`)
      const shooter = tell.snap.twins[tell.snap.shooter]
      assert.deepEqual([shooter.pose, shooter.anim], ['windup', `${typeKey}_attack_windup`])
      assert.deepEqual(tell.snap.barsVisible, [true, true], `${tag}: the pool's bar over both`)
      await shot('tell')
      const bolt = await labDrive({ id, maxFrames: 60 }, `(s) => s && s.bolts >= 1 && s.phase === 'bolt'`)
      assert.ok(bolt.met, `${tag}: the bolt`)
      await shot('bolt')
      row.boltTellFrames = phaseGap(bolt.phases, 'bolt_windup', 'bolt')
      assert.ok(within(row.boltTellFrames, 36), `${tag}: a 600 ms crackle (${row.boltTellFrames} frames)`)
      const flash = await labDrive({ id, maxFrames: 60 }, `(s) => s && s.phase === 'flash' && s.flashVisible && s.phaseMs >= 150`)
      assert.ok(flash.met, `${tag}: the warning flash over the swooper`)
      const swooper = flash.snap.twins[flash.snap.swooper]
      assert.ok(Math.abs(swooper.y - flash.hero.y) <= 8, `${tag}: the swooper lines up at the hero's height (${swooper.y} vs ${flash.hero.y})`)
      await shot('flash')
      await shield(0)
      const swoop = await labDrive({ id, maxFrames: 90 }, `(s, c) => s && s.phase === 'swoop' && c.game.playerHp < c.hp0`)
      assert.ok(swoop.met && swoop.hp0 - swoop.hp1 === 2 && swoop.hp1 > 0, `${tag}: the swoop takes 2 HP (${swoop.hp0} -> ${swoop.hp1})`)
      row.swoopHp = [swoop.hp0, swoop.hp1]
      await shot('swoop')
      await shield(600000)
      row.flashFrames = phaseGap(swoop.phases, 'flash', 'swoop')
      assert.ok(within(row.flashFrames, 27), `${tag}: a 450 ms flash (${row.flashFrames} frames)`)
      const swap = await labDrive({ id, maxFrames: 240 }, `(s) => s && s.rounds >= 1`)
      assert.ok(swap.met && swap.snap.shooter === 1, `${tag}: the roles swap`)
      await labDrive({ id, place: { x: center, bounds }, maxFrames: 240 }, `(s) => s && s.phase === 'flash'`)
    } else {
      const burrow = await labDrive({ id, place: { dx: 150, side: 'front', bounds }, maxFrames: 200 }, `(s) => s && s.phase === 'burrow' && s.phaseMs >= 120`)
      assert.ok(burrow.met, `${tag}: it burrows`)
      assert.equal(burrow.anim, `${typeKey}_burrow`)
      await shot('burrow')
      const tunnel = await labDrive({ id, maxFrames: 60 }, `(s) => s && s.phase === 'tunnel'`)
      assert.deepEqual([tunnel.snap.underground, tunnel.snap.bodyEnabled, tunnel.snap.visible], [true, false, false], `${tag}: under the floor, no body, not drawn`)
      const immune = await page.evaluate((id) => {
        const game = window.__phaserGame.scene.getScene('Game')
        const entity = game.enemySpawner.getEntities().find((entry) => entry.id === id)
        const before = entity.combat.currentHp
        game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 2, type: 'bullet', sourceId: 'smoke_43_burrowed' })
        return [before, entity.combat.currentHp]
      }, id)
      assert.equal(immune[1], immune[0], `${tag}: it cannot be hurt while burrowed (${immune})`)
      const mound = await labDrive({ id, maxFrames: 150 }, `(s) => s && s.phase === 'mound' && s.phaseMs >= 200`)
      assert.ok(mound.met, `${tag}: the mound tell`)
      assert.equal(mound.anim, `${typeKey}_mound`)
      assert.ok(Math.abs(mound.snap.moundX - mound.hero.x) <= 2, `${tag}: the mound is under the hero (${mound.snap.moundX} vs ${mound.hero.x})`)
      await shot('mound')
      await shield(0)
      const burst = await labDrive({ id, maxFrames: 60 }, `(s, c) => s && s.phase === 'burst' && c.game.playerHp < c.hp0`)
      assert.ok(burst.met && burst.hp0 - burst.hp1 === 3 && burst.hp1 > 0, `${tag}: bursting up under the hero takes 3 HP (${burst.hp0} -> ${burst.hp1})`)
      row.burstHp = [burst.hp0, burst.hp1]
      await shot('burst')
      await shield(600000)
      row.moundFrames = phaseGap(burst.phases, 'mound', 'burst')
      assert.ok(within(row.moundFrames, 30), `${tag}: a 500 ms mound (${row.moundFrames} frames)`)
      const coil = await labDrive({ id, maxFrames: 200 }, `(s) => s && s.phase === 'coil' && s.phaseMs >= 250`)
      assert.ok(coil.met, `${tag}: the coil`)
      assert.equal(coil.anim, `${typeKey}_attack_windup`)
      await shot('coil')
      const lunge = await labDrive({ id, maxFrames: 60 }, `(s, c) => s && s.phase === 'lunge' && Math.abs(s.x - c.start.x) >= 24`)
      assert.ok(lunge.met, `${tag}: the lunge along the floor`)
      assert.equal(lunge.anim, `${typeKey}_attack_active`)
      await shot('lunge')
      row.coilFrames = phaseGap(lunge.phases, 'coil', 'lunge')
      assert.ok(within(row.coilFrames, 30), `${tag}: a 500 ms coil (${row.coilFrames} frames)`)
      await labDrive({ id, maxFrames: 120 }, `(s) => s && s.phase === 'recover'`)
    }

    // A real buster pellet hurts it (both twins flash: one pool).
    const facing = await labDrive({ id, maxFrames: 0 })
    const selfX = facing.snap.x ?? facing.snap.twins[facing.snap.swooper].x
    const heroX = kind === 'twins' ? lock.room.x + 224 : selfX + (facing.snap.facing ?? 1) * 70
    const toward = heroX > selfX ? 'moveLeft' : 'moveRight'
    const hitPlace = kind === 'twins' ? { x: heroX, bounds } : { dx: 70, side: 'front', bounds }
    const hit = await labDrive(
      { id, place: hitPlace, script: [{ frames: 1, held: [toward] }, { frames: 1, held: ['shoot'] }, { frames: 1, held: [] }], maxFrames: 45 },
      `(s, c) => s && s.hp < c.before.hp && { tinted: s.twins ? s.twins.map((twin) => twin.tinted) : null }`
    )
    assert.ok(hit.met, `${tag}: a real pellet hurts it (${JSON.stringify(hit.snap)})`)
    assert.equal(hit.flashed, true, `${tag}: the hurt flash`)
    if (kind === 'twins') assert.deepEqual(hit.extra.tinted, [true, true], `${tag}: both twins flash, one pool`)
    row.hit = { hp: [hit.before.hp, hit.snap.hp] }

    // Debug damage: the death frames, the defeat, a health pickup where it fell, the gate.
    await labDrive({ id, maxFrames: 6 })
    const killAt = await page.evaluate(({ id, bounds }) => {
      const game = window.__phaserGame.scene.getScene('Game')
      const entity = game.enemySpawner.getEntities().find((entry) => entry.id === id)
      const s = entity.brain.snapshot()
      const x = s.x ?? s.twins[0].x
      game.player.setPosition(x - bounds[0] > bounds[1] - x ? bounds[0] : bounds[1], 214)
      game.player.body?.setVelocity?.(0, 0)
      game.enemySpawner.applyDamageToSprite(entity.sprite, { amount: 999, type: 'bullet', knockback: game.cameras.main.midPoint.clone().set(0, 0), sourceId: 'smoke_43' })
      return { x }
    }, { id, bounds })
    const dying = await labDrive({ id, maxFrames: 9 }, `(s, c) => !c.entity.sprite.active`)
    assert.equal(dying.snap?.phase, 'dying', `${tag}: dying`)
    assert.deepEqual([dying.anim, dying.visible], [`${typeKey}_death`, true], `${tag}: the death frames play`)
    if (kind === 'twins') assert.deepEqual(dying.snap.twins.map((twin) => [twin.pose, twin.visible]), [['dead', true], ['dead', true]], `${tag}: both twins die`)
    await shot('death')
    const gone = await labDrive({ id, maxFrames: 60 }, `(s, c) => !c.entity.sprite.active && { otherActive: Boolean(c.entity.brain.other?.active) }`)
    assert.ok(gone.met, `${tag}: gone after its death frames`)
    if (kind === 'twins') assert.equal(gone.extra.otherActive, false, `${tag}: twin 1 goes with the pool`)
    const drop = gone.drops.find((entry) => entry.type === 'health_large' && Math.abs(entry.x - killAt.x) <= 24)
    assert.ok(drop, `${tag}: the large health capsule dropped where it fell (${JSON.stringify(gone.drops)} vs x ${killAt.x})`)
    await shot('drop')
    row.drop = drop
    await setLoop(true)
    state = await waitForState(page, (next) => mech(next).roomLocks?.[index]?.phase === 'open' && !mech(next).roomLocks[index].gateClosed, 4000, `${tag}: the gate opens`)
    await shot('open')
    rows.push(row)
  }
  return rows
}
