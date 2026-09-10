import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const host = '127.0.0.1'
const port = Number(process.env.SWEEP_PORT ?? 4173)
const url = `http://${host}:${port}?renderer=canvas&automation=1&storyIntro=off&startScene=StageSelect`
const outputRoot = path.resolve('output/mission-visual-sweep')
const visualSweepSummaryPath = path.join(outputRoot, 'summary.json')
const STAGE_SELECT_STATE_TIMEOUT_MS = 10_000
const GAME_TRANSITION_TIMEOUT_MS = 10_000
const CLEANUP_TIMEOUT_MS = 5_000

const missionSlots = [
  { stageId: 'tutorial_sentinel', bossId: 'sentinel_rook', direct: true },
  { stageId: 'pyro_maw', bossId: 'pyro_maw' },
  { stageId: 'tide_reaver', bossId: 'tide_reaver' },
  { stageId: 'volt_hopper', bossId: 'volt_hopper' },
  { stageId: 'basalt_titan', bossId: 'basalt_titan' },
  { stageId: 'ferro_blade', bossId: 'ferro_blade' },
  { stageId: 'mire_wraith', bossId: 'mire_wraith' },
  { stageId: 'gale_vixen', bossId: 'gale_vixen' },
  { stageId: 'glacier_ronin', bossId: 'glacier_ronin' },
  { stageId: 'omega_fortress', bossId: 'omega_core', runtimeBossConfigId: 'omega_core' }
]
const robotMasterSlots = missionSlots.filter((slot) => !slot.direct)
const unlockedStageIds = missionSlots.map((slot) => slot.stageId)

const indexByBossId = new Map(robotMasterSlots.map((slot, index) => [slot.bossId, index]))

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: options.stdio ?? 'inherit',
      cwd: options.cwd ?? process.cwd(),
      env: options.env ?? process.env,
      shell: false
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
        return
      }
      reject(new Error(`${command} ${args.join(' ')} exited with code ${code ?? 'unknown'}`))
    })
  })
}

