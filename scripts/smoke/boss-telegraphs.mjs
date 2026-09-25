// Smoke 52-boss-telegraphs (prompt 12 part 12f wave 1; EVAL-P7-001). On stepped frames only: the loop sleeps and
// window.stepFrames(1, { manageLoop: false }) drives every frame, so no wall-clock frame slips between a check and
// its capture. For Sentinel Rook, Pyro Maw and Tide Reaver: (1) the boss HP bar is full on the first frame it shows
// (hp-bar-first-frame-<boss>.png); (2) every authored attack's wind-up draws its telegraph, read from
// render_game_to_text().bossState.runtime.telegraph: the authored warningFx, the telegraphs_v1 group that fx maps
// to, a frame a visible sprite really shows, and time left in the wind-up (telegraph-<boss>-<attack>.png).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const BOSSES = [
  { stageId: 'tutorial_sentinel', bossId: 'sentinel_rook' },
  { stageId: 'pyro_maw', bossId: 'pyro_maw' },
  { stageId: 'tide_reaver', bossId: 'tide_reaver' }
]
const MAX_FRAMES_PER_ATTACK = 900
// Close-range attacks (hops, stomps) only fire near the hero and long ones far from it, so while it waits the
// smoke moves the shielded hero between the room's near wall and the boss's side every this many frames.
const REPOSITION_EVERY_FRAMES = 180
const FRAME_PATTERN = /^telegraphs_v1\/(reticle|floor_marker|warning_flash|charge_glow)\/00[0-3]$/

// The mapping of src/boss/telegraphPlan.ts, restated independently: the drawn group is checked against it.
function expectedGroup(fx, patternState, kind) {
  if (fx === 'reticle') return 'reticle'
  if (fx === 'wave') return 'floor_marker'
  if (fx === 'fan-lines') return 'charge_glow'
  return patternState === 'dash' || kind === 'melee' || kind === 'dash' ? 'warning_flash' : 'charge_glow'
}

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

async function enterFight(page, dir, { stageId, bossId }, waitForState) {
  await page.evaluate((data) => {
    const game = window.__phaserGame
    if (!game.loop.running) game.loop.wake()
    game.scene.getScenes(true)[0].scene.start('Game', data)
  }, { stageId, bossId, runtimeBossConfigId: bossId })
  await waitForState(
    page,
    (state) => state.scene === 'Game' && state.stageRuntime?.stageId === stageId && state.newPlayer?.locomotion?.grounded === true,
    20000,
    `${stageId} loads with the hero grounded`
  )
  // From here the loop sleeps; every frame is a stepped frame.
  const bar = await page.evaluate(() => {
    const game = window.__phaserGame
    const scene = game.scene.getScene('Game')
    game.loop.sleep()
    window.stageDebug.crossBossGate()
    window.stageDebug.activateBossRoom()
    window.bossDebug?.unlockIntro?.()
    const room = scene.activeBossRoom
    if (room) window.stageDebug.setPlayerX(room.x + 72)
    scene.newPlayerRuntime?.resetForRespawn?.(600000)
    for (let frame = 1; frame <= 600; frame += 1) {
      if (scene.dialogueOverlay?.isActive?.()) scene.dialogueOverlay.skip()
      window.stepFrames(1, { manageLoop: false })
      if (scene.hud?.bossBarVisible) {
        return {
          frame,
          shown: { ...scene.hud.bossSnapshot },
          bossHp: { ...scene.bossHp },
          controllerHp: { ...scene.bossController.hp }
        }
      }
    }
    return null
  })
  assert.ok(bar, `${bossId}: the boss HP bar never showed within 600 frames of the room activating`)
  await page.locator('canvas').screenshot({ path: path.join(dir, `hp-bar-first-frame-${bossId}.png`) })
  assert.equal(bar.controllerHp.current, bar.controllerHp.max, `${bossId}: the boss starts the fight at full HP`)
  assert.equal(bar.shown.max, bar.controllerHp.max, `${bossId}: the bar's max is the boss's max HP`)
  assert.equal(bar.shown.current, bar.shown.max, `${bossId}: the bar is full on its first frame (${bar.shown.current}/${bar.shown.max})`)
  return bar
}

async function forcePhaseTwo(page) {
  return page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('Game')
    for (let attempt = 0; attempt < 6; attempt += 1) {
      const hp = scene.bossController.hp
      const floor = Math.ceil(hp.max * 0.4)
      if (hp.current <= floor) return true
      const result = scene.bossController.applyDamage({ amount: hp.current - floor, type: 'normal', source: 'smoke_phase_probe', iFrameMs: 0 })
      if (result?.accepted) return true
      window.stepFrames(30, { manageLoop: false })
    }
    return false
  })
}

