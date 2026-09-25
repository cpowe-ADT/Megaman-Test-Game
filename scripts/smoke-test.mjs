import { runInputFocusLossScenario } from './smoke/input-focus-loss.mjs'
import { provenance } from './lib/provenance.mjs'
import { runEndingFlowScenario, runPrologueFlowScenario, runRadioTickerScenario, runStoryReplaySkipScenario } from './smoke/story-surfaces.mjs'
import { runOptionsPersistScenario, runPauseWeaponSelectScenario, runTitleContinueScenario } from './smoke/pause-options.mjs'
import { runBossGroundingScenario } from './smoke/boss-grounding.mjs'
import { runHdRenderScenario } from './smoke/hd-render.mjs'
import { assertBossBoundaryLifecycle } from './smoke/boss-boundary-lifecycle.mjs'
import assert from 'node:assert/strict'
import { runClassicCampaignScenario, runClassicUpgradeScenario } from './smoke/classic-campaign.mjs'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import os from 'node:os'
import { chromium } from 'playwright'
import { assertPelletHitEvidence } from './smoke/assert-pellet-hit.mjs'
import { runInputLifecycleScenario } from './smoke/input-lifecycle.mjs'

const host = '127.0.0.1'
const port = Number(process.env.SMOKE_PORT ?? 4173)
const smokeServerMode = String(process.env.SMOKE_SERVER ?? 'dev').trim()
const serverUrl = `http://${host}:${port}/`
const url = `http://${host}:${port}?renderer=canvas&automation=1&storyIntro=off&startScene=StageSelect`
const touchUrl = `http://${host}:${port}?renderer=canvas&automation=1&storyIntro=off&startScene=StageSelect&touchControls=1`
const titleUrl = `http://${host}:${port}?renderer=canvas&automation=1&storyIntro=off`
/** Story surfaces on: for the narrative scenarios only. */
const storyUrl = `http://${host}:${port}?renderer=canvas&automation=1&storyIntro=on`
const smokeStableDir = path.resolve('output/web-game-smoke')
const outputDir = process.env.SMOKE_OUTPUT_DIR
  ? path.resolve(process.env.SMOKE_OUTPUT_DIR)
  : path.resolve('output/smoke-runs', new Date().toISOString().replace(/[:.]/g, '-'))
const smokeSummaryPath = path.join(outputDir, 'summary.json')
const smokeOnlyScenarios = new Set(
  String(process.env.SMOKE_ONLY ?? '')
    .split(',')
    .map((value) => value.trim())
    .filter(Boolean)
)
const smokeFromScenario = String(process.env.SMOKE_FROM ?? '').trim() || null
let smokeFromMatched = smokeFromScenario == null
// Continue-on-failure harness controls: SMOKE_FAIL_FAST=1 restores stop-at-first-failure; every
// scenario gets SMOKE_SCENARIO_TIMEOUT_MS (default 120s); SMOKE_FORCE_FAIL=<name> is test-only.
const smokeFailFast = String(process.env.SMOKE_FAIL_FAST ?? '') === '1'
const smokeScenarioTimeoutMs = Number(process.env.SMOKE_SCENARIO_TIMEOUT_MS ?? 120000) || 120000
// Route walks that cross a whole stage get more room (50-pyro-route: six steps, about 100s on a quiet machine).
const SMOKE_LONG_SCENARIO_TIMEOUT_MS = { '50-pyro-route': 300000 }
const smokeForceFailScenario = String(process.env.SMOKE_FORCE_FAIL ?? '').trim() || null

// scripts/smoke/*.mjs import the same 'playwright' module instance, so patching chromium.launch here
// also tracks the browsers they open. A scenario timeout force-closes whatever it opened.
const smokeActiveBrowsers = new Set()
const smokeOriginalChromiumLaunch = chromium.launch.bind(chromium)
chromium.launch = async (...launchArgs) => {
  const browser = await smokeOriginalChromiumLaunch(...launchArgs)
  smokeActiveBrowsers.add(browser)
  browser.on('disconnected', () => smokeActiveBrowsers.delete(browser))
  return browser
}
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

// Existing regression scenarios explicitly retain their original Randomizer fixture.
async function newSmokePage(browser) {
  const page = await browser.newPage()
  await page.addInitScript(() => {
    if (!localStorage.getItem('save.v1')) localStorage.setItem('save.v1', JSON.stringify({ weaponsUnlocked: [], clearedBosses: [], tutorialCleared: false, finalBossCleared: false, gameCompleted: false }))
  })
  return page
}

function getSmokeServerConfig() {
  if (smokeServerMode === 'preview') {
    return {
      label: 'vite-preview',
      args: ['run', 'preview', '--', '--host', host, '--port', String(port), '--strictPort'],
      env: process.env
    }
  }

  if (smokeServerMode !== 'dev') {
    throw new Error(`Unsupported SMOKE_SERVER mode '${smokeServerMode}'. Expected 'dev' or 'preview'.`)
  }

  return {
    label: 'vite',
    args: ['run', 'dev', '--', '--host', host, '--port', String(port), '--strictPort'],
    env: {
      ...process.env,
      VITE_SMOKE: '1',
      VITE_AUTOMATION: '1'
    }
  }
}

// `npm run dev` starts Vite as a grandchild; on Linux, signalling npm alone leaves Vite holding the pipes, so
// the dev server runs in its own process group and the whole group is signalled (2026-09-23 CI browser-gates).
function signalChildGroup(child, signal) {
  try {
    if (process.platform !== 'win32' && child.pid) process.kill(-child.pid, signal)
    else child.kill(signal)
  } catch {
    child.kill(signal)
  }
}

const clickOnlyActions = {
  steps: [
    { buttons: [], frames: 60 },
    { buttons: ['left_mouse_button'], frames: 2, mouse_x: 52, mouse_y: 84 },
    { buttons: [], frames: 60 }
  ]
}

const keyboardSelectThenEnterActions = {
  steps: [
    { buttons: [], frames: 20 },
    { buttons: [], frames: 8 },
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

function linkStableRunDir(target, linkPath) {
  try {
    const stat = fs.lstatSync(linkPath)
    if (stat.isDirectory() && !stat.isSymbolicLink()) {
      fs.rmSync(linkPath, { recursive: true, force: true })
    } else {
      fs.rmSync(linkPath, { force: true })
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error
    }
  }
  fs.symlinkSync(target, linkPath, 'dir')
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
  throw new Error(`Smoke server did not become ready at ${targetUrl} within ${timeoutMs}ms`)
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

/**
 * Loads a `{ meta, rows }` input script from `scripts/smoke/inputs/` (or a bare `[{ frame, held }]`
 * array) and replays it through `stageDebug.replayInputs`, which feeds the automation-only action
 * source and steps `window.stepFrames` between rows (prompt 05 §5.1 item 9). Resolves with
 * `{ frames, finalPlayer: { x, y, vx, vy } }`.
 */
async function replayInputs(page, scriptPath) {
  const raw = fs.readFileSync(path.resolve(scriptPath), 'utf8')
  const parsed = JSON.parse(raw)
  const rows = Array.isArray(parsed) ? parsed : parsed.rows
  return page.evaluate((script) => window.stageDebug.replayInputs(script), rows)
}

/** Releases every automation-held action, so the next `replayInputs` call presses fresh (a held
 * dash never registers a new dash edge; a real keyboard release does). */
async function releaseReplayedInputs(page) {
  await page.evaluate(() => window.stageDebug.replayInputs([{ frame: 0, held: [] }]))
}


async function readState(page) {
  let text = null
  try {
    text = await page.evaluate(() => {
      if (typeof window.render_game_to_text === 'function') {
        return window.render_game_to_text()
      }
      return null
    })
  } catch (error) {
    const message = String(error?.message ?? error ?? '')
    if (
      message.includes('Execution context was destroyed') ||
      message.includes('Cannot find context with specified id') ||
      message.includes('Target closed')
    ) {
      return null
    }
    throw error
  }
  return text ? JSON.parse(text) : null
}

function summarizeStateForError(state) {
  if (!state || typeof state !== 'object') {
    return null
  }

  return {
    scene: state.scene ?? null,
    activeScenes: Array.isArray(state.activeScenes) ? state.activeScenes : [],
    player: state.player ?? null,
    playerState: state.playerState ?? null,
    playerVisual: state.playerVisual ?? null,
    stageSelect: state.stageSelect ?? null,
    stageRuntime: state.stageRuntime ?? null,
    progression: state.progression ?? null,
    projectiles: state.projectiles ?? null,
    newPlayer: state.newPlayer ?? null,
    combatDebug: state.combatDebug ?? null,
    visuals: state.visuals ?? null,
    audio: state.audio ?? null
  }
}

function classifyScenarioError(error) {
  const message = String(error?.message ?? error ?? '')
  if (message.includes('Timed out waiting for state condition')) {
    return 'state_timeout'
  }
  if (message.includes('Timed out waiting for page condition')) {
    return 'page_timeout'
  }
  if (message.includes('browser errors')) {
    return 'browser_error'
  }
  return 'error'
}

function serializeScenarioError(error) {
  return {
    name: String(error?.name ?? 'Error'),
    message: String(error?.message ?? error ?? 'Unknown error'),
    classification: classifyScenarioError(error),
    stack: typeof error?.stack === 'string' ? error.stack : undefined,
    timeoutMs: Number(error?.timeoutMs ?? 0) || undefined,
    lastState: summarizeStateForError(error?.lastState)
  }
}

function writeSmokeSummary(summary) {
  fs.writeFileSync(smokeSummaryPath, JSON.stringify(summary, null, 2))
}

function createSmokeSummary() {
  return {
    status: 'running',
    startedAt: new Date().toISOString(),
    ...provenance(),
    serverMode: smokeServerMode,
    outputDir,
    runDir: outputDir,
    scenarios: []
  }
}

async function runScenarioWithTimeout(name, runScenario, timeoutMs) {
  const browsersBefore = new Set(smokeActiveBrowsers)
  let timedOut = false
  let timer
  const scenarioPromise = Promise.resolve().then(() => runScenario())
  const timeoutPromise = new Promise((_resolve, reject) => {
    timer = setTimeout(() => {
      timedOut = true
      const error = new Error(`Scenario "${name}" exceeded SMOKE_SCENARIO_TIMEOUT_MS (${timeoutMs}ms)`)
      error.name = 'ScenarioTimeoutError'
      error.timeoutMs = timeoutMs
      reject(error)
    }, timeoutMs)
  })

  try {
    return await Promise.race([scenarioPromise, timeoutPromise])
  } catch (error) {
    if (timedOut) {
      const scenarioBrowsers = [...smokeActiveBrowsers].filter((browser) => !browsersBefore.has(browser))
      await Promise.all(scenarioBrowsers.map((browser) => browser.close().catch(() => {})))
      // The abandoned scenario call may still settle later; never let that surface as an unhandled rejection.
      scenarioPromise.catch(() => {})
    }
    throw error
  } finally {
    clearTimeout(timer)
  }
}

async function executeSmokeScenario(summary, name, runScenario) {
  if (!smokeFromMatched) {
    if (name === smokeFromScenario) {
      smokeFromMatched = true
    } else {
      summary.scenarios.push({
        name,
        status: 'skipped',
        artifactDir: path.join(outputDir, name),
        reason: `Skipped until SMOKE_FROM=${smokeFromScenario}`
      })
      writeSmokeSummary(summary)
      return null
    }
  }

  // SMOKE_ONLY takes full names or their numeric prefix (35 matches 35-radio-ticker).
  if (smokeOnlyScenarios.size > 0 && !smokeOnlyScenarios.has(name) && !smokeOnlyScenarios.has(name.split('-')[0])) {
    summary.scenarios.push({
      name,
      status: 'skipped',
      artifactDir: path.join(outputDir, name),
      reason: 'Skipped by SMOKE_ONLY filter'
    })
    writeSmokeSummary(summary)
    return null
  }

  const startedAt = Date.now()
  try {
    // SMOKE_FORCE_FAIL is test-only: it throws instead of running the scenario so continue-on-failure
    // (and SMOKE_FAIL_FAST) can be proven without editing a real scenario.
    const effectiveRunScenario =
      smokeForceFailScenario === name
        ? async () => {
            throw new Error(`SMOKE_FORCE_FAIL forced scenario "${name}" to fail`)
          }
        : runScenario
    const result = await runScenarioWithTimeout(name, effectiveRunScenario, Math.max(smokeScenarioTimeoutMs, SMOKE_LONG_SCENARIO_TIMEOUT_MS[name] ?? 0))
    summary.scenarios.push({
      name,
      status: 'pass',
      durationMs: Date.now() - startedAt,
      artifactDir: path.join(outputDir, name)
    })
    writeSmokeSummary(summary)
    return result
  } catch (error) {
    summary.scenarios.push({
      name,
      status: 'fail',
      durationMs: Date.now() - startedAt,
      artifactDir: path.join(outputDir, name),
      error: serializeScenarioError(error)
    })
    writeSmokeSummary(summary)
    if (smokeFailFast) {
      throw error
    }
    return null
  }
}

// 15s by default: a wait still needs its condition to become true, so a longer wait cannot pass a broken build;
// it only stops scene transitions and page opens timing out on a loaded machine (2x software WebGL opens in 12s).
// Checks that something happens within a time budget pass their own shorter timeout.
async function waitForState(page, predicate, timeoutMs = 15000, description = 'state condition') {
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

async function waitForPageCheck(page, predicate, timeoutMs = 8000, description = 'page condition') {
  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    await advanceFrames(page, 2)
    let passed = false
    try {
      passed = await page.evaluate(predicate)
    } catch (error) {
      const message = String(error?.message ?? error ?? '')
      if (
        message.includes('Execution context was destroyed') ||
        message.includes('Cannot find context with specified id') ||
        message.includes('Target closed')
      ) {
        await page.waitForTimeout(25)
        continue
      }
      throw error
    }
    if (passed) {
      return
    }
    await page.waitForTimeout(25)
  }
  const error = new Error(`Timed out waiting for page condition (${description}) after ${timeoutMs}ms`)
  error.name = 'TimeoutError'
  error.timeoutMs = timeoutMs
  throw error
}

async function clickCanvas(page, x, y) {
  const point = await getCanvasPoint(page, x, y)
  await page.mouse.click(point.x, point.y)
}

async function getCanvasBox(page) {
  const canvas = await page.locator('canvas').first()
  const box = await canvas.boundingBox()
  if (!box) {
    throw new Error('Expected visible canvas while attempting click')
  }
  return box
}

async function getCanvasPoint(page, x, y) {
  const box = await getCanvasBox(page)
  const scaleX = box.width / 448
  const scaleY = box.height / 252
  return {
    x: box.x + x * scaleX,
    y: box.y + y * scaleY
  }
}

async function moveCanvasPointer(page, x, y) {
  const point = await getCanvasPoint(page, x, y)
  await page.mouse.move(point.x, point.y)
}

async function mouseDownCanvas(page, x, y) {
  await moveCanvasPointer(page, x, y)
  await page.mouse.down()
}

async function mouseUpCanvas(page, x, y = null) {
  if (typeof x === 'number' && typeof y === 'number') {
    await moveCanvasPointer(page, x, y)
  }
  await page.mouse.up()
}

async function tapCanvas(page, x, y, holdFrames = 2) {
  await mouseDownCanvas(page, x, y)
  await advanceFrames(page, holdFrames)
  await mouseUpCanvas(page)
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
  const page = await newSmokePage(browser)
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
      window.stageDebug?.skipDialogue?.()
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

    return finalState
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
  const page = await newSmokePage(browser)
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
    const baselineState = await waitForState(page, (state) => state.scene === 'Game')
    const baselineShots = Number(baselineState.combatDebug?.player?.shotsFiredTotal ?? 0)
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
    const finalShots = Number(finalState.combatDebug?.player?.shotsFiredTotal ?? 0)
    const lastProjectile = finalState.combatDebug?.player?.lastProjectile
    // Prompt 05 §5.2 item 3: the pellet fires on press and the held charge fires on release.
    if (finalShots - baselineShots !== 2) {
      throw new Error(`Expected a held shot to spawn a pellet on press and one charge shot on release; saw ${finalShots - baselineShots}.`)
    }
    if (
      lastProjectile?.weaponId !== 'Buster' ||
      Number(lastProjectile?.chargeLevel ?? 0) <= 0 ||
      !String(lastProjectile?.projectileId ?? '').startsWith('player_buster_charge_lv')
    ) {
      throw new Error('Expected charge-shot trace to retain Buster projectile identity and charge level.')
    }

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }

    return finalState
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
  const page = await newSmokePage(browser)
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
    const finalState = await waitForState(page, (state) => state.scene === 'Game')

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }

    return finalState
  } finally {
    await browser.close()
  }
}

async function runClickOnlyStageSelectScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await newSmokePage(browser)
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
    await clickCanvas(page, 224, 32)
    await advanceFrames(page, 30)
    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'StageSelect' &&
        typeof state.stageSelect?.weaknessLabel === 'string' &&
        state.stageSelect.weaknessLabel.length > 0 &&
        typeof state.stageSelect?.rewardLabel === 'string' &&
        state.stageSelect.rewardLabel.length > 0 &&
        typeof state.stageSelect?.finalGateText === 'string' &&
        state.stageSelect.finalGateText.startsWith('FINAL'),
      4000,
      'StageSelect seeded progression presentation payload'
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(finalState, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }

    return finalState
  } finally {
    await browser.close()
  }
}

async function runTitleControlsScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await newSmokePage(browser)
  await page.setViewportSize({ width: 448, height: 252 })
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
    await page.goto(titleUrl, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    const titleState = await waitForState(page, (state) => state.scene === 'Title')
    const titleEvidence = await page.evaluate(() => {
      const scene = window.__phaserGame.scene.getScene('Title')
      const describe = name => { const text = scene.children.getByName(name); const b = text.getBounds(); return { text: text.text, x:b.x,y:b.y,width:b.width,height:b.height } }
      return { title:describe('identity-title'), subtitle:describe('identity-subtitle') }
    })
    assert.equal(titleEvidence.title.text, 'OMEGA RELAY')
    assert.equal(titleEvidence.subtitle.text, 'EIGHT WARDENS. ONE MANUFACTURED CRISIS.')
    assert.ok(titleEvidence.title.x >= 58 && titleEvidence.title.x + titleEvidence.title.width <= 390, 'title must fit between cyan accents')
    assert.ok(titleEvidence.subtitle.x >= 56 && titleEvidence.subtitle.x + titleEvidence.subtitle.width <= 392, 'full subtitle must fit rail')
    assert.ok(titleEvidence.title.y + titleEvidence.title.height < titleEvidence.subtitle.y, 'title and subtitle must not overlap')
    await page.locator('canvas').screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    await tapKey(page, 'c')

    const controlsState = await waitForState(
      page,
      (state) => Array.isArray(state.activeScenes) && state.activeScenes.includes('Controls')
    )

    await page.locator('canvas').screenshot({ path: path.join(scenarioDir, 'shot-1-controls.png') })

    await tapKey(page, 'Escape')
    const finalState = await waitForState(
      page,
      (state) => state.scene === 'Title' && (!Array.isArray(state.activeScenes) || !state.activeScenes.includes('Controls'))
    )

    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await waitForState(page, state => state.scene === 'StageSelect')
    const stageHeader = await page.evaluate(() => {
      const scene=window.__phaserGame.scene.getScene('StageSelect')
      const describe=name=>{const t=scene.children.getByName(name), b=t.getBounds();return {text:t.text,x:b.x,y:b.y,width:b.width,height:b.height}}
      const progress=scene.headerProgress.getBounds()
      return {title:describe('identity-stage-title'),caption:describe('identity-stage-caption'),progress:{x:progress.x,y:progress.y,width:progress.width,height:progress.height}}
    })
    assert.equal(stageHeader.title.text,'WARDEN SELECT');assert.equal(stageHeader.caption.text,'8 WARDENS + OMEGA')
    assert.ok(stageHeader.title.x+stageHeader.title.width<stageHeader.caption.x,'stage title and descriptor must not overlap')
    for(const text of [stageHeader.title,stageHeader.caption]) assert.ok(text.y+text.height<=stageHeader.progress.y,'stage descriptor must fit above progress')
    await page.locator('canvas').screenshot({ path:path.join(scenarioDir,'shot-2-stage-select.png') })
    await tapKey(page,'Enter')
    await waitForState(page,state=>state.scene==='Game'&&state.newPlayer?.locomotion?.grounded===true)
    await waitForPageCheck(page,()=>!window.__phaserGame.scene.getScene('Game').cameras.main.fadeEffect.isRunning,2500,'entry fade to finish before HUD capture')
    const gameplayState=await readState(page)
    // The developer skin was retired in 05c (5.5): every build shows WREN from the base manifest alone.
    assert.equal(gameplayState.identity.heroLabel,'WREN')
    assert.equal('devSkinEnabled' in gameplayState.identity,false)
    assert.equal('privateOverrideEntries' in (gameplayState.spriteManifest??{}),false)
    const dialogue=await page.evaluate(()=>window.__phaserGame.scene.getScene('Game').buildDialogueLines('tutorial_sentinel','boss_intro'))
    assert.ok(dialogue.some(line=>line.text.startsWith('WREN,')))
    assert.ok(dialogue.some(line=>line.speakerId==='hero'&&line.speakerName==='WREN'))
    await page.locator('canvas').screenshot({ path:path.join(scenarioDir,'shot-3-hud.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify({ titleState,titleEvidence,controlsState,finalState,stageHeader,gameplayState,dialogue }, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runStageSelectProgressionSummaryScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await newSmokePage(browser)
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
    const modeState = await readState(page)
    if (modeState.stageSelect?.progressionMode !== 'relay_randomizer') throw new Error('Expected explicit Randomizer regression fixture.')
    await page.setViewportSize({ width:448, height:252 })
    await tapKey(page,'ArrowRight')
    const lockedPreview=await page.evaluate(()=>{
      const scene=window.__phaserGame.scene.getScene('StageSelect')
      return {stageId:scene.stages[scene.index].id,canConfirm:scene.canConfirm,text:scene.detailsText.text,details:scene.detailsText.getBounds(),preview:scene.getPanelEvidence().preview}
    })
    await page.locator('canvas').screenshot({path:path.join(scenarioDir,'shot-locked-access.png')})
    fs.writeFileSync(path.join(scenarioDir,'locked-access.json'),JSON.stringify(lockedPreview,null,2))
    assert.equal(lockedPreview.stageId,'tide_reaver');assert.equal(lockedPreview.canConfirm,false)
    assert.ok(lockedPreview.text.includes('NEEDS: Tide Reaver Access'),'locked Randomizer preview must name its access requirement')
    assert.ok(lockedPreview.details.x+lockedPreview.details.width<=lockedPreview.preview.x+lockedPreview.preview.width)
    assert.ok(lockedPreview.details.y+lockedPreview.details.height<=lockedPreview.preview.y+lockedPreview.preview.height)
    await tapKey(page,'ArrowLeft')
    await tapKey(page, 'Escape')
    await waitForPageCheck(page, () => Boolean(window.__phaserGame?.scene?.isActive?.('SystemMenu')))
    await page.evaluate(() => {
      const menu = window.__phaserGame?.scene?.getScene?.('SystemMenu')
      if (!menu) {
        return
      }
      menu.index = Math.max(0, menu.options.findIndex((option) => option.id === 'progression'))
      menu.updateCursor?.()
      menu.activateSelection?.()
    })

    const summaryState = await waitForState(
      page,
      (state) =>
        Array.isArray(state.activeScenes) &&
        state.activeScenes.includes('ProgressionSummary') &&
        typeof state.progressionSummary?.seed === 'string'
    )

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    await tapKey(page, 'Escape')
    const finalState = await waitForState(
      page,
      (state) =>
        Array.isArray(state.activeScenes) &&
        state.activeScenes.includes('SystemMenu') &&
        !state.activeScenes.includes('ProgressionSummary')
    )

    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify({ summaryState, finalState }, null, 2))

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runProgressionImportTruthScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await newSmokePage(browser)
  const errors = []

  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      errors.push({ type: 'console.error', text: msg.text() })
    }
  })
  page.on('pageerror', (err) => {
    errors.push({ type: 'pageerror', text: String(err), stack: err?.stack })
  })

  await page.addInitScript(() => {
    window.localStorage.setItem(
      'save.v1',
      JSON.stringify({
        weaponsUnlocked: [],
        gameOverCounts: {},
        clearedBosses: [],
        tutorialCleared: false,
        finalBossCleared: false,
        gameCompleted: false,
        activeRun: {
          version: 2,
          savedAt: Date.now(),
          stageId: 'pyro_maw',
          bossId: 'pyro_maw',
          playerHp: 8,
          playerMaxHp: 8,
          playerLives: 3,
          currentWeaponIndex: 0,
          currentWeaponId: 'Buster',
          checkpointIndex: 0,
          checkpointId: 'pyro_start',
          weaponEnergyById: { Buster: 28 }
        }
      })
    )
  })

  const payload = {
    version: 1,
    slotData: {
      seed: 'browser-import-seed',
      startingStageIds: ['tutorial_sentinel', 'pyro_maw'],
      weaknessStrictness: 'weakness_and_buster',
      finalGate: { rules: [{ category: 'medals', required: 8 }] }
    },
    checkedLocations: [
      'tutorial_sentinel:boss_clear',
      ...robotMasterStageIds.map((stageId) => `${stageId}:boss_clear`),
      'omega_fortress:boss_clear'
    ],
    receivedItems: [
      'FlameSerpent',
      'HydroLance',
      'ThunderSpike',
      'QuakeKnuckle',
      'MagcutDisc',
      'AcidGlob',
      'AeroDarts',
      'FrostShatter',
      'heart_tank',
      'heart_tank'
    ],
    checkpoints: { pyro_maw: ['pyro_mid_a', 'pyro_mid_b'] }
  }

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    await waitForState(page, (state) => state.scene === 'StageSelect')

    await page.evaluate(() => {
      const stageSelect = window.__phaserGame?.scene?.getScene?.('StageSelect')
      stageSelect?.scene?.launch?.('ProgressionSummary', {
        returnSceneKey: 'SystemMenu',
        sourceSceneKey: 'StageSelect'
      })
      stageSelect?.scene?.pause?.()
    })
    await waitForPageCheck(
      page,
      () => Boolean(window.__phaserGame?.scene?.getScene?.('ProgressionSummary')?.importTransportText),
      8000,
      'progression summary import handler'
    )
    await page.evaluate(async (transport) => {
      const summary = window.__phaserGame?.scene?.getScene?.('ProgressionSummary')
      await summary?.importTransportText?.(JSON.stringify(transport))
    }, payload)

    const finalState = await waitForState(
      page,
      (state) => state.scene === 'StageSelect' && state.stageSelect?.finalGateText === 'FINAL • COMPLETE',
      8000,
      'imported progression completion truth on Stage Select'
    )
    const storedSave = await page.evaluate(() => JSON.parse(window.localStorage.getItem('save.v1') ?? '{}'))
    if (
      storedSave.progressionWorld?.seed !== 'browser-import-seed' ||
      storedSave.tutorialCleared !== true ||
      storedSave.finalBossCleared !== true ||
      storedSave.gameCompleted !== true ||
      storedSave.clearedBosses?.length !== robotMasterStageIds.length ||
      storedSave.activeRun !== null
    ) {
      throw new Error('Imported progression did not persist canonical world, clear, completion, and active-run truth.')
    }

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify({ finalState, storedSave }, null, 2))
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
  const page = await newSmokePage(browser)
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

    await assertBossBoundaryLifecycle(page, scenarioDir)

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

