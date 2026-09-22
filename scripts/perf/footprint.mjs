// Footprint eval: how heavy the built game is on disk, over the wire, and in memory while it runs.
//
// Usage: npm run build && npm run perf:footprint            (checks tests/perf-budget.json, exits 1 on a breach)
//        PERF_REPORT_ONLY=1 npm run perf:footprint          (records, never fails; use for a baseline)
//        PERF_LABEL=before npm run perf:footprint           (names the output file)
//
// Serves dist/ with `vite preview`, drives headless Chromium through Title, a stage, its boss room and three
// stage revisits, and writes output/perf/footprint-<label>.json plus a Markdown table. Decoded audio and
// texture sizes are computed from Phaser's caches (bytes the page must hold, not file sizes); the JS heap
// is read after a forced GC. Headless SwiftShader frame times are a CPU proxy only, never a GPU verdict.
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import zlib from 'node:zlib'
import { chromium } from 'playwright'

const root = path.resolve('.')
const distDir = path.join(root, 'dist')
const outDir = path.join(root, 'output/perf')
const budget = JSON.parse(fs.readFileSync(path.join(root, 'tests/perf-budget.json'), 'utf8'))
const label = (process.env.PERF_LABEL ?? 'latest').replace(/[^a-z0-9_-]/gi, '_')
const reportOnly = process.env.PERF_REPORT_ONLY === '1'
const host = '127.0.0.1'
const port = Number(process.env.PERF_PORT ?? 4190)
const base = `http://${host}:${port}/`
const titleUrl = `${base}?renderer=webgl&automation=1&storyIntro=off`
const stageSelectUrl = `${base}?renderer=webgl&automation=1&storyIntro=off&startScene=StageSelect`
const STAGE = { stageId: 'pyro_maw', bossId: 'pyro_maw' }
const MB = 1e6

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const round = (value, digits = 2) => Math.round(value * 10 ** digits) / 10 ** digits

function walk(dir) {
  if (!fs.existsSync(dir)) return []
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name)
    return entry.isDirectory() ? walk(full) : [full]
  })
}

function staticMetrics() {
  const files = walk(distDir)
  if (files.length === 0) throw new Error('dist/ is empty: run `npm run build` first')
  const size = (list) => list.reduce((sum, file) => sum + fs.statSync(file).size, 0)
  const js = files.filter((file) => file.endsWith('.js'))
  const gz = (file) => zlib.gzipSync(fs.readFileSync(file), { level: 9 }).length
  const phaser = js.find((file) => path.basename(file).startsWith('phaser'))
  return {
    distTotalMB: round(size(files) / MB),
    distMapsMB: round(size(files.filter((file) => file.endsWith('.map'))) / MB),
    distFiles: files.length,
    jsRawKB: round(size(js) / 1e3, 1),
    jsGzipKB: round(js.reduce((sum, file) => sum + gz(file), 0) / 1e3, 1),
    phaserChunkGzipKB: phaser ? round(gz(phaser) / 1e3, 1) : null,
    runtimeAssetsMB: Object.fromEntries(
      ['audio', 'backgrounds', 'sprites', 'private'].map((dir) => [dir, round(size(walk(path.join(distDir, 'assets', dir))) / MB)])
    )
  }
}

async function startServer() {
  const vite = path.join(root, 'node_modules/.bin/vite')
  const child = spawn(vite, ['preview', '--host', host, '--port', String(port), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  })
  let log = ''
  child.stdout.on('data', (chunk) => (log += chunk))
  child.stderr.on('data', (chunk) => (log += chunk))
  // node:http with no agent: undici's fetch keeps failing an origin after the first refused connection.
  const probe = () =>
    new Promise((resolve) => {
      const request = http.get(base, { agent: false }, (response) => {
        response.resume()
        resolve(response.statusCode === 200)
      })
      request.on('error', () => resolve(false))
    })
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await probe()) return child
    await sleep(100)
  }
  child.kill()
  throw new Error(`vite preview did not start on ${base}\n${log}`)
}

const legacySave = { weaponsUnlocked: [], clearedBosses: [], tutorialCleared: false, finalBossCleared: false, gameCompleted: false }

async function newPage(browser, viewport, deviceScaleFactor = 1) {
  const context = await browser.newContext({ viewport, deviceScaleFactor })
  await context.addInitScript((save) => {
    if (!localStorage.getItem('save.v1')) localStorage.setItem('save.v1', JSON.stringify(save))
  }, legacySave)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text())
  })
  const cdp = await context.newCDPSession(page)
  await cdp.send('Performance.enable')
  return { context, page, cdp, errors }
}

