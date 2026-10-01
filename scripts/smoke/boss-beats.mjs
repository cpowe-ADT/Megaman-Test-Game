// Smoke 44-boss-beats (prompt 12 part 12f wave 2; EVAL-P7-002, EVAL-P7-003). Stepped frames only: the loop sleeps
// and window.stepFrames(1, { manageLoop: false }) drives every frame. For Pyro Maw and Tide Reaver, from the room
// activating: (1) the WARNING band, then the name-and-element card (warning-<boss>.png, card-<boss>.png); (2) the bar
// filling 0 to max in ticks over about 900 ms after the intro dialogue (bar-fill-<boss>.png); (3) phase two shows the
// phase pose and its retired attack never starts in the trace (phase-two-<boss>.png); (4) a weakness hit mid-attack
// breaks the boss (weakness-<boss>.png, break-<boss>.png; see checkWeakness); (5) desperation at 20%: palette flash,
// the arena change, the new attack's telegraph (desperation-<boss>.png, desperation-attack-<boss>.png); (6) the death:
// defeat frames under hit-stop, a chained explosion, a flash, a freeze, then the defeat dialogue (death-*.png).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BOSSES = [
  { stageId: 'pyro_maw', bossId: 'pyro_maw', element: 'FIRE TYPE', retired: 'blaze_lob', retimed: 'serpent_stream', desperation: 'magma_geyser', arena: 'vents_all_on' },
  { stageId: 'tide_reaver', bossId: 'tide_reaver', element: 'WATER TYPE', retired: 'jet_levitate', retimed: 'lance_volley', desperation: 'maelstrom', arena: 'anchors_shifting' }
]
const REPOSITION_EVERY_FRAMES = 150

// Installed once per page: stepping, dialogue skipping and the debug reads every stage below uses.
function installHelpers() {
  const scene = () => window.__phaserGame.scene.getScene('Game')
  const step = (frames = 1, { skipDialogue = true } = {}) => {
    for (let index = 0; index < frames; index += 1) {
      if (skipDialogue && scene().dialogueOverlay?.isActive?.()) scene().dialogueOverlay.skip()
      window.stepFrames(1, { manageLoop: false })
    }
  }
  const debug = () => scene().bossController?.getDebugState?.() ?? null
  const presentation = () => scene().bossBeats.presentation
  // Close attacks fire near the hero and far ones away from it: move the shielded hero between both every so often.
  const reposition = (frame) => {
    const s = scene()
    const room = s.activeBossRoom
    if (!room || frame % 150 !== 0) return
    const near = (frame / 150) % 2 === 1
    const bossX = s.bossController?.x ?? room.x + room.width - 72
    window.stageDebug.setPlayerX(near ? Math.max(room.x + 24, bossX - 56) : room.x + 72)
  }
  const forceHp = (ratio) => {
    const s = scene()
    for (let attempt = 0; attempt < 8; attempt += 1) {
      const hp = s.bossController.hp
      const target = Math.floor(hp.max * ratio)
      if (hp.current <= target) return true
      const result = s.bossController.applyDamage({ amount: hp.current - target, type: 'normal', source: 'smoke_phase_probe', iFrameMs: 0 })
      if (result?.accepted) return true
      step(20)
    }
    return false
  }
  window.__b44 = { scene, step, debug, presentation, reposition, forceHp }
}

async function capture(page, dir, name) {
  await page.locator('canvas').screenshot({ path: path.join(dir, name) })
  return name
}

async function enterFight(page, boss, waitForState) {
  await page.evaluate((data) => {
    const game = window.__phaserGame
    if (!game.loop.running) game.loop.wake()
    game.scene.getScenes(true)[0].scene.start('Game', data)
  }, { stageId: boss.stageId, bossId: boss.bossId, runtimeBossConfigId: boss.bossId })
  await waitForState(
    page,
    (state) => state.scene === 'Game' && state.stageRuntime?.stageId === boss.stageId && state.newPlayer?.locomotion?.grounded === true,
    20000,
    `${boss.stageId} loads with the hero grounded`
  )
}

