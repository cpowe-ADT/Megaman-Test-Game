// Smoke 65-shot-contract (13b.3, EVAL-P13-004). The Sentinel Rook boss room (tutorial_sentinel),
// shielded, shot standing, jumping, dashing, lv3 and lv4. Each pose gets its own fresh stage entry (a
// clean boss HP, no i-frames or hit-stop bled over from a previous pose's hit): the loop sleeps, then
// `stageDebug.replayInputs` steps one 1/60s frame per row (keepHeld across rows), so the trace it
// returns is deterministic. Asserts:
//   - each shot starts within 2px of its flash (item 1: one muzzle anchor for both);
//   - a straight shot's y holds within 1px of its spawn y (item 7: a fixed line, jump or not);
//   - every hit deals damage and shows a spark (item 6): boss HP drops and a spark sprite appears.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

// `hold(frame)`: the held-action set for that frame, precomputed here (not in the page) since a
// function cannot cross the `page.evaluate` serialization boundary -- only the plain array can.
const POSES = [
  { name: 'stand', gap: 150, frames: 40, hold: (frame) => (frame === 0 ? ['shoot'] : []) },
  { name: 'jump', gap: 150, frames: 40, hold: (frame) => (frame < 6 ? ['jump'] : frame === 6 ? ['jump', 'shoot'] : ['jump']) },
  { name: 'dash', gap: 170, frames: 40, hold: (frame) => (frame < 3 ? ['dash'] : frame === 3 ? ['dash', 'shoot'] : frame < 8 ? ['dash'] : []) },
  // lv3 (>=710ms => 44 frames) and lv4 (>=1020ms => 63 frames) held, then released.
  { name: 'lv3', gap: 150, frames: 70, hold: (frame) => (frame < 44 ? ['shoot'] : []) },
  { name: 'lv4', gap: 150, frames: 90, hold: (frame) => (frame < 63 ? ['shoot'] : []) }
]