async function readState(page) {
  const text = await page.evaluate(() => (typeof window.render_game_to_text === 'function' ? window.render_game_to_text() : null))
  return text ? JSON.parse(text) : null
}

async function waitForState(page, predicate, timeoutMs, description) {
  const started = Date.now()
  let last = null
  while (Date.now() - started < timeoutMs) {
    last = await readState(page).catch(() => null)
    if (last && predicate(last)) return last
    await sleep(40)
  }
  throw new Error(`timed out after ${timeoutMs}ms waiting for ${description}; last scene ${last?.scene ?? 'none'}`)
}

async function frames(page, count) {
  await page.evaluate(async (n) => {
    for (let i = 0; i < n; i += 1) await window.advanceTime?.(1000 / 60)
  }, count)
}

/** Everything the page holds that we can attribute: decoded audio, textures, text canvases, listeners, heap. */
async function snapshot(page, cdp) {
  await cdp.send('HeapProfiler.collectGarbage').catch(() => {})
  await sleep(50)
  const { metrics } = await cdp.send('Performance.getMetrics')
  const metric = (name) => metrics.find((entry) => entry.name === name)?.value ?? 0
  const inPage = await page.evaluate(() => {
    const game = window.__phaserGame
    if (!game) return null
    const audioEntries = game.cache?.audio?.entries?.entries ?? {}
    let decodedAudioBytes = 0
    const audioKeys = []
    Object.entries(audioEntries).forEach(([key, value]) => {
      if (value && typeof value.length === 'number' && typeof value.numberOfChannels === 'number') {
        decodedAudioBytes += value.length * value.numberOfChannels * 4
        audioKeys.push(key)
      }
    })
    let textureBytes = 0
    const textureKeys = game.textures.getTextureKeys()
    textureKeys.forEach((key) => {
      const texture = game.textures.get(key)
      texture.source.forEach((source) => {
        textureBytes += (source.width || 0) * (source.height || 0) * 4
      })
    })
    let textObjects = 0
    let textCanvasBytes = 0
    let displayObjects = 0
    const visit = (list) =>
      list.forEach((child) => {
        displayObjects += 1
        if (child.type === 'Text' && child.canvas) {
          textObjects += 1
          textCanvasBytes += child.canvas.width * child.canvas.height * 4
        }
        if (Array.isArray(child.list)) visit(child.list)
      })
    game.scene.getScenes(true).forEach((scene) => visit(scene.children?.list ?? []))
    const emitters = [game.events, game.scale, game.sound, game.textures, game.registry?.events, game.input, game.loop?.events]
    let listeners = 0
    emitters.forEach((emitter) => {
      if (!emitter?.eventNames) return
      emitter.eventNames().forEach((name) => (listeners += emitter.listenerCount(name)))
    })
    game.scene.scenes.forEach((scene) => {
      const events = scene.events
      if (events?.eventNames) events.eventNames().forEach((name) => (listeners += events.listenerCount(name)))
    })
    const state = JSON.parse(window.render_game_to_text?.() ?? '{}')
    return {
      scene: state.scene ?? null,
      musicCue: state.audio?.musicCue ?? null,
      decodedAudioBytes,
      audioKeys,
      soundInstances: game.sound?.sounds?.length ?? null,
      textureBytes,
      textureCount: textureKeys.length,
      textObjects,
      textCanvasBytes,
      displayObjects,
      listeners,
      canvas: { width: game.canvas.width, height: game.canvas.height },
      renderer: game.renderer?.type === 2 ? 'webgl' : 'canvas'
    }
  })
  return {
    jsHeapMB: round(metric('JSHeapUsedSize') / MB),
    jsHeapTotalMB: round(metric('JSHeapTotalSize') / MB),
    domNodes: metric('Nodes'),
    jsListeners: metric('JSEventListeners'),
    ...(inPage
      ? {
          scene: inPage.scene,
          musicCue: inPage.musicCue,
          decodedAudioMB: round(inPage.decodedAudioBytes / MB),
          audioKeys: inPage.audioKeys,
          soundInstances: inPage.soundInstances,
          textureMB: round(inPage.textureBytes / MB),
          textureCount: inPage.textureCount,
          textObjects: inPage.textObjects,
          textCanvasMB: round(inPage.textCanvasBytes / MB),
          displayObjects: inPage.displayObjects,
          phaserListeners: inPage.listeners,
          canvas: inPage.canvas,
          canvasMB: round((inPage.canvas.width * inPage.canvas.height * 4) / MB),
          renderer: inPage.renderer
        }
      : {})
  }
}

