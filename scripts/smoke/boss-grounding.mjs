// Boss grounding contract: the drawn feet sit on the physics body bottom, and the body rests on
// the arena floor between attacks (hover bosses included). Guards the "bosses float" regression.
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

export async function runBossGroundingScenario(
  name,
  { openGameplayPage, closeGameplayPage, waitForState, waitForPageCheck, advanceFrames }
) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)
  try {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate))
    await page.evaluate(() => {
      window.stageDebug?.crossBossGate?.()
      window.stageDebug?.activateBossRoom?.()
      window.bossDebug?.unlockIntro?.()
      window.stageDebug?.skipDialogue?.()
    })
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.bossRoom?.cameraLocked === true, 6000)

    // The boss spawns above the floor and must settle onto it under gravity.
    const settled = await waitForState(
      page,
      (state) => state.bossState?.runtime?.ground?.grounded === true,
      4000,
      'boss settles on the floor'
    )
    const first = settled.bossState.runtime.ground
    assert.ok(Math.abs(first.feetToBodyGap) <= 1, `boss floats on spawn: feet ${first.feetY} vs body bottom ${first.bodyBottom}`)

    const samples = []
    for (let index = 0; index < 24; index += 1) {
      await advanceFrames(page, 15)
      samples.push(await page.evaluate(() => window.bossDebug?.groundReport?.() ?? null))
    }
    fs.writeFileSync(path.join(scenarioDir, 'ground-samples.json'), JSON.stringify(samples, null, 2))
    await page.locator('canvas').screenshot({ path: path.join(scenarioDir, 'shot-boss-grounded.png') })

    assert.ok(samples.every((sample) => sample && typeof sample.feetToBodyGap === 'number'), 'ground report missing')
    const grounded = samples.filter((sample) => sample.grounded)
    assert.ok(grounded.length >= 6, `boss stood on the floor in only ${grounded.length}/${samples.length} samples`)
    grounded.forEach((sample) => {
      assert.ok(
        Math.abs(sample.feetToBodyGap) <= 1,
        `boss floats mid-fight: feet ${sample.feetY} vs body bottom ${sample.bodyBottom} (${sample.motionIntent}/${sample.lifecyclePhase})`
      )
    })
    // A grounded boss never has gravity switched off under it.
    grounded.forEach((sample) => {
      if (sample.lifecyclePhase === 'done' || sample.lifecyclePhase === 'landing') {
        assert.equal(sample.allowGravity, true, 'gravity must stay on for a resting boss')
      }
    })
    assert.equal(errors.length, 0, JSON.stringify(errors))
  } finally {
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}