async function checkIntro(page, dir, boss) {
  const warning = await page.evaluate(() => {
    const { scene, step, debug, presentation } = window.__b44
    window.__phaserGame.loop.sleep()
    const s = scene()
    window.stageDebug.crossBossGate()
    window.stageDebug.activateBossRoom()
    const room = s.activeBossRoom
    if (room) window.stageDebug.setPlayerX(room.x + 72)
    s.newPlayerRuntime?.resetForRespawn?.(600000)
    step(3)
    const title = presentation().texts[0]
    return { ...presentation().getDebugState(), title: title?.text, titleVisible: title?.visible, boss: debug(), barVisible: Boolean(s.hud?.bossBarVisible) }
  })
  const warningShot = await capture(page, dir, `warning-${boss.bossId}.png`)
  assert.equal(warning.beat, 'warning', `${boss.bossId}: the room opens on the WARNING beat`)
  assert.equal(warning.bandVisible, true)
  assert.equal(warning.title, 'WARNING')
  assert.equal(warning.titleVisible, true)
  assert.equal(warning.boss.state, 'INTRO')
  assert.equal(warning.boss.animationKey, `${boss.bossId}_intro`, `${boss.bossId}: the INTRO state plays the intro frames`)
  assert.match(warning.boss.animationFrame, new RegExp(`^${boss.bossId}/intro/00[0-3]$`))
  assert.equal(warning.barVisible, false, `${boss.bossId}: no boss bar during WARNING`)

  const card = await page.evaluate(() => {
    const { scene, step, presentation } = window.__b44
    for (let frame = 0; frame < 120 && presentation().beat === 'warning'; frame += 1) step()
    step(12)
    return { ...presentation().getDebugState(), bossName: String(scene().bossName ?? '').toUpperCase() }
  })
  const cardShot = await capture(page, dir, `card-${boss.bossId}.png`)
  assert.equal(card.beat, 'card')
  assert.equal(card.card.title, card.bossName, `${boss.bossId}: the card names the boss`)
  assert.equal(card.card.subtitle, boss.element, `${boss.bossId}: the card names the element`)

  const toFill = await page.evaluate(() => {
    const { scene, step, presentation } = window.__b44
    let dialogueSeen = false
    for (let frame = 0; frame < 1500 && presentation().beat !== 'bar_fill'; frame += 1) {
      dialogueSeen ||= Boolean(scene().dialogueOverlay?.isActive?.())
      step()
    }
    return { beat: presentation().beat, dialogueSeen, fill: scene().hud.bossBarFill, barVisible: scene().hud.bossBarVisible, bar: { ...presentation().bar } }
  })
  assert.equal(toFill.beat, 'bar_fill', `${boss.bossId}: the bar fill follows the intro dialogue`)
  assert.equal(toFill.barVisible, true)
  assert.equal(toFill.fill, 0, `${boss.bossId}: the bar starts empty`)

  const half = await page.evaluate(() => {
    const { scene, step, presentation } = window.__b44
    const samples = []
    for (let frame = 0; frame < 120 && presentation().bar.tick < 9; frame += 1) {
      step()
      samples.push({ tick: presentation().bar.tick, fill: scene().hud.bossBarFill })
    }
    return { samples, snapshot: { ...scene().hud.bossSnapshot } }
  })
  const fillShot = await capture(page, dir, `bar-fill-${boss.bossId}.png`)
  const done = await page.evaluate(() => {
    const { scene, step, debug, presentation } = window.__b44
    const samples = []
    for (let frame = 0; frame < 120 && presentation().beat !== 'fight'; frame += 1) {
      step()
      samples.push({ tick: presentation().bar.tick, fill: scene().hud.bossBarFill })
    }
    step(4)
    const beats = presentation().beats
    const at = (beat) => beats.filter((entry) => entry.beat === beat).pop()?.atMs ?? null
    return { samples, bar: { ...presentation().bar }, fillMs: at('fight') - at('bar_fill'), fill: scene().hud.bossBarFill, state: debug().state }
  })
  const fills = [...half.samples, ...done.samples].map((sample) => sample.fill ?? 1)
  fills.forEach((value, index) => assert.ok(index === 0 || value >= fills[index - 1], `${boss.bossId}: the bar only climbs`))
  assert.equal(done.bar.tick, done.bar.ticks, `${boss.bossId}: every tick filled`)
  assert.equal(done.bar.sfxTicks, done.bar.ticks, `${boss.bossId}: one tick sound per tick`)
  assert.ok(done.fillMs >= 850 && done.fillMs <= 1000, `${boss.bossId}: the fill takes about 900 ms (${done.fillMs})`)
  assert.equal(done.fill, null, `${boss.bossId}: after the fill the bar draws the HP`)
  assert.notEqual(done.state, 'INTRO', `${boss.bossId}: the fight starts when the bar is full`)
  return { warning, card, dialogueSeen: toFill.dialogueSeen, fillMs: done.fillMs, captures: [warningShot, cardShot, fillShot] }
}

