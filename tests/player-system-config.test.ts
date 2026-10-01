import test from 'node:test'
import assert from 'node:assert/strict'
import { AnimationManifest } from '../src/player/AnimationManifest'
import { resolveSwordVisualFacing, shouldFlipPlayerSpriteForFacing } from '../src/player/config'
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
  'player_wall_slide',
  'player_wall_jump',
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
  assert.equal(DEFAULT_PLAYER_FEATURE_FLAGS.enableWallSlideJump, true)
  assert.equal(DEFAULT_PLAYER_FEATURE_FLAGS.enableTouchControls, true)
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
    assert.equal(AnimationManifest.animations[`player_slash_ground_${dir}`]?.frameEnd >= 3, true)
    assert.equal(AnimationManifest.animations[`player_slash_air_${dir}`]?.frameEnd >= 3, true)
  })
})

test('run and fire locomotion animations use readable frame rates', () => {
  assert.equal(AnimationManifest.animations.player_run.frameRate >= 12, true)
  assert.equal(AnimationManifest.animations.player_shoot_run_fwd.frameRate >= 12, true)
  assert.equal(AnimationManifest.animations.player_idle.frameRate >= 4, true)
})

test('hero sheets are authored facing left, so the sprite flips when facing right', () => {
  assert.equal(shouldFlipPlayerSpriteForFacing(1), true)
  assert.equal(shouldFlipPlayerSpriteForFacing(-1), false)
})

test('resolveEightDirection returns expected buckets', () => {
  assert.equal(resolveEightDirection({ x: 1, y: 0 }, 1, 0.2), 'e')
  assert.equal(resolveEightDirection({ x: -1, y: 0 }, 1, 0.2), 'w')
  assert.equal(resolveEightDirection({ x: 0, y: -1 }, 1, 0.2), 'n')
  assert.equal(resolveEightDirection({ x: 0, y: 1 }, 1, 0.2), 's')
  assert.equal(resolveEightDirection({ x: 1, y: -1 }, 1, 0.2), 'ne')
  assert.equal(resolveEightDirection({ x: -1, y: 1 }, 1, 0.2), 'sw')
})

test('sword visual facing follows the locked horizontal attack direction', () => {
  assert.equal(resolveSwordVisualFacing('w', 1), -1)
  assert.equal(resolveSwordVisualFacing('nw', 1), -1)
  assert.equal(resolveSwordVisualFacing('sw', 1), -1)
  assert.equal(resolveSwordVisualFacing('e', -1), 1)
  assert.equal(resolveSwordVisualFacing('ne', -1), 1)
  assert.equal(resolveSwordVisualFacing('se', -1), 1)
  assert.equal(resolveSwordVisualFacing('n', -1), -1)
  assert.equal(resolveSwordVisualFacing('s', 1), 1)
})
