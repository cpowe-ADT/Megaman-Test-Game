// Smoke 51-saber-combo (combat lane phase 2). On real input, replayed with stageDebug.replayInputs (one
// replay per check, so no real frame can slip between stepped frames), against Sentinel Rook:
// three saber presses land combo hits 1, 2, 3 in order for 2, 2 and 4 damage on the boss; a dash cancels
// hit 1's recovery; an enemy shot met by the active blade reverses (x1.25) and damages the boss; and the
// charge aura is on screen while the buster charges (shot-charge-aura.png).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const held = (spec) => Object.entries(spec).map(([frame, actions]) => ({ frame: Number(frame), held: actions }))

// Hero placed 34px left of the boss body centre, facing right. Hit 1 starts on frame 4. Each landed hit
// freezes the scene for its hit-stop (presses made then are latched), so hit 1 is active on frames 9-16
// and hit 2 on 27-35: the presses on frames 11 and 31 fall in those windows and chain hits 2 and 3.
const COMBO_ROWS = held({ 0: ['moveRight'], 2: [], 4: ['saber'], 6: [], 11: ['saber'], 13: [], 31: ['saber'], 33: [], 84: [] })
// Hit 1 from frame 4 (recovery frames 13-18); a dash on frame 14 must end the swing at once.
const DASH_ROWS = held({ 0: ['moveRight'], 2: [], 4: ['saber'], 6: [], 14: ['dash'], 17: [], 40: [] })
// An enemy pellet 60px ahead, flying at the hero; the blade is live on frames 7-10.
const REFLECT_ROWS = held({ 0: ['moveRight'], 1: [], 2: ['saber'], 4: [], 90: [] })
const CHARGE_ROWS = held({ 0: ['shoot'], 50: ['shoot'] })