async function checkPhaseTwo(page, dir, boss) {
  const opening = await page.evaluate((retired) => {
    const { step, debug, reposition } = window.__b44
    for (let frame = 1; frame <= 3000; frame += 1) {
      reposition(frame)
      step()
      if ((debug().phaseKit.startedByPhase['0']?.[retired] ?? 0) > 0) return { frame, started: debug().phaseKit.startedByPhase['0'] }
    }
    return { frame: null, started: debug().phaseKit.startedByPhase['0'] ?? {} }
  }, boss.retired)
  assert.ok(opening.frame, `${boss.bossId}: ${boss.retired} fires in phase one (${JSON.stringify(opening.started)})`)

  const transition = await page.evaluate(() => {
    const { step, debug, forceHp } = window.__b44
    forceHp(0.45)
    for (let frame = 0; frame < 120 && debug().phaseIndex !== 1; frame += 1) step()
    step(2)
    const d = debug()
    return { phaseIndex: d.phaseIndex, state: d.state, animationKey: d.animationKey, frame: d.animationFrame, phaseKit: d.phaseKit }
  })
  const phaseShot = await capture(page, dir, `phase-two-${boss.bossId}.png`)
  assert.equal(transition.phaseIndex, 1)
  assert.equal(transition.state, 'PHASE_TRANSITION')
  assert.equal(transition.animationKey, `${boss.bossId}_phase`, `${boss.bossId}: the transition shows the phase pose`)
  assert.match(transition.frame, new RegExp(`^${boss.bossId}/phase/00[0-3]$`))
  assert.deepEqual(transition.phaseKit.retired, [boss.retired])
  assert.ok(transition.phaseKit.timing[boss.retimed]?.windupTime > 0, `${boss.bossId}: ${boss.retimed} is retimed`)

  const trace = await page.evaluate(() => {
    const { step, debug, reposition } = window.__b44
    for (let frame = 1; frame <= 2400; frame += 1) {
      reposition(frame)
      step()
    }
    const d = debug()
    return { startedByPhase: d.phaseKit.startedByPhase, phaseIndex: d.phaseIndex }
  })
  const phaseTwo = trace.startedByPhase['1'] ?? {}
  const total = Object.values(phaseTwo).reduce((sum, count) => sum + count, 0)
  assert.equal(trace.phaseIndex, 1)
  assert.ok(total >= 5, `${boss.bossId}: phase two plays attacks (${JSON.stringify(phaseTwo)})`)
  assert.equal(phaseTwo[boss.retired] ?? 0, 0, `${boss.bossId}: ${boss.retired} never starts in phase two (${JSON.stringify(phaseTwo)})`)
  assert.ok((phaseTwo[boss.retimed] ?? 0) > 0, `${boss.bossId}: the retimed ${boss.retimed} plays in phase two`)
  return { phaseOne: trace.startedByPhase['0'], phaseTwo, captures: [phaseShot] }
}

