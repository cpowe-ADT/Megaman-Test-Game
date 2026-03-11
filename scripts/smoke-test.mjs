import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { chromium } from 'playwright'

const host = '127.0.0.1'
const port = Number(process.env.SMOKE_PORT ?? 4173)
const url = `http://${host}:${port}?renderer=canvas&startScene=StageSelect`
const titleUrl = `http://${host}:${port}?renderer=canvas`
const outputDir = path.resolve('output/web-game-smoke')
const localClient = path.resolve('scripts/web_game_playwright_client.js')
const defaultClient = path.join(
  os.homedir(),
  '.codex',
  'skills',
  'develop-web-game',
  'scripts',
  'web_game_playwright_client.js'
)
const webGameClient = process.env.WEB_GAME_CLIENT ?? (fs.existsSync(localClient) ? localClient : defaultClient)
const robotMasterStageIds = [
  'pyro_maw',
  'tide_reaver',
  'volt_hopper',
  'basalt_titan',
  'ferro_blade',
  'mire_wraith',
  'gale_vixen',
  'glacier_ronin'
]

const clickOnlyActions = {
  steps: [
    { buttons: [], frames: 20 },
    { buttons: ['left_mouse_button'], frames: 2, mouse_x: 52, mouse_y: 84 },
    { buttons: [], frames: 30 }
  ]
}

const keyboardSelectThenEnterActions = {
  steps: [
    { buttons: [], frames: 20 },
    { buttons: ['right'], frames: 3 },
    { buttons: [], frames: 4 },
    { buttons: ['enter'], frames: 2 },
    { buttons: [], frames: 70 }
  ]
}

const enterThenChargeShotActions = {
  steps: [
    { buttons: [], frames: 20 },
    { buttons: ['enter'], frames: 2 },
    { buttons: [], frames: 80 },
    { buttons: ['x'], frames: 45 },
    { buttons: [], frames: 40 }
  ]
}

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
      // Keep polling until server comes up.
    }
    await new Promise((resolve) => setTimeout(resolve, 300))
  }
  throw new Error(`Dev server did not become ready at ${targetUrl} within ${timeoutMs}ms`)
}

function collectScenarioErrors(dir) {
  const files = fs.readdirSync(dir)
  return files.filter((file) => file.startsWith('errors-') && file.endsWith('.json'))
}

function readScenarioStates(dir) {
  const files = fs
    .readdirSync(dir)
    .filter((file) => file.startsWith('state-') && file.endsWith('.json'))
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))

  return files.map((file) => {
    const raw = fs.readFileSync(path.join(dir, file), 'utf8')
    return JSON.parse(raw)
  })
}

async function runScenario(name, actions, iterations = 2) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  await run('node', [
    webGameClient,
    '--url',
    url,
    '--actions-json',
    JSON.stringify(actions),
    '--iterations',
    String(iterations),
    '--pause-ms',
    '250',
    '--screenshot-dir',
    scenarioDir
  ])

  const errorFiles = collectScenarioErrors(scenarioDir)
  if (errorFiles.length > 0) {
    const firstErrorPath = path.join(scenarioDir, errorFiles[0])
    const details = fs.readFileSync(firstErrorPath, 'utf8')
    throw new Error(`Smoke test found browser errors in ${firstErrorPath}:\n${details}`)
  }

  const states = readScenarioStates(scenarioDir)
  if (states.length === 0) {
    throw new Error(`Smoke test scenario '${name}' did not produce any state-*.json outputs.`)
  }

  return { scenarioDir, states }
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

async function waitForPageCheck(page, predicate, timeoutMs = 5000) {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    await advanceFrames(page, 2)
    const passed = await page.evaluate(predicate)
    if (passed) {
      return
    }
    await page.waitForTimeout(25)
  }
  throw new Error(`Timed out waiting for page condition after ${timeoutMs}ms`)
}

async function clickCanvas(page, x, y) {
  const canvas = await page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) {
    throw new Error('Expected visible canvas while attempting click')
  }
  await page.mouse.click(box.x + x, box.y + y)
}

async function tapKey(page, key, holdFrames = 2) {
  await page.keyboard.down(key)
  await advanceFrames(page, holdFrames)
  await page.keyboard.up(key)
}