export async function runSaberComboScenario(name, { outputDir, url, readState, waitForState, advanceFrames }) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const page = await browser.newPage({ viewport: { width: 448, height: 252 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const skipDialogues = async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      const open = await page.evaluate(() => {
        const scene = window.__phaserGame.scene.getScene('Game')
        if (!scene?.dialogueOverlay?.isActive?.()) return false
        scene.dialogueOverlay.skip()
        return true
      })
      if (!open) return
      await advanceFrames(page, 2)
    }
  }
  // One replay per check; a postupdate logger samples the combat state on every stepped frame.
  const runReplay = (rows, setup, options = {}) => page.evaluate(({ rows, setup, options }) => {
    const scene = window.__phaserGame.scene.getScene('Game')
    const runtime = scene.newPlayerRuntime
    const boss = scene.bossTarget ?? scene.bossBody
    const bossX = boss.body?.center?.x ?? boss.x
    scene.player.setPosition(bossX + setup.offsetX, scene.player.y)
    scene.player.body?.setVelocity?.(0, 0)
    if (setup.shot) {
      scene.projectileSystem.spawn({
        id: 'enemy_shot_basic', x: scene.player.x + setup.shot.ahead, y: scene.player.y - 4, direction: -1,
        velocity: { x: -setup.shot.speed, y: 0 }, metadata: { sourceType: 'enemy_projectile', sourceId: 'smoke-51' }
      })
    }
    const frames = []
    const sample = () => {
      const combat = runtime.lastCombatSnapshot ?? {}
      frames.push({ phase: combat.slashPhase ?? null, move: combat.slashMove ?? null, dashing: Boolean(runtime.lastMotorSnapshot?.dashing), bossHp: scene.bossHp?.current ?? null })
    }
    const before = scene.swordHitRouter.getDebugState()
    scene.events.on('postupdate', sample)
    try {
      window.stageDebug.replayInputs(rows, options)
    } finally {
      scene.events.off('postupdate', sample)
    }
    const after = scene.swordHitRouter.getDebugState()
    return {
      frames,
      hits: after.hits.filter((hit) => hit.swingId > before.lastSwingId),
      reflects: after.reflects.slice(before.reflects.length),
      aura: runtime.vfxSfx.getChargeAuraDebug()
    }
  }, { rows, setup, options })

  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
  try {
    await page.goto(url)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'tutorial_sentinel', bossId: 'sentinel_rook', runtimeBossConfigId: 'sentinel_rook' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'tutorial_sentinel', 15000)
    await advanceFrames(page, 10)
    await skipDialogues()
    await page.evaluate(() => window.stageDebug.crossBossGate())
    await advanceFrames(page, 6)
    await skipDialogues()
    await page.evaluate(() => {
      window.bossDebug.unlockIntro()
      // Sampled for the blade, not for survival: long i-frames keep Rook's shots and contact out of the checks.
      window.__phaserGame.scene.getScene('Game').newPlayerRuntime.resetForRespawn(600000)
    })
    await advanceFrames(page, 4)
    await skipDialogues()

    const combo = await runReplay(COMBO_ROWS, { offsetX: -34 })
    fs.writeFileSync(path.join(dir, 'combo.json'), JSON.stringify(combo, null, 2))
    const bossHits = combo.hits.filter((hit) => hit.target === 'boss')
    assert.deepEqual(bossHits.map((hit) => hit.move), ['combo1', 'combo2', 'combo3'], 'three presses land hits 1, 2, 3 in order')
    assert.deepEqual(bossHits.map((hit) => hit.damage), [2, 2, 4], 'combo damage 2, 2, 4')
    bossHits.forEach((hit) => assert.equal(hit.bossHpBefore - hit.bossHpAfter, hit.damage, `${hit.move} took ${hit.damage} off the boss`))
    assert.ok(bossHits[2].knockbackX > bossHits[0].knockbackX, 'the finisher knocks back harder')

    const dash = await runReplay(DASH_ROWS, { offsetX: -220 })
    fs.writeFileSync(path.join(dir, 'dash-cancel.json'), JSON.stringify(dash, null, 2))
    const recoveryAt = dash.frames.findIndex((frame) => frame.phase === 'recovery')
    const endedAt = dash.frames.findIndex((frame, index) => index > recoveryAt && frame.phase === null)
    assert.ok(recoveryAt >= 0, 'hit 1 reached recovery')
    assert.ok(endedAt - recoveryAt < 6, `the dash cut recovery short (${endedAt - recoveryAt} of 6 frames)`)
    assert.equal(dash.frames[endedAt].dashing, true, 'the swing ended on the dash')

    const reflect = await runReplay(REFLECT_ROWS, { offsetX: -150, shot: { ahead: 60, speed: 200 } })
    fs.writeFileSync(path.join(dir, 'reflect.json'), JSON.stringify(reflect, null, 2))
    const bounced = reflect.reflects.find((entry) => entry.from === 'enemy_shot_basic')
    assert.ok(bounced?.shotSpawned, 'the enemy shot was reflected as a player shot')
    assert.equal(bounced.vx, 250, 'straight back at 1.25x')
    const hpStart = reflect.frames[0].bossHp
    const hpEnd = reflect.frames[reflect.frames.length - 1].bossHp
    assert.ok(hpStart - hpEnd >= bounced.damage, `the reflected shot damaged the boss (${hpStart} -> ${hpEnd})`)

    const charge = await runReplay(CHARGE_ROWS, { offsetX: -200 }, { keepHeld: true })
    assert.equal(charge.aura.visible, true, 'charge aura visible while charging')
    assert.ok(charge.aura.level >= 2, `charge aura at level ${charge.aura.level}`)
    await advanceFrames(page, 2)
    await page.locator('canvas').screenshot({ path: path.join(dir, 'shot-charge-aura.png') })
    fs.writeFileSync(path.join(dir, 'charge.json'), JSON.stringify({ aura: charge.aura, state: await readState(page) }, null, 2))
    await page.evaluate(() => window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 2, held: [] }]))
    assert.deepEqual(errors, [], `page errors: ${errors.join(' | ')}`)
  } finally {
    await browser.close()
  }
}