// The break (part 12f wave 5): a weakness hit mid-attack (active or recovery) cancels the attack, the boss recoils in
// its first defeat frame under the white fill, boss_hit_weak and the weakness hit-stop, is knocked 24 px away from the
// hero with a hop and lands, holds the pose for the 450 ms stun, and a second weakness hit inside the 1.5 s lockout
// deals its damage without a break (weakness-<boss>.png: the hit under hit-stop; break-<boss>.png: mid-knockback).
async function checkWeakness(page, dir, boss) {
  const hit = await page.evaluate((bossId) => {
    const { scene, step, debug } = window.__b44
    const s = scene()
    const weaponId = s.progressionSave?.progressionWorld?.weaknessProfiles?.[bossId]?.weaknessWeaponIds?.[0] ?? null
    if (!weaponId) return { weaponId }
    // Mid-attack, standing (so the hop lands inside the stun) and off the walls (so the hero fits beside it).
    const nearWall = (d) => Math.min(s.bossController.x - d.movementBounds.minX, d.movementBounds.maxX - s.bossController.x)
    const midAttack = (d) => d.state === 'ATTACKING' && d.grounded && nearWall(d) >= 12 && (d.activeAttackLifecycle === 'active' || d.activeAttackLifecycle === 'recovery')
    for (let frame = 0; frame < 2400; frame += 1) {
      if (midAttack(debug())) {
        // The hero stands in the room on the boss's side with less room, so the knockback carries the boss toward the middle.
        const bounds = debug().movementBounds
        const bossX = s.bossController.x
        window.stageDebug.setPlayerX(bossX - bounds.minX < bounds.maxX - bossX ? Math.max(bounds.minX, bossX - 40) : Math.min(bounds.maxX, bossX + 40))
        step()
        const ready = debug()
        if (!midAttack(ready)) continue
        const lastHitstop = s.cameraDirector.hitstops.at(-1)
        s.bossDamage.applyDamageToBoss(2, { weaponId })
        const reaction = s.bossDamage.lastReaction
        const after = debug()
        const newHitstop = s.cameraDirector.hitstops.at(-1)
        const pendingAfter = s.bossProjectileController.getPendingTelegraphs().length
        // One rendered frame inside the weakness hit-stop: the recoil pose under the white fill.
        step()
        const frozen = debug()
        const sprite = s.bossController.list[0]
        return {
          weaponId,
          attackId: ready.activeAttackId,
          lifecycle: ready.activeAttackLifecycle,
          heroX: s.player.x,
          reaction,
          pendingAfter,
          hitstop: newHitstop !== lastHitstop ? newHitstop?.kind : null,
          state: after.state,
          activeAfter: after.activeAttackId,
          interrupts: after.interrupts,
          frozen: { hitstop: s.hitstopRemainingFrames, key: frozen.animationKey, frame: frozen.animationFrame, broken: frozen.break.broken },
          tintFill: Boolean(sprite?.tintFill)
        }
      }
      step()
    }
    return { weaponId, reaction: s.bossDamage.lastReaction }
  }, boss.bossId)
  const weakShot = await capture(page, dir, `weakness-${boss.bossId}.png`)
  const recoilKey = `${boss.bossId}_recoil`
  const recoilFrame = `${boss.bossId}/defeat/000`
  assert.ok(hit.weaponId, `${boss.bossId}: the save names a weakness weapon`)
  assert.ok(hit.attackId, `${boss.bossId}: a weakness hit landed mid-attack (${JSON.stringify(hit.reaction)})`)
  assert.equal(hit.reaction.broke, true, `${boss.bossId}: the weakness hit breaks the boss`)
  assert.equal(hit.reaction.interruptedAttackId, hit.attackId, `${boss.bossId}: the break cancels ${hit.attackId} in its ${hit.lifecycle}`)
  assert.equal(hit.activeAfter, null)
  assert.equal(hit.pendingAfter, 0, `${boss.bossId}: nothing of the cancelled attack is left to spawn`)
  assert.equal(hit.reaction.stunMs, 450)
  assert.equal(hit.reaction.stunLockoutMs, 1500)
  assert.equal(hit.reaction.iFrameMs, 120)
  assert.deepEqual(hit.reaction.played, { flashMs: 140, whiteFlashMs: 140, sfx: 'boss_hit_weak', hitStop: true }, `${boss.bossId}: the break plays boss_hit_weak`)
  assert.equal(hit.hitstop, 'boss_weakness', `${boss.bossId}: the camera's weakness hit-stop`)
  assert.equal(hit.state, 'HURT_INVULN')
  assert.ok(hit.frozen.hitstop > 0, `${boss.bossId}: the capture frame is inside the hit-stop`)
  assert.deepEqual([hit.frozen.key, hit.frozen.frame, hit.frozen.broken], [recoilKey, recoilFrame, true], `${boss.bossId}: the recoil pose shows under the hit-stop`)
  assert.equal(hit.tintFill, true, `${boss.bossId}: the break flashes the boss white`)

  // The hit-stop freezes the boss first; the knockback and the 450 ms stun run on the frames the boss ticks.
  const knock = await page.evaluate(() => {
    const { scene, step, debug } = window.__b44
    const counts = { frames: 0, hitstopFrames: 0 }
    const poses = []
    while (counts.frames + counts.hitstopFrames < 60) {
      const frozen = scene().hitstopRemainingFrames > 0
      step()
      if (frozen) {
        counts.hitstopFrames += 1
        continue
      }
      counts.frames += 1
      const d = debug()
      poses.push(`${d.animationKey}|${d.animationFrame}`)
      if ((d.break.knockback?.elapsedMs ?? 999) >= 80) return { counts, poses, knockback: d.break.knockback, y: scene().bossController.y }
    }
    return { counts, poses, knockback: null }
  })
  const breakShot = await capture(page, dir, `break-${boss.bossId}.png`)
  assert.ok(knock.knockback, `${boss.bossId}: the knockback is in flight (${JSON.stringify(knock)})`)
  assert.equal(knock.knockback.style, 'hop')

  const stun = await page.evaluate((counts) => {
    const { scene, step, debug } = window.__b44
    let { frames, hitstopFrames } = counts
    const poses = []
    let landedFrame = null
    while (debug().state === 'HURT_INVULN' && frames + hitstopFrames < 120) {
      const frozen = scene().hitstopRemainingFrames > 0
      step()
      if (frozen) {
        hitstopFrames += 1
        continue
      }
      frames += 1
      const d = debug()
      if (d.state === 'HURT_INVULN') poses.push(`${d.animationKey}|${d.animationFrame}`)
      if (landedFrame === null && !d.break.knockback && d.grounded) landedFrame = frames
    }
    const d = debug()
    return { frames, hitstopFrames, poses, landedFrame, last: d.break.last, lockoutMs: d.break.lockoutRemainingMs, traceTail: d.traceTail, interrupts: d.interrupts }
  }, knock.counts)
  const poses = [...knock.poses, ...stun.poses]
  assert.ok(stun.frames >= 26 && stun.frames <= 29, `${boss.bossId}: the stun lasts about 450 ms of boss time (${JSON.stringify({ frames: stun.frames, hitstopFrames: stun.hitstopFrames })})`)
  assert.ok(poses.length >= 25 && poses.every((pose) => pose === `${recoilKey}|${recoilFrame}`), `${boss.bossId}: the recoil frame holds for the stun (${JSON.stringify([...new Set(poses)])})`)
  const away = stun.last.direction === 'east' ? 1 : -1
  assert.equal(Math.sign(stun.last.fromX - hit.heroX), away, `${boss.bossId}: the knockback goes away from the hero (${JSON.stringify(stun.last)})`)
  assert.ok((stun.last.toX - stun.last.fromX) * away >= 20, `${boss.bossId}: about 24 px back (${JSON.stringify(stun.last)})`)
  assert.ok(stun.landedFrame !== null && stun.landedFrame <= 16, `${boss.bossId}: the boss lands after the hop (${stun.landedFrame})`)
  const cut = stun.traceTail.findIndex((entry) => entry.event === 'attack_interrupted' && entry.attackId === hit.attackId)
  assert.ok(cut >= 0, `${boss.bossId}: the trace records the interrupt`)
  const later = stun.traceTail.slice(cut + 1)
  const nextStart = later.findIndex((entry) => entry.event === 'attack_started')
  const untilNext = nextStart < 0 ? later : later.slice(0, nextStart)
  assert.equal(untilNext.filter((entry) => entry.attackId === hit.attackId).length, 0, `${boss.bossId}: ${hit.attackId} is gone from the trace (${JSON.stringify(later)})`)

  // Inside the lockout (about 1 s of it left) a second weakness hit deals its damage and blinks, without the break.
  const lockout = await page.evaluate((weaponId) => {
    const { scene, debug } = window.__b44
    const s = scene()
    const before = debug()
    const hpBefore = s.bossController.hp.current
    const lastHitstop = s.cameraDirector.hitstops.at(-1)
    s.bossDamage.applyDamageToBoss(2, { weaponId })
    const after = debug()
    return {
      lockoutBefore: before.break.lockoutRemainingMs,
      reaction: s.bossDamage.lastReaction,
      damage: hpBefore - s.bossController.hp.current,
      breaks: [before.break.count, after.break.count],
      interrupts: [before.interrupts.count, after.interrupts.count],
      active: [before.activeAttackId, after.activeAttackId],
      broken: after.break.broken,
      hitstop: s.cameraDirector.hitstops.at(-1) !== lastHitstop
    }
  }, hit.weaponId)
  assert.ok(lockout.lockoutBefore >= 700 && lockout.lockoutBefore <= 1100, `${boss.bossId}: the second hit lands mid-lockout (${lockout.lockoutBefore} ms left)`)
  assert.equal(lockout.reaction.accepted, true)
  assert.ok(lockout.damage > 0, `${boss.bossId}: the lockout hit still deals its damage`)
  assert.equal(lockout.reaction.broke, false, `${boss.bossId}: no break inside the lockout`)
  assert.deepEqual(lockout.reaction.played, { flashMs: 70, whiteFlashMs: 0, sfx: 'boss_hit', hitStop: false })
  assert.equal(lockout.breaks[1], lockout.breaks[0])
  assert.equal(lockout.interrupts[1], lockout.interrupts[0])
  assert.equal(lockout.active[1], lockout.active[0], `${boss.bossId}: the lockout hit cancels nothing`)
  assert.equal(lockout.broken, false)
  assert.equal(lockout.hitstop, false)
  return {
    weaponId: hit.weaponId,
    interrupted: hit.reaction.interruptedAttackId,
    lifecycle: hit.lifecycle,
    stun: { frames: stun.frames, hitstopFrames: stun.hitstopFrames, landedFrame: stun.landedFrame },
    knockback: stun.last,
    lockout: { remainingMs: lockout.lockoutBefore, damage: lockout.damage, played: lockout.reaction.played },
    captures: [weakShot, breakShot]
  }
}

