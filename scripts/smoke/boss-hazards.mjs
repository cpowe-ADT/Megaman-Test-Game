// Smoke 53-boss-hazards (prompt 12 part 12f wave 4; EVAL-P7-001, EVAL-P7-010). On stepped frames only, like 52. For
// each warden: the boss is frozen idle, then every attack that spawns a hazard runs through the real attack path
// (BossProjectileController.onBossAttack: wind-up, then its spawner) and the hazard must appear with its own art on a
// visible sprite (hazard-<boss>-<hazard>.png). Pyro Maw: a hazard hurts only through its own body (a pod's art does
// not, its burst does; a puddle's art beside its body does not, its body does), and the floor body does not hurt while
// the saber still hits the hurtbox. Basalt Titan: a jumping hero clears a ground shockwave that hits a standing one.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const WARDENS = [
  { stageId: 'tutorial_sentinel', bossId: 'sentinel_rook' },
  { stageId: 'pyro_maw', bossId: 'pyro_maw', bodyChecks: true },
  { stageId: 'tide_reaver', bossId: 'tide_reaver' },
  { stageId: 'volt_hopper', bossId: 'volt_hopper' },
  { stageId: 'basalt_titan', bossId: 'basalt_titan', shockwaveJump: true },
  { stageId: 'ferro_blade', bossId: 'ferro_blade' },
  { stageId: 'mire_wraith', bossId: 'mire_wraith' },
  { stageId: 'gale_vixen', bossId: 'gale_vixen' },
  { stageId: 'glacier_ronin', bossId: 'glacier_ronin' }
]

// The art each spawner draws, restated independently of src/boss/hazards/hazardSpawners.ts.
const EXPECTED_ART = {
  icicle_fall: ['atlas_mechanics_v2', 'mechanics_v2/icicle'],
  charge_mine: ['atlas_hazards_v1', 'hazards_v1/charge_mine'],
  tornado_pillar: ['atlas_hazards_v1', 'hazards_v1/tornado_pillar'],
  splash_pillar: ['atlas_hazards_v1', 'hazards_v1/splash_pillar'],
  burn_puddle: ['atlas_hazards_v1', 'hazards_v1/burn_puddle'],
  acid_trail: ['atlas_hazards_v1', 'hazards_v1/acid_trail'],
  magnet_node: ['atlas_mechanics_v2', 'mechanics_v2/magnet_lift'],
  stone_pillar: ['atlas_hazards_v1', 'hazards_v1/stone_pillar'],
  vapor_pod: ['atlas_hazards_v1', 'hazards_v1/vapor_pod'],
  short_quake: ['atlas_hazards_v1', 'hazards_v1/ground_shockwave'],
  ground_shockwave: ['atlas_hazards_v1', 'hazards_v1/ground_shockwave'],
  wind_hitbox: ['atlas_mechanics_v2', 'mechanics_v2/wind_gust'],
  mag_disc: ['atlas_weapons_v1', 'weapons_v1/magcut_disc'],
  blaze_lob: ['atlas_weapons_v1', 'weapons_v1/boss_orb']
}
const SPAWN_TO_HAZARD = { ...Object.fromEntries(Object.keys(EXPECTED_ART).map((id) => [id, id])), fire_orb: 'blaze_lob', ground_slam_hazard: 'short_quake' }

const step = (page, frames = 1) => page.evaluate((count) => window.stepFrames(count, { manageLoop: false }), frames)

