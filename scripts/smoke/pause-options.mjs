// Pause menu, options persistence, and the Title continue path (prompt 01, Phase 1.5).
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

async function open(browser, readState, dir) {
  const page = await browser.newPage({ viewport: { width: 448, height: 252 } })
  const errors = []
  page.on('pageerror', (error) => errors.push(String(error)))
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()) })
  const capture = async (label) => {
    await page.locator('canvas').screenshot({ path: path.join(dir, `shot-${label}.png`) })
    fs.writeFileSync(path.join(dir, `state-${label}.json`), JSON.stringify(await readState(page), null, 2))
  }
  return { page, errors, capture }
}

export async function runOptionsPersistScenario(name, { outputDir, titleUrl, readState, waitForState, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const { page, errors, capture } = await open(browser, readState, dir)
  try {
    await page.goto(titleUrl)
    await waitForState(page, (state) => state.scene === 'Title')
    await tapKey(page, 'o')
    const opened = await waitForState(page, (state) => state.options && state.scene === 'Options')
    assert.equal(opened.options.rows[0].id, 'musicVolume')
    assert.equal(opened.settings.musicVolume, 8)
    await tapKey(page, 'ArrowLeft')
    await tapKey(page, 'ArrowLeft')
    await waitForState(page, (state) => state.settings?.musicVolume === 6)
    await tapKey(page, 'ArrowDown')
    await tapKey(page, 'ArrowDown')
    await tapKey(page, 'ArrowRight')
    const changed = await waitForState(page, (state) => state.settings?.screenShake === false)
    assert.equal(changed.options.index, 2)
    assert.equal(changed.audio.musicVolume, 6)
    await capture('options-changed')
    await tapKey(page, 'Escape')
    await waitForState(page, (state) => state.scene === 'Title' && !state.options)
    await page.reload()
    const reloaded = await waitForState(page, (state) => state.scene === 'Title')
    assert.equal(reloaded.settings.musicVolume, 6)
    assert.equal(reloaded.settings.screenShake, false)
    assert.equal(reloaded.audio.musicVolume, 6)
    await capture('reloaded')
    // Second and third visits in one page: the scene instance is reused, so its row arrays must be
    // rebuilt, not appended to, and a change must show on the rows that are actually on screen.
    for (let visit = 0; visit < 2; visit += 1) {
      await tapKey(page, 'o')
      await waitForState(page, (state) => state.options && state.scene === 'Options')
      if (visit === 0) {
        await tapKey(page, 'Escape')
        await waitForState(page, (state) => state.scene === 'Title' && !state.options)
      }
    }
    await tapKey(page, 'ArrowLeft')
    const revisited = await waitForState(page, (state) => state.settings?.musicVolume === 5 && state.options)
    assert.equal(revisited.options.rowObjects, revisited.options.rows.length, 'one set of Options rows per visit')
    assert.equal(revisited.options.shownValues[0], revisited.options.rows[0].value, 'the visible music row shows the new value')
    await capture('options-revisited')
    await tapKey(page, 'Escape')
    await waitForState(page, (state) => state.scene === 'Title' && !state.options)
    assert.deepEqual(errors, [])
    return reloaded.settings
  } finally { await browser.close() }
}

export async function runPauseWeaponSelectScenario(name, { outputDir, titleUrl, readState, waitForState, waitForPageCheck, advanceFrames, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const { page, errors, capture } = await open(browser, readState, dir)
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({
    weaponsUnlocked: ['FlameSerpent'], tutorialCleared: true, progressionWorld: { progressionMode: 'classic' }
  })))
  try {
    await page.goto(`${titleUrl}&startScene=StageSelect`)
    await waitForState(page, (state) => state.scene === 'StageSelect')
    await tapKey(page, 'Enter')
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true)
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.setSubTanks))
    const setup = await page.evaluate(() => {
      const tanks = window.stageDebug.setSubTanks(1, [1])
      const damage = window.stageDebug.damagePlayer(4)
      return { tanks, damage }
    })
    assert.equal(setup.tanks.subTanks, 1)
    assert.equal(setup.damage.hp, 4)
    await tapKey(page, 'Escape')
    const paused = await waitForState(page, (state) => state.systemMenu && state.playerState?.paused === true)
    assert.deepEqual(paused.systemMenu.options.map((option) => option.id), ['weapon', 'sub_tank', 'resume', 'controls', 'options', 'stage_select'])
    assert.equal(paused.systemMenu.index, 2, 'the cursor opens on Resume')
    await capture('paused')
    await tapKey(page, 'ArrowUp')
    await tapKey(page, 'ArrowUp')
    await waitForState(page, (state) => state.systemMenu?.index === 0)
    await tapKey(page, 'ArrowRight')
    const equipped = await waitForState(page, (state) => state.playerState?.weapon === 'FlameSerpent')
    assert.match(equipped.systemMenu.options[0].label, /Flame Serpent/)
    await capture('weapon-equipped')
    await tapKey(page, 'ArrowDown')
    await waitForState(page, (state) => state.systemMenu?.index === 1)
    assert.equal(equipped.systemMenu.options[1].enabled, true)
    await tapKey(page, 'Enter')
    const drunk = await waitForState(page, (state) => state.save?.subTankFill?.[0] === 0)
    assert.equal(drunk.playerState.paused, true, 'drinking keeps the menu open')
    await tapKey(page, 'ArrowDown')
    await tapKey(page, 'Enter')
    const resumed = await waitForState(page, (state) => state.playerState?.paused === false && !state.systemMenu)
    const healed = await waitForState(page, (state) => Number(state.playerState?.hp) >= 8, 4000)
    assert.equal(healed.playerState.hp, 8)
    assert.equal(healed.playerState.weapon, 'FlameSerpent')
    await capture('healed')
    // Surplus health at full HP refills the tank.
    await page.evaluate(() => window.stageDebug.spawnPickup('health', 8))
    const refilled = await waitForState(page, (state) => Number(state.save?.subTankFill?.[0]) > 0, 6000)
    assert.ok(refilled.save.subTankFill[0] > 0)
    assert.equal(refilled.save.hasActiveRun, true, 'autosave keeps an active run during the stage')
    assert.equal(resumed.scene, 'Game')
    // A second pause reuses the SystemMenu scene: one backplate per row, not one per row per visit.
    await tapKey(page, 'Escape')
    const repaused = await waitForState(page, (state) => state.systemMenu && state.playerState?.paused === true)
    assert.equal(repaused.systemMenu.rowBackplates, repaused.systemMenu.options.length, 'one set of pause-menu backplates')
    await tapKey(page, 'Escape')
    await waitForState(page, (state) => state.playerState?.paused === false && !state.systemMenu)
    assert.deepEqual(errors, [])
    return { setup, healed: healed.playerState, tank: refilled.save.subTankFill }
  } finally { await browser.close() }
}