async function checkDesperation(page, dir, boss, readState) {
  const start = await page.evaluate(() => {
    const { scene, step, debug, presentation, forceHp } = window.__b44
    forceHp(0.15)
    for (let frame = 0; frame < 120 && !debug().phaseKit.desperation; frame += 1) step()
    step(4)
    const s = scene()
    const arenaHazards = s.hazards.getChildren().filter((hazard) => hazard.active && hazard.data?.get?.('bossArenaHazard')).length
    return { phaseKit: debug().phaseKit, presentation: presentation().getDebugState().desperation, arenaHazards, anchors: [...(s.bossController.motionController?.anchorFractions ?? [])] }
  })
  const despShot = await capture(page, dir, `desperation-${boss.bossId}.png`)
  const state = await readState(page)
  assert.equal(state.bossState?.runtime?.phaseKit?.desperation, true, `${boss.bossId}: render_game_to_text reports desperation`)
  assert.equal(start.phaseKit.desperation, true)
  assert.equal(start.phaseKit.paletteFlashActive, true, `${boss.bossId}: the palette flash plays`)
  assert.equal(start.presentation.arena.kind, boss.arena)
  if (boss.arena === 'vents_all_on') assert.equal(start.arenaHazards, start.presentation.arena.hazardFractions.length, `${boss.bossId}: every vent fires`)
  if (boss.arena === 'anchors_shifting') assert.deepEqual(start.anchors, start.presentation.arena.anchorFractions, `${boss.bossId}: the anchors shift`)

  const attack = await page.evaluate((desperationId) => {
    const { step, debug, reposition } = window.__b44
    for (let frame = 1; frame <= 2400; frame += 1) {
      reposition(frame)
      step()
      const d = debug()
      if (d.telegraph && d.lastFiredAttackId === desperationId) return { frame, telegraph: d.telegraph, started: d.phaseKit.startedByPhase['2'] }
    }
    return { frame: null, started: debug().phaseKit.startedByPhase['2'] }
  }, boss.desperation)
  const attackShot = await capture(page, dir, `desperation-attack-${boss.bossId}.png`)
  assert.ok(attack.frame, `${boss.bossId}: ${boss.desperation} fires in desperation (${JSON.stringify(attack.started)})`)
  assert.ok(attack.telegraph.remainingMs > 0, `${boss.bossId}: ${boss.desperation} draws its tell`)
  assert.equal(attack.started[boss.retired] ?? 0, 0, `${boss.bossId}: ${boss.retired} stays retired`)
  return { arena: start.presentation.arena, arenaHazards: start.arenaHazards, telegraph: attack.telegraph, captures: [despShot, attackShot] }
}

