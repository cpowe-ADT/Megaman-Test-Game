import test from 'node:test'
import assert from 'node:assert/strict'
import {
  getLatestActiveProjectile,
  spawnDebugProjectileClash,
  summarizeProjectilePool
} from '../src/projectiles/diagnostics/ProjectileDevTools'

function createProjectile(active = true) {
  const body = {
    velocityX: 0,
    velocityY: 0,
    resetX: 0,
    resetY: 0,
    reset(x: number, y: number) {
      body.resetX = x
      body.resetY = y
    },
    setVelocityX(value: number) {
      body.velocityX = value
    },
    setVelocityY(value: number) {
      body.velocityY = value
    }
  }

  const sprite = {
    x: 0,
    y: 0,
    active,
    body,
    setPosition(x: number, y: number) {
      sprite.x = x
      sprite.y = y
      return sprite
    }
  }

  return sprite
}

function createGroup(children: any[]) {
  return {
    children: {
      iterate(callback: (child: any) => unknown) {
        children.forEach((child) => callback(child))
      }
    },
    countActive() {
      return children.filter((child) => child.active).length
    },
    getLength() {
      return children.length
    }
  }
}

test('summarizeProjectilePool reports active count and pool size', () => {
  const group = createGroup([createProjectile(true), createProjectile(false), createProjectile(true)])

  assert.deepEqual(summarizeProjectilePool(group as any), {
    active: 2,
    size: 3
  })
})

test('getLatestActiveProjectile returns the last active sprite in the pool', () => {
  const inactive = createProjectile(false)
  const activeA = createProjectile(true)
  const activeB = createProjectile(true)
  const group = createGroup([inactive, activeA, activeB])

  assert.equal(getLatestActiveProjectile(group as any), activeB)
})

test('spawnDebugProjectileClash repositions both projectiles into a head-on collision', () => {
  const playerBullet = createProjectile(true)
  const enemyBullet = createProjectile(true)
  const playerGroup = createGroup([playerBullet])
  const enemyGroup = createGroup([enemyBullet])
  let playerSpawned = 0
  let enemySpawned = 0

  const result = spawnDebugProjectileClash({
    playerGroup: playerGroup as any,
    enemyGroup: enemyGroup as any,
    clashX: 96,
    clashY: 44,
    speed: 180,
    spawnPlayerProjectile: () => {
      playerSpawned += 1
    },
    spawnEnemyProjectile: () => {
      enemySpawned += 1
    }
  })

  assert.equal(playerSpawned, 1)
  assert.equal(enemySpawned, 1)
  assert.equal(playerBullet.x, 74)
  assert.equal(playerBullet.y, 44)
  assert.equal(playerBullet.body.velocityX, 180)
  assert.equal(enemyBullet.x, 118)
  assert.equal(enemyBullet.y, 44)
  assert.equal(enemyBullet.body.velocityX, -180)
  assert.deepEqual(result, {
    playerBullets: 1,
    enemyBullets: 1
  })
})