export async function runTitleContinueScenario(name, { outputDir, titleUrl, readState, waitForState, tapKey }) {
  const dir = scenarioDir(outputDir, name)
  const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--use-angle=swiftshader'] })
  const { page, errors, capture } = await open(browser, readState, dir)
  await page.addInitScript(() => localStorage.setItem('save.v1', JSON.stringify({
    weaponsUnlocked: ['FlameSerpent'], tutorialCleared: true, progressionWorld: { progressionMode: 'classic' },
    stats: { playTimeMs: 4320000, deaths: 2, clearTimeMsByStage: {}, secretsFoundByStage: {} },
    activeRun: { version: 2, savedAt: Date.now(), stageId: 'tide_reaver', bossId: 'tide_reaver', playerHp: 6, playerMaxHp: 8, playerLives: 2, currentWeaponIndex: 1, currentWeaponId: 'FlameSerpent', weaponEnergyById: { Buster: 28, FlameSerpent: 17 } }
  })))
  try {
    await page.goto(titleUrl)
    const title = await waitForState(page, (state) => state.scene === 'Title')
    assert.equal(title.save.hasActiveRun, true)
    const label = await page.evaluate(() => window.__phaserGame.scene.getScene('Title').children.list.find((child) => child.text && /CONTINUE/.test(child.text))?.text ?? null)
    assert.match(label, /CONTINUE  WARDENS 0\/8  1H 12M/)
    await capture('title')
    await tapKey(page, 'Enter')
    const resumed = await waitForState(page, (state) => state.scene === 'Game' && state.activeRun?.loadedFromSave === true && state.playerState?.weapon === 'FlameSerpent', 20000)
    assert.equal(resumed.stageRuntime.stageId, 'tide_reaver')
    assert.equal(resumed.weaponEnergy.current, 17)
    assert.equal(resumed.playerState.lives, 2)
    assert.equal(resumed.playerState.hp, 6)
    assert.equal(resumed.stageIntro.phase, 'idle', 'a resumed run shows no card or briefing')
    await capture('resumed')
    assert.deepEqual(errors, [])
    return resumed.playerState
  } finally { await browser.close() }
}