/** Prompt 05 §5.2 item 5: the death pose sampled during the 250ms freeze, then the trace after respawn. */
async function sampleDeathPose(page) {
  return page.evaluate(() => {
    const scene = window.__phaserGame?.scene?.getScene?.('Game')
    return {
      animationKey: String(scene?.player?.anims?.currentAnim?.key ?? ''),
      frameName: String(scene?.player?.frame?.name ?? ''),
      trace: scene?.deathSequence?.trace ? { ...scene.deathSequence.trace } : null
    }
  })
}

async function assertDeathSequence(page, pose) {
  const trace = await page.evaluate(() => {
    const scene = window.__phaserGame?.scene?.getScene?.('Game')
    return scene?.deathSequence?.trace ? { ...scene.deathSequence.trace } : null
  })
  if (pose.animationKey !== 'player_death' && !pose.frameName.includes('/death/')) {
    throw new Error(`Expected a player_death sample during the freeze; saw ${pose.animationKey} ${pose.frameName}.`)
  }
  if (trace?.sfxKey !== 'player_death' || trace?.animationKey !== 'player_death' || Number(trace?.orbCount) !== 8) {
    throw new Error(`Expected the death trace to record player_death and 8 orbs; saw ${JSON.stringify(trace)}.`)
  }
  const delay = Number(trace.respawnedAtMs) - Number(trace.diedAtMs)
  if (!Number.isFinite(delay) || delay < 900) {
    throw new Error(`Expected a respawn delay of at least 900ms; saw ${delay}.`)
  }
  return { pose, trace, respawnDelayMs: delay }
}

async function runCheckpointRespawnScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await newSmokePage(browser)
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
    const deathPose = await sampleDeathPose(page)
    await advanceFrames(page, 22)
    await page.screenshot({ path: path.join(scenarioDir, 'death-burst.png') })

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
    const death = await assertDeathSequence(page, deathPose)
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify({ ...respawnState, death }, null, 2))

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
  const page = await newSmokePage(browser)
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
    // Heat Works (EVAL-P6-009): the intro mine streams in from x 170; by x 700 it has retired behind
    // the hero and the teach slicer and rocket loader are live.
    await page.evaluate(() => window.stageDebug?.setPlayerX?.(200))

    const midState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.enemySpawner?.activeMarkers ?? 0) >= 1 &&
        Number(state.enemySpawner?.activeMarkers ?? 0) <= Number(state.enemySpawner?.totalMarkers ?? 0)
    )

    await page.evaluate(() => window.stageDebug?.setPlayerX?.(700))

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
  const page = await newSmokePage(browser)
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
    upgradeUnlocks: ['armor_helmet', 'armor_arms', 'armor_body', 'armor_legs'],
    heartTanks: 8,
    subTanks: 4,
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
  const page = await newSmokePage(browser)
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
    const startingShots = Number(switchedState.combatDebug?.player?.shotsFiredTotal ?? 0)
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
    const lastProjectile = firedState.combatDebug?.player?.lastProjectile
    const firedShots = Number(firedState.combatDebug?.player?.shotsFiredTotal ?? 0)
    const energyCost = Number(lastProjectile?.energyCost ?? -1)
    const endingEnergy = Number(firedState.weaponEnergy?.current ?? -1)
    if (firedShots - startingShots !== 1) {
      throw new Error(`Expected one special-weapon input to spawn exactly one projectile; saw ${firedShots - startingShots}.`)
    }
    if (lastProjectile?.weaponId !== 'FlameSerpent' || Number(lastProjectile?.chargeLevel ?? -1) !== 0) {
      throw new Error('Expected special-weapon trace to retain FlameSerpent identity without Buster charge metadata.')
    }
    if (energyCost <= 0 || startingEnergy - endingEnergy !== energyCost) {
      throw new Error(
        `Expected special-weapon energy delta to equal one configured cost; start=${startingEnergy}, end=${endingEnergy}, cost=${energyCost}.`
      )
    }

    await page.evaluate(() => window.stageDebug.grantUpgrade('arc_slash'))
    await advanceFrames(page, 30)
    const beforeArc = await readState(page)
    await page.keyboard.down('c')
    await advanceFrames(page, 3)
    const heldArc = await readState(page)
    if (heldArc.combatDebug.player.shotsFiredTotal !== beforeArc.combatDebug.player.shotsFiredTotal) throw new Error('Arc fired before saber release.')
    await page.keyboard.up('c')
    const arcState = await waitForState(page, state => state.combatDebug?.player?.lastProjectile?.weaponId === 'ArcSlash')
    if (arcState.combatDebug.player.shotsFiredTotal !== beforeArc.combatDebug.player.shotsFiredTotal + 1 || arcState.playerState.weapon !== 'FlameSerpent' || arcState.combatDebug.player.lastProjectile.energyCost !== 0) throw new Error('Arc release identity/count/energy contract failed.')
    fs.writeFileSync(path.join(scenarioDir,'arc-evidence.json'),JSON.stringify({beforeArc,heldArc,arcState},null,2))

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
  const page = await newSmokePage(browser)
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
    await page.evaluate(() => {
      const stageSelect = window.__phaserGame?.scene?.getScene?.('StageSelect')
      stageSelect?.onSystemMenuAction?.('load_game')
    })

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
      20000
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

async function runCorruptSaveRejectedScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await newSmokePage(browser)
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
        activeRun: {
          version: 2,
          savedAt: Date.now(),
          stageId: 'not_a_stage',
          bossId: 'not_a_boss',
          playerHp: 999,
          playerMaxHp: -4,
          playerLives: -7,
          currentWeaponIndex: 999,
          currentWeaponId: 'not_a_weapon',
          weaponEnergyById: { not_a_weapon: 999 },
          checkpointIndex: 999,
          checkpointId: 'not_a_checkpoint'
        }
      })
    )
  })

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))

    const beforeLoad = await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Escape')
    await waitForPageCheck(page, () => Boolean(window.__phaserGame?.scene?.isActive?.('SystemMenu')))
    const loadOptionEnabled = await page.evaluate(() => {
      const menu = window.__phaserGame?.scene?.getScene?.('SystemMenu')
      const loadOption = menu?.options?.find?.((option) => option.id === 'load_game')
      return Boolean(loadOption?.enabled)
    })
    if (loadOptionEnabled) {
      throw new Error('Expected corrupt active run to disable the load option.')
    }

    await page.evaluate(() => {
      const stageSelect = window.__phaserGame?.scene?.getScene?.('StageSelect')
      stageSelect?.onSystemMenuAction?.('load_game')
    })
    const afterLoad = await waitForState(page, (state) => state.scene === 'StageSelect')
    const storedActiveRun = await page.evaluate(() => {
      const stored = JSON.parse(window.localStorage.getItem('save.v1') ?? '{}')
      return stored.activeRun ?? null
    })
    if (storedActiveRun !== null) {
      throw new Error('Expected corrupt active run to be removed from persistent storage.')
    }

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(
      path.join(scenarioDir, 'state-0.json'),
      JSON.stringify({ beforeLoad, loadOptionEnabled, storedActiveRun, afterLoad }, null, 2)
    )

    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runUnifiedPlayerDamageScenario(name) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await newSmokePage(browser)
  const errors = []
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push({ type: 'console.error', text: msg.text() })
  })
  page.on('pageerror', (err) => errors.push({ type: 'pageerror', text: String(err), stack: err?.stack }))

  const requestDebugDamage = (sourceId) =>
    page.evaluate((id) => {
      const scene = window.__phaserGame?.scene?.getScene?.('Game')
      if (!scene || typeof scene.requestPlayerDamage !== 'function') {
        throw new Error('Game damage adapter unavailable in automation mode.')
      }
      return scene.requestPlayerDamage({
        amount: 1,
        tier: 'light',
        sourceType: 'system',
        sourceId: id,
        direction: 1
      })
    }, sourceId)

  try {
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(400)
    await page.evaluate(() => window.dispatchEvent(new Event('resize')))
    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    const baseline = await waitForState(
      page,
      (state) => state.scene === 'Game' && Number(state.playerState?.hp ?? 0) > 0
    )
    const baselineHp = Number(baseline.playerState.hp)

    const readPlayerX = () => page.evaluate(() => Number(window.__phaserGame?.scene?.getScene?.('Game')?.player?.x ?? NaN))
    const beforeHitX = await readPlayerX()
    const first = await requestDebugDamage('damage_matrix_first')
    const repeated = await requestDebugDamage('damage_matrix_iframe_repeat')
    // Prompt 05 §5.2 item 2: the hurt lock holds the knockback, so the hero visibly moves.
    await advanceFrames(page, 20)
    const knockbackDx = (await readPlayerX()) - beforeHitX
    if (!(Math.abs(knockbackDx) >= 20)) {
      throw new Error(`Expected at least 20px of knockback after a hit; saw ${knockbackDx}.`)
    }
    const iframeState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.playerState?.hp ?? -1) === baselineHp - 1 &&
        Number(state.combatDebug?.totals?.total ?? 0) >= 2
    )
    if (!first?.accepted || repeated?.accepted) {
      throw new Error('Expected first damage request accepted and immediate i-frame repeat rejected.')
    }
    const iframeHits = iframeState.combatDebug?.recentHits ?? []
    if (
      iframeHits.filter((hit) => hit.note?.startsWith('damage_matrix_first:') && hit.accepted).length !== 1 ||
      iframeHits.filter((hit) => hit.note?.startsWith('damage_matrix_iframe_repeat:') && !hit.accepted).length !== 1
    ) {
      throw new Error('Expected exactly one accepted and one rejected trace for the i-frame pair.')
    }

    await advanceFrames(page, 50)
    await waitForState(
      page,
      (state) => state.scene === 'Game' && Number(state.combatDebug?.player?.iFramesMs ?? -1) === 0,
      8000,
      'player i-frame expiry'
    )
    const afterIFrames = await requestDebugDamage('damage_matrix_after_iframes')
    const expiredState = await waitForState(
      page,
      (state) => state.scene === 'Game' && Number(state.playerState?.hp ?? -1) === baselineHp - 2
    )
    if (!afterIFrames?.accepted) {
      throw new Error('Expected damage after i-frame expiry to be accepted.')
    }

    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScene?.('Game')
      scene?.scene?.restart?.({ bossId: 'pyro_maw', stageId: 'pyro_maw' })
    })
    const restartBaseline = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.playerState?.hp ?? 0) === Number(state.playerState?.maxHp ?? -1) &&
        Number(state.combatDebug?.totals?.total ?? -1) === 0,
      8000,
      'clean Game restart damage baseline'
    )
    const restartHp = Number(restartBaseline.playerState.hp)
    const restartHit = await requestDebugDamage('damage_matrix_restart')
    const finalState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        Number(state.playerState?.hp ?? -1) === restartHp - 1 &&
        Number(state.combatDebug?.totals?.total ?? 0) === 1 &&
        Number(state.combatDebug?.totals?.accepted ?? 0) === 1
    )
    if (!restartHit?.accepted) {
      throw new Error('Expected one accepted hit after scene restart.')
    }

    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(
      path.join(scenarioDir, 'state-0.json'),
      JSON.stringify({ baseline, iframeState, expiredState, restartBaseline, finalState }, null, 2)
    )
    if (errors.length > 0) {
      fs.writeFileSync(path.join(scenarioDir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${scenarioDir}`)
    }
  } finally {
    await browser.close()
  }
}

async function runMovementFeelScenario(name) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)
  // Base/Speedster dash and the dash-jump trace (EVAL-P5-001, EVAL-P5-002) run from frame-exact
  // input scripts (`stageDebug.replayInputs`, prompt 05 §5.1 item 9) instead of Playwright key
  // timing; see scripts/smoke/inputs/*.json for the held-action rows and reference thresholds.
  const dashScript = path.resolve('scripts/smoke/inputs/dash-basic.json')
  const dashJumpScript = path.resolve('scripts/smoke/inputs/dash-jump.json')

  try {
    await waitForState(
      page,
      (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true,
      8000,
      'grounded player before movement feel trace'
    )
    // From here on every step is deterministic (`window.stepFrames`, via `stageDebug.replayInputs`).
    // Sleeping Phaser's TimeStep now, once, keeps it asleep for the rest of this scenario: each
    // `stepFrames` call below sees the loop already asleep and skips its own wake(), so no stray
    // real animation frame (with an uncontrolled delta) can perturb the Arcade physics fixed-step
    // accumulator between our page.evaluate calls. `advanceTime`/`waitForState` cannot run after
    // this point (they need the real rAF loop), which is why the traces below no longer use them.
    await page.evaluate(() => window.__phaserGame?.loop.sleep())
    const resetMovement = (speedster) =>
      page.evaluate((enableSpeedster) => {
        const scene = window.__phaserGame?.scene?.getScene?.('Game')
        if (!scene?.player || !scene?.newPlayerRuntime) {
          throw new Error('Player runtime unavailable for movement trace.')
        }
        const upgrades = Array.isArray(scene.progressionSave?.upgradeUnlocks)
          ? scene.progressionSave.upgradeUnlocks.filter((id) => id !== 'chip_speedster')
          : []
        scene.progressionSave = {
          ...scene.progressionSave,
          upgradeUnlocks: enableSpeedster ? [...upgrades, 'chip_speedster'] : upgrades
        }
        scene.applyProgressionMovementModifiers()
        // The trace measures the motor alone. Enemy contact during the dash used to trigger
        // hit-stop, which pauses physics and defers button presses, so the second dash never
        // started. Long i-frames, no live enemies and a cleared hit-stop keep the trace pure.
        scene.hitstopRemainingFrames = 0
        scene.physics?.world?.resume?.()
        scene.enemies?.clear?.(true, true)
        scene.newPlayerRuntime.resetForRespawn(60000)
        scene.player.setPosition(180, scene.player.y)
        scene.player.body.setVelocity(0, 0)
        return {
          maxVelocityX: Number(scene.player.body.maxVelocity?.x ?? 0),
          maxVelocityY: Number(scene.player.body.maxVelocity?.y ?? 0)
        }
      }, speedster)

    const near = (value, expected, tolerance = 2) => Math.abs(value - expected) <= tolerance

    const baseLimits = await resetMovement(false)
    const baseReplay = await replayInputs(page, dashScript)
    await releaseReplayedInputs(page)
    const speedsterLimits = await resetMovement(true)
    const speedsterReplay = await replayInputs(page, dashScript)
    await releaseReplayedInputs(page)

    const wallJump = await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScene?.('Game')
      const runtime = scene?.newPlayerRuntime
      const motor = runtime?.motor
      const body = scene?.player?.body
      if (!motor || !body) {
        throw new Error('Player motor unavailable for wall-jump trace.')
      }
      runtime.resetForRespawn(0)
      const originalOnFloor = body.onFloor
      body.onFloor = () => false
      body.blocked.down = false
      body.touching.down = false
      body.blocked.right = false
      body.touching.right = true
      body.setVelocity(0, 120)
      const snapshot = motor.update(
        {
          moveAxis: 1,
          jumpPressed: true,
          jumpHeld: true,
          jumpReleased: false,
          dashPressed: false,
          dashHeld: true,
          dashReleased: false,
          shootPressed: false,
          shootHeld: false,
          shootReleased: false,
          slashPressed: false,
          crouchHeld: false,
          aim: { x: 1, y: 0 }
        },
        1000 / 60,
        true
      )
      const result = {
        vx: Number(body.velocity.x),
        vy: Number(body.velocity.y),
        jumpSource: snapshot.jumpSource,
        wallJumping: snapshot.wallJumping
      }
      body.onFloor = originalOnFloor
      return result
    })

    const dragState = await page.evaluate(() => {
      const body = window.__phaserGame?.scene?.getScene?.('Game')?.player?.body
      return { dragX: Number(body?.drag?.x ?? Number.NaN), allowDrag: Boolean(body?.allowDrag) }
    })
    // Local (this scenario only): `replayInputs`/`releaseReplayedInputs` above cover the plain
    // base/Speedster traces; the dash-jump and dash-recycle traces below need `trace: true`
    // per-step samples (EVAL-P5-002 review, MERGED.md 2026-09-23-5.1b-replay), so they call
    // `stageDebug.replayInputs` directly with rows/options instead.
    const replayRows = (rows, options) => page.evaluate(({ r, o }) => window.stageDebug.replayInputs(r, o), { r: rows, o: options })
    const replayScriptFile = async (scriptPath, options) => {
      const parsed = JSON.parse(fs.readFileSync(path.resolve(scriptPath), 'utf8'))
      return replayRows(Array.isArray(parsed) ? parsed : parsed.rows, options)
    }

    // Dash-recycle (5.1c review): a grounded dash release ends the dash immediately and starts its
    // cooldown (PlayerMotor), so releasing after 2 dashing frames, waiting 5 more, then pressing
    // again must start a second dash within 100ms (6 frames) of that second press. Runs here, before
    // the dash-jump replay below, because dash-jump ends mid-air at the apex: resetMovement keeps
    // the player's current y (it only re-centers x), so a reset after dash-jump would start this
    // grounded-dash test still falling instead of grounded.
    await resetMovement(false)
    const dashRecycleRows = [
      { frame: 0, held: [] },
      { frame: 2, held: ['moveRight', 'dash'] },
      { frame: 4, held: [] },
      { frame: 10, held: ['moveRight', 'dash'] },
      { frame: 18, held: [] }
    ]
    const recycleReplay = await replayRows(dashRecycleRows, { trace: true })
    const recycleTrace = recycleReplay.trace ?? []
    const secondPressFrame = 10
    const recycleWindowFrames = Math.ceil(100 / (1000 / 60))
    const firstDashReleased = recycleTrace.some((sample) => sample.frame >= 5 && sample.frame <= secondPressFrame && !sample.dashing)
    const secondDashStarted = recycleTrace.find(
      (sample) => sample.frame > secondPressFrame && sample.frame <= secondPressFrame + recycleWindowFrames && sample.dashing
    )

    await resetMovement(false)
    // The wall-jump probe above left synthetic blocked/touching flags; dashJumpScript's leading 30
    // idle deterministic frames both recompute real ground contact and let the respawn jump-
    // suppression window (120ms) lapse before the dash+jump rows run.
    const dashJumpReplay = await replayScriptFile(dashJumpScript, { trace: true })
    // The dash carries vx=320 unchanged through takeoff and the whole flight in this motor (see
    // scripts/smoke/inputs/dash-jump.json); takeoff is the first airborne sample, apex is the first
    // airborne sample where vy reaches 0 (restored as separate reads per the 5.1b review).
    const airborne = (dashJumpReplay.trace ?? []).filter((sample) => !sample.grounded)
    const takeoff = airborne[0] ?? null
    const apex = airborne.find((sample) => sample.vy >= 0) ?? null

    fs.writeFileSync(
      path.join(scenarioDir, 'dash-traces.json'),
      JSON.stringify(
        { baseLimits, baseReplay, speedsterLimits, speedsterReplay, wallJump, dragState, dashJumpReplay, takeoff, apex, recycleReplay, playerAfter: (await readState(page))?.newPlayer ?? null },
        null,
        2
      )
    )
    if (baseLimits.maxVelocityX !== 320 || baseReplay.finalPlayer.vx < 315 || baseReplay.finalPlayer.vx > 321) {
      throw new Error(`Expected unclamped base dash near 320, got cap=${baseLimits.maxVelocityX} vx=${baseReplay.finalPlayer.vx}.`)
    }
    if (!near(baseReplay.finalPlayer.x, 212, 2)) {
      throw new Error(`Expected the base dash to land near x=212 after 7 frames, got ${JSON.stringify(baseReplay.finalPlayer)}.`)
    }
    if (speedsterLimits.maxVelocityX !== 368 || speedsterReplay.finalPlayer.vx < 363 || speedsterReplay.finalPlayer.vx > 369) {
      throw new Error(
        `Expected Speedster dash near 368, got cap=${speedsterLimits.maxVelocityX} vx=${speedsterReplay.finalPlayer.vx}.`
      )
    }
    if (!near(speedsterReplay.finalPlayer.x, 216.8, 2)) {
      throw new Error(`Expected the Speedster dash to land near x=216.8 after 7 frames, got ${JSON.stringify(speedsterReplay.finalPlayer)}.`)
    }
    if (!wallJump.wallJumping || wallJump.jumpSource !== 'wall' || Math.abs(wallJump.vx + 353.28) > 0.01) {
      throw new Error(`Expected boosted Speedster wall-jump launch vx=-353.28, got ${JSON.stringify(wallJump)}.`)
    }
    if (dragState.dragX !== 0) {
      throw new Error(`Expected the player body drag.x to be 0 (the motor owns X), got ${JSON.stringify(dragState)}.`)
    }
    if (!takeoff || takeoff.grounded || takeoff.vx < 315 || takeoff.vx > 321) {
      throw new Error(`Expected the dash-jump to leave the ground near 320, got ${JSON.stringify(takeoff)}.`)
    }
    if (!apex || apex.grounded || apex.vx < 315 || apex.vx > 321) {
      throw new Error(`Expected the dash-jump to hold near 320 at apex, got ${JSON.stringify(apex)}.`)
    }
    if (!near(apex.x, 265.33, 2) || !near(apex.y, 180.77, 2)) {
      throw new Error(`Expected the dash-jump apex near x=265.33 y=180.77, got ${JSON.stringify(apex)}.`)
    }
    if (!firstDashReleased) {
      throw new Error(`Expected the first grounded dash to release before the second press, got trace ${JSON.stringify(recycleTrace)}.`)
    }
    if (!secondDashStarted) {
      throw new Error(`Expected a second dash to start within 100ms of the second press, got trace ${JSON.stringify(recycleTrace)}.`)
    }

    const finalState = await readState(page)
    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
    fs.writeFileSync(
      path.join(scenarioDir, 'state-0.json'),
      JSON.stringify({ baseLimits, baseReplay, speedsterLimits, speedsterReplay, wallJump, dragState, dashJumpReplay, takeoff, apex, recycleReplay, finalState }, null, 2)
    )
  } finally {
    await page.keyboard.up('Space').catch(() => {})
    await page.keyboard.up('z').catch(() => {})
    await page.keyboard.up('ArrowRight').catch(() => {})
    await closeGameplayPage(browser, scenarioDir, errors)
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
  const page = await newSmokePage(browser)
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
    upgradeUnlocks: ['armor_helmet', 'armor_arms', 'armor_body', 'armor_legs'],
    heartTanks: 8,
    subTanks: 4,
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
    // storyIntro=off opens the ending on the campaign record; Enter reaches the credits, Esc finishes to Title.
    await waitForState(page, (state) => state.scene === 'EndingScene' && state.ending?.phase === 'record')
    await page.locator('canvas').screenshot({ path: path.join(scenarioDir, 'shot-record.png') })
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'EndingScene' && state.ending?.phase === 'credits')
    await tapKey(page, 'Escape')
    // The ending returns to Title; with startScene=StageSelect in the automation URL, Title redirects there at once.
    const finalState = await waitForState(page, (state) => (state.scene === 'Title' || state.scene === 'StageSelect') && state.save?.gameCompleted === true, 10000)

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
  const page = await newSmokePage(browser)
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
  const page = await newSmokePage(browser)
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
    // On-demand music: once Stage Select's track plays, the stage and boss tracks (even one whose decode
    // landed after the victory) are no longer held. Skipped only if the browser kept audio locked.
    const musicSettled = await waitForState(
      page,
      (state) =>
        state.scene === 'StageSelect' &&
        (state.audio?.unlocked === false ||
          (state.audio?.musicPlayingCue === 'stage_select' &&
            state.audio?.musicLoading === false &&
            JSON.stringify(state.audio?.residentMusicKeys) === JSON.stringify(['bgm_stage_select'])))
    )
    fs.writeFileSync(path.join(scenarioDir, 'music-residency.json'), JSON.stringify(musicSettled.audio, null, 2))

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
  const page = await newSmokePage(browser)
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
  const page = await newSmokePage(browser)
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
  const page = await newSmokePage(browser)
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
    })
    // The hurt lock carries the knockback (5.2) and the page also runs in real time between polls, so a
    // fixed frame count spawned the capsules mid-flight (05b: the hero landed 30px away and never
    // collected them). Wait until the hero is grounded and still, then drop them at his feet.
    await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.newPlayer?.locomotion?.grounded === true &&
        Math.abs(Number(state.player?.vx ?? 1)) < 1 &&
        Number(state.newPlayer?.combat?.hitstunMs ?? 1) === 0,
      8000,
      'hero settled after the debug hit'
    )
    await page.evaluate(() => {
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
  const page = await newSmokePage(browser)
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
  const page = await newSmokePage(browser)
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
    progressionWorld: null,
    stageAccessUnlocked: ['tutorial_sentinel', 'pyro_maw'],
    collectedChecks: [],
    unlockedCheckpoints: {},
    selectedCheckpointByStage: {},
    upgradeUnlocks: ['armor_helmet', 'armor_arms', 'armor_body', 'armor_legs'],
    heartTanks: 8,
    subTanks: 4,
    pendingProgressionItems: [],
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
    if (!saveState.collectedChecks?.includes?.('pyro_maw:boss_clear')) {
      throw new Error('Expected the last live boss clear to persist the Pyro Maw boss-clear check.')
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
  const page = await newSmokePage(browser)
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
    const spawnedHostileProjectile = await page.evaluate(() => window.stageDebug?.spawnHostileProjectile?.())
    if (!spawnedHostileProjectile || spawnedHostileProjectile.active === false) {
      throw new Error('Expected debug hostile projectile spawn helper to return an active projectile before respawn test.')
    }
    const immediateProjectileState = await readState(page)
    if (Number(immediateProjectileState?.projectiles?.bossActive ?? 0) < 1) {
      await waitForState(
        page,
        (state) => state.scene === 'Game' && Number(state.projectiles?.bossActive ?? 0) >= 1,
        2000,
        'debug hostile projectile to become visible before respawn'
      )
    }

    await waitForPageCheck(page, () => Boolean(window.stageDebug?.forcePlayerDeath))
    await page.evaluate(() => window.stageDebug?.forcePlayerDeath?.())
    const deathPose = await sampleDeathPose(page)

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
      JSON.stringify({ activeBossRoomState, respawnState, death: await assertDeathSequence(page, deathPose) }, null, 2)
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
  const page = await newSmokePage(browser)
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

    // Camera follow trace (prompt 05 §5.3b, EVAL-P5-004 fix, review of commit 610fe2c): teleport
    // at least one screen from both bounds first (the old scenario passed with the camera stuck at
    // the left bound, which hid the bug), settle 30 frames, then read produced scroll from the
    // `camera` automation payload (documented in TESTING.md) rather than a Phaser instance, so a
    // render-scale skew like the one the review found would show up here.
    await waitForState(
      page,
      (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true,
      8000,
      'grounded player before the camera trace'
    )
    const spawnState = await readState(page)
    const boundsWidth = Number(spawnState.camera?.boundsWidth ?? 0)
    const margin = 448 + 40
    const midStageX = Math.min(Math.max(boundsWidth / 2, margin), Math.max(margin, boundsWidth - margin))
    await page.evaluate((x) => window.stageDebug.setPlayerX(x), midStageX)
    await advanceFrames(page, 30)

    const before = await readState(page)
    const rightReplay = await page.evaluate(() =>
      window.stageDebug.replayInputs([
        { frame: 0, held: ['moveRight'] },
        { frame: 60, held: [] }
      ])
    )
    const afterRight = await readState(page)
    await page.screenshot({ path: path.join(scenarioDir, 'shot-lookahead.png') })

    const heroScreenXRight = afterRight.player.x - afterRight.camera.scrollX
    const leadRight = afterRight.camera.midPointX - afterRight.player.x
    const verticalDriftPx = Math.abs(afterRight.camera.midPointY - before.camera.midPointY)

    const leftReplay = await page.evaluate(() =>
      window.stageDebug.replayInputs([
        { frame: 0, held: ['moveLeft'] },
        { frame: 30, held: [] }
      ])
    )
    const afterLeft = await readState(page)
    const leadLeft = afterLeft.camera.midPointX - afterLeft.player.x

    fs.writeFileSync(
      path.join(scenarioDir, 'state-lookahead.json'),
      JSON.stringify(
        { midStageX, before, afterRight, rightReplay, heroScreenXRight, leadRight, verticalDriftPx, afterLeft, leftReplay, leadLeft },
        null,
        2
      )
    )

    if (!(afterRight.camera.scrollX > before.camera.scrollX)) {
      throw new Error(`Camera did not scroll right: before ${before.camera.scrollX}, after ${afterRight.camera.scrollX}`)
    }
    if (
      !(
        afterRight.camera.scrollX > afterRight.camera.boundsX &&
        afterRight.camera.scrollX < afterRight.camera.boundsX + afterRight.camera.boundsWidth - 448
      )
    ) {
      throw new Error(`Camera scroll not strictly inside bounds: ${afterRight.camera.scrollX}`)
    }
    if (!(heroScreenXRight >= 0 && heroScreenXRight <= 448)) {
      throw new Error(`Hero left the frame: screen x ${heroScreenXRight}`)
    }
    if (!(leadRight >= 24 && leadRight <= 48)) {
      throw new Error(`Camera lead out of [24,48] after running right: ${leadRight}`)
    }
    if (!(leadLeft < 0)) {
      throw new Error(`Camera lead did not go negative after running left: ${leadLeft}`)
    }
    if (verticalDriftPx > 4) {
      throw new Error(`Camera vertical drift on flat ground exceeded 4px: ${verticalDriftPx}`)
    }

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

async function openGameplayPage(name, targetUrl = url) {
  const scenarioDir = path.join(outputDir, name)
  fs.rmSync(scenarioDir, { recursive: true, force: true })
  fs.mkdirSync(scenarioDir, { recursive: true })

  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader']
  })
  const page = await newSmokePage(browser)
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

  await page.goto(targetUrl, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(400)
  await page.evaluate(() => window.dispatchEvent(new Event('resize')))
  await waitForState(page, (state) => state.scene === 'StageSelect', 15000)
  await tapKey(page, 'Enter')
  try {
    await waitForState(page, (state) => state.scene === 'Game', 4000)
  } catch {
    const retryState = await readState(page)
    if (retryState?.scene === 'StageSelect') {
      await tapKey(page, 'Enter')
    }
    await waitForState(page, (state) => state.scene === 'Game', 15000)
  }

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
    await waitForPageCheck(
      page,
      () =>
        Boolean(window.stageDebug?.setPlayerX) &&
        Boolean(window.__phaserGame?.scene?.getScenes(true)?.[0]?.newPlayerRuntime?.resetForRespawn),
      8000,
      'stage debug position control and player runtime reset for sword scenario stabilization'
    )
    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      window.stageDebug?.setPlayerX?.(150)
      scene?.newPlayerRuntime?.resetForRespawn?.(30000)
      if (typeof scene?.playerMaxHp === 'number') {
        scene.playerHp = scene.playerMaxHp
        scene.player?.data?.set?.('hp', scene.playerMaxHp)
      }
      const enemyGroup = scene?.enemies
      enemyGroup?.getChildren?.().forEach((child) => {
        child?.disableBody?.(true, true)
        child?.setActive?.(false)
        child?.setVisible?.(false)
      })
    })
    await advanceFrames(page, 2)
    // Prompt 05 §5.2 item 1: a whiff emits no hit-stop; the hit-stop follows the recorded hit.
    const readHitFeel = () =>
      page.evaluate(() => {
        const director = window.__phaserGame?.scene?.getScene?.('Game')?.cameraDirector
        return { contactHits: [...(director?.contactHits ?? [])], hitstops: [...(director?.hitstops ?? [])] }
      })
    if (!moving) {
      // Streamed enemies can walk in; clear them again so the swing is a true whiff.
      await page.evaluate(() => {
        const scene = window.__phaserGame?.scene?.getScene?.('Game')
        scene?.enemies?.getChildren?.().forEach((child) => child?.disableBody?.(true, true))
      })
      const beforeWhiff = await readHitFeel()
      await tapKey(page, 'c', 2)
      await advanceFrames(page, 24)
      const afterWhiff = await readHitFeel()
      const newHits = afterWhiff.contactHits.length - beforeWhiff.contactHits.length
      const newStops = afterWhiff.hitstops.length - beforeWhiff.hitstops.length
      if (newStops !== newHits || newStops !== 0) {
        throw new Error(`Expected no hit-stop from a whiffed slash; saw ${JSON.stringify(afterWhiff)}.`)
      }
    }
    await waitForPageCheck(page, () => Boolean(window.spawnEnemyDebug))
    if (moving) {
      await page.keyboard.down('ArrowRight')
      await advanceFrames(page, 10)
    }
    await page.evaluate((enemyOffsetX) => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      const x = Number(scene?.player?.x ?? 0) + Number(enemyOffsetX ?? 28)
      const y = Number(scene?.player?.y ?? 0) - 4
      window.spawnEnemyDebug?.('enemy_gunner_bot', x, y)
    }, moving ? 72 : 28)
    await advanceFrames(page, 8)
    // The slash lasts about 13 frames; a real-time poll on a loaded machine can miss every one of them. Record
    // the first frame that shows the east slash from inside the page, then check that recorded state.
    await page.evaluate(() => {
      const game = window.__phaserGame?.scene?.getScene?.('Game')
      window.__eastSlashSeen = null
      window.__eastSlashProbe = () => {
        if (window.__eastSlashSeen) return
        const state = JSON.parse(window.render_game_to_text())
        const animationKey = String(state.newPlayer?.visuals?.animationKey ?? '')
        const frameName = String(state.playerVisual?.frameName ?? '')
        const validSlash =
          (animationKey === 'player_slash_ground_e' && frameName.startsWith('player_main/slash_ground_e/')) ||
          (animationKey === 'player_slash_air_e' && frameName.startsWith('player_main/slash_air_e/'))
        if (state.scene === 'Game' && validSlash && state.newPlayer?.visuals?.activeHitbox?.direction === 'e') window.__eastSlashSeen = state
      }
      game?.events.on('postupdate', window.__eastSlashProbe)
      // Sampled for the blade, not for survival: without i-frames the gunner 28px ahead can touch the hero first
      // on a loaded machine, and the hurt lock swallows the press.
      game?.newPlayerRuntime?.resetForRespawn?.(600000)
    })
    await tapKey(page, 'c', 2)
    const isEastSlashState = (state) => {
      if (state?.scene !== 'Game') {
        return false
      }
      const animationKey = String(state.newPlayer?.visuals?.animationKey ?? '')
      const frameName = String(state.playerVisual?.frameName ?? '')
      const validSlash =
        (animationKey === 'player_slash_ground_e' && frameName.startsWith('player_main/slash_ground_e/')) ||
        (animationKey === 'player_slash_air_e' && frameName.startsWith('player_main/slash_air_e/'))
      return validSlash && state.newPlayer?.visuals?.activeHitbox?.direction === 'e'
    }
    if (moving) {
      await advanceFrames(page, 6)
      const immediateMovingState = await readState(page)
      const movingHitState =
        isEastSlashState(immediateMovingState) && Number(immediateMovingState?.player?.vx ?? 0) >= 0
          ? immediateMovingState
          : await waitForState(
              page,
              (state) => isEastSlashState(state) && Number(state.player?.vx ?? 0) >= 0,
              5000
            )
      await captureScenarioState(page, scenarioDir, 0, movingHitState)
    } else {
      const immediateSlashState = await readState(page)
      let slashState = isEastSlashState(immediateSlashState) ? immediateSlashState : null
      for (let attempt = 0; !slashState && attempt < 3; attempt += 1) {
        try {
          await waitForPageCheck(page, () => Boolean(window.__eastSlashSeen), 5000, 'an east slash on any frame after the press')
          slashState = await page.evaluate(() => window.__eastSlashSeen)
        } catch (error) {
          if (attempt === 2) throw error
          await tapKey(page, 'c', 2)
        }
      }
      if (!isEastSlashState(slashState)) throw new Error(`Expected the recorded east slash state; saw ${JSON.stringify(slashState?.newPlayer?.visuals ?? null)}.`)
      await captureScenarioState(page, scenarioDir, 0, slashState)
      await waitForPageCheck(
        page,
        () => (window.__phaserGame?.scene?.getScene?.('Game')?.cameraDirector?.contactHits ?? []).some((hit) => String(hit.kind).startsWith('sword')),
        2500,
        'a recorded sword contact hit'
      )
      const hitFeel = await readHitFeel()
      const swordHits = hitFeel.contactHits.filter((hit) => String(hit.kind).startsWith('sword'))
      const firstSwordHitAt = Math.min(...swordHits.map((hit) => Number(hit.atMs)))
      const early = hitFeel.hitstops.filter((stop) => Number(stop.atMs) < firstSwordHitAt || stop.kind === 'other')
      if (early.length > 0 || !hitFeel.hitstops.some((stop) => String(stop.kind).startsWith('sword') && Number(stop.frames) >= 4)) {
        throw new Error(`Expected hit-stop only after the recorded sword hit; saw ${JSON.stringify(hitFeel)}.`)
      }
      fs.writeFileSync(path.join(scenarioDir, 'hit-feel.json'), JSON.stringify(hitFeel, null, 2))
    }
  } finally {
    await page.evaluate(() => { window.__phaserGame?.scene?.getScene?.('Game')?.events.off('postupdate', window.__eastSlashProbe) }).catch(() => {})
    if (moving) {
      await page.keyboard.up('ArrowRight').catch(() => {})
    }
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function runWestSwordFacingScenario(name) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)

  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      window.stageDebug?.setPlayerX?.(180)
      scene?.newPlayerRuntime?.resetForRespawn?.(30000)
    })
    await advanceFrames(page, 2)

    // Start west, then reverse locomotion during startup. The authored slash
    // direction must remain west and keep the east-authored sprite mirrored.
    await page.keyboard.down('ArrowLeft')
    await advanceFrames(page, 2)
    await tapKey(page, 'c', 2)
    await page.keyboard.up('ArrowLeft')
    await page.keyboard.down('ArrowRight')

    const slashState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.newPlayer?.combat?.slashDirection === 'w' &&
        state.newPlayer?.visuals?.activeHitbox?.direction === 'w' &&
        state.newPlayer?.visuals?.facing === -1 &&
        String(state.newPlayer?.visuals?.animationKey ?? '').endsWith('_w') &&
        String(state.playerVisual?.frameName ?? '').startsWith('player_main/slash_ground_e/'),
      3000,
      'west saber pose, hitbox, and mirrored atlas frame to stay aligned after locomotion reversal'
    )
    await captureScenarioState(page, scenarioDir, 0, slashState)
  } finally {
    await page.keyboard.up('ArrowLeft').catch(() => {})
    await page.keyboard.up('ArrowRight').catch(() => {})
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function runFrozenProjectileWatchdogScenario(name) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)

  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.freezeLatestPlayerProjectile))
    const baseline = Number((await readState(page))?.projectiles?.playerActive ?? 0)
    await tapKey(page, 'x', 2)
    await waitForState(
      page,
      (state) => Number(state.projectiles?.playerActive ?? 0) > baseline,
      2500,
      'player projectile to become active before freeze watchdog test'
    )
    const frozen = await page.evaluate(() => window.stageDebug?.freezeLatestPlayerProjectile?.())
    if (!frozen?.active || !frozen?.visible || !frozen?.bodyEnabled) {
      throw new Error('Expected the debug freeze hook to stop a live, visible projectile body.')
    }

    await advanceFrames(page, 20)
    const recycledState = await waitForState(
      page,
      (state) => Number(state.projectiles?.playerActive ?? 0) <= baseline,
      2500,
      'stalled projectile watchdog to recycle the frozen shot'
    )
    await captureScenarioState(page, scenarioDir, 0, recycledState)
  } finally {
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function runViewportAndEnergyEconomyScenario(name) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)

  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await waitForPageCheck(
      page,
      () =>
        Boolean(window.stageDebug?.setWeaponEnergy) &&
        Boolean(window.stageDebug?.playerViewport) &&
        Boolean(window.stageDebug?.spawnPickup),
      8000,
      'viewport, energy, and pickup automation hooks'
    )

    const pickupVisuals = await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      scene.weapons = ['Buster', 'FlameSerpent', 'HydroLance']
      scene.currentWeaponIndex = 1
      scene.weaponEnergyById = { Buster: 28, FlameSerpent: 0, HydroLance: 0 }
      scene.updateWeaponLabel?.()
      window.stageDebug?.setWeaponEnergy?.('FlameSerpent', 0)
      window.stageDebug?.setWeaponEnergy?.('HydroLance', 0)
      return {
        health: window.stageDebug?.spawnPickup?.('health', 48),
        weapon: window.stageDebug?.spawnPickup?.('ammo', 72)
      }
    })
    if (
      pickupVisuals.health?.textureKey !== 'pickup_capsule_health' ||
      pickupVisuals.weapon?.textureKey !== 'pickup_capsule_weapon'
    ) {
      throw new Error(`Expected distinct capsule textures, got ${JSON.stringify(pickupVisuals)}.`)
    }

    await tapKey(page, 'c', 2)
    const saberRechargeState = await waitForState(
      page,
      (state) =>
        state.playerState?.weapon === 'FlameSerpent' &&
        Number(state.weaponRecharge?.inventory?.FlameSerpent ?? 0) === 2,
      3000,
      'saber to restore two energy to the selected empty special weapon'
    )

    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      scene.currentWeaponIndex = 0
      scene.passiveWeaponRechargeAccumulatorMs = 0
      scene.updateWeaponLabel?.()
    })
    await waitForState(page, (state) => state.playerState?.weapon === 'Buster', 2500)
    await advanceFrames(page, 96)
    const passiveRechargeState = await waitForState(
      page,
      (state) =>
        Number(state.weaponRecharge?.inventory?.FlameSerpent ?? 0) >= 3 &&
        Number(state.weaponRecharge?.inventory?.HydroLance ?? 0) >= 1,
      3000,
      'holstered special weapons to receive their passive recharge tick'
    )

    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      const player = scene?.player
      const body = player?.body
      if (player && body) {
        player.setY(42)
        body.reset(player.x, 42)
        body.setVelocityY(-520)
      }
    })
    await advanceFrames(page, 8)
    const viewport = await page.evaluate(() => window.stageDebug?.playerViewport?.())
    if (Number(viewport?.top ?? -1) < Number(viewport?.actorCeiling ?? 90)) {
      throw new Error(`Player escaped behind the HUD: ${JSON.stringify(viewport)}.`)
    }

    const finalState = await readState(page)
    await captureScenarioState(page, scenarioDir, 0, {
      pickupVisuals,
      saberRechargeState,
      passiveRechargeState,
      viewport,
      finalState
    })
    await page.screenshot({ path: path.join(scenarioDir, 'shot-0.png') })
  } finally {
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function runPelletHitsShortEnemyScenario(name) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)

  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await waitForPageCheck(page, () => Boolean(window.spawnEnemyDebug) && Boolean(window.stageDebug?.setPlayerX))
    const baseline = await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      window.stageDebug?.setPlayerX?.(150)
      scene?.newPlayerRuntime?.resetForRespawn?.(30000)
      const describeProjectile = (bullet) => ({
        x: bullet.x, y: bullet.y, vx: bullet.body?.velocity?.x, vy: bullet.body?.velocity?.y,
        sourceId: bullet.data?.get('sourceId'), attack: bullet.data?.get('attack'),
        projectileId: bullet.data?.get('projectileId')
      })
      const priorHostileProjectiles = (scene?.bossBullets?.getChildren?.() ?? [])
        .filter((bullet) => bullet.active).map(describeProjectile)
      window.__pelletClashTrace = []
      const router = scene?.projectileCollisionRouter
      const originalClash = router.handleProjectileClash.bind(router)
      router.handleProjectileClash = (playerBullet, enemyBullet) => {
        window.__pelletClashTrace.push({ timeMs: scene.time.now,
          player: describeProjectile(playerBullet), enemy: describeProjectile(enemyBullet) })
        return originalClash(playerBullet, enemyBullet)
      }
      scene?.enemySpawner?.getEntities?.().forEach((entity) => entity?.destroy?.())
      scene?.enemySpawner?.enemies?.clear?.()
      scene?.enemySpawner?.levelMarkers?.clear?.()
      scene?.enemySpawner?.activeMarkerIds?.clear?.()
      scene?.enemySpawner?.retiredMarkerIds?.clear?.()
      // This scenario measures pellet/body contact; projectile interception has its own scenarios.
      for (const bullet of scene?.bossBullets?.getChildren?.() ?? []) {
        if (bullet.active) scene?.projectileSystem?.recycle?.(bullet)
      }
      const spawnOptions = scene.enemySpawner.options
      const previousOptions = { enableAI: spawnOptions.enableAI, enableProjectiles: spawnOptions.enableProjectiles }
      let entity
      try {
        spawnOptions.enableAI = false
        spawnOptions.enableProjectiles = false
        entity = window.spawnEnemyDebug?.(
          'enemy_mine_bot',
          Number(scene?.player?.x ?? 150) + 68,
          Number(scene?.player?.y ?? 0)
        )
      } finally {
        Object.assign(spawnOptions, previousOptions)
      }
      window.__pelletTestEnemyId = entity?.id ?? null
      return { id: entity?.id ?? null, hp: Number(entity?.combat?.currentHp ?? -1),
        timeMs: scene.time.now, priorHostileProjectiles, targetAttacksDisabled: true }
    })
    if (baseline.hp <= 0) {
      throw new Error('Expected a live short enemy for the pellet hitbox scenario.')
    }

    const beforeShot = await readState(page)
    await tapKey(page, 'ArrowRight', 3)
    await tapKey(page, 'x', 2)
    await advanceFrames(page, 2)
    const geometry = await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      const bounds = (sprite) => {
        const body = sprite?.body
        return body ? {
          x: sprite.x, y: sprite.y,
          left: body.left, right: body.right, top: body.top, bottom: body.bottom,
          width: body.width, height: body.height,
          visibleBounds: sprite.getBounds()
        } : null
      }
      const enemy = scene?.enemySpawner?.getEntities?.()
        ?.find?.((entity) => entity?.id === window.__pelletTestEnemyId)
      return {
        player: bounds(scene?.player),
        enemy: bounds(enemy?.sprite),
        projectiles: (scene?.playerBullets?.getChildren?.() ?? [])
          .filter((bullet) => bullet.active).map(bounds)
      }
    })
    let contactWaitError = null
    try {
      await waitForPageCheck(page, () => {
        const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
        const target = scene?.enemySpawner?.getEntities?.().find((entity) => entity.id === window.__pelletTestEnemyId)
        return Number(target?.combat?.currentHp ?? 5) < 5
      }, 2500, 'ordinary pellet to contact the isolated live short enemy')
    } catch (error) {
      contactWaitError = String(error)
    }

    const result = await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      const entity = scene?.enemySpawner
        ?.getEntities?.()
        ?.find?.((candidate) => candidate?.id === window.__pelletTestEnemyId)
      return {
        id: entity?.id ?? null,
        hp: entity?.combat?.currentHp ?? null,
        active: Boolean(entity?.sprite?.active),
        bodyEnabled: Boolean(entity?.sprite?.body?.enable)
      }
    })
    const state = await readState(page)
    await captureScenarioState(page, scenarioDir, 0, state)
    const evidence = {
      baseline, result, geometry, contactWaitError,
      clashes: await page.evaluate(() => window.__pelletClashTrace),
      shot: state?.combatDebug?.player?.lastProjectile,
      shotsFired: Number(state?.combatDebug?.player?.shotsFiredTotal ?? 0) -
        Number(beforeShot?.combatDebug?.player?.shotsFiredTotal ?? 0),
      acceptedEnemyHits: Number(state?.combatDebug?.totals?.byTarget?.enemy ?? 0) -
        Number(beforeShot?.combatDebug?.totals?.byTarget?.enemy ?? 0),
      hits: (state?.combatDebug?.recentHits ?? []).slice(beforeShot?.combatDebug?.recentHits?.length ?? 0)
    }
    fs.writeFileSync(path.join(scenarioDir, 'pellet-evidence.json'), JSON.stringify(evidence, null, 2))
    assertPelletHitEvidence(evidence)
  } finally {
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function runTouchControlsScenario(name) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name, touchUrl)

  try {
    const initialState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.playerState?.virtualControlsVisible === true &&
        state.newPlayer?.locomotion?.grounded === true,
      8000
    )

    await waitForPageCheck(
      page,
      () => Boolean(window.__phaserGame?.scene?.getScenes(true)?.[0]?.newPlayerRuntime?.resetForRespawn),
      8000,
      'new player runtime to expose resetForRespawn for touch scenario stabilization'
    )
    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      scene?.newPlayerRuntime?.resetForRespawn?.(30000)
    })
    await advanceFrames(page, 2)

    await waitForPageCheck(
      page,
      () => {
        const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
        return Boolean(scene?.touchControls?.setButtonHeld) && Boolean(scene?.touchControls?.triggerPause)
      },
      8000,
      'touch controls to expose button and pause handlers'
    )

    const setTouchButton = async (name, held) => {
      await page.evaluate(
        ({ name, held }) => {
          const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
          scene?.touchControls?.setButtonHeld?.(name, held)
        },
        { name, held }
      )
    }

    await setTouchButton('right', true)
    await advanceFrames(page, 24)
    const movedRightState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.playerState?.virtualControlsVisible === true &&
        state.newPlayer?.locomotion?.grounded === true &&
        Number(state.player?.vx ?? 0) >= 30,
      4000
    )

    await setTouchButton('right', false)
    await setTouchButton('left', true)
    await advanceFrames(page, 24)
    const movedLeftState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.playerState?.virtualControlsVisible === true &&
        state.newPlayer?.locomotion?.grounded === true &&
        Number(state.player?.vx ?? 0) <= -30,
      4000
    )

    await setTouchButton('left', false)
    await advanceFrames(page, 10)

    const groundedY = Number(movedLeftState.player?.y ?? 0)
    await setTouchButton('jump', true)
    await advanceFrames(page, 3)
    await setTouchButton('jump', false)
    const jumpState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.playerState?.virtualControlsVisible === true &&
        state.newPlayer?.locomotion?.grounded === false &&
        Number(state.player?.y ?? groundedY) < groundedY,
      4000
    )

    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 6000)
    await setTouchButton('dash', true)
    await advanceFrames(page, 3)
    const isDashState = (state) =>
      state?.scene === 'Game' &&
      state.playerState?.virtualControlsVisible === true &&
      (
        state.newPlayer?.locomotion?.dashing === true ||
        Number(state.newPlayer?.locomotion?.dashMs ?? 0) > 0 ||
        Number(state.newPlayer?.locomotion?.dashCooldownMs ?? 0) > 0 ||
        Number(state.combatDebug?.player?.dashCooldownMs ?? 0) > 0
      )
    const immediateDashState = await readState(page)
    const dashState = isDashState(immediateDashState)
      ? immediateDashState
      : await waitForState(page, isDashState, 3000, 'touch dash to engage')
    await setTouchButton('dash', false)
    await advanceFrames(page, 12)

    const shotBaselineState = await readState(page)
    const baselinePlayerProjectiles = Number(shotBaselineState?.projectiles?.playerActive ?? 0)
    const baselineShotsFiredTotal = Number(shotBaselineState?.newPlayer?.combat?.shotsFiredTotal ?? 0)
    await setTouchButton('shoot', true)
    await advanceFrames(page, 3)
    const shootHoldState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.playerState?.virtualControlsVisible === true &&
        (
          state.newPlayer?.combat?.charging === true ||
          Number(state.newPlayer?.combat?.chargeElapsedMs ?? 0) > 0 ||
          Number(state.combatDebug?.player?.chargeMs ?? 0) > 0
        ),
      3000,
      'touch shoot hold to enter charge state'
    )
    await setTouchButton('shoot', false)
    const shotState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        state.playerState?.virtualControlsVisible === true &&
        (
          Number(state.projectiles?.playerActive ?? 0) > baselinePlayerProjectiles ||
          Number(state.newPlayer?.combat?.shotsFiredTotal ?? 0) > baselineShotsFiredTotal ||
          Number(state.combatDebug?.player?.shotsFiredTotal ?? 0) > baselineShotsFiredTotal
        ),
      4000,
      'touch shoot release to spawn a projectile'
    )

    await setTouchButton('saber', true)
    await advanceFrames(page, 2)
    const isSaberSlashState = (state) =>
      state?.scene === 'Game' &&
      (
        typeof state.newPlayer?.combat?.slashPhase === 'string' ||
        (typeof state.newPlayer?.visuals?.animationKey === 'string' &&
          state.newPlayer.visuals.animationKey.startsWith('player_slash_')) ||
        Boolean(state.newPlayer?.visuals?.activeHitbox)
      )
    const immediateSaberState = await readState(page)
    const saberSlashState = isSaberSlashState(immediateSaberState)
      ? immediateSaberState
      : await waitForState(page, isSaberSlashState, 2500, 'touch saber to enter slash state')
    await setTouchButton('saber', false)
    const saberState = saberSlashState

    await captureScenarioState(page, scenarioDir, 0, {
      initialState,
      movedRightState,
      movedLeftState,
      jumpState,
      dashState,
      shotBaselineState,
      shootHoldState,
      shotState,
      saberSlashState,
      saberState
    })

    await page.evaluate(() => {
      const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
      scene?.touchControls?.triggerPause?.()
    })
    const pausedState = await waitForState(
      page,
      (state) =>
        Array.isArray(state.activeScenes) &&
        state.activeScenes.includes('Game') &&
        state.activeScenes.includes('SystemMenu'),
      3000
    )
    await captureScenarioState(page, scenarioDir, 1, pausedState)
  } finally {
    await page.mouse.up().catch(() => {})
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}

async function runAirSwordDirectionScenario(name, direction) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)

  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await tapKey(page, 'Space', 2)
    try {
      await waitForState(
        page,
        (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === false,
        1200,
        'jump to become airborne for air sword'
      )
    } catch {
      await page.evaluate(() => {
        const scene = window.__phaserGame?.scene?.getScenes(true)?.[0]
        const player = scene?.player
        const body = player?.body
        if (player && body) {
          player.setY(Number(player.y ?? 0) - 20)
          body.setVelocityY(-260)
        }
      })
      await waitForState(
        page,
        (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === false,
        2500,
        'fallback airborne setup for air sword'
      )
    }
    const key = direction === 'n' ? 'ArrowUp' : 'ArrowDown'
    await page.keyboard.down(key)
    await tapKey(page, 'c', 2)
    await advanceFrames(page, 2)
    const expectedAnimation = `player_slash_air_${direction}`
    const expectedFramePrefix = `player_main/slash_air_${direction}/`
    const isExpectedAirSlashState = (state) =>
      state?.scene === 'Game' &&
      state.newPlayer?.combat?.slashGrounded === false &&
      state.newPlayer?.combat?.slashDirection === direction &&
      (
        state.newPlayer?.visuals?.animationKey === expectedAnimation ||
        String(state.playerVisual?.frameName ?? '').startsWith(expectedFramePrefix) ||
        state.newPlayer?.visuals?.activeHitbox?.direction === direction
      )
    const immediateSlashState = await readState(page)
    const finalState = isExpectedAirSlashState(immediateSlashState)
      ? immediateSlashState
      : await waitForState(
      page,
      isExpectedAirSlashState,
      2500,
      `air sword ${direction} slash animation`
    )
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
        // Isolate the saber contract from the independently tested contact/projectile
        // damage paths so hitstun cannot consume the one-frame slash input.
        scene?.bossContactWire?.destroy?.()
        scene.bossContactWire = undefined
        scene?.disableProjectileGroups?.()
        scene?.bossProjectileController?.onPauseChanged?.(true)
        player.setPosition(boss.x - 26, boss.y + 8)
      }
    })
    await advanceFrames(page, 8)
    const preSlashState = await readState(page)
    const bossHpBefore = Number(preSlashState?.bossState?.hp?.current ?? 0)
    const bossHitsBefore = Number(preSlashState?.combatDebug?.totals?.byTarget?.boss ?? 0)
    await tapKey(page, 'c', 2)
    const slashState = await waitForState(
      page,
      (state) => {
        if (state.scene !== 'Game') {
          return false
        }
        const animationKey = String(state.newPlayer?.visuals?.animationKey ?? '')
        const frameName = String(state.playerVisual?.frameName ?? '')
        const validSlash =
          (animationKey === 'player_slash_ground_e' && frameName.startsWith('player_main/slash_ground_e/')) ||
          (animationKey === 'player_slash_air_e' && frameName.startsWith('player_main/slash_air_e/')) ||
          (animationKey === 'player_slash_air_spin' && frameName.startsWith('player_main/slash_air_spin/'))
        return validSlash && state.newPlayer?.visuals?.activeHitbox?.direction === 'e'
      },
      2500
    )
    await captureScenarioState(page, scenarioDir, 0, slashState)
    const damageState = await waitForState(
      page,
      (state) =>
        state.scene === 'Game' &&
        (
          Number(state.bossState?.hp?.current ?? bossHpBefore) < bossHpBefore ||
          Number(state.combatDebug?.totals?.byTarget?.boss ?? 0) > bossHitsBefore
        ),
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
  linkStableRunDir(outputDir, smokeStableDir)
  const summary = createSmokeSummary()
  writeSmokeSummary(summary)

  const smokeServer = getSmokeServerConfig()
  const vite = spawn('npm', smokeServer.args, {
    stdio: 'pipe',
    cwd: process.cwd(),
    env: smokeServer.env,
    shell: false,
    detached: process.platform !== 'win32'
  })
  // A detached group no longer gets the terminal's Ctrl-C, so pass it on instead of orphaning the server.
  process.once('SIGINT', () => {
    signalChildGroup(vite, 'SIGTERM')
    process.exit(130)
  })

  let markReady = () => {}
  const readyFromOutput = new Promise((resolve) => {
    markReady = resolve
  })
  const readyMarker = `http://${host}:${port}/`
  const maybeMarkReady = (chunk) => {
    if (String(chunk).includes(readyMarker)) {
      markReady()
    }
  }

  const relay = (chunk) => {
    maybeMarkReady(chunk)
    process.stdout.write(`[${smokeServer.label}] ${chunk}`)
  }
  const relayErr = (chunk) => {
    maybeMarkReady(chunk)
    process.stderr.write(`[${smokeServer.label}] ${chunk}`)
  }

  vite.stdout.on('data', relay)
  vite.stderr.on('data', relayErr)

  try {
    await Promise.race([waitForServerReady(serverUrl), readyFromOutput])

    await executeSmokeScenario(summary, '1-click-select', async () => {
      const clickOnlyLast = await runClickOnlyStageSelectScenario('1-click-select')
      if (clickOnlyLast.scene !== 'StageSelect') {
        throw new Error(`Expected click-only scenario to stay on StageSelect, got ${clickOnlyLast.scene}`)
      }

      const selectedBoss = clickOnlyLast.stageSelect?.selectedBossId
      if (selectedBoss !== 'pyro_maw') {
        throw new Error(`Expected click-only scenario to remain on pyro_maw, got ${selectedBoss ?? 'null'}`)
      }
    })

    await executeSmokeScenario(summary, '2-keyboard-enter-start', () =>
      runKeyboardEnterStartScenario('2-keyboard-enter-start')
    )

    await executeSmokeScenario(summary, '3-enter-then-charge-shot', async () => {
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
        typeof shootLast.combatDebug?.player?.chargeMs !== 'number' ||
        typeof shootLast.combatDebug?.player?.shotsFiredTotal !== 'number' ||
        typeof shootLast.combatDebug?.player?.lastProjectileSpawnMs !== 'number'
      ) {
        throw new Error(
          'Expected combatDebug.player timers and shot metrics (dashCooldownMs/chargeMs/shotsFiredTotal/lastProjectileSpawnMs) in state payload.'
        )
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
    })

    await executeSmokeScenario(summary, '4-title-controls', () => runTitleControlsScenario('4-title-controls'))
    await executeSmokeScenario(summary, '4b-stage-select-progression', () =>
      runStageSelectProgressionSummaryScenario('4b-stage-select-progression')
    )
    await executeSmokeScenario(summary, '4c-touch-controls', () => runTouchControlsScenario('4c-touch-controls'))
    await executeSmokeScenario(summary, '4d-progression-import-truth', () =>
      runProgressionImportTruthScenario('4d-progression-import-truth')
    )

    await executeSmokeScenario(summary, '33-classic-stage-select', () => runClassicCampaignScenario('33-classic-stage-select', { outputDir, titleUrl, readState, waitForState, advanceFrames, tapKey }))

    await executeSmokeScenario(summary, '33b-classic-upgrade-runtime', () => runClassicUpgradeScenario('33b-classic-upgrade-runtime', { outputDir, titleUrl, readState, waitForState, advanceFrames, tapKey }))

    await executeSmokeScenario(summary, '5-boss-clear-enter-return', () =>
      runVictoryReturnScenario('5-boss-clear-enter-return', 'enter')
    )
    await executeSmokeScenario(summary, '6-boss-clear-numpad-return', () =>
      runVictoryReturnScenario('6-boss-clear-numpad-return', 'numpad_enter')
    )
    await executeSmokeScenario(summary, '7-boss-clear-escape-return', () =>
      runVictoryReturnScenario('7-boss-clear-escape-return', 'escape')
    )
    await executeSmokeScenario(summary, '8-boss-room-activation', () =>
      runBossRoomActivationScenario('8-boss-room-activation')
    )
    await executeSmokeScenario(summary, '9-checkpoint-respawn', () =>
      runCheckpointRespawnScenario('9-checkpoint-respawn')
    )
    await executeSmokeScenario(summary, '10-enemy-streaming', () =>
      runEnemyStreamingScenario('10-enemy-streaming')
    )
    await executeSmokeScenario(summary, '11-final-route-unlock', () =>
      runFinalRouteUnlockScenario('11-final-route-unlock')
    )
    await executeSmokeScenario(summary, '12-weapon-switch-energy', () =>
      runWeaponSwitchAndEnergyScenario('12-weapon-switch-energy')
    )
    await executeSmokeScenario(summary, '13-load-save-restores-weapon-energy', () =>
      runLoadSaveRestoreScenario('13-load-save-restores-weapon-energy')
    )
    await executeSmokeScenario(summary, '13b-corrupt-save-rejected', () =>
      runCorruptSaveRejectedScenario('13b-corrupt-save-rejected')
    )
    await executeSmokeScenario(summary, '13c-unified-player-damage', () =>
      runUnifiedPlayerDamageScenario('13c-unified-player-damage')
    )
    await executeSmokeScenario(summary, '13d-movement-feel', () =>
      runMovementFeelScenario('13d-movement-feel')
    )
    const storyDeps = { outputDir, storyUrl, readState, waitForState, waitForPageCheck, advanceFrames, tapKey }
    await executeSmokeScenario(summary, '34-prologue-flow', () => runPrologueFlowScenario('34-prologue-flow', storyDeps))
    await executeSmokeScenario(summary, '35-radio-ticker', () => runRadioTickerScenario('35-radio-ticker', storyDeps))
    await executeSmokeScenario(summary, '36-ending-flow', () => runEndingFlowScenario('36-ending-flow', storyDeps))
    await executeSmokeScenario(summary, '42-mechanics-matrix', async () => (await import('./smoke/mechanics-matrix.mjs')).runMechanicsMatrixScenario('42-mechanics-matrix', { outputDir, url, readState, waitForState, advanceFrames, tapKey }))
    await executeSmokeScenario(summary, '43-miniboss-custodian', async () => (await import('./smoke/miniboss-custodian.mjs')).runMinibossCustodianScenario('43-miniboss-custodian', storyDeps))
    await executeSmokeScenario(summary, '49-tutorial-verbs', async () => (await import('./smoke/tutorial-verbs.mjs')).runTutorialVerbsScenario('49-tutorial-verbs', storyDeps))
    await executeSmokeScenario(summary, '50-pyro-route', async () => (await import('./smoke/pyro-route.mjs')).runPyroRouteScenario('50-pyro-route', storyDeps))
    await executeSmokeScenario(summary, '51-saber-combo', async () => (await import('./smoke/saber-combo.mjs')).runSaberComboScenario('51-saber-combo', { outputDir, url, readState, waitForState, advanceFrames }))
    await executeSmokeScenario(summary, '52-boss-telegraphs', async () => (await import('./smoke/boss-telegraphs.mjs')).runBossTelegraphsScenario('52-boss-telegraphs', { outputDir, url, readState, waitForState }))
    await executeSmokeScenario(summary, '44-boss-beats', async () => (await import('./smoke/boss-beats.mjs')).runBossBeatsScenario('44-boss-beats', { outputDir, url, readState, waitForState }))
    await executeSmokeScenario(summary, '37-story-replay-skip', () => runStoryReplaySkipScenario('37-story-replay-skip', storyDeps))
    const pauseDeps = { outputDir, titleUrl, readState, waitForState, waitForPageCheck, advanceFrames, tapKey }
    await executeSmokeScenario(summary, '38-options-persist', () => runOptionsPersistScenario('38-options-persist', pauseDeps))
    await executeSmokeScenario(summary, '38b-pause-weapon-select', () => runPauseWeaponSelectScenario('38b-pause-weapon-select', pauseDeps))
    await executeSmokeScenario(summary, '38c-title-continue-autosave', () => runTitleContinueScenario('38c-title-continue-autosave', pauseDeps))
    await executeSmokeScenario(summary, '41-profiles', async () => (await import('./smoke/profiles.mjs')).runProfilesScenario('41-profiles', storyDeps))
    await executeSmokeScenario(summary, '13f-input-focus-loss', () => runInputFocusLossScenario('13f-input-focus-loss', { outputDir, titleUrl, readState, waitForState, advanceFrames, tapKey }))

    await executeSmokeScenario(summary, '14-completion-return-flow', () =>
      runCompletionReturnScenario('14-completion-return-flow')
    )
    await executeSmokeScenario(summary, '13e-input-source-lifecycle', () =>
      runInputLifecycleScenario('13e-input-source-lifecycle', { openGameplayPage, closeGameplayPage, readState, waitForState, waitForPageCheck, advanceFrames, tapKey, titleUrl })
    )
    await executeSmokeScenario(summary, '39-boss-grounded', () =>
      runBossGroundingScenario('39-boss-grounded', { openGameplayPage, closeGameplayPage, waitForState, waitForPageCheck, advanceFrames })
    )
    await executeSmokeScenario(summary, '40-hd-render', () =>
      runHdRenderScenario('40-hd-render', { outputDir, url, readState, waitForState, advanceFrames, tapKey })
    )
    await executeSmokeScenario(summary, '15-menu-audio-and-input-stability', () =>
      runMenuAudioInputScenario('15-menu-audio-and-input-stability')
    )
    await executeSmokeScenario(summary, '16-music-cue-flow', () =>
      runMusicCueScenario('16-music-cue-flow')
    )
    await executeSmokeScenario(summary, '17-projectile-clash', () =>
      runProjectileClashScenario('17-projectile-clash')
    )
    await executeSmokeScenario(summary, '18-extended-stage-scroll', () =>
      runExtendedStageScenario('18-extended-stage-scroll')
    )
    await executeSmokeScenario(summary, '19-projectile-clash-survive', () =>
      runProjectileClashSurviveScenario('19-projectile-clash-survive')
    )
    await executeSmokeScenario(summary, '20-pickup-recovery', () =>
      runPickupRecoveryScenario('20-pickup-recovery')
    )
    await executeSmokeScenario(summary, '21-boss-gate-lock', () =>
      runBossGateLockScenario('21-boss-gate-lock')
    )
    await executeSmokeScenario(summary, '22-final-unlock-from-last-clear', () =>
      runFinalUnlockFromLastClearScenario('22-final-unlock-from-last-clear')
    )
    await executeSmokeScenario(summary, '23-boss-room-respawn', () =>
      runBossRoomRespawnScenario('23-boss-room-respawn')
    )
    await executeSmokeScenario(summary, '24-ground-sword-enemy', () =>
      runGroundSwordEnemyScenario('24-ground-sword-enemy')
    )
    await executeSmokeScenario(summary, '25-air-sword-up', () =>
      runAirSwordDirectionScenario('25-air-sword-up', 'n')
    )
    await executeSmokeScenario(summary, '26-air-sword-down', () =>
      runAirSwordDirectionScenario('26-air-sword-down', 's')
    )
    await executeSmokeScenario(summary, '27-boss-sword-hit', () =>
      runBossSwordScenario('27-boss-sword-hit')
    )
    await executeSmokeScenario(summary, '28-moving-sword-align', () =>
      runGroundSwordEnemyScenario('28-moving-sword-align', true)
    )
    await executeSmokeScenario(summary, '29-pellet-hits-short-enemy', () =>
      runPelletHitsShortEnemyScenario('29-pellet-hits-short-enemy')
    )
    await executeSmokeScenario(summary, '30-west-sword-facing', () =>
      runWestSwordFacingScenario('30-west-sword-facing')
    )
    await executeSmokeScenario(summary, '31-frozen-projectile-watchdog', () =>
      runFrozenProjectileWatchdogScenario('31-frozen-projectile-watchdog')
    )
    await executeSmokeScenario(summary, '32-viewport-energy-economy', () =>
      runViewportAndEnergyEconomyScenario('32-viewport-energy-economy')
    )
    // A filter that matches nothing must not report a pass with every scenario skipped.
    if (smokeOnlyScenarios.size > 0 && summary.scenarios.every((scenario) => scenario.status === 'skipped')) {
      throw new Error(`SMOKE_ONLY=${[...smokeOnlyScenarios].join(',')} matched no scenario`)
    }
    summary.status = summary.scenarios.some((scenario) => scenario.status === 'fail') ? 'fail' : 'pass'
  } finally {
    if (!vite.killed) {
      signalChildGroup(vite, 'SIGTERM')
    }
    if (summary.status === 'running') {
      summary.status = 'fail'
    }
    summary.completedAt = new Date().toISOString()
    writeSmokeSummary(summary)
  }

  const ran = summary.scenarios.filter((scenario) => scenario.status !== 'skipped').length
  console.log(`Smoke test complete: ${ran} ran, ${summary.scenarios.length - ran} skipped. Artifacts: ${outputDir}`)
  // Name every failure in the log itself: CI keeps the summary only inside an artifact.
  const failed = summary.scenarios.filter((scenario) => scenario.status === 'fail')
  failed.forEach((scenario) => {
    const error = scenario.error ?? {}
    const where = String(error.stack ?? '').split('\n').find((line) => line.includes('/scripts/smoke')) ?? ''
    console.log(`Smoke FAILED ${scenario.name}: ${String(error.message ?? error).split('\n')[0].slice(0, 300)} ${where.trim()}`)
  })
  if (failed.length > 0) {
    process.exitCode = 1
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