async function checkBoss(page, dir, boss, { readState, waitForState }) {
  const bar = await enterFight(page, dir, boss, waitForState)
  const authored = await page.evaluate(() => {
    const blueprint = window.__phaserGame.scene.getScene('Game').bossController.blueprint
    return {
      attacks: blueprint.attacks.map((attack) => ({ name: attack.name, fx: attack.telegraph.warningFx, anchor: attack.telegraph.anchor })),
      // Phase one fights with every attack no later phase unlocks (Tide Reaver's first phase lists none itself).
      openingAttacks: blueprint.attacks
        .map((attack) => attack.name)
        .filter((attackName) => !blueprint.phases.slice(1).some((phase) => phase.newAttacks.includes(attackName)))
    }
  })
  const seen = new Map()
  let phaseForced = false
  while (seen.size < authored.attacks.length) {
    if (!phaseForced && authored.openingAttacks.every((attackName) => seen.has(attackName))) {
      phaseForced = await forcePhaseTwo(page)
    }
    const hit = await page.evaluate(({ seenNames, maxFrames, repositionEvery }) => {
      const scene = window.__phaserGame.scene.getScene('Game')
      const room = scene.activeBossRoom
      for (let frame = 1; frame <= maxFrames; frame += 1) {
        if (room && frame % repositionEvery === 0) {
          const near = (frame / repositionEvery) % 2 === 1
          const bossX = scene.bossController?.x ?? room.x + room.width - 72
          window.stageDebug.setPlayerX(near ? Math.max(room.x + 24, bossX - 56) : room.x + 72)
        }
        window.stepFrames(1, { manageLoop: false })
        let telegraph = scene.bossController?.getDebugState?.()?.telegraph
        if (telegraph && !seenNames.includes(telegraph.attack)) {
          // Caught on its first frame (000); step on to frame 002 so the capture shows the tell mid-wind-up.
          const firstFrame = telegraph.frame
          const attackName = telegraph.attack
          for (let extra = 0; extra < 60 && !telegraph.frame.endsWith('/002'); extra += 1) {
            window.stepFrames(1, { manageLoop: false })
            const next = scene.bossController?.getDebugState?.()?.telegraph
            if (!next || next.attack !== attackName) break
            telegraph = next
          }
          const pending = scene.bossProjectileController?.getPendingTelegraphs?.() ?? []
          const entry = pending[pending.length - 1]
          return {
            frame,
            firstFrame,
            telegraph,
            drawnFrames: scene.children.list
              .filter((child) => child.texture?.key === 'atlas_telegraphs_v1' && child.visible && child.active)
              .map((child) => String(child.frame?.name)),
            patternState: entry?.attack?.state ?? null,
            kind: entry?.attackData?.type ?? null,
            phaseIndex: scene.bossController.getDebugState().phaseIndex
          }
        }
      }
      return null
    }, { seenNames: [...seen.keys()], maxFrames: MAX_FRAMES_PER_ATTACK, repositionEvery: REPOSITION_EVERY_FRAMES })
    if (!hit) {
      if (phaseForced) break
      phaseForced = await forcePhaseTwo(page)
      continue
    }
    const { telegraph } = hit
    const attack = authored.attacks.find((entry) => entry.name === telegraph.attack)
    assert.ok(attack, `${boss.bossId}: telegraph for an unknown attack '${telegraph.attack}'`)
    const group = expectedGroup(attack.fx, hit.patternState, hit.kind)
    const shot = `telegraph-${boss.bossId}-${slug(attack.name)}.png`
    await page.locator('canvas').screenshot({ path: path.join(dir, shot) })
    const state = await readState(page)
    assert.deepEqual(state.bossState?.runtime?.telegraph, telegraph, `${boss.bossId}: render_game_to_text reports the live telegraph`)
    assert.equal(telegraph.fx, attack.fx, `${boss.bossId}: ${attack.name} draws its authored warningFx`)
    assert.equal(telegraph.anchor, attack.anchor, `${boss.bossId}: ${attack.name} keeps its authored anchor`)
    assert.equal(telegraph.group, group, `${boss.bossId}: ${attack.name} (${attack.fx}) draws ${group}`)
    assert.match(telegraph.frame, FRAME_PATTERN, `${boss.bossId}: ${attack.name} frame ${telegraph.frame}`)
    assert.ok(telegraph.frame.startsWith(`telegraphs_v1/${group}/`), `${boss.bossId}: ${attack.name} frame ${telegraph.frame} is from ${group}`)
    assert.ok(hit.drawnFrames.includes(telegraph.frame), `${boss.bossId}: a visible sprite shows ${telegraph.frame} (${hit.drawnFrames.join(', ')})`)
    assert.ok(telegraph.remainingMs > 0, `${boss.bossId}: ${attack.name} is caught inside its wind-up`)
    assert.equal(hit.firstFrame, `telegraphs_v1/${group}/000`, `${boss.bossId}: ${attack.name} starts its wind-up on frame 000`)
    assert.equal(telegraph.frame, `telegraphs_v1/${group}/002`, `${boss.bossId}: ${attack.name} reaches frame 002 mid-wind-up`)
    seen.set(attack.name, { ...hit, expectedGroup: group, capture: shot })
  }
  const missing = authored.attacks.filter((attack) => !seen.has(attack.name)).map((attack) => attack.name)
  if (missing.length > 0) {
    const diagnostics = await page.evaluate(() => {
      const scene = window.__phaserGame.scene.getScene('Game')
      const debug = scene.bossController?.getDebugState?.() ?? {}
      return { recent: scene.bossBeats?.telegraphs?.recent ?? [], phaseIndex: debug.phaseIndex, traceTail: debug.traceTail, hp: scene.bossController?.hp }
    })
    fs.writeFileSync(path.join(dir, `missing-${boss.bossId}.json`), JSON.stringify({ missing, diagnostics }, null, 2))
  }
  assert.deepEqual(missing, [], `${boss.bossId}: attacks never telegraphed within the frame budget`)
  return { ...boss, hpBarFirstFrame: bar, telegraphs: [...seen.values()] }
}

export async function runBossTelegraphsScenario(name, { outputDir, url, readState, waitForState }) {
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
    for (const boss of BOSSES) {
      report.push(await checkBoss(page, dir, boss, { readState, waitForState }))
      fs.writeFileSync(path.join(dir, 'telegraphs.json'), JSON.stringify(report, null, 2))
    }
    assert.equal(errors.length, 0, JSON.stringify(errors))
  } finally {
    fs.writeFileSync(path.join(dir, 'telegraphs.json'), JSON.stringify({ report, errors }, null, 2))
    await browser.close()
  }
}
