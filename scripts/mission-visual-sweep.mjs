import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const host = '127.0.0.1'
const port = Number(process.env.SWEEP_PORT ?? 4173)
const url = `http://${host}:${port}?renderer=canvas&startScene=StageSelect`
const outputRoot = path.resolve('output/mission-visual-sweep')

const missionSlots = [
  { bossId: 'pyro_maw' },
  { bossId: 'tide_reaver' },
  { bossId: 'volt_hopper' },
  { bossId: 'basalt_titan' },
  { bossId: 'ferro_blade' },
  { bossId: 'mire_wraith' },
  { bossId: 'gale_vixen' },
  { bossId: 'glacier_ronin' }
]

const indexByBossId = new Map(missionSlots.map((slot, index) => [slot.bossId, index]))

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

async function waitForState(page, predicate, timeoutMs = 5000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    await advanceFrames(page, 2)
    const state = await readState(page)
    if (state && predicate(state)) {
      return state
    }
    await page.waitForTimeout(25)
  }
  throw new Error(`Timed out waiting for state condition after ${timeoutMs}ms`)
}

async function moveSelectionToBoss(page, bossId) {
  let state = await waitForState(page, (next) => next.scene === 'StageSelect' && next.stageSelect?.selectedBossId)

  for (let attempt = 0; attempt < missionSlots.length + 2; attempt += 1) {
    if (state.stageSelect?.selectedBossId === bossId) {
      return state
    }

    const currentIndex = indexByBossId.get(state.stageSelect?.selectedBossId ?? '') ?? 0
    const targetIndex = indexByBossId.get(bossId) ?? 0
    const delta = (targetIndex - currentIndex + missionSlots.length) % missionSlots.length
    const key = delta > 0 && delta <= missionSlots.length / 2 ? 'ArrowRight' : 'ArrowLeft'

    await page.keyboard.press(key)
    await advanceFrames(page, 6)
    state = await waitForState(page, (next) => next.scene === 'StageSelect' && next.stageSelect?.selectedBossId)
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
}

function assertBossRoomState(state, bossId) {
  if (!state.stageRuntime?.bossRoom?.cameraLocked) {
    throw new Error(`[${bossId}] expected boss-room camera lock to be active`)
  }
  if (!state.stageRuntime?.bossEncounterActive) {
    throw new Error(`[${bossId}] expected boss encounter to be active`)
  }
}

async function sampleBossMovement(page, bossId) {
  const samples = []

  for (let index = 0; index < 8; index += 1) {
    await advanceFrames(page, 20)
    const sample = await page.evaluate(() => {
      const game = window.__phaserGame
      const scene = game?.scene?.getScenes(true)?.[0]
      const bossRoom = scene?.activeBossRoom ?? null
      return {
        bossX: Math.round(scene?.bossController?.x ?? scene?.bossTarget?.x ?? 0),
        playerX: Math.round(scene?.player?.x ?? 0),
        bossRoom,
        cameraLocked: Boolean(scene?.bossRoomCameraLocked)
      }
    })
    samples.push(sample)
  }

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

  return samples
}

async function captureMission(browser, bossId) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const dir = path.join(outputRoot, bossId)
  fs.mkdirSync(dir, { recursive: true })

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

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(350)
  await moveSelectionToBoss(page, bossId)
  await page.keyboard.press('Enter')

  const preBossState = await waitForState(page, (state) => state.scene === 'Game')
  assertPreBossState(preBossState, bossId)
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
  })

  const bossRoomState = await waitForState(
    page,
    (state) => state.scene === 'Game' && state.stageRuntime?.bossRoom?.cameraLocked === true,
    6000
  )
  assertBossRoomState(bossRoomState, bossId)
  fs.writeFileSync(path.join(dir, 'state-boss-room.json'), JSON.stringify(bossRoomState, null, 2))

  const samples = await sampleBossMovement(page, bossId)
  fs.writeFileSync(path.join(dir, 'boss-movement-samples.json'), JSON.stringify(samples, null, 2))
  await page.screenshot({ path: path.join(dir, 'boss-room.png') })

  if (errors.length > 0) {
    fs.writeFileSync(path.join(dir, 'errors.json'), JSON.stringify(errors, null, 2))
    throw new Error(`[${bossId}] browser errors captured during visual sweep`)
  }

  await context.close()
}

async function main() {
  fs.rmSync(outputRoot, { recursive: true, force: true })
  fs.mkdirSync(outputRoot, { recursive: true })

  let vite = null
  try {
    await waitForServerReady(url, 1200)
  } catch {
    vite = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port), '--strictPort'], {
      stdio: 'pipe',
      cwd: process.cwd(),
      env: process.env,
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
      await captureMission(browser, slot.bossId)
    }
  } finally {
    await browser.close()
    if (vite && !vite.killed) {
      vite.kill('SIGTERM')
    }
  }

  console.log(`Mission visual sweep complete. Artifacts: ${outputRoot}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