async function enterFight(page, { stageId, bossId }, waitForState) {
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
  const started = await page.evaluate(() => {
    const game = window.__phaserGame
    const scene = game.scene.getScene('Game')
    game.loop.sleep()
    window.stageDebug.crossBossGate()
    window.stageDebug.activateBossRoom()
    window.bossDebug?.unlockIntro?.()
    const room = scene.activeBossRoom
    if (room) window.stageDebug.setPlayerX(room.x + 72)
    scene.newPlayerRuntime?.resetForRespawn?.(600000)
    for (let frame = 1; frame <= 900; frame += 1) {
      if (scene.dialogueOverlay?.isActive?.()) scene.dialogueOverlay.skip()
      window.stepFrames(1, { manageLoop: false })
      if (!scene.hud?.bossBarVisible) continue
      // Freeze the boss idle and grounded: its brain stops, so only the attacks the smoke starts spawn anything.
      const debug = scene.bossController.getDebugState()
      if (debug.activeAttackId == null && debug.grounded && frame > 60) {
        const controller = scene.bossController
        controller.update = () => {}
        controller.body.setVelocity(0, 0)
        scene.bossProjectileController.stop()
        scene.bossProjectileController.startLoop()
        scene.bossBeats.hazards.clear()
        return { frame, bossX: controller.x }
      }
    }
    return null
  })
  assert.ok(started, `${bossId}: the fight starts and the boss comes to rest within 900 frames`)
}

async function checkHazardAttack(page, dir, bossId, attack) {
  const found = await page.evaluate(({ attackId, hazardId }) => {
    const scene = window.__phaserGame.scene.getScene('Game')
    const controller = scene.bossController
    const room = scene.activeBossRoom
    // The hero stands in the room's near half; the boss faces it, as it would when the attack starts.
    window.stageDebug.setPlayerX(Math.min(controller.x - 110, room.x + 90))
    window.stepFrames(2, { manageLoop: false })
    controller.attackFacing = scene.player.x < controller.x ? -1 : 1
    const definition = controller.runtimeDefinition.attacks.find((entry) => entry.id === attackId)
    const pattern = controller.toSceneAttackPattern(definition)
    scene.bossProjectileController.onBossAttack(pattern, definition)
    let appearedAt = null
    let hurtingAt = null
    for (let frame = 1; frame <= 240; frame += 1) {
      window.stepFrames(1, { manageLoop: false })
      const entry = scene.bossBeats.hazards.getDebugState().active.find((hazard) => hazard.id === hazardId && hazard.pieces.length > 0)
      if (!entry) continue
      appearedAt ??= frame
      // Capture 12 frames after a body can first hurt (a pillar risen, an orb in flight), or 30 frames after the
      // hazard appeared (a mine waits armed, a pod pulses).
      if (hurtingAt === null && entry.pieces.some((piece) => piece.body || piece.solid)) hurtingAt = frame
      if ((hurtingAt !== null && frame - hurtingAt >= 12) || frame - appearedAt >= 30) {
        const sprites = scene.children.list
          .filter((child) => child.texture?.key === entry.texture && child.visible && child.active)
          .map((child) => String(child.frame?.name))
        return { frame, appearedAt, telegraphMs: pattern.telegraph.telegraphMs, entry, sprites }
      }
    }
    return { recent: scene.bossBeats.hazards.recent, pending: scene.bossProjectileController.getPendingTelegraphs().length }
  }, attack)
  assert.ok(found?.entry, `${bossId}: ${attack.name} never spawned ${attack.hazardId} (${JSON.stringify(found)})`)
  const [texture, prefix] = EXPECTED_ART[attack.hazardId]
  const capture = `hazard-${bossId}-${attack.hazardId}.png`
  await page.locator('canvas').screenshot({ path: path.join(dir, capture) })
  assert.equal(found.entry.texture, texture, `${bossId}: ${attack.hazardId} draws from ${texture}`)
  for (const piece of found.entry.pieces) {
    assert.match(piece.frame, new RegExp(`^${prefix}/00[0-3]$`), `${bossId}: ${attack.hazardId} frame ${piece.frame}`)
    assert.ok(found.sprites.includes(piece.frame), `${bossId}: a visible sprite shows ${piece.frame}`)
  }
  await page.evaluate(() => window.__phaserGame.scene.getScene('Game').bossBeats.hazards.clear())
  return { attack: attack.name, hazard: attack.hazardId, capture, appearedAtFrame: found.appearedAt, capturedAtFrame: found.frame, pieces: found.entry.pieces }
}