async function waitForServerReady(targetUrl, timeoutMs = 30_000) {
  const start = Date.now()
  while (Date.now() - start < timeoutMs) {
    try {
      const response = await fetch(targetUrl)
      if (response.ok) {
        return
      }
    } catch {
      // keep polling
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Dev server did not become ready at ${targetUrl} within ${timeoutMs}ms`)
}

async function advanceFrames(page, frames = 1) {
  for (let index = 0; index < frames; index += 1) {
    await page.evaluate(async () => {
      if (typeof window.advanceTime === 'function') {
        await window.advanceTime(1000 / 60)
      }
    })
  }
}

async function readState(page) {
  const text = await page.evaluate(() => {
    if (typeof window.render_game_to_text === 'function') {
      return window.render_game_to_text()
    }
    return null
  })
  return text ? JSON.parse(text) : null
}

function summarizeStateForError(state) {
  if (!state || typeof state !== 'object') {
    return null
  }

  return {
    scene: state.scene ?? null,
    activeScenes: Array.isArray(state.activeScenes) ? state.activeScenes : [],
    stageSelect: state.stageSelect ?? null,
    stageRuntime: state.stageRuntime ?? null,
    bossState: state.bossState ?? null,
    player: state.player ?? null,
    playerState: state.playerState ?? null,
    projectiles: state.projectiles ?? null,
    visuals: state.visuals ?? null,
    audio: state.audio ?? null
  }
}

function classifyVisualSweepError(error) {
  if (error?.classification === 'hung_after_artifacts') {
    return 'hung_after_artifacts'
  }

  const message = String(error?.message ?? error ?? '')
  if (message.includes('Timed out waiting for state condition')) {
    return 'state_timeout'
  }
  if (message.includes('browser errors captured')) {
    return 'browser_error'
  }
  return 'error'
}

function serializeVisualSweepError(error) {
  return {
    name: String(error?.name ?? 'Error'),
    message: String(error?.message ?? error ?? 'Unknown error'),
    classification: classifyVisualSweepError(error),
    stack: typeof error?.stack === 'string' ? error.stack : undefined,
    timeoutMs: Number(error?.timeoutMs ?? 0) || undefined,
    lastState: summarizeStateForError(error?.lastState)
  }
}

function writeVisualSweepSummary(summary) {
  fs.writeFileSync(visualSweepSummaryPath, JSON.stringify(summary, null, 2))
}

function createVisualSweepSummary() {
  return {
    status: 'running',
    startedAt: new Date().toISOString(),
    outputDir: outputRoot,
    missions: []
  }
}

async function runWithTimeout(task, label, timeoutMs = CLEANUP_TIMEOUT_MS, classification = 'error') {
  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const error = new Error(`${label} exceeded ${timeoutMs}ms`)
      error.name = 'CleanupTimeoutError'
      error.classification = classification
      error.timeoutMs = timeoutMs
      reject(error)
    }, timeoutMs)

    Promise.resolve()
      .then(task)
      .then(
        (value) => {
          clearTimeout(timer)
          resolve(value)
        },
        (error) => {
          clearTimeout(timer)
          reject(error)
        }
      )
  })
}

async function stopChildProcess(child, label, timeoutMs = CLEANUP_TIMEOUT_MS) {
  if (!child || child.killed || child.exitCode !== null) {
    return
  }

  await new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      const error = new Error(`${label} did not exit within ${timeoutMs}ms`)
      error.name = 'CleanupTimeoutError'
      error.classification = 'hung_after_artifacts'
      error.timeoutMs = timeoutMs
      reject(error)
    }, timeoutMs)

    child.once('close', () => {
      clearTimeout(timer)
      resolve()
    })

    child.kill('SIGTERM')
  })
}

async function waitForState(page, predicate, timeoutMs = 5000, description = 'state condition') {
  const startedAt = Date.now()
  let lastState = null
  while (Date.now() - startedAt < timeoutMs) {
    await advanceFrames(page, 2)
    const state = await readState(page)
    lastState = state
    if (state && predicate(state)) {
      return state
    }
    await page.waitForTimeout(25)
  }
  const error = new Error(`Timed out waiting for state condition (${description}) after ${timeoutMs}ms`)
  error.name = 'TimeoutError'
  error.timeoutMs = timeoutMs
  error.lastState = lastState
  throw error
}

async function moveSelectionToBoss(page, bossId) {
  let state = await waitForState(
    page,
    (next) => next.scene === 'StageSelect' && next.stageSelect?.selectedBossId,
    STAGE_SELECT_STATE_TIMEOUT_MS
  )

  for (let attempt = 0; attempt < robotMasterSlots.length + 2; attempt += 1) {
    if (state.stageSelect?.selectedBossId === bossId) {
      return state
    }

    const currentIndex = indexByBossId.get(state.stageSelect?.selectedBossId ?? '') ?? 0
    const targetIndex = indexByBossId.get(bossId) ?? 0
    const delta = (targetIndex - currentIndex + robotMasterSlots.length) % robotMasterSlots.length
    const key = delta > 0 && delta <= robotMasterSlots.length / 2 ? 'ArrowRight' : 'ArrowLeft'

    await page.keyboard.press(key)
    await advanceFrames(page, 6)
    state = await waitForState(
      page,
      (next) => next.scene === 'StageSelect' && next.stageSelect?.selectedBossId,
      STAGE_SELECT_STATE_TIMEOUT_MS
    )
  }

  throw new Error(`Could not focus boss '${bossId}' from Stage Select`)
}

function assertPreBossState(state, bossId) {
  if (state.scene !== 'Game') {
    throw new Error(`[${bossId}] Expected Game scene, got ${state.scene}`)
  }
  if ((state.visuals?.backgroundLayerCount ?? 0) <= 0) {
    throw new Error(`[${bossId}] expected background layers to be present`)
  }
  if ((state.visuals?.placeholderCount ?? 0) !== 0) {
    throw new Error(`[${bossId}] placeholderCount expected 0, got ${state.visuals?.placeholderCount}`)
  }
  if ((state.visuals?.missingAtlasCount ?? 0) !== 0) {
    throw new Error(`[${bossId}] missingAtlasCount expected 0, got ${state.visuals?.missingAtlasCount}`)
  }
  if (!state.stageRuntime?.bossRoom) {
    throw new Error(`[${bossId}] expected bossRoom metadata in state payload`)
  }
  const retention = state.stageRuntime?.contentRetention
  if (!retention || JSON.stringify(retention.authored) !== JSON.stringify(retention.retained)) {
    throw new Error(`[${bossId}] expected all authored route content to be retained`)
  }
  if (Number(retention.worldWidth ?? 0) !== Number(retention.routeWidth ?? 0) + 448) {
    throw new Error(`[${bossId}] expected world width to reserve one 448px boss room after the route`)
  }
}

function assertBossRoomState(state, bossId) {
  if (!state.stageRuntime?.bossRoom?.cameraLocked) {
    throw new Error(`[${bossId}] expected boss-room camera lock to be active`)
  }
  if (!state.stageRuntime?.bossEncounterActive) {
    throw new Error(`[${bossId}] expected boss encounter to be active`)
  }
  if (state.bossState?.legacyActorPresent) {
    throw new Error(`[${bossId}] found a second legacy boss actor beside the runtime controller`)
  }
  if (Number(state.bossState?.runtime?.visualChildCount ?? 0) !== 1) {
    throw new Error(`[${bossId}] expected exactly one boss visual child`)
  }
  if (Number(state.bossState?.runtime?.visibleBossSpriteCount ?? 0) !== 1) {
    throw new Error(`[${bossId}] expected exactly one visible boss sprite`)
  }
}

async function sampleBossMovement(page, bossId, artifactDir) {
  const samples = []
  let phaseForced = false

  for (let index = 0; index < 18; index += 1) {
    await advanceFrames(page, 20)
    const sample = await page.evaluate(() => {
      const game = window.__phaserGame
      const scene = game?.scene?.getScenes(true)?.[0]
      const bossRoom = scene?.activeBossRoom ?? null
      return {
        bossX: Math.round(scene?.bossController?.x ?? scene?.bossTarget?.x ?? 0),
        bossRawX: Number(scene?.bossController?.x ?? scene?.bossTarget?.x ?? 0),
        bossBodyX: Number(scene?.bossController?.body?.x ?? 0),
        bossVelocityX: Number(scene?.bossController?.body?.velocity?.x ?? 0),
        bossY: Math.round(scene?.bossController?.y ?? scene?.bossTarget?.y ?? 0),
        playerX: Math.round(scene?.player?.x ?? 0),
        bossRoom,
        cameraLocked: Boolean(scene?.bossRoomCameraLocked),
        runtime: scene?.bossController?.getDebugState?.() ?? null,
        bossProjectilesActive: Number(scene?.bossBullets?.getTotalUsed?.() ?? 0),
        hazardsActive: Number(scene?.hazards?.getTotalUsed?.() ?? 0)
      }
    })
    samples.push(sample)
    if (!phaseForced && sample.runtime?.lastFiredAttackId) {
      sample.phaseProbe = await page.evaluate(() => {
        const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
        const controller = scene?.bossController
        const hp = controller?.hp
        if (controller && hp?.max) {
          const result = controller.applyDamage({
            amount: Math.ceil(hp.max * 0.65),
            type: 'normal',
            source: 'visual_sweep_phase_probe',
            iFrameMs: 0
          })
          return { result, hp: controller.hp }
        }
        return null
      })
      phaseForced = Boolean(sample.phaseProbe?.result?.accepted)
    }
  }

  fs.writeFileSync(path.join(artifactDir, 'boss-movement-samples.json'), JSON.stringify(samples, null, 2))
  const room = samples[0]?.bossRoom
  if (!room) {
    throw new Error(`[${bossId}] missing boss room data while sampling boss movement`)
  }

  const minX = room.x + room.leftInset
  const maxX = room.x + room.width - room.rightInset
  samples.forEach((sample) => {
    if (sample.bossX < minX || sample.bossX > maxX) {
      throw new Error(
        `[${bossId}] boss left the room bounds (${sample.bossX} not in ${minX}-${maxX})`
      )
    }
  })
  if (!samples.some((sample) => sample.runtime?.lastFiredAttackId)) {
    throw new Error(`[${bossId}] no authored boss attack fired during the movement sample`)
  }
  // Feet on the floor: whenever the body is grounded, the drawn feet must be where the body
  // bottom is (otherwise the art floats above the platform), and every boss must touch the floor
  // at least once during the sample window, hover bosses included.
  samples.forEach((sample) => {
    const ground = sample.runtime?.ground
    if (!ground) {
      throw new Error(`[${bossId}] boss ground report is missing from the runtime debug state`)
    }
    if (ground.grounded && Math.abs(Number(ground.feetToBodyGap)) > 1) {
      throw new Error(
        `[${bossId}] boss floats: feet ${ground.feetY} vs body bottom ${ground.bodyBottom} (gap ${ground.feetToBodyGap}px)`
      )
    }
  })
  if (!samples.some((sample) => sample.runtime?.ground?.grounded)) {
    throw new Error(`[${bossId}] boss never touched the floor during the movement sample`)
  }
  const traces = new Map()
  samples.forEach((sample) => {
    ;(sample.runtime?.traceTail ?? []).forEach((trace) => traces.set(trace.sequence, trace))
  })
  const traceList = [...traces.values()]
  if (!traceList.some((trace) => trace.event === 'attack_started')) {
    throw new Error(`[${bossId}] typed boss traces never recorded an attack start`)
  }
  if (!traceList.some((trace) => trace.event === 'phase_changed' && trace.lifecycle === 'active')) {
    throw new Error(`[${bossId}] attack lifecycle never reached an asserted active frame`)
  }
  const attackingSamples = samples.filter((sample) => sample.runtime?.state === 'ATTACKING')
  if (attackingSamples.length === 0) {
    throw new Error(`[${bossId}] no ATTACKING sample was observed`)
  }
  attackingSamples.forEach((sample) => {
    const runtime = sample.runtime
    if (!runtime?.motionIntent || !runtime?.attackLifecyclePhase) {
      throw new Error(`[${bossId}] typed motion/lifecycle debug fields are missing`)
    }
    const animationKey = String(runtime.animationKey ?? '')
    if (!animationKey.startsWith(`${runtime.blueprintId}_`) || animationKey === `${runtime.blueprintId}_shoot`) {
      throw new Error(
        `[${bossId}] expected an action-specific animation family for ${runtime.lastFiredAttackId}, got ${runtime.animationKey}`
      )
    }
    if (runtime.facing !== runtime.lockedFacing) {
      throw new Error(
        `[${bossId}] sprite facing ${runtime.facing} disagrees with locked attack facing ${runtime.lockedFacing}`
      )
    }
    if (Number(runtime.activeHazardCount ?? 0) > Number(runtime.roomDynamics?.maxActiveHazards ?? 0)) {
      throw new Error(`[${bossId}] exceeded the authored boss-room hazard cap`)
    }
  })
  if (!samples.some((sample) => Number(sample.runtime?.phaseIndex ?? 0) >= 1)) {
    throw new Error(`[${bossId}] phase-two transition was not observed during the visual sweep`)
  }

  return samples
}

async function captureMission(browser, slot, summary) {
  const { stageId, bossId, runtimeBossConfigId, direct } = slot
  const context = await browser.newContext()
  const page = await context.newPage()
  const dir = path.join(outputRoot, stageId)
  fs.mkdirSync(dir, { recursive: true })
  const startedAt = Date.now()
  let artifactsProduced = false

  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (error) => {
    errors.push({
      type: 'pageerror',
      text: String(error),
      stack: typeof error?.stack === 'string' ? error.stack : undefined
    })
  })

  await page.addInitScript((savePayload) => {
    window.localStorage.setItem('save.v1', JSON.stringify(savePayload))
  }, {
    weaponsUnlocked: ['HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob', 'AeroDarts', 'FrostShatter'],
    gameOverCounts: {},
    clearedBosses: [
      'pyro_maw',
      'tide_reaver',
      'volt_hopper',
      'basalt_titan',
      'ferro_blade',
      'mire_wraith',
      'gale_vixen',
      'glacier_ronin'
    ],
    tutorialCleared: true,
    finalBossCleared: false,
    gameCompleted: false,
    progressionWorld: null,
    stageAccessUnlocked: unlockedStageIds,
    collectedChecks: [],
    unlockedCheckpoints: {},
    selectedCheckpointByStage: {},
    upgradeUnlocks: ['armor_helmet', 'armor_arms', 'armor_body', 'armor_legs'],
    heartTanks: 8,
    subTanks: 4,
    pendingProgressionItems: [],
    activeRun: null
  })

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(350)
  if (direct) {
    await waitForState(page, (state) => state.scene === 'StageSelect', STAGE_SELECT_STATE_TIMEOUT_MS)
    await page.evaluate(
      (data) => {
        const stageSelect = window.__phaserGame?.scene?.getScene?.('StageSelect')
        stageSelect?.scene?.start?.('Game', data)
      },
      { stageId, bossId, runtimeBossConfigId }
    )
  } else {
    await moveSelectionToBoss(page, bossId)
    await page.keyboard.press('Enter')
  }

  try {
    const startState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.stageRuntime?.stageId === stageId &&
        state.newPlayer?.locomotion?.grounded === true,
      GAME_TRANSITION_TIMEOUT_MS,
      `[${stageId}] grounded transition into Game`
    )
    assertPreBossState(startState, stageId)
    fs.writeFileSync(path.join(dir, 'state-start.json'), JSON.stringify(startState, null, 2))
    await page.screenshot({ path: path.join(dir, 'start.png') })
    artifactsProduced = true

    const routeWidth = Number(startState.stageRuntime?.contentRetention?.routeWidth ?? 0)
    await page.evaluate((x) => window.stageDebug?.setPlayerX?.(x), Math.round(routeWidth * 0.5))
    await advanceFrames(page, 4)
    const midState = await readState(page)
    fs.writeFileSync(path.join(dir, 'state-mid.json'), JSON.stringify(midState, null, 2))
    await page.screenshot({ path: path.join(dir, 'mid.png') })

    await page.evaluate((x) => window.stageDebug?.setPlayerX?.(x), routeWidth - 64)
    await advanceFrames(page, 2)
    const preBossState = await readState(page)
    assertPreBossState(preBossState, stageId)
    fs.writeFileSync(path.join(dir, 'state-pre-boss.json'), JSON.stringify(preBossState, null, 2))
    await page.screenshot({ path: path.join(dir, 'pre-boss.png') })

    await page.evaluate(() => {
      window.stageDebug?.crossBossGate?.()
      window.stageDebug?.activateBossRoom?.()
      const room = window.__phaserGame?.scene?.getScenes(true)?.[0]?.activeBossRoom
      if (room) {
        window.stageDebug?.setPlayerX?.(room.x + room.width - 44)
      }
      window.bossDebug?.unlockIntro?.()
      window.stageDebug?.skipDialogue?.()
    })

    const bossRoomState = await waitForState(
      page,
      (state) => state.scene === 'Game' && state.stageRuntime?.bossRoom?.cameraLocked === true,
      GAME_TRANSITION_TIMEOUT_MS,
      `[${stageId}] boss-room camera lock`
    )
    assertBossRoomState(bossRoomState, stageId)
    fs.writeFileSync(path.join(dir, 'state-boss-room.json'), JSON.stringify(bossRoomState, null, 2))

    await sampleBossMovement(page, stageId, dir)
    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      const room = scene?.activeBossRoom
      if (room) window.stageDebug?.setPlayerX?.(room.x + 72)
    })
    await advanceFrames(page, 12)
    await page.screenshot({ path: path.join(dir, 'boss-room.png') })
    artifactsProduced = true

    if (errors.length > 0) {
      fs.writeFileSync(path.join(dir, 'errors.json'), JSON.stringify(errors, null, 2))
      throw new Error(`[${stageId}] browser errors captured during visual sweep`)
    }

    summary.missions.push({
      stageId,
      bossId,
      routeWidth,
      worldWidth: Number(startState.stageRuntime?.contentRetention?.worldWidth ?? 0),
      retained: startState.stageRuntime?.contentRetention?.retained ?? null,
      status: 'pass',
      durationMs: Date.now() - startedAt,
      artifactDir: dir,
      artifactsProduced
    })
    writeVisualSweepSummary(summary)
  } catch (error) {
    const classification = classifyVisualSweepError(error)
    summary.missions.push({
      stageId,
      bossId,
      status: classification === 'hung_after_artifacts' ? 'hung_after_artifacts' : 'fail',
      durationMs: Date.now() - startedAt,
      artifactDir: dir,
      artifactsProduced,
      error: serializeVisualSweepError(error)
    })
    writeVisualSweepSummary(summary)
    throw error
  } finally {
    await runWithTimeout(
      () => context.close(),
      `[${stageId}] browser context cleanup`,
      CLEANUP_TIMEOUT_MS,
      artifactsProduced ? 'hung_after_artifacts' : 'error'
    )
  }
}

async function main() {
  fs.rmSync(outputRoot, { recursive: true, force: true })
  fs.mkdirSync(outputRoot, { recursive: true })
  const summary = createVisualSweepSummary()
  writeVisualSweepSummary(summary)

  let vite = null
  try {
    await waitForServerReady(url, 1200)
  } catch {
    vite = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port), '--strictPort'], {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: {
        ...process.env,
        VITE_AUTOMATION: '1',
        VITE_SMOKE: '1'
      },
      shell: false
    })
    vite.stdout.on('data', (chunk) => process.stdout.write(`[vite] ${chunk}`))
    vite.stderr.on('data', (chunk) => process.stderr.write(`[vite] ${chunk}`))
    await waitForServerReady(url)
  }

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })

  try {
    for (const slot of missionSlots) {
      await captureMission(browser, slot, summary)
    }
    summary.status = 'pass'
  } finally {
    let cleanupError = null
    try {
      await runWithTimeout(() => browser.close(), 'Browser cleanup', CLEANUP_TIMEOUT_MS, 'hung_after_artifacts')
    } catch (error) {
      cleanupError = error
    }

    try {
      await stopChildProcess(vite, 'Visual sweep dev server')
    } catch (error) {
      cleanupError ??= error
    }

    if (cleanupError) {
      summary.status = 'hung_after_artifacts'
      summary.error = serializeVisualSweepError(cleanupError)
    } else if (summary.status === 'running') {
      summary.status = 'fail'
    }

    summary.completedAt = new Date().toISOString()
    writeVisualSweepSummary(summary)

    if (cleanupError) {
      throw cleanupError
    }
  }

  console.log(`Mission visual sweep complete. Artifacts: ${outputRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
