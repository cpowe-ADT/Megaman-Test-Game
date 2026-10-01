// Smoke `64-enemy-behavior-lab` (12c, EVAL-P6-006): the mechanics lab (`mechanics_lab`, no enemy markers
// of its own, a continuous flat floor, `GAME_FLOOR_TOP`) debug-spawns one of each new behaviour through
// `enemySpawner.spawn`/`applyDamageToSprite` and steps frames with the loop asleep, as `miniboss-custodian.mjs`
// does. Three beats, each its own screen so the camera's `isOnscreen` attack gate sees the hero beside it:
// (a) x 300, `enemy_armored_bot`: it reaches attack range at spawn, winds up (380 ms), then its `charge`
//     consumes `chargeSpeed` (150 px/s) toward the hero, moving it off its spawn x (`shot-armored-charge.png`);
// (b) x 900, `enemy_laser_eye`: the 400 ms telegraph (`attack_windup`, `shot-beam-telegraph.png`), then the
//     timed line hitbox goes active (`shot-beam-active.png`);
// (c) x 1500, `enemy_shield_drone`, facing forced right (shield covers the right, gap on the left):
//     a front bullet (arriving from the right) clashes for no damage, the same bullet from behind (the
//     left) lands (`shot-shield-front-blocked.png`, `shot-shield-back-hit.png`), and on a fresh second
//     drone a charged front bullet (damage 2, the buster clash rule) punches through.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