/** Hits the hero took since `sinceMs` from sources whose note starts with `prefix` (accepted or refused by i-frames). */
const hitsSince = (page, sinceMs, prefix) =>
  page.evaluate(({ since, source }) => {
    const scene = window.__phaserGame.scene.getScene('Game')
    return scene.combatDebugBus.getRecentHits(40).filter((hit) => hit.target === 'player' && hit.timeMs >= since && String(hit.note ?? '').startsWith(source))
  }, { since: sinceMs, source: prefix })

const now = (page) => page.evaluate(() => window.__phaserGame.scene.getScene('Game').time.now)

/** Spawns one hazard straight from its spawner at `originX` (count 1), the hero unshielded and standing at `heroX`. */
async function spawnDirect(page, id, originX, heroX, facing = 1) {
  return page.evaluate(({ hazardId, x, hero, dir }) => {
    const scene = window.__phaserGame.scene.getScene('Game')
    const room = scene.activeBossRoom
    const floorY = scene.bossController.getFloorY()
    // A hit's hit-stop holds the hero where it was: let it run out before placing the hero.
    window.stepFrames(30, { manageLoop: false })
    window.stageDebug.setPlayerX(hero)
    scene.newPlayerRuntime.resetForRespawn(0)
    window.stepFrames(2, { manageLoop: false })
    scene.bossBeats.hazards.spawn({ id: hazardId, originX: x, floorY, ceilingY: 20, muzzleY: floorY - 16, facing: dir, heroX: x, minX: room.x + 8, maxX: room.x + room.width - 8, damage: 1, count: 1 }, 'smoke')
    return { floorY, heroHalfWidth: scene.player.body.width / 2 }
  }, { hazardId: id, x: originX, hero: heroX, dir: facing })
}

async function checkBodiesOnly(page, dir) {
  const report = {}
  const room = await page.evaluate(() => ({ ...window.__phaserGame.scene.getScene('Game').activeBossRoom }))
  // 1. A vapor pod's art does not hurt while it pulses; its burst body does.
  const podX = room.x + 80
  await spawnDirect(page, 'vapor_pod', podX, podX)
  let since = await now(page)
  await step(page, 30)
  const duringFuse = await hitsSince(page, since, 'vapor_pod:')
  assert.equal(duringFuse.length, 0, `standing in a pulsing pod's art does not hurt (${JSON.stringify(duringFuse)})`)
  await page.locator('canvas').screenshot({ path: path.join(dir, 'body-only-vapor-pod-fuse.png') })
  await step(page, 60)
  const afterBurst = await hitsSince(page, since, 'vapor_pod:')
  assert.ok(afterBurst.some((hit) => hit.accepted), `the burst body hurts (${JSON.stringify(afterBurst)})`)
  report.vaporPod = { fuseHits: duringFuse.length, burstHits: afterBurst.length }
  await page.evaluate(() => window.__phaserGame.scene.getScene('Game').bossBeats.hazards.clear())
  // 2. A puddle: the hero overlapping its art beside the body is not hurt; on the body it is.
  const puddleX = room.x + 80
  const { heroHalfWidth } = await spawnDirect(page, 'burn_puddle', puddleX, room.x + 30)
  await step(page, 12)
  const beside = puddleX + 13 + heroHalfWidth + 1
  const geometry = await page.evaluate((x) => {
    window.stageDebug.setPlayerX(x)
    window.stepFrames(1, { manageLoop: false })
    const scene = window.__phaserGame.scene.getScene('Game')
    const piece = scene.bossBeats.hazards.getDebugState().active[0].pieces[0]
    const body = scene.player.body
    return { puddle: piece, hero: { x: body.x, y: body.y, width: body.width, height: body.height } }
  }, beside)
  assert.ok(geometry.hero.x < geometry.puddle.x + 17 && geometry.hero.x >= geometry.puddle.body.x + geometry.puddle.body.width, 'the hero overlaps the drawn puddle but not its body')
  since = await now(page)
  await step(page, 20)
  const besideHits = await hitsSince(page, since, 'burn_puddle:')
  assert.equal(besideHits.length, 0, `the puddle's art beside its body does not hurt (${JSON.stringify(besideHits)})`)
  await page.evaluate((x) => window.stageDebug.setPlayerX(x), puddleX)
  await step(page, 6)
  const onHits = await hitsSince(page, since, 'burn_puddle:')
  assert.ok(onHits.some((hit) => hit.accepted), `the puddle's body hurts (${JSON.stringify(onHits)})`)
  report.burnPuddle = { geometry, besideHits: besideHits.length, onBodyHits: onHits.length }
  await page.evaluate(() => window.__phaserGame.scene.getScene('Game').bossBeats.hazards.clear())
  return report
}