async function checkDeath(page, dir, boss) {
  const kill = await page.evaluate((bossId) => {
    const { scene, step, debug, presentation } = window.__b44
    const s = scene()
    for (let attempt = 0; attempt < 40 && !s.bossDeathHandled; attempt += 1) {
      window.bossDebug.damage(999)
      if (!s.bossDeathHandled) step(8)
    }
    const d = debug()
    return {
      handled: s.bossDeathHandled,
      beat: presentation().beat,
      hitstop: s.hitstopRemainingFrames,
      active: Boolean(s.bossController?.active),
      visible: Boolean(s.bossController?.visible),
      bodyEnabled: Boolean(s.bossController?.body?.enable),
      animationKey: d?.animationKey,
      frame: d?.animationFrame,
      expectedKey: `${bossId}_defeat`,
      flashes: presentation().death.flashes
    }
  }, boss.bossId)
  assert.equal(kill.handled, true)
  assert.equal(kill.beat, 'death_hitstop')
  assert.equal(kill.hitstop, 20, `${boss.bossId}: 20 frames of hit-stop on the killing blow`)
  assert.equal(kill.active && kill.visible, true, `${boss.bossId}: the boss is not destroyed on the killing blow`)
  assert.equal(kill.bodyEnabled, false, `${boss.bossId}: the dying boss no longer collides`)
  assert.equal(kill.animationKey, kill.expectedKey, `${boss.bossId}: the defeat frames play`)
  assert.equal(kill.flashes, 1, `${boss.bossId}: a white flash on the killing blow`)

  const explosion = await page.evaluate(() => {
    const { step, presentation } = window.__b44
    for (let frame = 0; frame < 120 && presentation().death.bursts < 4; frame += 1) step(1, { skipDialogue: false })
    return { ...presentation().death, beat: presentation().beat, alive: Boolean(window.__b44.scene().bossController?.active) }
  })
  const explosionShot = await capture(page, dir, `death-explosion-${boss.bossId}.png`)
  assert.equal(explosion.beat, 'death_explosion')
  assert.equal(explosion.alive, true, `${boss.bossId}: the boss stays through the chained explosion`)

  const freeze = await page.evaluate(() => {
    const { scene, step, presentation } = window.__b44
    for (let frame = 0; frame < 120 && presentation().beat !== 'death_freeze'; frame += 1) step(1, { skipDialogue: false })
    step(10, { skipDialogue: false })
    const s = scene()
    return { ...presentation().death, beat: presentation().beat, bossGone: !s.bossController, paused: s.physics.world.isPaused, dialogue: Boolean(s.dialogueOverlay?.isActive?.()) }
  })
  const freezeShot = await capture(page, dir, `death-freeze-${boss.bossId}.png`)
  assert.equal(freeze.beat, 'death_freeze')
  assert.equal(freeze.bursts, 8, `${boss.bossId}: eight chained bursts`)
  assert.equal(freeze.flashes, 2, `${boss.bossId}: a second flash as the boss goes`)
  assert.equal(freeze.bossGone, true)
  assert.equal(freeze.paused, true, `${boss.bossId}: the room holds still`)
  assert.equal(freeze.dialogue, false, `${boss.bossId}: no dialogue during the freeze`)
  const goneMs = freeze.bossGoneAtMs - freeze.startedAtMs
  assert.ok(goneMs >= 1480 && goneMs <= 1600, `${boss.bossId}: the boss goes after hit-stop and 1.2 s of explosion (${goneMs} ms)`)

  const after = await page.evaluate(() => {
    const { scene, step, presentation } = window.__b44
    for (let frame = 0; frame < 120 && presentation().beat !== 'defeat_dialogue'; frame += 1) step(1, { skipDialogue: false })
    step(2, { skipDialogue: false })
    const s = scene()
    const beats = presentation().beats
    const at = (beat) => beats.filter((entry) => entry.beat === beat).pop()?.atMs ?? null
    const opened = { dialogue: Boolean(s.dialogueOverlay?.isActive?.()), victory: Boolean(s.victoryModal?.isOpen?.()) }
    for (let frame = 0; frame < 900 && !s.victoryModal?.isOpen?.(); frame += 1) step()
    return { beat: presentation().beat, deathToDialogueMs: at('defeat_dialogue') - at('death_hitstop'), opened, victory: Boolean(s.victoryModal?.isOpen?.()) }
  })
  assert.ok(after.deathToDialogueMs >= 2380 && after.deathToDialogueMs <= 2520, `${boss.bossId}: dialogue after the 900 ms freeze (${after.deathToDialogueMs} ms)`)
  assert.ok(after.opened.dialogue || after.opened.victory, `${boss.bossId}: the defeat dialogue (or victory) follows the freeze`)
  assert.equal(after.victory, true, `${boss.bossId}: the victory modal opens after the defeat dialogue`)
  return { goneMs, deathToDialogueMs: after.deathToDialogueMs, defeatDialogue: after.opened.dialogue, captures: [explosionShot, freezeShot] }
}