/** CPU time per Phaser step (update + render submission) over `count` real frames. */
async function stepTimes(page, count) {
  return page.evaluate(async (n) => {
    const game = window.__phaserGame
    const samples = []
    let started = 0
    const pre = () => (started = performance.now())
    const post = () => started && samples.push(performance.now() - started)
    game.events.on('prestep', pre)
    game.events.on('postrender', post)
    await new Promise((resolve) => {
      const tick = () => (samples.length >= n ? resolve() : requestAnimationFrame(tick))
      requestAnimationFrame(tick)
    })
    game.events.off('prestep', pre)
    game.events.off('postrender', post)
    const sorted = samples.slice().sort((a, b) => a - b)
    const pick = (q) => sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
    return { frames: sorted.length, p50: pick(0.5), p95: pick(0.95), p99: pick(0.99), max: sorted[sorted.length - 1] }
  }, count)
}

async function bootScenario(browser) {
  const { context, page, cdp, errors } = await newPage(browser, { width: 896, height: 504 })
  await cdp.send('Network.enable')
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true })
  const requests = new Map()
  let bytes = 0
  const byType = {}
  cdp.on('Network.responseReceived', (event) => requests.set(event.requestId, event.type))
  cdp.on('Network.loadingFinished', (event) => {
    bytes += event.encodedDataLength
    const type = requests.get(event.requestId) ?? 'Other'
    byType[type] = (byType[type] ?? 0) + event.encodedDataLength
  })
  const started = Date.now()
  await page.goto(titleUrl, { waitUntil: 'domcontentloaded' })
  await waitForState(page, (state) => state.scene === 'Title', 30000, 'Title after Preload')
  const titleReadyMs = Date.now() - started
  const bootDownloadMB = round(bytes / MB)
  const downloadByType = Object.fromEntries(Object.entries(byType).map(([type, value]) => [type, round(value / MB, 3)]))
  await sleep(500)
  const snap = await snapshot(page, cdp)
  await context.close()
  return { titleReadyMs, bootDownloadMB, requests: requests.size, downloadByType, ...snap, errors }
}

async function enterStage(page) {
  await page.goto(stageSelectUrl, { waitUntil: 'domcontentloaded' })
  await waitForState(page, (state) => state.scene === 'StageSelect', 30000, 'StageSelect')
  await page.evaluate((data) => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', data), STAGE)
  await waitForState(
    page,
    (state) => state.scene === 'Game' && state.stageRuntime?.stageId === STAGE.stageId && state.newPlayer?.locomotion?.grounded === true,
    30000,
    'grounded in Game'
  )
}

async function stageScenario(browser) {
  const { context, page, cdp, errors } = await newPage(browser, { width: 896, height: 504 })
  await enterStage(page)
  await frames(page, 90)
  const stage = await snapshot(page, cdp)
  const steps = await stepTimes(page, 180)

  // Combat: shots, dashes and slashes for about four seconds. Effects used to allocate an emitter,
  // sprite or Graphics set each time; with pools the display-object count stays flat.
  const combatStart = await snapshot(page, cdp)
  const combatStepsPending = stepTimes(page, 240)
  for (let index = 0; index < 36; index += 1) {
    await page.keyboard.press('x')
    if (index % 4 === 0) await page.keyboard.press('z')
    if (index % 6 === 0) await page.keyboard.press('c')
    await sleep(70)
  }
  const combatSteps = await combatStepsPending
  await sleep(800)
  const combatEnd = await snapshot(page, cdp)
  const combat = {
    steps: combatSteps,
    displayObjectsBefore: combatStart.displayObjects,
    displayObjectsAfter: combatEnd.displayObjects,
    objectGrowth: combatEnd.displayObjects - combatStart.displayObjects,
    saveBytes: await page.evaluate(() => (localStorage.getItem('save.v1') ?? '').length)
  }

  await page.evaluate(() => {
    window.stageDebug?.crossBossGate?.()
    window.stageDebug?.activateBossRoom?.()
    const room = window.__phaserGame?.scene?.getScenes(true)?.[0]?.activeBossRoom
    if (room) window.stageDebug?.setPlayerX?.(room.x + room.width - 44)
    window.bossDebug?.unlockIntro?.()
    window.stageDebug?.skipDialogue?.()
  })
  await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.bossRoom?.cameraLocked === true, 30000, 'boss room lock')
  // Give a lazily loaded boss track time to fetch and decode before measuring.
  // musicCue is what the game asked for; musicPlayingCue flips only once the track has decoded and started.
  await waitForState(
    page,
    (state) => ['boss', 'final'].includes(state.audio?.musicPlayingCue) || (state.audio && !state.audio.unlocked),
    20000,
    'boss track decoded and playing'
  )
  await sleep(500)
  await frames(page, 60)
  const boss = await snapshot(page, cdp)
  const bossSteps = await stepTimes(page, 180)
  await context.close()
  return { stage: { ...stage, steps }, combat, boss: { ...boss, steps: bossSteps }, errors }
}

