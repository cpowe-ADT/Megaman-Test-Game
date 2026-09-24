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
