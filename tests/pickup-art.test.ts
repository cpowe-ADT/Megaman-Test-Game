import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  DROP_ART,
  ENEMY_DROP_TYPES,
  LOCATION_ART,
  PICKUPS_ATLAS,
  PICKUP_ART_GROUPS,
  pickupFrame,
  rollEnemyDrop
} from '../src/ui/pickups/pickupArt'
import { DROP_HEAL, applyDropReward, type DropRewardEffects } from '../src/ui/pickups/dropRewards'
import { GAME_SCENE_ATLASES } from '../src/scenes/game/stageBackgroundLoading'

// Part 12h (EVAL-P8-001): pickups drawn from pickups_v1, and the large health drop every mini-boss leaves.

test('every pickup group has its two frames in the pickups_v1 atlas, a Game-scene resident', () => {
  const atlas = JSON.parse(fs.readFileSync(PICKUPS_ATLAS.data, 'utf8')) as { frames: Record<string, unknown> }
  assert.ok(fs.existsSync(PICKUPS_ATLAS.image), PICKUPS_ATLAS.image)
  for (const group of PICKUP_ART_GROUPS) {
    for (const index of [0, 1] as const) assert.ok(atlas.frames[pickupFrame(group, index)], `${group} frame ${index}`)
  }
  assert.equal(Object.keys(atlas.frames).length, PICKUP_ART_GROUPS.length * 2, 'no frame the game cannot name')
  const resident: ReadonlyArray<{ key: string }> = GAME_SCENE_ATLASES
  assert.ok(resident.some((atlasEntry) => atlasEntry.key === PICKUPS_ATLAS.key), 'loaded with the Game scene atlases')
})

test('each drop type and placed pickup draws its own group', () => {
  assert.deepEqual(
    ENEMY_DROP_TYPES.map((type) => DROP_ART[type]),
    ['health_small', 'health_large', 'energy_small', 'energy_large']
  )
  assert.deepEqual(LOCATION_ART, { capsule: 'capsule', heart_tank: 'heart_tank', sub_tank: 'sub_tank', pickup_bonus: 'health_large' })
})

test('the random drop keeps its odds and never rolls the large capsule', () => {
  assert.deepEqual([0, 0.17, 0.2, 0.32, 0.4, 0.45, 0.46, 0.99].map(rollEnemyDrop), ['health', 'health', 'ammo', 'ammo', 'bonus', 'bonus', null, null])
  for (let roll = 0; roll < 1; roll += 0.01) assert.notEqual(rollEnemyDrop(roll), 'health_large')
})

function effects(hpRoom: number, energyRoom: number) {
  const calls: string[] = []
  const fx: DropRewardEffects = {
    heal: (amount) => {
      calls.push(`heal ${amount}`)
      return Math.min(amount, hpRoom)
    },
    restoreEnergy: (amount) => {
      calls.push(`energy ${amount}`)
      const restored = Math.min(amount, energyRoom)
      return { weaponId: restored > 0 ? 'FlameSerpent' : null, restored }
    }
  }
  return { fx, calls }
}

test('the large health drop heals 6, like hp_refill_large; the small one heals 2', () => {
  assert.equal(DROP_HEAL.health_large, 6)
  let run = effects(10, 10)
  assert.deepEqual(applyDropReward('health_large', run.fx), { sfx: 'pickup_health', message: 'HP +6' })
  assert.deepEqual(run.calls, ['heal 6'])
  run = effects(3, 10)
  assert.deepEqual(applyDropReward('health_large', run.fx), { sfx: 'pickup_health', message: 'HP +3' })
  run = effects(10, 10)
  assert.deepEqual(applyDropReward('health', run.fx), { sfx: 'pickup_health', message: 'HP +2' })
  assert.deepEqual(run.calls, ['heal 2'])
})

test('a health drop at full HP gives weapon energy, then SYSTEM OK; ammo and bonus keep their rules', () => {
  let run = effects(0, 10)
  const atFull = applyDropReward('health_large', run.fx)
  assert.equal(atFull.sfx, 'pickup_ammo')
  assert.match(atFull.message, / \+4$/)
  assert.deepEqual(run.calls, ['heal 6', 'energy 4'])
  run = effects(0, 0)
  assert.deepEqual(applyDropReward('health', run.fx), { sfx: 'pickup_bonus', message: 'SYSTEM OK' })
  run = effects(10, 10)
  assert.equal(applyDropReward('ammo', run.fx).sfx, 'pickup_ammo')
  assert.deepEqual(run.calls, ['energy 6'])
  run = effects(0, 0)
  assert.deepEqual(applyDropReward('ammo', run.fx), { sfx: 'pickup_bonus', message: 'ENERGY MAX' })
  run = effects(10, 10)
  assert.equal(applyDropReward('bonus', run.fx).sfx, 'pickup_bonus')
  assert.deepEqual(run.calls, ['heal 1', 'energy 3'])
  run = effects(0, 0)
  assert.deepEqual(applyDropReward('bonus', run.fx), { sfx: 'pickup_bonus', message: 'BONUS SECURED' })
})
