import test from 'node:test'
import assert from 'node:assert/strict'
import { shouldCollideWithOneWayPlatform } from '../src/physics/platformCollisionRules'

test('one-way collides when actor is descending from above and crossing top', () => {
  const collide = shouldCollideWithOneWayPlatform({
    actorPrevBottom: 98,
    actorBottom: 102,
    actorVelocityY: 80,
    actorLeft: 40,
    actorRight: 52,
    platformTop: 100,
    platformLeft: 30,
    platformRight: 80,
    dropThroughActive: false
  })

  assert.equal(collide, true)
})

test('one-way does not collide when actor is moving up through platform', () => {
  const collide = shouldCollideWithOneWayPlatform({
    actorPrevBottom: 106,
    actorBottom: 102,
    actorVelocityY: -120,
    actorLeft: 40,
    actorRight: 52,
    platformTop: 100,
    platformLeft: 30,
    platformRight: 80,
    dropThroughActive: false
  })

  assert.equal(collide, false)
})

test('one-way does not collide while drop-through is active', () => {
  const collide = shouldCollideWithOneWayPlatform({
    actorPrevBottom: 98,
    actorBottom: 102,
    actorVelocityY: 40,
    actorLeft: 40,
    actorRight: 52,
    platformTop: 100,
    platformLeft: 30,
    platformRight: 80,
    dropThroughActive: true
  })

  assert.equal(collide, false)
})

test('one-way does not collide without horizontal overlap', () => {
  const collide = shouldCollideWithOneWayPlatform({
    actorPrevBottom: 98,
    actorBottom: 102,
    actorVelocityY: 60,
    actorLeft: 5,
    actorRight: 12,
    platformTop: 100,
    platformLeft: 30,
    platformRight: 80,
    dropThroughActive: false
  })

  assert.equal(collide, false)
})
