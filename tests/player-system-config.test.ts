import test from 'node:test'
import assert from 'node:assert/strict'
import { AnimationManifest } from '../src/player/AnimationManifest'
import { DEFAULT_PLAYER_FEATURE_FLAGS } from '../src/player/featureFlags'
import { resolveEightDirection } from '../src/player/PlayerCombat'

const requiredAnimationKeys = [
  'player_idle',
  'player_turn',
  'player_run',
  'player_crouch_in',
  'player_crouch_hold',
  'player_crouch_out',
  'player_jump_start',
  'player_jump_rise',
  'player_jump_apex',
  'player_fall',
  'player_land',
  'player_dash_start',
  'player_dash_loop',
  'player_dash_end',
  'player_airdash_start',
  'player_airdash_loop',
  'player_airdash_end',
  'player_shoot_stand_fwd',
  'player_shoot_run_fwd',
  'player_shoot_air_fwd',
  'player_shoot_dash_fwd',
  'player_charge_start',
  'player_charge_hold',
  'player_charge_release_lv1',
  'player_charge_release_lv2',
  'player_charge_release_lv3',
  'player_charge_release_lv4',
  'player_hurt_light',
  'player_hurt_heavy',
  'player_death'
]

test('new player feature flags default to v2-enabled behavior', () => {
  assert.equal(DEFAULT_PLAYER_FEATURE_FLAGS.enableSword, true)
  assert.equal(DEFAULT_PLAYER_FEATURE_FLAGS.enableChargeShot, true)
  assert.equal(DEFAULT_PLAYER_FEATURE_FLAGS.enableAirDash, true)
  assert.equal(DEFAULT_PLAYER_FEATURE_FLAGS.enableHitstop, true)
  assert.equal(DEFAULT_PLAYER_FEATURE_FLAGS.enableDebugHitboxes, false)
})

test('animation manifest includes required top-level animation keys', () => {
  const keys = Object.keys(AnimationManifest.animations)
  requiredAnimationKeys.forEach((key) => {
    assert.equal(keys.includes(key), true, `missing animation key: ${key}`)
  })
})

test('animation manifest contains all 8 sword directions for ground and air', () => {
  const dirs = ['n', 'ne', 'e', 'se', 's', 'sw', 'w', 'nw']
  dirs.forEach((dir) => {
    assert.equal(AnimationManifest.animations[`player_slash_ground_${dir}`] != null, true)
    assert.equal(AnimationManifest.animations[`player_slash_air_${dir}`] != null, true)
  })
})

test('resolveEightDirection returns expected buckets', () => {
  assert.equal(resolveEightDirection({ x: 1, y: 0 }, 1, 0.2), 'e')
  assert.equal(resolveEightDirection({ x: -1, y: 0 }, 1, 0.2), 'w')
  assert.equal(resolveEightDirection({ x: 0, y: -1 }, 1, 0.2), 'n')
  assert.equal(resolveEightDirection({ x: 0, y: 1 }, 1, 0.2), 's')
  assert.equal(resolveEightDirection({ x: 1, y: -1 }, 1, 0.2), 'ne')
  assert.equal(resolveEightDirection({ x: -1, y: 1 }, 1, 0.2), 'sw')
})