async function runVictoryReturnScenario(name, confirmMode) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate && window.bossDebug?.damage))
    await page.evaluate(() => {
      window.stageDebug?.crossBossGate?.()
      window.bossDebug?.unlockIntro?.()
      window.bossDebug?.damage?.(999)
    })

    await waitForState(page, (state) => state.scene === 'Game' && state.victory?.modalOpen === true)

    if (confirmMode === 'enter') {
      await tapKey(page, 'Enter')
      const stageSelectState = await waitForState(page, (state) => state.scene === 'StageSelect')
      if (stageSelectState.stageSelect?.transitionPending) {
        throw new Error('StageSelect should be idle after the victory modal closes, before the next fresh Enter.')
      }
      await waitForState(page, (state) => state.scene === 'StageSelect' && state.stageSelect?.confirmArmed === true)
    } else if (confirmMode === 'numpad_enter') {
      await tapKey(page, 'NumpadEnter')
      await waitForState(page, (state) => state.scene === 'StageSelect' && state.stageSelect?.confirmArmed === true)
    } else if (confirmMode === 'escape') {
      await tapKey(page, 'Escape')
      await waitForState(page, (state) => state.scene === 'StageSelect' && state.stageSelect?.confirmArmed === true)
    } else if (confirmMode === 'click') {
      await clickCanvas(page, 224, 184)
      await waitForState(page, (state) => state.scene === 'StageSelect')
    } else {
      throw new Error(`Unknown confirm mode '${confirmMode}'`)
    }

    await advanceFrames(page, 8)
    await tapKey(page, 'Enter')
    const stageSelectAfterBlockedConfirm = await waitForState(
      page,
      (state) => state.scene === 'StageSelect' && state.stageSelect?.transitionPending === false
    )
    await tapKey(page, 'ArrowRight')
    await advanceFrames(page, 4)
    await tapKey(page, 'Enter')
    const finalState = await waitForState(page, (state) => state.scene === 'Game')

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(
      path.join(scenarioDir, 'state-0.json'),
      JSON.stringify({ stageSelectAfterBlockedConfirm, finalState }, null, 2)
    )

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runChargeShotScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await page.keyboard.down('x')
    await advanceFrames(page, 45)
    await page.keyboard.up('x')
    await advanceFrames(page, 20)

    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        typeof state.playerState?.hp === 'number' &&
        typeof state.playerState?.maxHp === 'number' &&
        typeof state.combatDebug?.player?.chargeMs === 'number'
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runKeyboardEnterStartScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'ArrowRight')
    await advanceFrames(page, 8)
    await tapKey(page, 'Enter')

    const finalState = await waitForState(page, (state) => state.scene === 'Game')

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runBossRoomActivationScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    const initialGameState = await waitForState(page, (state) => state.scene === 'Game')
    if (initialGameState.stageRuntime?.bossEncounterActive !== false) {
      throw new Error('Expected boss encounter to remain inactive at stage start.')
    }

    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate))
    await page.evaluate(() => window.stageDebug?.crossBossGate?.())

    const finalState = await waitForState(
      page,
      (state) => state.scene === 'Game' && state.stageRuntime?.bossEncounterActive === true
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runCheckpointRespawnScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')

    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossNextCheckpoint))
    await page.evaluate(() => window.stageDebug?.crossNextCheckpoint?.())

    const checkpointState = await waitForState(
      page,
      (state) => state.scene === 'Game' && Number(state.stageRuntime?.checkpointIndex ?? 0) >= 1
    )
    if ((checkpointState.player?.x ?? 0) < 120) {
      throw new Error('Expected player to advance far enough to reach the checkpoint trigger.')
    }
    const expectedRespawnX = Number(checkpointState.player?.x ?? 0)

    await waitForPageCheck(page, () => Boolean(window.stageDebug?.forcePlayerDeath))
    await page.evaluate(() => window.stageDebug?.forcePlayerDeath?.())

    const respawnState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.stageRuntime?.checkpointIndex ?? 0) >= 1 &&
        Number(state.playerState?.lives ?? 0) === 2 &&
        Number(state.playerState?.hp ?? 0) === Number(state.playerState?.maxHp ?? -1) &&
        Number(state.player?.x ?? 0) >= expectedRespawnX - 48 &&
        Number(state.player?.x ?? 0) <= expectedRespawnX + 48,
      6000
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(respawnState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runEnemyStreamingScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    const initialState = await waitForState(page, (state) => state.scene === 'Game')

    const initialStream = initialState.enemySpawner
    if (!initialStream || Number(initialStream.totalMarkers ?? 0) < 3) {
      throw new Error('Expected stage enemy stream metadata with at least 3 authored markers.')
    }
    if (Number(initialStream.activeMarkers ?? 0) >= Number(initialStream.totalMarkers ?? 0)) {
      throw new Error('Expected stage start to stream only part of the enemy roster, not all markers at once.')
    }

    await waitForPageCheck(page, () => Boolean(window.stageDebug?.setPlayerX))
    await page.evaluate(() => window.stageDebug?.setPlayerX?.(150))

    const midState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.enemySpawner?.activeMarkers ?? 0) >= 1 &&
        Number(state.enemySpawner?.activeMarkers ?? 0) <= Number(state.enemySpawner?.totalMarkers ?? 0)
    )

    await page.evaluate(() => window.stageDebug?.setPlayerX?.(250))

    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.enemySpawner?.retiredMarkers ?? 0) >= 1 &&
        Number(state.enemySpawner?.activeMarkers ?? 0) >= 1,
      6000
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(
      path.join(scenarioDir, 'state-0.json'),
      JSON.stringify({ initialState, midState, finalState }, null, 2)
    )

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runFinalRouteUnlockScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.addInitScript((savePayload) => {
    window.localStorage.setItem('save.v1', JSON.stringify(savePayload))
  }, {
    weaponsUnlocked: ['FlameSerpent', 'HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob', 'AeroDarts', 'FrostShatter'],
    gameOverCounts: {},
    clearedBosses: robotMasterStageIds,
    tutorialCleared: true,
    finalBossCleared: false,
    gameCompleted: false,
    activeRun: null
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'f')

    const finalState = await waitForState(
      page,
      (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'omega_fortress'
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runWeaponSwitchAndEnergyScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'save.v1',
      JSON.stringify({
        weaponsUnlocked: ['FlameSerpent'],
        gameOverCounts: {},
        clearedBosses: [],
        tutorialCleared: false,
        finalBossCleared: false,
        gameCompleted: false,
        activeRun: null
      })
    )
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')

    await tapKey(page, 'e')
    const switchedState = await waitForState(
      page,
      (state) => state.scene === 'Game' && state.playerState?.weapon === 'FlameSerpent'
    )
    const startingEnergy = Number(switchedState.weaponEnergy?.current ?? -1)
    const maxEnergy = Number(switchedState.weaponEnergy?.max ?? -1)
    if (startingEnergy <= 0 || maxEnergy <= 0) {
      throw new Error('Expected switched special weapon to expose positive current/max weapon energy.')
    }

    await tapKey(page, 'x', 3)
    const firedState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.playerState?.weapon === 'FlameSerpent' &&
        Number(state.weaponEnergy?.current ?? 999) < startingEnergy &&
        Number(state.projectiles?.playerActive ?? 0) >= 1,
      6000
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(
      path.join(scenarioDir, 'state-0.json'),
      JSON.stringify({ switchedState, firedState }, null, 2)
    )

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runLoadSaveRestoreScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'save.v1',
      JSON.stringify({
        weaponsUnlocked: ['FlameSerpent'],
        gameOverCounts: {},
        clearedBosses: [],
        tutorialCleared: true,
        finalBossCleared: false,
        gameCompleted: false,
        activeRun: {
          version: 2,
          savedAt: Date.now(),
          stageId: 'tide_reaver',
          bossId: 'tide_reaver',
          playerHp: 6,
          playerMaxHp: 8,
          playerLives: 2,
          currentWeaponIndex: 1,
          currentWeaponId: 'FlameSerpent',
          weaponEnergyById: {
            Buster: 28,
            FlameSerpent: 17
          }
        }
      })
    )
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Escape')
    await waitForPageCheck(page, () => Boolean(window.__phaserGame?.scene?.isActive?.('SystemMenu')))
    await tapKey(page, 'Enter')

    const loadedState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.stageRuntime?.stageId === 'tide_reaver' &&
        state.activeRun?.loadedFromSave === true &&
        state.playerState?.weapon === 'FlameSerpent' &&
        Number(state.weaponEnergy?.current ?? -1) === 17 &&
        Number(state.playerState?.lives ?? -1) === 2 &&
        Number(state.playerState?.hp ?? -1) === 6,
      6000
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(loadedState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runCompletionReturnScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.addInitScript((savePayload) => {
    window.localStorage.setItem('save.v1', JSON.stringify(savePayload))
  }, {
    weaponsUnlocked: ['FlameSerpent', 'HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob', 'AeroDarts', 'FrostShatter'],
    gameOverCounts: {},
    clearedBosses: robotMasterStageIds,
    tutorialCleared: true,
    finalBossCleared: false,
    gameCompleted: false,
    activeRun: null
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'f')
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'omega_fortress')
    await waitForPageCheck(page, () => Boolean(window.bossDebug?.forceVictory))
    await page.evaluate(() => window.bossDebug?.forceVictory?.())

    await waitForState(page, (state) => state.scene === 'Game' && state.victory?.modalOpen === true)
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'CompletionScene')
    await tapKey(page, 'Enter')
    const finalState = await waitForState(page, (state) => state.scene === 'StageSelect')

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runMenuAudioInputScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'save.v1',
      JSON.stringify({
        weaponsUnlocked: [],
        gameOverCounts: {},
        clearedBosses: [],
        tutorialCleared: true,
        finalBossCleared: false,
        gameCompleted: false,
        activeRun: null
      })
    )
  })

  try {
    await page.goto(titleUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    const titleState = await waitForState(page, (state) => state.scene === 'Title')
    if (!titleState.audio || typeof titleState.audio.unlocked !== 'boolean' || titleState.audio.enabled !== true) {
      throw new Error('Expected title payload to expose audio enabled/unlocked state.')
    }

    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'StageSelect')

    await tapKey(page, 'Escape')
    await waitForPageCheck(page, () => Boolean(window.__phaserGame?.scene?.isActive?.('SystemMenu')))
    await tapKey(page, 'Escape')
    await waitForPageCheck(page, () => !window.__phaserGame?.scene?.isActive?.('SystemMenu'))

    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await waitForPageCheck(page, () => Boolean(window.__phaserGame?.scene?.keys?.GameOver))
    await page.evaluate(() => {
      window.__phaserGame?.scene?.stop?.('Game')
      window.__phaserGame?.scene?.start?.('GameOver', { stageId: 'pyro_maw' })
    })

    await waitForPageCheck(page, () => Boolean(window.__phaserGame?.scene?.isActive?.('GameOver')))
    await tapKey(page, 'Enter')
    const finalState = await waitForState(page, (state) => state.scene === 'Game')

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runMusicCueScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'save.v1',
      JSON.stringify({
        weaponsUnlocked: [],
        gameOverCounts: {},
        clearedBosses: [],
        tutorialCleared: true,
        finalBossCleared: false,
        gameCompleted: false,
        activeRun: null
      })
    )
  })

  try {
    await page.goto(titleUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'Title' && state.audio?.musicCue === 'title')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'StageSelect' && state.audio?.musicCue === 'stage_select')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game' && state.audio?.musicCue === 'stage')
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate))
    await page.evaluate(() => window.stageDebug?.crossBossGate?.())
    await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.stageRuntime?.bossEncounterActive === true &&
        state.audio?.musicCue === 'boss'
    )
    await waitForPageCheck(page, () => Boolean(window.bossDebug?.forceVictory))
    await page.evaluate(() => window.bossDebug?.forceVictory?.())
    await waitForState(page, (state) => state.scene === 'Game' && state.victory?.modalOpen === true && state.audio?.musicCue === null)
    await tapKey(page, 'Enter')
    const finalState = await waitForState(
      page,
      (state) => state.scene === 'StageSelect' && state.audio?.musicCue === 'stage_select'
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runProjectileClashScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.spawnProjectileClash))
    await page.evaluate(() => window.stageDebug?.spawnProjectileClash?.())

    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.projectiles?.playerActive ?? -1) === 0 &&
        Number(state.projectiles?.bossActive ?? -1) === 0
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runProjectileClashSurviveScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.spawnProjectileClash))
    await page.evaluate(() => window.stageDebug?.spawnProjectileClash?.({ strong: true }))

    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.projectiles?.bossActive ?? -1) === 0 &&
        Number(state.projectiles?.playerActive ?? 0) >= 1 &&
        Boolean(
          state.combatDebug?.recentHits?.some?.((hit) => hit?.note === 'projectile-clash-survive')
        ),
      3000
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runPickupRecoveryScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.addInitScript(() => {
    window.localStorage.setItem('save.v1', JSON.stringify({
      weaponsUnlocked: ['FlameSerpent'],
      gameOverCounts: {},
      clearedBosses: [],
      tutorialCleared: false,
      finalBossCleared: false,
      gameCompleted: false,
      activeRun: null
    }))
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await tapKey(page, 'd')

    await waitForState(
      page,
      (state) => state.scene === 'Game' && state.playerState?.weapon === 'FlameSerpent'
    )

    await tapKey(page, 'x')
    const spentState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.playerState?.weapon === 'FlameSerpent' &&
        Number(state.weaponEnergy?.current ?? 99) < Number(state.weaponEnergy?.max ?? 0)
    )

    await waitForPageCheck(page, () => Boolean(window.stageDebug?.damagePlayer && window.stageDebug?.spawnPickup))
    await page.evaluate(() => {
      window.stageDebug?.damagePlayer?.(3)
      window.stageDebug?.spawnPickup?.('health')
      window.stageDebug?.spawnPickup?.('ammo')
    })

    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.playerState?.hp ?? 0) > Number(spentState.playerState?.hp ?? 0) - 3 &&
        Number(state.weaponEnergy?.current ?? 0) > Number(spentState.weaponEnergy?.current ?? 0),
      4000
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify({ spentState, finalState }, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runBossGateLockScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate && window.stageDebug?.bossGateState))
    await page.evaluate(() => window.stageDebug?.crossBossGate?.())

    const activatedState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.stageRuntime?.bossEncounterActive === true &&
        state.stageRuntime?.bossGateLocked === true
    )

    const gateX = Number(activatedState.stageRuntime?.bossGateX ?? 0)
    await page.evaluate((targetX) => window.stageDebug?.setPlayerX?.(targetX), gateX + 72)
    await advanceFrames(page, 8)
    await page.keyboard.down('ArrowLeft')
    await advanceFrames(page, 60)
    await page.keyboard.up('ArrowLeft')

    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.stageRuntime?.bossGateLocked === true &&
        Number(state.player?.x ?? -1) >= gateX + 8,
      3000
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify({ activatedState, finalState }, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runFinalUnlockFromLastClearScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.addInitScript((savePayload) => {
    window.localStorage.setItem('save.v1', JSON.stringify(savePayload))
  }, {
    weaponsUnlocked: ['HydroLance', 'ThunderSpike', 'QuakeKnuckle', 'MagcutDisc', 'AcidGlob', 'AeroDarts', 'FrostShatter'],
    gameOverCounts: {},
    clearedBosses: robotMasterStageIds.filter((id) => id !== 'pyro_maw'),
    tutorialCleared: true,
    finalBossCleared: false,
    gameCompleted: false,
    activeRun: null
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'pyro_maw')
    await waitForPageCheck(page, () => Boolean(window.bossDebug?.forceVictory))
    await page.evaluate(() => window.bossDebug?.forceVictory?.())
    await waitForState(page, (state) => state.scene === 'Game' && state.victory?.modalOpen === true)
    await tapKey(page, 'Enter')

    const stageSelectState = await waitForState(page, (state) => state.scene === 'StageSelect')
    const saveState = await page.evaluate(() => JSON.parse(window.localStorage.getItem('save.v1') ?? '{}'))
    if (!Array.isArray(saveState.clearedBosses) || saveState.clearedBosses.length < 8) {
      throw new Error('Expected the last live boss clear to persist all 8 cleared robot masters.')
    }
    if (!saveState.weaponsUnlocked?.includes?.('FlameSerpent')) {
      throw new Error('Expected the last live boss clear to unlock FlameSerpent.')
    }
    if (saveState.activeRun !== null) {
      throw new Error('Expected the last live boss clear to clear any stale active run snapshot.')
    }

    await tapKey(page, 'f')
    const finalRouteState = await waitForState(
      page,
      (state) => state.scene === 'Game' && state.stageRuntime?.stageId === 'omega_fortress'
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(
      path.join(scenarioDir, 'state-0.json'),
      JSON.stringify({ stageSelectState, saveState, finalRouteState }, null, 2)
    )

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runBossRoomRespawnScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate))
    await page.evaluate(() => window.stageDebug?.crossBossGate?.())

    const activeBossRoomState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.stageRuntime?.bossEncounterActive === true &&
        state.stageRuntime?.bossGateLocked === true
    )
    const gateX = Number(activeBossRoomState.stageRuntime?.bossGateX ?? 0)

    await waitForPageCheck(page, () => Boolean(window.stageDebug?.spawnHostileProjectile))
    await page.evaluate(() => window.stageDebug?.spawnHostileProjectile?.())
    await waitForState(page, (state) => state.scene === 'Game' && Number(state.projectiles?.bossActive ?? 0) >= 1)

    await waitForPageCheck(page, () => Boolean(window.stageDebug?.forcePlayerDeath))
    await page.evaluate(() => window.stageDebug?.forcePlayerDeath?.())

    const respawnState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.stageRuntime?.bossEncounterActive === true &&
        state.stageRuntime?.bossGateLocked === true &&
        Number(state.playerState?.lives ?? 0) === 2 &&
        Number(state.playerState?.hp ?? 0) === Number(state.playerState?.maxHp ?? -1) &&
        Number(state.player?.x ?? -1) >= gateX + 8 &&
        Number(state.projectiles?.bossActive ?? -1) === 0,
      6000
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(
      path.join(scenarioDir, 'state-0.json'),
      JSON.stringify({ activeBossRoomState, respawnState }, null, 2)
    )

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runExtendedStageScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game')
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossNextCheckpoint))
    await page.evaluate(() => {
      window.stageDebug?.crossNextCheckpoint?.()
    })
    await waitForState(page, (state) => state.scene === 'Game' && Number(state.stageRuntime?.checkpointIndex ?? -1) >= 1)
    await page.evaluate(() => {
      window.stageDebug?.crossNextCheckpoint?.()
    })

    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.stageRuntime?.checkpointIndex ?? -1) >= 2 &&
        Number(state.player?.x ?? -1) > 448
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function captureScenarioState(page, scenarioDir, index, state) {
  await page.screenshot({ path: path.join(scenarioDir, `shot-${index}.png`) })
  fs.writeFileSync(path.join(scenarioDir, `state-${index}.json`), JSON.stringify(state, null, 2))
}

