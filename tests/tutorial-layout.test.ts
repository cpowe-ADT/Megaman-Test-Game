import test from 'node:test'
import assert from 'node:assert/strict'
import { getCampaignStage, TUTORIAL_STAGE_ID } from '../src/content/campaign.ts'
import { PLAYER_GAMEPLAY_CONFIG } from '../src/player/config.ts'

/** A hero can leave a ledge with half its body over the edge and land with half on: one body width, generously. */
const BODY_ALLOWANCE_PX = 24

function flatJumpRange(speedX: number): number {
  const { jumpVelocity, gravity } = PLAYER_GAMEPLAY_CONFIG.movement
  return speedX * ((2 * Math.abs(jumpVelocity)) / gravity)
}

function jumpHeight(): number {
  const { jumpVelocity, gravity } = PLAYER_GAMEPLAY_CONFIG.movement
  return (jumpVelocity * jumpVelocity) / (2 * gravity)
}

/** Floor top (game px): a hazard at y 230 has a 10px body resting on it. */
const FLOOR_TOP = 236
const SPIKE_HALF_WIDTH = 14

function ledgeOf(id: string) {
  const platform = getCampaignStage(TUTORIAL_STAGE_ID).arena.midPlatforms.find((entry) => entry.id === id)
  assert.ok(platform, `${id} exists`)
  return { left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - (platform.height ?? 8) / 2 }
}

test('tutorial dash gap: a plain running jump falls short, a dash jump clears it', () => {
  const stage = getCampaignStage(TUTORIAL_STAGE_ID)
  const ledge = (id: string) => {
    const platform = stage.arena.midPlatforms.find((entry) => entry.id === id)
    assert.ok(platform, `${id} exists`)
    return { left: platform.x - platform.width / 2, right: platform.x + platform.width / 2, top: platform.y - (platform.height ?? 8) / 2 }
  }
  const near = ledge('tutorial_dash_ledge_a')
  const far = ledge('tutorial_dash_ledge_b')
  assert.equal(near.top, far.top, 'both ledges share a height, so the flight is a full flat jump')
  const gap = far.left - near.right
  const plain = flatJumpRange(PLAYER_GAMEPLAY_CONFIG.movement.runSpeed)
  const dash = flatJumpRange(PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed)
  assert.ok(gap >= 200, `gap ${gap}px is at least 200px`)
  assert.ok(plain + BODY_ALLOWANCE_PX < gap, `a plain jump (${plain.toFixed(1)}px + ${BODY_ALLOWANCE_PX}) falls short of ${gap}px`)
  assert.ok(dash >= gap, `a dash jump (${dash.toFixed(1)}px) clears ${gap}px`)
  const locks = stage.arena.roomLocks ?? []
  const dashRoom = locks.find((lock) => lock.requiredInput === 'dash')
  assert.ok(dashRoom && near.left >= dashRoom.room.x && far.right <= dashRoom.gateX, 'the gap sits inside the dash room')
})

test('tutorial checkpoints: start, the end of the dash room, after the shaft, the boss gate', () => {
  const checkpoints = getCampaignStage(TUTORIAL_STAGE_ID).arena.checkpoints
  const dashExit = checkpoints[1]
  assert.ok(dashExit.x >= 896 && dashExit.x <= 960 && dashExit.triggerX >= 896 && dashExit.triggerX <= 960, 'checkpoint 2 closes the dash room')
  assert.deepEqual(checkpoints.map((entry) => entry.id), ['tutorial_start', 'tutorial_dash_exit', 'tutorial_shaft_exit', 'tutorial_boss_gate'])
})

