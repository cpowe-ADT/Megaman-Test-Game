// HD render contract: a window twice the native size gets a canvas twice the size, cameras at
// zoom 2 with a top-left origin, Text rendered at resolution 2, and the same world pixels as 1x.
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

async function openGame(browser, { url, waitForState, tapKey, advanceFrames }, viewport, errors) {
  const page = await browser.newPage({ viewport })
  await page.addInitScript(() => {
    if (!localStorage.getItem('save.v1')) {
      localStorage.setItem('save.v1', JSON.stringify({ weaponsUnlocked: [], clearedBosses: [], tutorialCleared: false, finalBossCleared: false, gameCompleted: false }))
    }
  })
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  await page.goto(url, { waitUntil: 'domcontentloaded' })
  await page.waitForTimeout(300)
  await waitForState(page, (state) => state.scene === 'StageSelect', 8000)
  await tapKey(page, 'Enter')
  await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
  await advanceFrames(page, 30)
  return page
}

// Read canvas pixels in game units: (x, y) at scale s samples canvas pixel (x*s, y*s).
async function samplePixels(page, points, scale) {
  return page.evaluate(({ points, scale }) => {
    const canvas = document.querySelector('canvas')
    const context = canvas.getContext('2d')
    return points.map(([x, y]) => Array.from(context.getImageData(Math.round(x * scale), Math.round(y * scale), 1, 1).data).slice(0, 3))
  }, { points, scale })
}

// Every visible Text in the running scenes, in game pixels, that falls outside the 448x252 frame.
async function textOutsideFrame(page) {
  return page.evaluate(() => {
    const outside = []
    window.__phaserGame.scene.getScenes(true).forEach((scene) => {
      const visit = (list) =>
        list.forEach((object) => {
          if (object.type === 'Text' && object.visible && object.alpha > 0 && object.text) {
            const bounds = object.getBounds()
            if (bounds.left < -1 || bounds.top < -1 || bounds.right > 449 || bounds.bottom > 253) {
              outside.push({ scene: scene.scene.key, text: object.text.slice(0, 24), x: Math.round(bounds.x), y: Math.round(bounds.y), right: Math.round(bounds.right), bottom: Math.round(bounds.bottom) })
            }
          }
          if (Array.isArray(object.list)) visit(object.list)
        })
      visit(scene.children.list)
    })
    return outside
  })
}

// Menus lay out in game pixels (GAME_SIZE), not canvas pixels: at 2x every menu text stays inside the frame.
async function assertMenusInsideFrame(browser, { url, waitForState, tapKey }, dir, errors) {
  const page = await browser.newPage({ viewport: { width: 896, height: 504 } })
  page.on('pageerror', (error) => errors.push(String(error)))
  const report = {}
  try {
    await page.goto(url.replace('&startScene=StageSelect', ''), { waitUntil: 'domcontentloaded' })
    await waitForState(page, (state) => state.scene === 'Title', 8000)
    report.title = await textOutsideFrame(page)
    await page.locator('canvas').screenshot({ path: path.join(dir, 'menu-title-2x.png') })
    await tapKey(page, 'o')
    await waitForState(page, (state) => state.scene === 'Options' || state.options, 8000)
    report.options = await textOutsideFrame(page)
    await page.locator('canvas').screenshot({ path: path.join(dir, 'menu-options-2x.png') })
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await waitForState(page, (state) => state.scene === 'StageSelect', 8000)
    report.stageSelect = await textOutsideFrame(page)
    await page.locator('canvas').screenshot({ path: path.join(dir, 'menu-stage-select-2x.png') })
  } finally {
    fs.writeFileSync(path.join(dir, 'menus-2x.json'), JSON.stringify(report, null, 2))
    await page.close()
  }
  Object.entries(report).forEach(([screen, outside]) => {
    assert.deepEqual(outside, [], `${screen} at 2x has text outside the 448x252 frame`)
  })
}