// Existing smokes kill the boss and skip dialogue in one tick (scenario 5, forceVictory callers). The death sequence
// now comes before the defeat dialogue, so a skip must fast-forward it: presentation.finishDeathNow() is that step.
async function checkFastForward(page, boss, waitForState) {
  await enterFight(page, boss, waitForState)
  const result = await page.evaluate(() => {
    const { scene, step, presentation } = window.__b44
    window.__phaserGame.loop.sleep()
    const s = scene()
    window.stageDebug.crossBossGate()
    window.bossDebug.unlockIntro()
    window.bossDebug.damage(999)
    const beatAfterKill = presentation().beat
    presentation().finishDeathNow()
    window.stageDebug.skipDialogue()
    const sameTick = { beat: presentation().beat, bossGone: !s.bossController, victory: Boolean(s.victoryModal?.isOpen?.()) }
    step(2, { skipDialogue: false })
    return { beatAfterKill, sameTick, victory: Boolean(s.victoryModal?.isOpen?.()) }
  })
  assert.equal(result.beatAfterKill, 'death_hitstop')
  assert.equal(result.sameTick.beat, 'defeat_dialogue')
  assert.equal(result.sameTick.bossGone, true)
  assert.equal(result.sameTick.victory || result.victory, true, 'a fast-forward then a skip in the same tick reach the victory modal')
  return result
}

export async function runBossBeatsScenario(name, { outputDir, url, readState, waitForState }) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 448, height: 252 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const report = []
  try {
    await page.goto(url)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(installHelpers)
    for (const boss of BOSSES) {
      await enterFight(page, boss, waitForState)
      const entry = { boss: boss.bossId }
      report.push(entry)
      entry.intro = await checkIntro(page, dir, boss)
      entry.phaseTwo = await checkPhaseTwo(page, dir, boss)
      entry.weakness = await checkWeakness(page, dir, boss)
      entry.desperation = await checkDesperation(page, dir, boss, readState)
      entry.death = await checkDeath(page, dir, boss)
      fs.writeFileSync(path.join(dir, 'boss-beats.json'), JSON.stringify(report, null, 2))
    }
    report.push({ fastForward: await checkFastForward(page, BOSSES[0], waitForState) })
    assert.equal(errors.length, 0, JSON.stringify(errors))
  } finally {
    fs.writeFileSync(path.join(dir, 'boss-beats.json'), JSON.stringify({ report, errors }, null, 2))
    await browser.close()
  }
}