async function checkFloorBodyAndSaber(page, dir) {
  const setup = await page.evaluate(() => {
    const scene = window.__phaserGame.scene.getScene('Game')
    const controller = scene.bossController
    window.stepFrames(30, { manageLoop: false })
    const boxes = controller.getBodyBoxes()
    const floor = { x: controller.body.x, y: controller.body.y, width: controller.body.width, height: controller.body.height }
    const half = scene.player.body.width / 2
    const room = scene.activeBossRoom
    // Beside the contact hitbox but inside the floor body, on whichever side has room.
    const left = boxes.hitbox.x - half - 4
    const x = left - half > room.x + 4 ? left : boxes.hitbox.x + boxes.hitbox.width + half + 4
    window.stageDebug.setPlayerX(x)
    scene.newPlayerRuntime.resetForRespawn(0)
    window.stepFrames(2, { manageLoop: false })
    const body = scene.player.body
    const hero = { x: body.x, y: body.y, width: body.width, height: body.height }
    const overlaps = (a, b) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y
    return { boxes, floor, hero, side: x < controller.x ? 'west' : 'east', inFloor: overlaps(hero, floor), inHitbox: overlaps(hero, boxes.hitbox), bossHp: scene.bossHp.current }
  })
  assert.ok(setup.inFloor && !setup.inHitbox, `the hero overlaps the floor body only (${JSON.stringify(setup)})`)
  const since = await now(page)
  await step(page, 20)
  const contact = await hitsSince(page, since, setup.boxes ? 'pyro_maw' : '')
  assert.equal(contact.filter((hit) => hit.kind === 'boss_contact').length, 0, 'the floor body does not hurt')
  // Face the boss for one frame, then swing the saber at the hurtbox.
  const toward = setup.side === 'west' ? 'ArrowRight' : 'ArrowLeft'
  await page.keyboard.down(toward)
  await step(page, 1)
  await page.keyboard.up(toward)
  await page.keyboard.down('c')
  await step(page, 3)
  await page.keyboard.up('c')
  let bossHp = setup.bossHp
  for (let frame = 0; frame < 40 && bossHp >= setup.bossHp; frame += 1) {
    await step(page, 1)
    bossHp = await page.evaluate(() => window.__phaserGame.scene.getScene('Game').bossHp.current)
  }
  await page.locator('canvas').screenshot({ path: path.join(dir, 'saber-hurtbox-pyro_maw.png') })
  assert.ok(bossHp < setup.bossHp, `the saber hits the hurtbox (${setup.bossHp} -> ${bossHp})`)
  const after = await hitsSince(page, since, '')
  assert.equal(after.filter((hit) => hit.kind === 'boss_contact').length, 0, 'still no contact damage from the floor body')
  return { ...setup, bossHpAfter: bossHp }
}