export async function runShotContractScenario(name, { outputDir, url, waitForState, waitForPageCheck, advanceFrames }) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const errors = []

  const results = {}
  try {
    for (const pose of POSES) {
      const page = await browser.newPage({ viewport: { width: 448, height: 252 } })
      page.on('pageerror', (error) => errors.push(`${pose.name}: ${error}`))
      page.on('console', (message) => { if (message.type() === 'error') errors.push(`${pose.name}: ${message.text()}`) })
      try {
        // `url` already carries storyIntro=off and startScene=StageSelect: the tutorial's story
        // briefing otherwise blocks NewPlayerRuntime.update() (so it never grounds) until dismissed,
        // and this scenario is about shot mechanics, not the story.
        await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } })))
        await page.goto(url)
        await waitForState(page, (s) => s.scene === 'StageSelect', 20000, 'StageSelect')
        await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'tutorial_sentinel' }))
        await waitForState(page, (s) => s.scene === 'Game' && s.newPlayer?.locomotion?.grounded === true, 20000, 'Game grounded')
        await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate), 5000, 'stageDebug ready')
        await page.evaluate(() => {
          window.stageDebug.crossBossGate()
          window.stageDebug.activateBossRoom()
          window.bossDebug?.unlockIntro?.()
          window.stageDebug.skipDialogue?.()
        })
        await waitForState(page, (s) => s.stageRuntime?.bossRoom?.cameraLocked === true, 8000, 'boss room active')
        await advanceFrames(page, 30)
        await page.evaluate(() => {
          window.stageDebug.skipDialogue?.()
          // A long shield: the boss's own attacks (unrelated to this contract) never interrupt a run.
          window.__phaserGame.scene.getScene('Game').newPlayerRuntime?.resetForRespawn?.(600000)
        })
        await advanceFrames(page, 3)

        const heldPerFrame = Array.from({ length: pose.frames }, (_, frame) => pose.hold(frame))
        const trace = await page.evaluate(({ gap, heldPerFrame }) => {
          const loop = window.__phaserGame.loop
          const wasRunning = loop.running
          if (wasRunning) loop.sleep()
          try {
            const game = window.__phaserGame.scene.getScene('Game')
            const bossX = game.bossTarget.x
            window.stageDebug.setPlayerX(bossX - gap)
            game.player.body?.setVelocity?.(0, 0)
            window.stageDebug.replayInputs([{ frame: 0, held: [] }])
            const frames = []
            for (const held of heldPerFrame) {
              window.stageDebug.replayInputs([{ frame: 0, held }, { frame: 1, held }], { keepHeld: true })
              const shots = game.playerBullets.getChildren()
                .filter((bullet) => bullet.active)
                .map((bullet) => ({ x: bullet.x, y: bullet.y }))
              const flashes = game.children.list
                .filter((child) => child.visible && /muzzle/.test(String(child.frame?.name ?? '')))
                .map((child) => ({ x: child.x, y: child.y }))
              const sparks = game.children.list.filter((child) => child.visible && child.depth === 8 && child.texture?.key === 'atlas_effects_core').length
              frames.push({ bossHp: game.bossController?.hp?.current ?? null, shots, flashes, sparks })
            }
            return { bossX, frames }
          } finally {
            window.stageDebug.replayInputs([{ frame: 0, held: [] }])
            if (wasRunning) loop.wake()
          }
        }, { gap: pose.gap, heldPerFrame })
        results[pose.name] = trace
        fs.writeFileSync(path.join(dir, `trace-${pose.name}.json`), JSON.stringify(trace, null, 1))
      } finally {
        await page.close()
      }
    }
  } finally {
    if (errors.length > 0) {
      fs.writeFileSync(path.join(dir, 'errors.json'), JSON.stringify(errors, null, 2))
    }
    await browser.close()
  }

  if (errors.length > 0) {
    throw new Error(`Smoke test found browser errors in ${dir}: ${errors.slice(0, 3).join(' | ')}`)
  }

  for (const pose of POSES) {
    const trace = results[pose.name]
    // Find the first frame a shot appears (it did not exist the frame before).
    let spawnIndex = -1
    for (let i = 0; i < trace.frames.length; i += 1) {
      if (trace.frames[i].shots.length > 0 && (i === 0 || trace.frames[i - 1].shots.length === 0)) {
        spawnIndex = i
        break
      }
    }
    assert.ok(spawnIndex >= 0, `${pose.name}: no shot ever appeared (trace-${pose.name}.json)`)
    const spawnFrame = trace.frames[spawnIndex]
    const shot = spawnFrame.shots[spawnFrame.shots.length - 1]
    assert.ok(spawnFrame.flashes.length > 0, `${pose.name}: shot spawned with no muzzle flash on the same frame`)
    const nearestFlash = spawnFrame.flashes.reduce((best, flash) => {
      const dist = Math.hypot(flash.x - shot.x, flash.y - shot.y)
      return dist < best.dist ? { dist, flash } : best
    }, { dist: Infinity, flash: null }).dist
    assert.ok(nearestFlash <= 2, `${pose.name}: shot (${shot.x},${shot.y}) is ${nearestFlash.toFixed(1)}px from its flash, want <=2`)

    // The shot's y across the frames it is alive: a straight shot holds a fixed line.
    const ys = trace.frames.slice(spawnIndex).map((f) => f.shots[f.shots.length - 1]?.y).filter((y) => y !== undefined)
    const spread = Math.max(...ys) - Math.min(...ys)
    assert.ok(spread <= 1, `${pose.name}: shot y spread ${spread}px across its flight, want <=1`)

    // The hit: boss HP drops and a spark appears once the shot reaches it.
    const initialHp = trace.frames[0].bossHp
    const hitFrame = trace.frames.find((f) => f.bossHp !== null && f.bossHp < initialHp)
    assert.ok(hitFrame, `${pose.name}: boss HP never dropped from ${initialHp} (trace-${pose.name}.json)`)
    assert.ok(hitFrame.sparks > 0, `${pose.name}: boss HP dropped with no spark on the same frame`)
  }

  return results
}
