import test from 'node:test'
import assert from 'node:assert/strict'
import {
  consumeProjectileHit,
  shouldSkipProjectileHit
} from '../src/projectiles/collision/projectileHitTracking'

function createData(seed: Record<string, unknown> = {}) {
  const store = new Map(Object.entries(seed))
  return {
    get(key: string) {
      return store.get(key)
    },
    set(key: string, value: unknown) {
      store.set(key, value)
    }
  }
}

function createBullet(seed: Record<string, unknown> = {}) {
  const data = createData(seed)
  const body = {
    lastReset: null as { x: number; y: number } | null,
    velocityX: 0,
    reset(x: number, y: number) {
      body.lastReset = { x, y }
    },
    setVelocityX(value: number) {
      body.velocityX = value
    }
  }

  const bullet = {
    x: 32,
    y: 18,
    data,
    body,
    setPosition(x: number, y: number) {
      bullet.x = x
      bullet.y = y
    }
  }

  return bullet
}

function createTarget(seed: Record<string, unknown> = {}) {
  return {
    x: 48,
    y: 18,
    data: createData(seed)
  }
}

test('repeat-hit suppression blocks the same target inside the cooldown window', () => {
  const bullet = createBullet({
    lastHitTargetId: 'enemy-1',
    lastHitAt: 100
  })
  const target = createTarget({ enemyFrameworkId: 'enemy-1' })

  assert.equal(shouldSkipProjectileHit(bullet, target, 150), true)
  assert.equal(shouldSkipProjectileHit(bullet, target, 191), false)
})

test('consumeProjectileHit decrements pierce and pushes the projectile forward', () => {
  const bullet = createBullet({
    pierceRemaining: 2,
    baseSpeedX: 320,
    bulletFacing: 1
  })
  const target = createTarget({ enemyFrameworkId: 'enemy-7' })

  const survives = consumeProjectileHit(bullet, target, 240, 1)

  assert.equal(survives, true)
  assert.equal(bullet.data.get('lastHitTargetId'), 'enemy-7')
  assert.equal(bullet.data.get('lastHitAt'), 240)
  assert.equal(bullet.data.get('pierceRemaining'), 1)
  assert.equal(bullet.x, 46)
  assert.deepEqual(bullet.body.lastReset, { x: 46, y: 18 })
  assert.equal(bullet.body.velocityX, 320)
})

test('consumeProjectileHit returns false when the projectile has no pierce remaining', () => {
  const bullet = createBullet({ pierceRemaining: 0 })
  const target = createTarget({ enemyFrameworkId: 'enemy-2' })

  const survives = consumeProjectileHit(bullet, target, 300, -1)

  assert.equal(survives, false)
  assert.equal(bullet.data.get('lastHitTargetId'), 'enemy-2')
  assert.equal(bullet.data.get('lastHitAt'), 300)
})