async function checkShockwaveJump(page, dir) {
  const run = async (jump) => {
    const start = await page.evaluate(() => {
      const scene = window.__phaserGame.scene.getScene('Game')
      const room = scene.activeBossRoom
      return { heroX: room.x + 150, originX: room.x + 40 }
    })
    await spawnDirect(page, 'ground_shockwave', start.originX, start.heroX, 1)
    const since = await now(page)
    let jumped = false
    let heldFrames = 0
    let overlapped = false
    let passed = false
    for (let frame = 0; frame < 120 && !passed; frame += 1) {
      const state = await page.evaluate(() => {
        const scene = window.__phaserGame.scene.getScene('Game')
        const wave = scene.bossBeats.hazards.getDebugState().active[0]?.pieces[0]?.body ?? null
        const body = scene.player.body
        return { wave, hero: { x: body.x, y: body.y, width: body.width, height: body.height } }
      })
      if (!state.wave) break
      const gap = state.hero.x - (state.wave.x + state.wave.width)
      if (jump && !jumped && gap <= 26) {
        await page.keyboard.down('Space')
        jumped = true
      }
      if (jumped && (heldFrames += 1) === 16) await page.keyboard.up('Space')
      const w = state.wave
      const h = state.hero
      overlapped ||= h.x < w.x + w.width && h.x + h.width > w.x && h.y < w.y + w.height && h.y + h.height > w.y
      passed = w.x > h.x + h.width
      if (jump && jumped && heldFrames === 6) await page.locator('canvas').screenshot({ path: path.join(dir, 'shockwave-jump-basalt_titan.png') })
      await step(page, 1)
    }
    if (jumped && heldFrames < 16) await page.keyboard.up('Space')
    await step(page, 30)
    const hits = await hitsSince(page, since, 'ground_shockwave:')
    await page.evaluate(() => window.__phaserGame.scene.getScene('Game').bossBeats.hazards.clear())
    return { jumped, overlapped, passed, hits: hits.length, accepted: hits.filter((hit) => hit.accepted).length }
  }
  const jumping = await run(true)
  assert.ok(jumping.jumped && jumping.passed, `the wave passes under the jump (${JSON.stringify(jumping)})`)
  assert.equal(jumping.overlapped, false, 'the jumping hero never overlaps the wave body')
  assert.equal(jumping.hits, 0, 'a jumping hero takes no shockwave hit')
  const standing = await run(false)
  assert.ok(standing.accepted > 0, `a standing hero is hit by the same wave (${JSON.stringify(standing)})`)
  return { jumping, standing }
}

async function checkWarden(page, dir, warden, waitForState) {
  await enterFight(page, warden, waitForState)
  const attacks = await page.evaluate((spawnToHazard) => {
    const blueprint = window.__phaserGame.scene.getScene('Game').bossController.blueprint
    return blueprint.attacks.flatMap((attack) => {
      const hazardId = (attack.spawns ?? []).map((spawn) => spawnToHazard[spawn]).find(Boolean)
      return hazardId ? [{ name: attack.name, attackId: attack.name.toLowerCase().replace(/[^a-z0-9]+/g, '_'), hazardId }] : []
    })
  }, SPAWN_TO_HAZARD)
  assert.ok(attacks.length > 0, `${warden.bossId}: at least one attack spawns a hazard`)
  const hazards = []
  for (const attack of attacks) hazards.push(await checkHazardAttack(page, dir, warden.bossId, attack))
  const result = { ...warden, hazards }
  if (warden.bodyChecks) {
    result.bodyOnly = await checkBodiesOnly(page, dir)
    result.floorBodyAndSaber = await checkFloorBodyAndSaber(page, dir)
  }
  if (warden.shockwaveJump) result.shockwaveJump = await checkShockwaveJump(page, dir)
  return result
}

export async function runBossHazardsScenario(name, { outputDir, url, waitForState }) {
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
    for (const warden of WARDENS) {
      report.push(await checkWarden(page, dir, warden, waitForState))
      fs.writeFileSync(path.join(dir, 'hazards.json'), JSON.stringify(report, null, 2))
    }
    assert.equal(errors.length, 0, JSON.stringify(errors))
  } finally {
    fs.writeFileSync(path.join(dir, 'hazards.json'), JSON.stringify({ report, errors }, null, 2))
    await browser.close()
  }
}