export async function runHdRenderScenario(name, { outputDir, url, readState, waitForState, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const errors = []
  try {
    const deps = { url, waitForState, tapKey, advanceFrames }
    const base = await openGame(browser, deps, { width: 448, height: 252 }, errors)
    const hd = await openGame(browser, deps, { width: 896, height: 504 }, errors)

    const baseState = await readState(base)
    const hdState = await readState(hd)
    fs.writeFileSync(path.join(dir, 'state-1x.json'), JSON.stringify(baseState.view, null, 2))
    fs.writeFileSync(path.join(dir, 'state-2x.json'), JSON.stringify(hdState.view, null, 2))
    await base.locator('canvas').screenshot({ path: path.join(dir, 'shot-1x.png') })
    await hd.locator('canvas').screenshot({ path: path.join(dir, 'shot-2x.png') })

    assert.equal(baseState.view.canvasWidth, 448, '1x canvas width')
    assert.equal(baseState.view.scale, 1)
    assert.equal(hdState.view.canvasWidth, 896, '2x canvas width')
    assert.equal(hdState.view.canvasHeight, 504, '2x canvas height')
    assert.equal(hdState.view.scale, 2)
    assert.equal(hdState.view.cameraZoom, 2, 'main camera zoom follows the render scale')
    assert.equal(hdState.view.cameraIsHd, true, 'main camera is the top-left HdCamera')
    assert.deepEqual(hdState.view.cameraOrigin, { x: 0, y: 0 })
    assert.equal(hdState.view.textResolution, 2, 'Text objects render at resolution 2')
    assert.ok(
      hdState.view.textCanvasWidth >= hdState.view.textDisplayWidth * 2 - 2,
      `text canvas ${hdState.view.textCanvasWidth}px should be about twice its ${hdState.view.textDisplayWidth}px display width`
    )

    // World pixels: static ground/background samples and the HUD panel border must be identical
    // at 1x and 2x (nearest-neighbour), which also proves scroll-factor-0 HUD objects did not move.
    // Points that change between two frames on the 1x page (flames, pickups, enemies, the hero)
    // are dynamic and excluded; text glyphs are avoided by sampling the panel border, not the label.
    const points = []
    // Ground strip left of the RETRY label (its glyphs reach row 238); HUD border columns 1-7
    // (column 9 is a half-pixel accent-bar edge that legitimately resolves differently at 2x).
    for (let y = 238; y <= 250; y += 4) for (let x = 2; x < 350; x += 6) points.push([x, y])
    for (let y = 1; y <= 45; y += 4) for (let x = 1; x <= 7; x += 2) points.push([x, y])
    const baseA = await samplePixels(base, points, 1)
    await advanceFrames(base, 12)
    const baseB = await samplePixels(base, points, 1)
    const hdPixels = await samplePixels(hd, points, 2)
    const equal = (a, b) => a[0] === b[0] && a[1] === b[1] && a[2] === b[2]
    const staticIndices = points.map((_, index) => index).filter((index) => equal(baseA[index], baseB[index]))
    let same = 0
    const diffs = []
    staticIndices.forEach((index) => {
      if (equal(baseA[index], hdPixels[index])) same += 1
      else if (diffs.length < 8) diffs.push({ point: points[index], base: baseA[index], hd: hdPixels[index] })
    })
    const ratio = staticIndices.length ? same / staticIndices.length : 0
    fs.writeFileSync(
      path.join(dir, 'pixel-compare.json'),
      JSON.stringify({ points: points.length, staticPoints: staticIndices.length, same, ratio, diffs }, null, 2)
    )
    assert.ok(staticIndices.length >= points.length * 0.6, `too few static sample points (${staticIndices.length}/${points.length})`)
    assert.ok(ratio >= 0.98, `only ${(ratio * 100).toFixed(1)}% of static world/HUD pixels match between 1x and 2x: ${JSON.stringify(diffs)}`)

    // Resizing the 2x window down to 1x must shrink the canvas and cameras back.
    await hd.setViewportSize({ width: 448, height: 252 })
    await hd.evaluate(() => window.dispatchEvent(new Event('resize')))
    await advanceFrames(hd, 4)
    const shrunk = await readState(hd)
    assert.equal(shrunk.view.canvasWidth, 448, 'canvas follows a window resize')
    assert.equal(shrunk.view.cameraZoom, 1)
    assert.equal(shrunk.view.textResolution, 1)

    await assertMenusInsideFrame(browser, deps, dir, errors)

    assert.equal(errors.length, 0, JSON.stringify(errors))
  } finally {
    await browser.close()
  }
}
