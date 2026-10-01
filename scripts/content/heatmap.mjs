// Part 13c (EVAL-P6-012): prompt 06 phase 6.8, "scripts/content/heatmap.mjs paints deaths over each
// stage contact sheet into output/level-review/<stageId>-heat.png." Balance from data, not taste.
//
// Input: a telemetry JSON shaped like `SegmentTelemetrySnapshot` (`src/telemetry/segmentTelemetry.ts`),
// written from `stageDebug.telemetry()` by an automated run or exported from Craig's play (the export
// path itself is 05.6's, out of this slice's file list). Only `recentDeaths` (bounded to 20; a longer
// capture should page telemetry() and concatenate) needs `x`, `y` and `segmentId`.
//
// Usage: node scripts/content/heatmap.mjs <telemetry.json> [--stage <stageId>] [--base <contact-sheet.png>]
//   --stage   filters recentDeaths to one stage's segments (segmentId's `stageId:checkpointIndex` prefix)
//             and names the output file; defaults to the first death's stage, or "stage" if there are none.
//   --base    an existing contact sheet (any size) to paint over; without one, paints over a plain
//             GAME_WIDTH x GAME_HEIGHT backdrop (`src/config/renderPolicy.ts`) -- a heat-only placeholder
//             until a real per-stage contact sheet lands at a known path.
//
// Reuses Playwright (already a devDependency, `scripts/perf/footprint.mjs`) to draw on a real <canvas>
// instead of adding a new image-manipulation dependency for one script.
import fs from 'node:fs'
import path from 'node:path'
import { chromium } from 'playwright'

const GAME_WIDTH = 448
const GAME_HEIGHT = 252

function parseArgs(argv) {
  const [jsonPath, ...rest] = argv
  const options = { stage: null, base: null }
  for (let i = 0; i < rest.length; i += 1) {
    if (rest[i] === '--stage') options.stage = rest[(i += 1)]
    else if (rest[i] === '--base') options.base = rest[(i += 1)]
  }
  return { jsonPath, ...options }
}

function stageIdOf(segmentId) {
  return segmentId.split(':')[0]
}

async function main() {
  const { jsonPath, stage: stageFilter, base } = parseArgs(process.argv.slice(2))
  if (!jsonPath) {
    console.error('Usage: node scripts/content/heatmap.mjs <telemetry.json> [--stage <stageId>] [--base <contact-sheet.png>]')
    process.exit(1)
  }
  const snapshot = JSON.parse(fs.readFileSync(path.resolve(jsonPath), 'utf8'))
  const deaths = Array.isArray(snapshot.recentDeaths) ? snapshot.recentDeaths : []
  const stageId = stageFilter ?? (deaths[0] ? stageIdOf(deaths[0].segmentId) : 'stage')
  const stageDeaths = deaths.filter((death) => stageIdOf(death.segmentId) === stageId)

  const outDir = path.resolve('output/level-review')
  fs.mkdirSync(outDir, { recursive: true })
  const outPath = path.join(outDir, `${stageId}-heat.png`)

  const baseDataUrl = base
    ? `data:image/png;base64,${fs.readFileSync(path.resolve(base)).toString('base64')}`
    : null

  const browser = await chromium.launch()
  const page = await browser.newPage()
  await page.setViewportSize({ width: GAME_WIDTH, height: GAME_HEIGHT })
  await page.setContent(`<!doctype html><canvas id="c" width="${GAME_WIDTH}" height="${GAME_HEIGHT}"></canvas>`)
  await page.evaluate(
    async ({ baseDataUrl, stageDeaths, width, height }) => {
      const canvas = document.getElementById('c')
      const ctx = canvas.getContext('2d')
      if (baseDataUrl) {
        const image = await new Promise((resolve, reject) => {
          const img = new Image()
          img.onload = () => resolve(img)
          img.onerror = reject
          img.src = baseDataUrl
        })
        ctx.drawImage(image, 0, 0, width, height)
      } else {
        ctx.fillStyle = '#0e1622'
        ctx.fillRect(0, 0, width, height)
      }
      ctx.globalCompositeOperation = 'lighter'
      stageDeaths.forEach((death) => {
        const gradient = ctx.createRadialGradient(death.x, death.y, 0, death.x, death.y, 18)
        gradient.addColorStop(0, 'rgba(255,60,60,0.85)')
        gradient.addColorStop(1, 'rgba(255,60,60,0)')
        ctx.fillStyle = gradient
        ctx.fillRect(death.x - 18, death.y - 18, 36, 36)
      })
    },
    { baseDataUrl, stageDeaths, width: GAME_WIDTH, height: GAME_HEIGHT }
  )
  const canvasHandle = await page.$('#c')
  await canvasHandle.screenshot({ path: outPath })
  await browser.close()

  console.log(`[heatmap] ${stageDeaths.length} death${stageDeaths.length === 1 ? '' : 's'} for ${stageId} -> ${outPath}${base ? '' : ' (no --base: plain backdrop)'}`)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