test('tutorial dash teach is safe: no hazard and no enemy in the dash room, and the bay floor is one hop from the deck', () => {
  const stage = getCampaignStage(TUTORIAL_STAGE_ID)
  const dashRoom = (stage.arena.roomLocks ?? []).find((lock) => lock.requiredInput === 'dash')
  assert.ok(dashRoom)
  const inRoom = (x: number) => x >= dashRoom.room.x && x < dashRoom.gateX
  assert.deepEqual(stage.arena.hazards.filter((hazard) => inRoom(hazard.x)).map((hazard) => hazard.id), [], 'no spikes on the first dash teach')
  assert.deepEqual(stage.enemyMarkers.filter((enemy) => inRoom(enemy.x)).map((enemy) => enemy.id), [], 'no enemies on the first dash teach')
  const deck = ledgeOf('tutorial_dash_ledge_a')
  assert.ok(FLOOR_TOP - deck.top < jumpHeight() - 16, `a hero who falls into the bay hops back up the ${FLOOR_TOP - deck.top}px deck face`)
})

test('tutorial spikes appear only after the verb they test: all on the approach, in the dash check bay', () => {
  const stage = getCampaignStage(TUTORIAL_STAGE_ID)
  const locks = stage.arena.roomLocks ?? []
  const saberGate = locks.find((lock) => lock.requiredInput === 'saber')?.gateX ?? Infinity
  assert.ok(stage.arena.hazards.length > 0, 'the dash check has spikes')
  assert.ok(stage.arena.hazards.every((hazard) => hazard.x >= saberGate), 'every spike sits past the last teach gate')
  const launch = ledgeOf('tutorial_check_ledge_a')
  const landing = ledgeOf('tutorial_check_ledge_b')
  assert.equal(launch.top, landing.top)
  const gap = landing.left - launch.right
  assert.ok(flatJumpRange(PLAYER_GAMEPLAY_CONFIG.movement.runSpeed) + BODY_ALLOWANCE_PX < gap, `a plain jump falls short of the ${gap}px check`)
  assert.ok(flatJumpRange(PLAYER_GAMEPLAY_CONFIG.dash.dashSpeed) >= gap, `a dash jump clears the ${gap}px check`)
  for (const spike of stage.arena.hazards) {
    assert.ok(spike.x - SPIKE_HALF_WIDTH >= launch.right && spike.x + SPIKE_HALF_WIDTH <= landing.left, `${spike.id} lies inside the check bay`)
  }
  const nearestSpike = Math.min(...stage.arena.hazards.map((hazard) => hazard.x - SPIKE_HALF_WIDTH))
  assert.ok(nearestSpike - launch.right >= 100, 'a walk-off from the deck lands on spike-free floor')
  const bossGate = stage.arena.checkpoints.at(-1)
  assert.ok(bossGate && bossGate.x >= landing.left && bossGate.x <= landing.right, 'the boss-gate respawn lands on the check ledge, never in the bay')
})

test('tutorial enemy roster follows the brief: 8 placements over 5 types plus the charge target', () => {
  const stage = getCampaignStage(TUTORIAL_STAGE_ID)
  const counts: Record<string, number> = {}
  for (const enemy of stage.enemyMarkers) counts[enemy.typeKey] = (counts[enemy.typeKey] ?? 0) + 1
  assert.deepEqual(counts, {
    enemy_gunner_bot: 2,
    enemy_shock_hopper: 2,
    enemy_drone: 2,
    enemy_shield_drone: 1,
    enemy_rocket_bot: 1,
    enemy_armored_bot: 1
  })
  const shaftGate = (stage.arena.roomLocks ?? []).find((lock) => lock.requiredInput === 'wall_jump')?.gateX ?? 0
  assert.ok(stage.enemyMarkers.filter((enemy) => enemy.typeKey === 'enemy_drone').every((enemy) => enemy.x >= shaftGate), 'drones only after the wall-jump shaft')
  const firstScreen = stage.enemyMarkers.filter((enemy) => enemy.x < 448)
  assert.deepEqual(firstScreen.map((enemy) => enemy.typeKey), ['enemy_gunner_bot'], 'the gunner is the first threat, alone')
})