async function revisitScenario(browser) {
  const { context, page, cdp, errors } = await newPage(browser, { width: 896, height: 504 })
  await enterStage(page)
  const cycles = []
  for (let cycle = 0; cycle < 4; cycle += 1) {
    await frames(page, 30)
    await page.evaluate(() => window.__phaserGame.scene.getScene('Game').scene.start('StageSelect'))
    await waitForState(page, (state) => state.scene === 'StageSelect', 15000, 'StageSelect on revisit')
    await frames(page, 20)
    await page.evaluate((data) => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', data), STAGE)
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 15000, 'Game on revisit')
    await frames(page, 30)
    const snap = await snapshot(page, cdp)
    cycles.push({
      cycle,
      jsHeapMB: snap.jsHeapMB,
      textureCount: snap.textureCount,
      textureMB: snap.textureMB,
      phaserListeners: snap.phaserListeners,
      jsListeners: snap.jsListeners,
      soundInstances: snap.soundInstances,
      displayObjects: snap.displayObjects,
      decodedAudioMB: snap.decodedAudioMB
    })
  }
  await context.close()
  // Cycle 0 warms caches; growth is measured from cycle 1 to the last cycle.
  const first = cycles[1]
  const last = cycles[cycles.length - 1]
  return {
    cycles,
    heapGrowthMB: round(last.jsHeapMB - first.jsHeapMB),
    textureGrowth: last.textureCount - first.textureCount,
    listenerGrowth: last.phaserListeners - first.phaserListeners,
    jsListenerGrowth: last.jsListeners - first.jsListeners,
    soundGrowth: (last.soundInstances ?? 0) - (first.soundInstances ?? 0),
    errors
  }
}

async function hiDpiScenario(browser) {
  const results = []
  for (const [width, height, dpr] of [
    [1512, 860, 2],
    [1920, 1080, 2],
    [2560, 1440, 2]
  ]) {
    const { context, page } = await newPage(browser, { width, height }, dpr)
    await page.goto(`${base}?renderer=webgl&storyIntro=off`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => {
      const canvas = document.querySelector('canvas')
      return canvas && canvas.width > 0
    }, null, { timeout: 30000 })
    await sleep(1500)
    const canvas = await page.evaluate(() => {
      const element = document.querySelector('canvas')
      const rect = element.getBoundingClientRect()
      return { width: element.width, height: element.height, cssWidth: Math.round(rect.width), cssHeight: Math.round(rect.height) }
    })
    results.push({ window: `${width}x${height}@${dpr}x`, ...canvas, pixels: canvas.width * canvas.height, canvasMB: round((canvas.width * canvas.height * 4) / MB) })
    await context.close()
  }
  return { windows: results, maxCanvasPixels: Math.max(...results.map((entry) => entry.pixels)) }
}