export async function runEnemyBehaviorLabScenario(name, { outputDir, storyUrl, waitForState }) {
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
  const evidence = {}

  await page.addInitScript(() =>
    localStorage.setItem('save.v1', JSON.stringify({ tutorialCleared: true, progressionWorld: { progressionMode: 'classic' } }))
  )
  try {
    await page.goto(`${storyUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
    await page.evaluate(() => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId: 'mechanics_lab' }))
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'mechanics_lab', 15000, 'lab loaded')
    await page.evaluate(() => { window.stageDebug?.skipStageIntro?.(); window.stageDebug?.skipDialogue?.() })

    // (a) armored_bot: charge consumes chargeSpeed, leaving its spawn.
    const charge = await page.evaluate(async () => {
      const game = window.__phaserGame.scene.getScene('Game')
      const hero = game.player
      hero.setPosition(260, 214)
      hero.body?.setVelocity?.(0, 0)
      const entity = game.enemySpawner.spawn('enemy_armored_bot', 320, 180)
      const loop = window.__phaserGame.loop
      if (loop.running) loop.sleep()
      for (let i = 0; i < 40; i += 1) window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
      const spawnX = entity.sprite.x
      let sawWindup = false
      let activeStartX = null
      let activeEndX = null
      let maxDelta = 0
      for (let i = 0; i < 200; i += 1) {
        window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
        if (!entity.sprite.active) break
        if (entity.state === 'attack_windup') sawWindup = true
        if (entity.state === 'attack_active') {
          if (activeStartX === null) activeStartX = entity.sprite.x
          activeEndX = entity.sprite.x
          maxDelta = Math.max(maxDelta, Math.abs(entity.sprite.x - spawnX))
        }
        if (sawWindup && activeEndX !== null && entity.state !== 'attack_active' && entity.state !== 'attack_windup') break
      }
      loop.wake()
      return { spawnX, activeStartX, activeEndX, maxDelta, sawWindup, finalState: entity.state, chargeSpeed: entity.definition.attack.chargeSpeed }
    })
    evidence.armoredBotCharge = charge
    await capture('armored-charge')
    assert.ok(charge.sawWindup, 'the charge telegraphs (attack_windup) before it moves')
    assert.ok(charge.maxDelta >= 8, `it left its spawn during the charge (moved ${charge.maxDelta}px of a possible ${charge.chargeSpeed * 0.26}px)`)

    // (b) laser_eye: a 400 ms telegraph, then the timed line hitbox.
    const beam = await page.evaluate(async () => {
      const game = window.__phaserGame.scene.getScene('Game')
      const hero = game.player
      hero.setPosition(780, 214)
      hero.body?.setVelocity?.(0, 0)
      const entity = game.enemySpawner.spawn('enemy_laser_eye', 900, 214)
      const loop = window.__phaserGame.loop
      if (loop.running) loop.sleep()
      let windupFrames = 0
      let sawWindup = false
      let sawActive = false
      for (let i = 0; i < 200; i += 1) {
        window.stageDebug.replayInputs([{ frame: 0, held: [] }, { frame: 1, held: [] }])
        if (!entity.sprite.active) break
        if (entity.state === 'attack_windup') {
          sawWindup = true
          windupFrames += 1
        }
        if (entity.state === 'attack_active' && !sawActive) {
          sawActive = true
        }
        if (sawActive) break
      }
      loop.wake()
      return { sawWindup, sawActive, windupFrames, windupMs: entity.definition.attack.windupMs, finalState: entity.state }
    })
    evidence.laserEyeBeam = beam
    await capture('beam-telegraph')
    assert.ok(beam.sawWindup, 'the beam telegraphs first')
    assert.equal(beam.windupMs, 400, 'the telegraph is 400 ms')
    assert.ok(beam.sawActive, 'the timed line hitbox goes active after the telegraph')
    await capture('beam-active')

    // (c) shield_drone: a front bullet clashes, the same bullet from behind lands, a charged front bullet
    // punches through (the buster clash rule mirrored on damage: SHIELD_PUNCH_THROUGH_DAMAGE = 2).
    const shield = await page.evaluate(async () => {
      const game = window.__phaserGame.scene.getScene('Game')
      const hero = game.player
      hero.setPosition(1460, 214)
      hero.body?.setVelocity?.(0, 0)
      const entity = game.enemySpawner.spawn('enemy_shield_drone', 1500, 150)
      entity.facing = 1 // shield covers its right (the front), gap on the left (the back)
      const hp0 = entity.combat.currentHp
      // EnemyCombat's own knockback path calls `.clone().scale()` (a real Phaser.Math.Vector2 normally);
      // a hit the shield does not block reaches it, so this stands in for one without importing Phaser.
      const vec = (x, y) => ({ x, y, clone() { return vec(this.x, this.y) }, scale(s) { this.x *= s; this.y *= s; return this } })
      // The generic AI drifts `facing` toward the hero on its own each real frame (`advanceTime` below
      // runs it); re-forcing it right before each hit keeps the fixture's "shield covers the right" fact
      // true regardless, so each hit tests only the shield arc, not the AI's facing.
      const faceRight = () => { entity.facing = 1 }
      faceRight()
      // A shot travelling left (knockback.x < 0) arrives at the drone from its right: the front.
      const frontBlocked = game.enemySpawner.applyDamageToSprite(entity.sprite, {
        amount: 1,
        type: 'bullet',
        knockback: vec(-120, -20),
        sourceId: 'lab_front'
      })
      const hpAfterFront = entity.combat.currentHp
      // The drone's own `invulnerabilityMs` (80) would otherwise swallow the next hit outright: each real
      // hit waits it out first, same as a player would between two separate shots landing.
      await window.advanceTime(90)
      faceRight()
      // The same shot travelling right (knockback.x > 0) arrives from the left: the back, through the gap.
      const backHit = game.enemySpawner.applyDamageToSprite(entity.sprite, {
        amount: 1,
        type: 'bullet',
        knockback: vec(120, -20),
        sourceId: 'lab_back'
      })
      const hpAfterBack = entity.combat.currentHp
      // A fresh second drone for the punch-through: its own `invulnerabilityMs` window (just spent on the
      // first drone's two hits above) never enters into this one at all.
      const puncher = game.enemySpawner.spawn('enemy_shield_drone', 1540, 150)
      puncher.facing = 1
      const punchHp0 = puncher.combat.currentHp
      const chargedFront = game.enemySpawner.applyDamageToSprite(puncher.sprite, {
        amount: 2,
        type: 'bullet',
        knockback: vec(-120, -20),
        sourceId: 'lab_charged_front'
      })
      const hpAfterChargedFront = puncher.combat.currentHp
      return { hp0, hpAfterFront, hpAfterBack, punchHp0, hpAfterChargedFront, frontBlocked, backHit, chargedFront }
    })
    evidence.shieldDrone = shield
    await capture('shield-front-blocked')
    assert.equal(shield.hpAfterFront, shield.hp0, 'a front shot clashes: no damage')
    assert.equal(shield.hpAfterBack, shield.hp0 - 1, 'the same shot from behind lands')
    await capture('shield-back-hit')
    assert.equal(shield.hpAfterChargedFront, shield.punchHp0 - 2, 'a charged front shot punches through')

    if (errors.length > 0) {
      fs.writeFileSync(path.join(dir, 'errors.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${dir}`)
    }
    fs.writeFileSync(path.join(dir, 'evidence.json'), JSON.stringify(evidence, null, 2))
  } finally {
    await browser.close()
  }
}