function hasAcceptedMeleeHit(state, target) {
  const recentHits = state?.combatDebug?.recentHits
  if (!Array.isArray(recentHits)) {
    return false
  }

  return recentHits.some((hit) => hit?.accepted === true && hit?.kind === 'melee' && hit?.target === target)
}

function findEnemy(state, typeKey = 'enemy_gunner_bot') {
  const enemies = Array.isArray(state?.enemies) ? state.enemies : []
  return enemies.find((enemy) => enemy?.typeKey === typeKey) ?? null
}

async function openGameplayPage(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await browser.newPage()
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({
      type: 'pageerror',
      text: String(err),
      stack: typeof err?.stack === 'string' ? err.stack : undefined
    })
  })

  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await waitForState(page, (state) => state.scene === 'StageSelect', 8000)
  await tapKey(page, 'Enter')
  await waitForState(page, (state) => state.scene === 'Game', 8000)

  return { browser, page, scenarioDir, errors }
}

async function closeGameplayPage(browser, scenarioDir, errors) {
  try {
    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runGroundSwordEnemyScenario(name, moving = false) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)

  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await waitForPageCheck(page, () => Boolean(window.spawnEnemyDebug))
    if (moving) {
      await page.keyboard.down('ArrowRight')
      await advanceFrames(page, 10)
    }
    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      const x = Number(scene?.player?.x ?? 0) + 28
      const y = Number(scene?.player?.y ?? 0) - 4
      window.spawnEnemyDebug?.('enemy_gunner_bot', x, y)
    })
    await advanceFrames(page, 8)
    await tapKey(page, 'c', 2)
    const baselineEnemyHp = 4
    const slashState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.newPlayer?.visuals?.animationKey === 'player_slash_ground_e' &&
        String(state.playerVisual?.frameName ?? '').startsWith('player_main/slash_ground_e/') &&
        state.newPlayer?.visuals?.activeHitbox?.direction === 'e' &&
        (!moving || Number(state.player?.vx ?? 0) >= 0),
      2500
    )
    await captureScenarioState(page, scenarioDir, 0, slashState)

    if (!moving) {
      const damageState = await waitForState(
        page,
        (state) => state.scene === 'Game' && Number(findEnemy(state)?.hp ?? baselineEnemyHp) < baselineEnemyHp,
        5000
      )
      await captureScenarioState(page, scenarioDir, 1, damageState)
    }
  } finally {
    if (moving) {
      await page.keyboard.up('ArrowRight').catch(() => {})
    }
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function runAirSwordDirectionScenario(name, direction) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)

  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await tapKey(page, 'Space', 2)
    await advanceFrames(page, 6)
    const key = direction === 'n' ? 'ArrowUp' : 'ArrowDown'
    await page.keyboard.down(key)
    await tapKey(page, 'c', 2)
    await advanceFrames(page, 6)
    const expectedAnimation = `player_slash_air_${direction}`
    const expectedFramePrefix = `player_main/slash_air_${direction}/`
    const finalState = await readState(page)
    if (
      finalState?.scene !== 'Game' ||
      finalState?.newPlayer?.visuals?.animationKey !== expectedAnimation ||
      !String(finalState?.playerVisual?.frameName ?? '').startsWith(expectedFramePrefix) ||
      finalState?.newPlayer?.visuals?.activeHitbox?.direction !== direction
    ) {
      throw new Error(
        `Expected airborne slash '${direction}' but observed ${JSON.stringify(finalState?.newPlayer?.visuals ?? null)}`
      )
    }
    await captureScenarioState(page, scenarioDir, 0, finalState)
    await page.keyboard.up(key)
  } finally {
    await page.keyboard.up('ArrowUp').catch(() => {})
    await page.keyboard.up('ArrowDown').catch(() => {})
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function runBossSwordScenario(name) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)

  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate))
    await page.evaluate(() => {
      window.stageDebug?.crossBossGate?.()
      window.stageDebug?.activateBossRoom?.()
      window.bossDebug?.unlockIntro?.()
    })

    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.bossRoom?.cameraLocked === true, 6000)
    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      const boss = scene?.bossTarget ?? scene?.bossBody
      const player = scene?.player
      if (boss && player) {
        player.setPosition(boss.x - 26, boss.y + 8)
      }
    })
    await advanceFrames(page, 8)
    await tapKey(page, 'c', 2)
    const bossHpBefore = await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      return Number(scene?.bossHp?.current ?? scene?.bossController?.hp ?? 0)
    })
    const slashState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.newPlayer?.visuals?.animationKey === 'player_slash_ground_e' &&
        String(state.playerVisual?.frameName ?? '').startsWith('player_main/slash_ground_e/') &&
        state.newPlayer?.visuals?.activeHitbox?.direction === 'e',
      2500
    )
    await captureScenarioState(page, scenarioDir, 0, slashState)
    const damageState = await waitForState(
      page,
      (state) => state.scene === 'Game' && Number(state.bossState?.hp?.current ?? bossHpBefore) < bossHpBefore,
      5000
    )
    await captureScenarioState(page, scenarioDir, 1, damageState)
  } finally {
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function main() {
  if (!fs.existsSync(webGameClient)) {
    throw new Error(`Missing Playwright client script at ${webGameClient}`)
  }

  fs.rmSync(outputDir, { recursive: true, force: true })
  fs.mkdirSync(outputDir, { recursive: true })

  const vite = spawn('npm', ['run', 'dev', '--', '--host', host, '--port', String(port), '--strictPort'], {
    stdio: 'pipe',
    cwd: process.cwd(),
    env: process.env,
    shell: false
  })

  const relay = (chunk) => {
    process.stdout.write(`[vite] ${chunk}`)
  }
  const relayErr = (chunk) => {
    process.stderr.write(`[vite] ${chunk}`)
  }

  vite.stdout.on('data', relay)
  vite.stderr.on('data', relayErr)

  try {
    await waitForServerReady(url)

    const clickOnly = await runScenario('1-click-select', clickOnlyActions, 1)
    const clickOnlyLast = clickOnly.states[clickOnly.states.length - 1]

    if (clickOnlyLast.scene !== 'StageSelect') {
      throw new Error(`Expected click-only scenario to stay on StageSelect, got ${clickOnlyLast.scene}`)
    }

    const selectedBoss = clickOnlyLast.stageSelect?.selectedBossId
    if (selectedBoss !== 'pyro_maw') {
      throw new Error(`Expected click-only scenario to remain on pyro_maw, got ${selectedBoss ?? 'null'}`)
    }

    await runKeyboardEnterStartScenario('2-keyboard-enter-start')

    await runChargeShotScenario('3-enter-then-charge-shot')
    const shootLast = JSON.parse(
      fs.readFileSync(path.join(outputDir, '3-enter-then-charge-shot', 'state-0.json'), 'utf8')
    )
    if (typeof shootLast.playerState?.hp !== 'number' || typeof shootLast.playerState?.maxHp !== 'number') {
      throw new Error('Expected Game state payload to expose numeric player HP and max HP.')
    }
    if (!shootLast.combatDebug || typeof shootLast.combatDebug !== 'object') {
      throw new Error('Expected Game state payload to expose combatDebug snapshot.')
    }
    if (
      typeof shootLast.combatDebug?.player?.dashCooldownMs !== 'number' ||
      typeof shootLast.combatDebug?.player?.chargeMs !== 'number'
    ) {
      throw new Error('Expected combatDebug.player timers (dashCooldownMs/chargeMs) in state payload.')
    }
    if (!shootLast.visuals || typeof shootLast.visuals !== 'object') {
      throw new Error('Expected Game state payload to expose visuals snapshot counters.')
    }
    if (
      typeof shootLast.visuals?.placeholderCount !== 'number' ||
      typeof shootLast.visuals?.missingAtlasCount !== 'number' ||
      typeof shootLast.visuals?.nonPixelFilteredCount !== 'number'
    ) {
      throw new Error(
        'Expected visuals counters (placeholderCount/missingAtlasCount/nonPixelFilteredCount) in state payload.'
      )
    }

    await runVictoryReturnScenario('4-boss-clear-enter-return', 'enter')
    await runVictoryReturnScenario('5-boss-clear-numpad-return', 'numpad_enter')
    await runVictoryReturnScenario('6-boss-clear-escape-return', 'escape')
    await runBossRoomActivationScenario('7-boss-room-activation')
    await runCheckpointRespawnScenario('8-checkpoint-respawn')
    await runEnemyStreamingScenario('9-enemy-streaming')
    await runFinalRouteUnlockScenario('10-final-route-unlock')
    await runWeaponSwitchAndEnergyScenario('11-weapon-switch-energy')
    await runLoadSaveRestoreScenario('12-load-save-restores-weapon-energy')
    await runCompletionReturnScenario('13-completion-return-flow')
    await runMenuAudioInputScenario('14-menu-audio-and-input-stability')
    await runMusicCueScenario('15-music-cue-flow')
    await runProjectileClashScenario('16-projectile-clash')
    await runExtendedStageScenario('17-extended-stage-scroll')
    await runProjectileClashSurviveScenario('18-projectile-clash-survive')
    await runPickupRecoveryScenario('19-pickup-recovery')
    await runBossGateLockScenario('20-boss-gate-lock')
    await runFinalUnlockFromLastClearScenario('21-final-unlock-from-last-clear')
    await runBossRoomRespawnScenario('22-boss-room-respawn')
    await runGroundSwordEnemyScenario('23-ground-sword-enemy')
    await runAirSwordDirectionScenario('24-air-sword-up', 'n')
    await runAirSwordDirectionScenario('25-air-sword-down', 's')
    await runBossSwordScenario('26-boss-sword-hit')
    await runGroundSwordEnemyScenario('27-moving-sword-align', true)
  } finally {
    if (!vite.killed) {
      vite.kill('SIGTERM')
    }
  }

  console.log(`Smoke test complete. Artifacts: ${outputDir}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
