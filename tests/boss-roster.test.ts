import test from 'node:test'
import assert from 'node:assert/strict'
import { getBossById } from '../src/bosses/roster'

const sentinelId = 'sentinel_rook' as const

function getGuardShot() {
  const blueprint = getBossById(sentinelId)
  const guardShot = blueprint.attacks.find((attack) => attack.name === 'Guard Shot')

  assert.ok(guardShot, 'Sentinel Rook is expected to have a Guard Shot attack defined')
  return guardShot
}

test('Sentinel Rook Guard Shot remains a projectile attack', () => {
  const guardShot = getGuardShot()
  assert.equal(guardShot.state, 'shoot')
})

test('Sentinel Rook Guard Shot fires the slow bullet projectile', () => {
  const guardShot = getGuardShot()
  assert.deepEqual(guardShot.spawns, ['slow_bullet'])
})
