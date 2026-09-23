import test from 'node:test'
import assert from 'node:assert/strict'
import { PLAYER_GAMEPLAY_CONFIG } from '../src/player/config'
import { resolveSwordHitboxOrigin, swordHitboxIntersectsTarget } from '../src/player/swordCollision'
import type { ResolvedHitbox } from '../src/player/types'

test('ground sword hitbox reaches an enemy in front of the player', () => {
  const hitbox: ResolvedHitbox = {
    shape: PLAYER_GAMEPLAY_CONFIG.sword.windows.ground.e.hitbox,
    direction: 'e',
    grounded: true
  }
  const origin = resolveSwordHitboxOrigin(100, 120, 1, hitbox)
  const intersects = swordHitboxIntersectsTarget(origin, hitbox, {
    x: 122,
    y: 114,
    width: 22,
    height: 26
  })
  assert.equal(intersects, true)
})

test('upward air sword hitbox can connect with a boss-sized target above the player', () => {
  const hitbox: ResolvedHitbox = {
    shape: PLAYER_GAMEPLAY_CONFIG.sword.windows.air.n.hitbox,
    direction: 'n',
    grounded: false
  }
  const origin = resolveSwordHitboxOrigin(160, 140, 1, hitbox)
  const intersects = swordHitboxIntersectsTarget(origin, hitbox, {
    x: 160,
    y: 115,
    width: 44,
    height: 44
  })
  assert.equal(intersects, true)
})

test('sword hitbox does not register targets well outside the swing arc', () => {
  const hitbox: ResolvedHitbox = {
    shape: PLAYER_GAMEPLAY_CONFIG.sword.windows.ground.e.hitbox,
    direction: 'e',
    grounded: true
  }
  const origin = resolveSwordHitboxOrigin(100, 120, 1, hitbox)
  const intersects = swordHitboxIntersectsTarget(origin, hitbox, {
    x: 170,
    y: 114,
    width: 20,
    height: 20
  })
  assert.equal(intersects, false)
})

test('west-facing sword hitboxes stay on the left side of the player', () => {
  const hitbox: ResolvedHitbox = {
    shape: PLAYER_GAMEPLAY_CONFIG.sword.windows.ground.w.hitbox,
    direction: 'w',
    grounded: true
  }
  const origin = resolveSwordHitboxOrigin(100, 120, -1, hitbox)
  assert.equal(origin.x < 100, true)
  const intersects = swordHitboxIntersectsTarget(origin, hitbox, {
    x: 78,
    y: 114,
    width: 20,
    height: 20
  })
  assert.equal(intersects, true)
})
