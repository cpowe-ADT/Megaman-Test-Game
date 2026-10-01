// Smoke 66-production-music (13h.1, the rest of EVAL-P13-002): on the real production build, a player
// path (Title -> New Game -> name -> skip the prologue -> the tutorial), unlocking audio with genuine
// Playwright key presses, not a debug hook (a programmatic call never satisfies a browser's autoplay
// gesture rule). Within 5s of reaching the `Game` scene, `audio.musicPlayingCue` must read `'stage'` and
// no `[audio] music ...` console error (`src/audio/MusicTrackLoader.ts`) may have been logged.
//
// Adapted from the probe at `output/probes/13a/music-probe.mjs` (left as read-only evidence; this is the
// harness's own copy of its technique, wired into `npm run test:smoke`'s summary/continue-on-failure and
// the full tier only — see scripts/smoke/tiers.json).
//
// Self-contained: builds nothing (run `npm run build` first; `npm run verify` already does before
// `test:smoke`), but always serves its own `vite preview` on MUSIC_PROBE_PORT regardless of the smoke
// run's own SMOKE_SERVER, because "the production build" means the preview server specifically.
import { spawn } from 'node:child_process'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { chromium } from 'playwright'

const HOST = '127.0.0.1'
const PORT = Number(process.env.MUSIC_PROBE_PORT ?? 4191)
const BASE = `http://${HOST}:${PORT}/`
const DRIVE_DEADLINE_MS = 60000
const CUE_WAIT_MS = 5000

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function startPreviewServer() {
  const root = path.resolve('.')
  if (!fs.existsSync(path.join(root, 'dist', 'index.html'))) {
    throw new Error(
      'dist/index.html is missing: run `npm run build` before the full smoke tier (66-production-music needs the real production build, not the dev server).'
    )
  }
  const vite = path.join(root, 'node_modules/.bin/vite')
  const child = spawn(vite, ['preview', '--host', HOST, '--port', String(PORT), '--strictPort'], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env
  })
  let log = ''
  child.stdout.on('data', (chunk) => (log += chunk))
  child.stderr.on('data', (chunk) => (log += chunk))
  const probeOnce = () =>
    new Promise((resolve) => {
      const request = http.get(BASE, { agent: false }, (response) => {
        response.resume()
        resolve(response.statusCode === 200)
      })
      request.on('error', () => resolve(false))
    })
  for (let attempt = 0; attempt < 150; attempt += 1) {
    if (await probeOnce()) return child
    await sleep(100)
  }
  child.kill()
  throw new Error(`vite preview did not start on ${BASE}\n${log}`)
}

/** Same technique as `output/probes/13a/music-probe.mjs`: flag any source over 8s (music, never SFX). */
function installAudioProbe() {
  const probe = (window.__musicProbe = { events: [] })
  const start = AudioBufferSourceNode.prototype.start
  AudioBufferSourceNode.prototype.start = function (...args) {
    const seconds = this.buffer ? this.buffer.duration : 0
    if (seconds > 8) probe.events.push({ kind: 'music-source-start', seconds: Math.round(seconds) })
    return start.apply(this, args)
  }
}

async function snap(page) {
  return page.evaluate(() => {
    let state = null
    try {
      state = JSON.parse(window.render_game_to_text())
    } catch (error) {
      state = { error: String(error) }
    }
    return { scene: state?.scene ?? null, audio: state?.audio ?? null, profileScreen: state?.profiles?.screen ?? null }
  })
}

export async function runProductionMusicScenario(name, { outputDir }) {
  const dir = path.join(outputDir, name)
  fs.mkdirSync(dir, { recursive: true })
  const server = await startPreviewServer()
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  try {
    const context = await browser.newContext()
    const page = await context.newPage()
    const audioErrors = []
    page.on('console', (message) => {
      if (message.type() === 'error' && message.text().includes('[audio] music')) audioErrors.push(message.text())
    })
    await page.addInitScript(installAudioProbe)
    await page.goto(`${BASE}?automation=1&renderer=canvas`, { waitUntil: 'domcontentloaded' })

    // A generic scene-driven loop (real keyboard events only, so the browser's autoplay-unlock gesture
    // rule is genuinely satisfied): New Game, name entry, skip the prologue, land in the tutorial.
    let lastScene = ''
    let sameSceneTries = 0
    const deadline = Date.now() + DRIVE_DEADLINE_MS
    let entered = false
    while (Date.now() < deadline) {
      const state = await snap(page).catch(() => null)
      const scene = state?.scene ?? null
      if (scene !== lastScene) {
        lastScene = scene
        sameSceneTries = 0
      } else {
        sameSceneTries += 1
      }
      if (scene === 'Game') {
        entered = true
        break
      }
      if (!scene) {
        await page.waitForTimeout(250)
        continue
      }
      if (scene === 'Prologue') await page.keyboard.press('Escape')
      else if (scene === 'Profiles' && state.profileScreen?.mode === 'name') {
        if (!state.profileScreen?.name) await page.keyboard.type('CRAIG', { delay: 40 })
        await page.keyboard.press('Enter')
      } else if (sameSceneTries > 5 && scene !== 'Profiles' && scene !== 'Title') await page.keyboard.press('Escape')
      else await page.keyboard.press('Enter')
      await page.waitForTimeout(400)
    }
    assert.ok(entered, `never reached the Game scene from Title within ${DRIVE_DEADLINE_MS}ms (last scene ${lastScene})`)

    const entryAt = Date.now()
    let playingStage = false
    let lastAudio = null
    while (Date.now() - entryAt < CUE_WAIT_MS) {
      const state = await snap(page)
      lastAudio = state.audio
      if (state.audio?.musicPlayingCue === 'stage') {
        playingStage = true
        break
      }
      await page.waitForTimeout(200)
    }
    await page.screenshot({ path: path.join(dir, 'stage-entry.png') })
    fs.writeFileSync(path.join(dir, 'audio-state.json'), JSON.stringify({ lastAudio, audioErrors }, null, 2))

    assert.ok(playingStage, `audio.musicPlayingCue never reached 'stage' within ${CUE_WAIT_MS}ms of stage entry (last: ${JSON.stringify(lastAudio)})`)
    assert.equal(audioErrors.length, 0, `[audio] music error(s) logged: ${JSON.stringify(audioErrors)}`)
  } finally {
    await browser.close()
    server.kill()
  }
}
