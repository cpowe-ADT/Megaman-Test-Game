import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveHurtbox, rectHurtboxOverlap, type TopLeftRect } from '../src/combat/Hitbox'
import { swordHitboxIntersectsTarget } from '../src/player/swordCollision'
import type { ResolvedHitbox } from '../src/player/types'

/**
 * Prompt 06 phase 6.0 (`EVAL-P6-015`): one `resolveHurtbox` for the sword, player shots against
 * enemies and bosses (`ProjectileCollisionRouter.handlePlayerBulletHitsEnemy`/`HitsBoss`, through the
 * exported `rectHurtboxOverlap`) and an enemy's melee hitbox against the player
 * (`EnemyCombat.applyMeleeHitIfNeeded`, the exact box `EnemyDebugOverlay` draws in red -- also through
 * `rectHurtboxOverlap`). This fixture is one attacker box and one target box, worked out the way each
 * consumer already has the numbers on hand: the sword keeps an origin point and an offset hitbox
 * shape; the other two start from a Phaser-style top-left rect (an Arcade body, `getActiveHitboxRect`,
 * `getBounds()`). All three must land on the same verdict.
 */

const TARGET_CENTER = { x: 130, y: 100, width: 20, height: 24 }
// The same target, as the top-left rect a Phaser body or `getBounds()` would hand the shot router and
// an enemy's melee check: x/y = 130 - 20/2, 100 - 24/2.
const TARGET_RECT: TopLeftRect = { x: 120, y: 88, width: 20, height: 24 }

function swordHitbox(width: number, height: number): ResolvedHitbox {
  return {
    shape: { kind: 'rect', offsetX: 0, offsetY: 0, width, height },
    direction: 'e',
    grounded: true
  }
}

test('hit contract: an attacker box overlapping the target is a hit for all three consumers', () => {
  const origin = { x: 138, y: 96 }
  // The same attacker box, as a top-left rect: origin is its centre.
  const attackerRect: TopLeftRect = { x: origin.x - 8, y: origin.y - 5, width: 16, height: 10 }

  const canonical = resolveHurtbox(origin, { kind: 'rect', width: 16, height: 10 }, TARGET_CENTER)
  const sword = swordHitboxIntersectsTarget(origin, swordHitbox(16, 10), TARGET_CENTER)
  // The shot router and an enemy's melee hitbox both call this one function on their own rects.
  const shotsAndMelee = rectHurtboxOverlap(attackerRect, TARGET_RECT)

  assert.equal(canonical, true)
  assert.equal(sword, canonical)
  assert.equal(shotsAndMelee, canonical)
})

test('hit contract: an attacker box well clear of the target misses for all three consumers', () => {
  const origin = { x: 300, y: 96 }
  const attackerRect: TopLeftRect = { x: origin.x - 8, y: origin.y - 5, width: 16, height: 10 }

  const canonical = resolveHurtbox(origin, { kind: 'rect', width: 16, height: 10 }, TARGET_CENTER)
  const sword = swordHitboxIntersectsTarget(origin, swordHitbox(16, 10), TARGET_CENTER)
  const shotsAndMelee = rectHurtboxOverlap(attackerRect, TARGET_RECT)

  assert.equal(canonical, false)
  assert.equal(sword, canonical)
  assert.equal(shotsAndMelee, canonical)
})

test('hit contract: boxes that only touch at the edge agree between the rect form and the canonical form', () => {
  // The attacker's right edge lands exactly on the target's left edge (x: 100..120 vs target 120..140).
  const origin = { x: 110, y: 100 }
  const attackerRect: TopLeftRect = { x: 100, y: 88, width: 20, height: 24 }

  const canonical = resolveHurtbox(origin, { kind: 'rect', width: 20, height: 24 }, TARGET_CENTER)
  const shotsAndMelee = rectHurtboxOverlap(attackerRect, TARGET_RECT)

  assert.equal(shotsAndMelee, canonical)
})
