// Smoke 62-perf-budget (prompt 08 8.5): Pyro Maw on `renderer=webgl`, viewport 896x504,
// `deviceScaleFactor: 2` (scale 4, `src/config/hdRenderMath.ts`'s MAX_RENDER_SCALE=6 caps it lower
// than an uncapped 2x window at 2x dpr would reach). Reads `window.perfDebug()`, writes the snapshot,
// and regression-checks it against `tests/perf-baseline.json` at 1.25x per 8.5's CI rule (the harder
// "on Craig's Mac" absolute p95/p99 numbers are recorded, not asserted here: this machine runs other
// lanes at the same time, so an absolute-ms assert would be measuring their load, not a regression).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

function scenarioDir(outputDir, name) {
  const dir = path.join(outputDir, name)
  fs.rmSync(dir, { recursive: true, force: true })
  fs.mkdirSync(dir, { recursive: true })
  return dir
}

function withRenderer(url, renderer) {
  if (/[?&]renderer=/.test(url)) {
    return url.replace(/([?&]renderer=)[^&]*/, `$1${renderer}`)
  }
  const separator = url.includes('?') ? '&' : '?'
  return `${url}${separator}renderer=${renderer}`
}

const PYRO_MAW_STAGE_ID = 'pyro_maw'
const SCENE_WAIT_MS = 20000

export async function runPerfBudgetScenario(name, { outputDir, url, readState, waitForState, advanceFrames }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const errors = []
  try {
    const page = await browser.newPage({ viewport: { width: 896, height: 504 }, deviceScaleFactor: 2 })
    await page.addInitScript(() => {
      if (!localStorage.getItem('save.v1')) {
        localStorage.setItem('save.v1', JSON.stringify({ weaponsUnlocked: [], clearedBosses: [], tutorialCleared: false, finalBossCleared: false, gameCompleted: false }))
      }
    })
    page.on('pageerror', (error) => errors.push(String(error)))
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })

    await page.goto(withRenderer(url, 'webgl'), { waitUntil: 'domcontentloaded' })
    await waitForState(page, (state) => state.scene === 'StageSelect', SCENE_WAIT_MS)
    await page.evaluate(
      (stageId) => window.__phaserGame.scene.getScene('StageSelect').scene.start('Game', { stageId }),
      PYRO_MAW_STAGE_ID
    )
    await waitForState(
      page,
      (state) => state.scene === 'Game' && state.stageRuntime?.stageId === PYRO_MAW_STAGE_ID,
      SCENE_WAIT_MS
    )
    // Warm the rolling frame-time buffer under real per-frame cost (about 3s) before reading it.
    await advanceFrames(page, 180)

    const perf = await page.evaluate(() => window.perfDebug?.() ?? null)
    const state = await readState(page)
    fs.writeFileSync(
      path.join(dir, 'perf-snapshot.json'),
      JSON.stringify({ perf, scene: state?.scene, stageId: state?.stageRuntime?.stageId }, null, 2)
    )
    await page.screenshot({ path: path.join(dir, 'pyro-maw-2x.png') })

    if (errors.length > 0) {
      fs.writeFileSync(path.join(dir, 'errors-0.json'), JSON.stringify(errors, null, 2))
      throw new Error(`Smoke test found browser errors in ${dir}`)
    }

    assert.ok(perf, 'window.perfDebug() returned nothing')
    assert.ok(perf.frameMs.frames > 0, 'no frame samples were collected')
    assert.ok(perf.renderScale > 0 && perf.renderScale <= 6, `renderScale ${perf.renderScale} outside (0, 6]`)
    assert.ok(perf.textureMB > 0, 'textureMB was not positive with a stage loaded')

    const baselinePath = path.resolve('tests/perf-baseline.json')
    if (process.env.PERF_BASELINE_WRITE === '1') {
      fs.writeFileSync(
        baselinePath,
        `${JSON.stringify(
          {
            $comment:
              'Baseline for smoke 62-perf-budget (prompt 08 8.5): CI regresses only past 1.25x these p95/p99 numbers. Recorded with PERF_BASELINE_WRITE=1; lower it when a slice earns it, never raise it without a docs/prompts/EVAL_LEDGER.md row (charter rule 14).',
            recordedAt: new Date().toISOString(),
            frameMs: perf.frameMs,
            textureMB: perf.textureMB
          },
          null,
          2
        )}\n`
      )
    } else if (fs.existsSync(baselinePath)) {
      const baseline = JSON.parse(fs.readFileSync(baselinePath, 'utf8'))
      const ceilingP95 = baseline.frameMs.p95 * 1.25
      const ceilingP99 = baseline.frameMs.p99 * 1.25
      assert.ok(
        perf.frameMs.p95 <= ceilingP95,
        `p95 ${perf.frameMs.p95}ms exceeds the CI regression ceiling ${ceilingP95}ms (baseline ${baseline.frameMs.p95}ms * 1.25)`
      )
      assert.ok(
        perf.frameMs.p99 <= ceilingP99,
        `p99 ${perf.frameMs.p99}ms exceeds the CI regression ceiling ${ceilingP99}ms (baseline ${baseline.frameMs.p99}ms * 1.25)`
      )
    }
  } finally {
    await browser.close()
  }
}
