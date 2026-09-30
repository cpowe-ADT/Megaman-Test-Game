// Boss grounding contract: the drawn feet sit on the physics body bottom, and the body rests on
// the arena floor between attacks (hover bosses included). Guards the "bosses float" regression.
// 12f wave 6 (EVAL-P7-005) adds two built rooms in the same page: a channel room (Basalt Titan: the walker
// never drops into a channel, the hero does and stands on its bed) and the shaft (Gale Vixen: the camera
// holds the two-screen room, she comes down on the shaft's floor, never a ledge, and the hero stands on one).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const FLOOR_Y = 236
const CHANNEL_ROOM = { stageId: 'basalt_titan', beds: ['basalt_boss_channel_1_bed', 'basalt_boss_channel_2_bed'] }
const SHAFT_ROOM = { stageId: 'gale_vixen', segmentId: 'gale_boss_shaft', ledgeId: 'gale_boss_ledge_right' }

export async function runBossGroundingScenario(
  name,
  { openGameplayPage, closeGameplayPage, waitForState, waitForPageCheck, advanceFrames }
) {
  const { browser, page, scenarioDir, errors } = await openGameplayPage(name)
  const evidence = {}
  const enterBossRoom = async () => {
    await waitForState(page, (state) => state.scene === 'Game' && state.newPlayer?.locomotion?.grounded === true, 8000)
    await waitForPageCheck(page, () => Boolean(window.stageDebug?.crossBossGate))
    await page.evaluate(() => {
      window.stageDebug?.crossBossGate?.()
      window.stageDebug?.activateBossRoom?.()
      window.bossDebug?.unlockIntro?.()
      window.stageDebug?.skipDialogue?.()
    })
    return waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.bossRoom?.cameraLocked === true, 6000)
  }
  const sample = async (count, frames = 15) => {
    const samples = []
    for (let index = 0; index < count; index += 1) {
      await advanceFrames(page, frames)
      samples.push(await page.evaluate(() => window.bossDebug?.groundReport?.() ?? null))
    }
    return samples
  }
  const startStage = async (stageId) => {
    await page.evaluate((id) => window.__phaserGame.scene.getScene('Game').scene.restart({ stageId: id }), stageId)
    await waitForState(page, (state) => state.scene === 'Game' && state.stageRuntime?.stageId === stageId, 15000, `${stageId} loaded`)
  }
  const shieldHero = () => page.evaluate(() => window.__phaserGame.scene.getScene('Game').newPlayerRuntime?.resetForRespawn?.(600000))
  const heroBody = () =>
    page.evaluate(() => {
      const body = window.__phaserGame.scene.getScene('Game').player?.body
      return body ? { x: Math.round(body.center.x), bottom: Math.round(body.bottom * 100) / 100, grounded: Boolean(body.blocked.down) } : null
    })
  const inRoom = (samples, room) =>
    samples.forEach((entry) =>
      assert.ok(entry.x >= room.x + 24 && entry.x <= room.x + room.width - 24, `boss left its room: x ${entry.x} (${room.x}+${room.width})`)
    )

  try {
    const entered = await enterBossRoom()
    evidence.defaultStage = entered.stageRuntime?.stageId

    // The boss spawns above the floor and must settle onto it under gravity.
    const settled = await waitForState(
      page,
      (state) => state.bossState?.runtime?.ground?.grounded === true,
      4000,
      'boss settles on the floor'
    )
    const first = settled.bossState.runtime.ground
    assert.ok(Math.abs(first.feetToBodyGap) <= 1, `boss floats on spawn: feet ${first.feetY} vs body bottom ${first.bodyBottom}`)

    const samples = await sample(24)
    fs.writeFileSync(path.join(scenarioDir, 'ground-samples.json'), JSON.stringify(samples, null, 2))
    await page.locator('canvas').screenshot({ path: path.join(scenarioDir, 'shot-boss-grounded.png') })

    assert.ok(samples.every((entry) => entry && typeof entry.feetToBodyGap === 'number'), 'ground report missing')
    const grounded = samples.filter((entry) => entry.grounded)
    assert.ok(grounded.length >= 6, `boss stood on the floor in only ${grounded.length}/${samples.length} samples`)
    grounded.forEach((entry) => {
      assert.ok(
        Math.abs(entry.feetToBodyGap) <= 1,
        `boss floats mid-fight: feet ${entry.feetY} vs body bottom ${entry.bodyBottom} (${entry.motionIntent}/${entry.lifecyclePhase})`
      )
    })
    // A grounded boss never has gravity switched off under it.
    grounded.forEach((entry) => {
      if (entry.lifecyclePhase === 'done' || entry.lifecyclePhase === 'landing') {
        assert.equal(entry.allowGravity, true, 'gravity must stay on for a resting boss')
      }
    })

    // The channel room: the walker crosses over the channels on their banks; the hero drops in onto a bed.
    await startStage(CHANNEL_ROOM.stageId)
    const channelState = await enterBossRoom()
    const channelRoom = channelState.stageRuntime.bossRoom
    await shieldHero()
    const channels = await page.evaluate((ids) => {
      const game = window.__phaserGame.scene.getScene('Game')
      return ids.map((id) => {
        const bed = game.platformCollisionSystem?.findPlatformVisual(id)
        return bed ? { id, left: bed.x - bed.width / 2, right: bed.x + bed.width / 2, bedTop: bed.y - bed.height / 2 } : null
      })
    }, CHANNEL_ROOM.beds)
    assert.ok(channels.every(Boolean), `channel beds built: ${JSON.stringify(channels)}`)
    await waitForState(page, (state) => state.bossState?.runtime?.ground?.grounded === true, 4000, 'the channel room boss settles')
    const walk = await sample(12)
    await page.evaluate((x) => window.stageDebug.setPlayerX(x), (channels[0].left + channels[0].right) / 2)
    await advanceFrames(page, 30)
    const heroInChannel = await heroBody()
    await page.locator('canvas').screenshot({ path: path.join(scenarioDir, 'shot-channel-room.png') })
    const channelSamples = [...walk, ...(await sample(12))]
    assert.ok(
      heroInChannel && heroInChannel.grounded && Math.abs(heroInChannel.bottom - channels[0].bedTop) <= 1,
      `the hero stands on the channel bed, a dip not a pit: ${JSON.stringify({ heroInChannel, bed: channels[0] })}`
    )
    assert.ok(channelSamples.every(Boolean), 'channel room ground report missing')
    channelSamples.forEach((entry) =>
      assert.ok(entry.bodyBottom <= FLOOR_Y + 1, `boss dropped into a channel: body bottom ${entry.bodyBottom} at x ${entry.x}`)
    )
    inRoom(channelSamples, channelRoom)
    const channelGrounded = channelSamples.filter((entry) => entry.grounded)
    assert.ok(channelGrounded.length >= 6, `channel room boss grounded in only ${channelGrounded.length}/${channelSamples.length}`)
    channelGrounded.forEach((entry) => assert.ok(Math.abs(entry.feetToBodyGap) <= 1 && Math.abs(entry.bodyBottom - FLOOR_Y) <= 1, `boss off the floor line: ${JSON.stringify(entry)}`))
    evidence.channelRoom = {
      room: channelRoom,
      channels,
      heroInChannel,
      groundedSamples: channelGrounded.length,
      overChannelSamples: channelSamples.filter((entry) => channels.some((channel) => entry.x >= channel.left && entry.x <= channel.right)).length,
      xRange: [Math.min(...channelSamples.map((entry) => entry.x)), Math.max(...channelSamples.map((entry) => entry.x))]
    }

    // The shaft: two screens held by the camera; the Vixen lands on the floor, never a ledge; the hero can stand on one.
    await startStage(SHAFT_ROOM.stageId)
    const shaftState = await enterBossRoom()
    const shaftRoom = shaftState.stageRuntime.bossRoom
    await shieldHero()
    const held = await waitForState(
      page,
      (state) => state.mechanics?.verticalSegments?.some((segment) => segment.id === SHAFT_ROOM.segmentId && segment.cameraHeld),
      4000,
      'the camera holds the shaft'
    )
    const shaft = held.mechanics.verticalSegments.find((segment) => segment.id === SHAFT_ROOM.segmentId)
    assert.ok(shaft.room.height >= 2 * 252 && shaft.room.x === shaftRoom.x, `the shaft is the room, two screens: ${JSON.stringify(shaft.room)}`)
    const landed = await waitForState(page, (state) => state.bossState?.runtime?.ground?.grounded === true, 4000, 'the Vixen settles')
    assert.ok(Math.abs(landed.bossState.runtime.ground.bodyBottom - FLOOR_Y) <= 1, `the Vixen lands on the shaft floor: ${landed.bossState.runtime.ground.bodyBottom}`)
    await page.locator('canvas').screenshot({ path: path.join(scenarioDir, 'shot-shaft-floor.png') })
    const shaftSamples = await sample(24)
    assert.ok(shaftSamples.every(Boolean), 'shaft ground report missing')
    inRoom(shaftSamples, shaftRoom)
    const shaftGrounded = shaftSamples.filter((entry) => entry.grounded)
    shaftGrounded.forEach((entry) => assert.ok(Math.abs(entry.bodyBottom - FLOOR_Y) <= 1 && Math.abs(entry.feetToBodyGap) <= 1, `the Vixen stood off the shaft floor: ${JSON.stringify(entry)}`))
    const ledge = await page.evaluate((id) => {
      const game = window.__phaserGame.scene.getScene('Game')
      const visual = game.platformCollisionSystem?.findPlatformVisual(id)
      if (!visual) return null
      game.player.setPosition(visual.x, visual.y - visual.height / 2 - 24)
      game.player.body.setVelocity(0, 0)
      return { x: visual.x, top: visual.y - visual.height / 2 }
    }, SHAFT_ROOM.ledgeId)
    assert.ok(ledge, 'the ledge is built')
    await advanceFrames(page, 40)
    const heroOnLedge = await heroBody()
    const cameraTop = await page.evaluate(() => window.__phaserGame.scene.getScene('Game').cameras.main.scrollY)
    await page.locator('canvas').screenshot({ path: path.join(scenarioDir, 'shot-shaft-ledge.png') })
    assert.ok(heroOnLedge?.grounded && Math.abs(heroOnLedge.bottom - ledge.top) <= 1, `the hero stands on the wall-side ledge: ${JSON.stringify({ heroOnLedge, ledge })}`)
    evidence.shaft = { room: shaftRoom, segment: shaft, groundedSamples: shaftGrounded.length, heroOnLedge, ledge, cameraTop }

    fs.writeFileSync(path.join(scenarioDir, 'room-evidence.json'), JSON.stringify(evidence, null, 2))
    assert.equal(errors.length, 0, JSON.stringify(errors))
  } finally {
    await closeGameplayPage(browser, scenarioDir, errors)
  }
}
