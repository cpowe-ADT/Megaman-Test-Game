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
