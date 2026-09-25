import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

export async function runInputLifecycleScenario(name, { openGameplayPage, closeGameplayPage, readState, waitForState, waitForPageCheck, advanceFrames, tapKey, titleUrl }) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)
  const evidence = { cycles: [] }
  const menuOpen = () => page.evaluate(() => window.__phaserGame.scene.isActive('SystemMenu'))
  const menuIndex = () => page.evaluate(() => window.__phaserGame.scene.getScene('SystemMenu').index)
  const snapshot = label => page.screenshot({ path: path.join(scenarioDir, `shot-${label}.png`) })
  const shots = state => state.newPlayer.combat.shotsFiredTotal
  try {
    await waitForState(page, s => s.newPlayer?.locomotion?.grounded === true)
    await page.evaluate(() => window.__phaserGame.scene.getScene('Game').newPlayerRuntime.resetForRespawn(30000))
    await advanceFrames(page, 3)
    for (let cycle = 0; cycle < 3; cycle++) {
      // An active charge is cancelled on pause without firing or resetting combat protection.
      await page.keyboard.down('x')
      await waitForState(page, s => s.newPlayer?.combat?.charging === true)
      const before = await readState(page)
      await tapKey(page, 'Escape')
      await waitForPageCheck(page, () => window.__phaserGame.scene.isActive('SystemMenu'))
      assert.equal((await readState(page)).playerState.paused, true)
      assert.equal((await readState(page)).newPlayer.combat.charging, false)
      assert.equal(await page.evaluate(() => window.__phaserGame.scene.getScenes(true).filter(s => s.scene.key === 'SystemMenu').length), 1)
      const index = await menuIndex()
      const menuLength = await page.evaluate(() => window.__phaserGame.scene.getScene('SystemMenu').options.length)
      await page.keyboard.press('ArrowDown') // fast complete tap must survive between frames
      await advanceFrames(page, 3)
      assert.equal(await menuIndex(), (index + 1) % menuLength)
      await page.keyboard.down('ArrowRight')
      await advanceFrames(page, 4)
      await page.keyboard.up('x')
      await page.keyboard.up('ArrowRight')
      const underlay = await readState(page)
      assert.equal(underlay.player.x, before.player.x)
      assert.equal(shots(underlay), shots(before))
      if (cycle === 0) {
        // Enter Controls using the live menu selection, then hold Escape across resume.
        const controlsSteps = await page.evaluate(() => {
          const menu = window.__phaserGame.scene.getScene('SystemMenu')
          const target = menu.options.findIndex((option) => option.id === 'controls')
          return (target - menu.index + menu.options.length) % menu.options.length
        })
        for (let step = 0; step < controlsSteps; step += 1) await tapKey(page, 'ArrowDown')
        await tapKey(page, 'Enter')
        await waitForPageCheck(page, () => window.__phaserGame.scene.isActive('Controls'))
        await page.keyboard.down('Escape')
        await waitForPageCheck(page, () => window.__phaserGame.scene.isActive('SystemMenu'))
        await advanceFrames(page, 20)
        assert.equal(await menuOpen(), true)
        await snapshot('0-nested-menu')
        await page.keyboard.up('Escape')
        await advanceFrames(page, 2)
      }
      await tapKey(page, 'Escape')
      await waitForPageCheck(page, () => !window.__phaserGame.scene.isActive('SystemMenu'))
      await advanceFrames(page, 5)
      const resumed = await readState(page)
      assert.equal(resumed.playerState.paused, false)
      assert.equal(resumed.newPlayer.combat.charging, false)
      assert.equal(shots(resumed), shots(before))
      await page.keyboard.down('ArrowRight')
      await waitForState(page, s => Number(s.player?.vx) > 0)
      await page.keyboard.up('ArrowRight')
      await page.keyboard.down('x')
      await advanceFrames(page, 3)
      await page.keyboard.up('x')
      const fired = await waitForState(page, s => shots(s) === shots(before) + 1)
      evidence.cycles.push({ before, underlay, resumed, fired })
    }
    await snapshot('1-resumed-game')
    // Debug actions must be bound on the first Game start, and hooks removed on exit.
    const debugBefore = await page.evaluate(() => window.__phaserGame.scene.getScene('Game')._dev.on)
    await tapKey(page, '`')
    assert.equal(await page.evaluate(() => window.__phaserGame.scene.getScene('Game')._dev.on), !debugBefore)
    await tapKey(page, '`')
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate && window.bossDebug?.unlockIntro))
    await page.evaluate(() => {
      window.stageDebug.crossBossGate(); window.bossDebug.unlockIntro(); window.bossDebug.damage(999); window.stageDebug.skipDialogue()
    })
    await waitForState(page, s => s.victory?.modalOpen === true)
    await page.keyboard.down('NumpadEnter')
    await waitForState(page, s => s.scene === 'StageSelect')
    await advanceFrames(page, 20)
    evidence.heldConfirm = await readState(page)
    assert.equal(evidence.heldConfirm.stageSelect.confirmArmed, false)
    assert.equal(evidence.heldConfirm.stageSelect.transitionPending, false)
    assert.equal(await page.evaluate(() => 'bossDebug' in window), false)
    assert.deepEqual(await page.evaluate(() => Object.keys(window.stageDebug ?? {}).sort()), ['grantUpgrade', 'grantWeapon'])
    await page.keyboard.down('NumpadEnter') // OS repeat remains physically held
    await advanceFrames(page, 5)
    assert.equal((await readState(page)).stageSelect.confirmArmed, false)
    await page.keyboard.up('NumpadEnter')
    await waitForState(page, s => s.stageSelect?.confirmArmed === true)
    const selectionBefore = (await readState(page)).stageSelect
    await tapKey(page, 'Escape')
    await waitForPageCheck(page, () => window.__phaserGame.scene.isActive('SystemMenu'))
    const routeMenuIndex = await menuIndex()
    await tapKey(page, 'ArrowDown')
    await tapKey(page, 'ArrowRight')
    await tapKey(page, 'l')
    await tapKey(page, 't')
    await advanceFrames(page, 5)
    const routeMenuLength = await page.evaluate(() => window.__phaserGame.scene.getScene('SystemMenu').options.length)
    assert.equal(await menuIndex(), (routeMenuIndex + 1) % routeMenuLength)
    const selectionAfter = (await readState(page)).stageSelect
    assert.equal(selectionAfter.index, selectionBefore.index)
    assert.equal(selectionAfter.selectedCheckpointId, selectionBefore.selectedCheckpointId)
    assert.equal(await page.evaluate(() => window.__phaserGame.scene.isActive('Game')), false)
    evidence.routeOverlay = { selectionBefore, selectionAfter }
    await tapKey(page, 'Escape')
    await waitForPageCheck(page, () => !window.__phaserGame.scene.isActive('SystemMenu'))
    await snapshot('2-stage-select')
    await tapKey(page, 'ArrowRight')
    await tapKey(page, 'ArrowLeft')
    await tapKey(page, 'NumpadEnter')
    evidence.freshConfirm = await waitForState(page, s => s.scene === 'Game')
    assert.equal(await page.evaluate(() => window.__phaserGame.scene.getScenes(true).filter(s => s.scene.key === 'Game').length), 1)
    assert.equal(await page.evaluate(() => Boolean(window.stageDebug && window.bossDebug)), true)
    // A paused Title must baseline the physical Enter that closed its child.
    await page.goto(titleUrl, { waitUntil: 'domcontentloaded' })
    await waitForState(page, s => s.scene === 'Title')
    await tapKey(page, 'c')
    await waitForState(page, s => s.scene === 'Controls')
    await page.keyboard.down('Enter')
    await waitForState(page, s => s.scene === 'Title')
    await advanceFrames(page, 20)
    evidence.heldTitleReturn = await readState(page)
    assert.equal(evidence.heldTitleReturn.scene, 'Title')
    await snapshot('3-title-return')
    await page.keyboard.up('Enter')
    fs.writeFileSync(path.join(scenarioDir, 'state-0.json'), JSON.stringify(evidence, null, 2))
  } catch (error) {
    fs.writeFileSync(path.join(scenarioDir, 'failure-state.json'), JSON.stringify({ evidence, current: await readState(page) }, null, 2))
    throw error
  } finally {
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}