function check(report) {
  const rows = []
  const add = (group, key, actual, limit) => {
    if (limit == null || actual == null) return
    rows.push({ metric: `${group}.${key}`, actual, limit, pass: actual <= limit })
  }
  Object.entries(budget.static).forEach(([key, limit]) => add('static', key, report.static[key] ?? report.boot[key], limit))
  Object.entries(budget.boot).forEach(([key, limit]) => add('boot', key, report.boot[key], limit))
  Object.entries(budget.stage).forEach(([key, limit]) => add('stage', key, key === 'stepP95Ms' ? round(report.stage.steps.p95) : report.stage[key], limit))
  Object.entries(budget.combat ?? {}).forEach(([key, limit]) =>
    add('combat', key, key === 'stepP95Ms' ? round(report.combat.steps.p95) : report.combat[key], limit)
  )
  Object.entries(budget.boss).forEach(([key, limit]) => add('boss', key, report.boss[key], limit))
  Object.entries(budget.revisit).forEach(([key, limit]) => add('revisit', key, report.revisit[key], limit))
  add('hiDpi', 'maxCanvasPixels', report.hiDpi.maxCanvasPixels, budget.hiDpi.maxCanvasPixels)
  return rows
}

function markdown(report, rows) {
  const lines = [
    `# Footprint report: ${label}`,
    '',
    `Commit ${report.commit}${report.dirty ? ` plus ${report.dirty} uncommitted runtime paths` : ''}, ${report.at}. Budget: tests/perf-budget.json.`,
    '',
    '| Metric | Actual | Budget | Result |',
    '| --- | ---: | ---: | --- |',
    ...rows.map((row) => `| ${row.metric} | ${row.actual} | ${row.limit} | ${row.pass ? 'PASS' : 'FAIL'} |`),
    '',
    `Boot download by type (MB): ${JSON.stringify(report.boot.downloadByType)}`,
    `Stage step ms p50/p95/p99: ${round(report.stage.steps.p50)}/${round(report.stage.steps.p95)}/${round(report.stage.steps.p99)}; combat ${round(report.combat.steps.p50)}/${round(report.combat.steps.p95)}/${round(report.combat.steps.p99)}; boss ${round(report.boss.steps.p50)}/${round(report.boss.steps.p95)}/${round(report.boss.steps.p99)}`,
    `Combat display objects ${report.combat.displayObjectsBefore} -> ${report.combat.displayObjectsAfter}; save.v1 ${report.combat.saveBytes} bytes`,
    `Hi-DPI canvases: ${report.hiDpi.windows.map((entry) => `${entry.window} -> ${entry.width}x${entry.height} (${entry.canvasMB}MB)`).join('; ')}`,
    `Revisit cycles: ${report.revisit.cycles.map((entry) => `heap ${entry.jsHeapMB} tex ${entry.textureCount} lst ${entry.phaserListeners} snd ${entry.soundInstances}`).join(' | ')}`
  ]
  return lines.join('\n') + '\n'
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true })
  const report = {
    label,
    at: new Date().toISOString(),
    commit: await new Promise((resolve) => {
      const git = spawn('git', ['rev-parse', '--short', 'HEAD'])
      let out = ''
      git.stdout.on('data', (chunk) => (out += chunk))
      git.on('close', () => resolve(out.trim()))
    }),
    // A run on a dirty tree measures code that is not in `commit`; say so rather than let the hash imply it.
    dirty: await new Promise((resolve) => {
      const git = spawn('git', ['status', '--porcelain', '--', 'src', 'vite.config.ts', 'package.json', 'index.html'])
      let out = ''
      git.stdout.on('data', (chunk) => (out += chunk))
      git.on('close', () => resolve(out.split('\n').filter(Boolean).length))
    }),
    static: staticMetrics()
  }
  const server = await startServer()
  const browser = await chromium.launch({
    headless: true,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-precise-memory-info', '--autoplay-policy=no-user-gesture-required']
  })
  try {
    report.boot = await bootScenario(browser)
    Object.assign(report, await stageScenario(browser))
    report.revisit = await revisitScenario(browser)
    report.hiDpi = await hiDpiScenario(browser)
  } finally {
    await browser.close()
    server.kill()
  }
  const rows = check(report)
  report.checks = rows
  const errors = [...(report.boot.errors ?? []), ...(report.errors ?? []), ...(report.revisit.errors ?? [])]
  const jsonPath = path.join(outDir, `footprint-${label}.json`)
  const mdPath = path.join(outDir, `footprint-${label}.md`)
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2))
  fs.writeFileSync(mdPath, markdown(report, rows))
  process.stdout.write(markdown(report, rows))
  const failed = rows.filter((row) => !row.pass)
  console.log(`\nfootprint: ${rows.length - failed.length}/${rows.length} within budget, ${errors.length} page errors (${jsonPath})`)
  if (errors.length) console.log(errors.slice(0, 5).join('\n'))
  if (!reportOnly && (failed.length || errors.length)) process.exit(1)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
