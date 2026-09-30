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
import { applyExtraLifePickup } from '../src/ui/pickups/extraLife'
import { GAME_SCENE_ATLASES } from '../src/scenes/game/stageBackgroundLoading'

// Part 12h (EVAL-P8-001): pickups drawn from pickups_v1, and the large health drop every mini-boss leaves.
// Part 13e (EVAL-P13-009/010): pickups_v2 art, the bonus/life drop types, and the extra-life cap helper.

test('every pickup group has its two frames in the pickups_v2 atlas, a Game-scene resident', () => {
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
    ['health_small', 'health_large', 'energy_small', 'bonus', 'extra_life']
  )
  assert.deepEqual(LOCATION_ART, { capsule: 'capsule', heart_tank: 'heart_tank', sub_tank: 'sub_tank', pickup_bonus: 'health_large', extra_life: 'extra_life' })
})

test('the random drop keeps its odds and never rolls the large capsule', () => {
  assert.deepEqual(
    [0, 0.17, 0.2, 0.32, 0.4, 0.449].map((roll) => rollEnemyDrop(roll)),
    ['health', 'health', 'ammo', 'ammo', 'bonus', 'bonus']
  )
  for (let roll = 0; roll < 1; roll += 0.01) assert.notEqual(rollEnemyDrop(roll), 'health_large')
})

test('a life is a further 2% on Normal/Veteran and 4% on Assist, carved from the "nothing" remainder', () => {
  // Normal and Veteran: life fills [0.45, 0.47); clearly inside and clearly past it (not exact-sum boundaries,
  // which float addition cannot guarantee land exactly on 0.47).
  assert.equal(rollEnemyDrop(0.45, 'normal'), 'life')
  assert.equal(rollEnemyDrop(0.469, 'normal'), 'life')
  assert.equal(rollEnemyDrop(0.48, 'normal'), null)
  assert.equal(rollEnemyDrop(0.45, 'veteran'), 'life')
  assert.equal(rollEnemyDrop(0.48, 'veteran'), null)
  // Assist: life fills [0.45, 0.49), so 0.48 is still a life there though it is already null on Normal above.
  assert.equal(rollEnemyDrop(0.45, 'assist'), 'life')
  assert.equal(rollEnemyDrop(0.48, 'assist'), 'life')
  assert.equal(rollEnemyDrop(0.5, 'assist'), null)
  assert.equal(rollEnemyDrop(0.99), null)
  // The default (no difficulty passed) is Normal's 2%.
  assert.equal(rollEnemyDrop(0.46), 'life')
})

function effects(hpRoom: number, energyRoom: number, lifeRoom = 1) {
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
    },
    addLife: () => {
      calls.push('life')
      return lifeRoom
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

test('a life drop grants an extra life, or reports the cap when one exists and is already hit', () => {
  let run = effects(10, 10, 1)
  assert.deepEqual(applyDropReward('life', run.fx), { sfx: 'pickup_bonus', message: '1UP' })
  assert.deepEqual(run.calls, ['life'])
  run = effects(10, 10, 0)
  assert.deepEqual(applyDropReward('life', run.fx), { sfx: 'pickup_bonus', message: 'LIFE MAX' })
})

test('collecting an extra life adds one, capped at the existing maximum if there is one', () => {
  assert.equal(applyExtraLifePickup(3), 4)
  assert.equal(applyExtraLifePickup(0), 1)
  // No cap exists in this codebase today, so an unbounded grant is the correct default.
  assert.equal(applyExtraLifePickup(98), 99)
  // The clamp itself still works, so a future cap is honoured the moment one is passed in.
  assert.equal(applyExtraLifePickup(8, 9), 9)
  assert.equal(applyExtraLifePickup(9, 9), 9)
})
