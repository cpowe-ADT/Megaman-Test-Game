import test from 'node:test'
import assert from 'node:assert/strict'
import { ProjectileCollisionRouter } from '../src/projectiles/collision/ProjectileCollisionRouter'

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

function createSprite(seed: Record<string, unknown> = {}) {
  const data = createData(seed)
  const body = {
    enable: true,
    velocity: { x: 0, y: 0 },
    reset(x: number, y: number) {
      sprite.x = x
      sprite.y = y
    },
    setVelocityX(value: number) {
      body.velocity.x = value
    }
  }

  const sprite = {
    x: 20,
    y: 12,
    active: true,
    visible: true,
    body,
    data,
    setDataEnabled() {},
    setPosition(x: number, y: number) {
      sprite.x = x
      sprite.y = y
      return sprite
    },
    setVelocity() {
      return sprite
    },
    setTexture() {
      return sprite
    }
  }

  return sprite
}

function createGroup(member: unknown) {
  return {
    contains(value: unknown) {
      return value === member
    },
    getTotalUsed() {
      return 1
    },
    getLength() {
      return 8
    }
  }
}

test('ProjectileCollisionRouter suppresses repeat hits on the same enemy inside cooldown', () => {
  let now = 100
  let damageCalls = 0
  let recycleCalls = 0
  const bullet = createSprite({
    owner: 'player',
    damage: 2,
    pierceRemaining: 1,
    baseSpeedX: 260
  })
  const enemy = createSprite({ enemyFrameworkId: 'enemy-1' })

  const router = new ProjectileCollisionRouter({
    playerBullets: createGroup(bullet) as any,
    enemyBullets: createGroup({}) as any,
    getPlayer: () => undefined,
    getNow: () => now,
    getFacing: () => 1,
    damageBoss: () => {},
    damagePlayer: () => ({ accepted: true }),
    damageEnemy: () => {
      damageCalls += 1
      return { accepted: true, defeated: false, recycleBullet: true }
    },
    recycleBullet: () => {
      recycleCalls += 1
    },
    recordCombatHit: () => {}
  })

  router.handlePlayerBulletHitsEnemy(bullet as any, enemy as any)
  now = 150
  router.handlePlayerBulletHitsEnemy(bullet as any, enemy as any)

  assert.equal(damageCalls, 1)
  assert.equal(recycleCalls, 0)
  assert.equal(bullet.data.get('pierceRemaining'), 0)
  assert.equal(bullet.x, 34)
})

test('ProjectileCollisionRouter recycles a player bullet after a non-piercing enemy hit', () => {
  let recycleCalls = 0
  const bullet = createSprite({
    owner: 'player',
    damage: 1,
    pierceRemaining: 0
  })
  const enemy = createSprite({ enemyFrameworkId: 'enemy-2' })

  const router = new ProjectileCollisionRouter({
    playerBullets: createGroup(bullet) as any,
    enemyBullets: createGroup({}) as any,
    getPlayer: () => undefined,
    getNow: () => 200,
    getFacing: () => 1,
    damageBoss: () => {},
    damagePlayer: () => ({ accepted: true }),
    damageEnemy: () => ({ accepted: true, defeated: false, recycleBullet: true }),
    recycleBullet: () => {
      recycleCalls += 1
    },
    recordCombatHit: () => {}
  })

  router.handlePlayerBulletHitsEnemy(bullet as any, enemy as any)

  assert.equal(recycleCalls, 1)
})

test('ProjectileCollisionRouter resolves player-bullet enemy hits even if overlap args are reversed', () => {
  let damageCalls = 0
  const bullet = createSprite({
    owner: 'player',
    damage: 3,
    pierceRemaining: 0
  })
  const enemy = createSprite({ enemyFrameworkId: 'enemy-3' })

  const router = new ProjectileCollisionRouter({
    playerBullets: createGroup(bullet) as any,
    enemyBullets: createGroup({}) as any,
    getPlayer: () => undefined,
    getNow: () => 220,
    getFacing: () => 1,
    damageBoss: () => {},
    damagePlayer: () => ({ accepted: true }),
    damageEnemy: () => {
      damageCalls += 1
      return { accepted: true, defeated: false, recycleBullet: false }
    },
    recycleBullet: () => {},
    recordCombatHit: () => {}
  })

  router.handlePlayerBulletHitsEnemy(enemy as any, bullet as any)

  assert.equal(damageCalls, 1)
})

test('ProjectileCollisionRouter forwards immutable projectile identity to boss damage', () => {
  let received: Record<string, unknown> | null = null
  const bullet = createSprite({
    owner: 'player',
    damage: 4,
    weaponId: 'Buster',
    weaponElement: 'Normal',
    projectileId: 'player_buster_charge_lv4',
    chargeLevel: 4
  })
  const boss = createSprite({ hp: 20 })
  const router = new ProjectileCollisionRouter({
    playerBullets: createGroup(bullet) as any,
    enemyBullets: createGroup({}) as any,
    getPlayer: () => undefined,
    getNow: () => 300,
    getFacing: () => 1,
    damageBoss: (_damage, meta) => {
      received = meta
    },
    damagePlayer: () => ({ accepted: true }),
    damageEnemy: () => ({ accepted: true, defeated: false, recycleBullet: true }),
    recycleBullet: () => {},
    recordCombatHit: () => {}
  })

  router.handlePlayerBulletHitsBoss(bullet as any, boss as any, boss as any)

  assert.deepEqual(received, {
    weaponId: 'Buster',
    weaponElement: 'Normal',
    projectileId: 'player_buster_charge_lv4',
    chargeLevel: 4,
    kind: 'bullet'
  })
})

test('ProjectileCollisionRouter forwards hostile source metadata without creating a duplicate player trace', () => {
  let received: Record<string, unknown> | null = null
  let traceCalls = 0
  let recycleCalls = 0
  const player = createSprite({ hp: 8 })
  const bullet = createSprite({
    owner: 'enemy',
    damage: 2,
    projectileId: 'enemy_basic_shot',
    sourceType: 'boss_projectile',
    sourceId: 'ground_slam',
    attack: 'ground_slam'
  })
  bullet.body.velocity.x = -220
  const router = new ProjectileCollisionRouter({
    playerBullets: createGroup({}) as any,
    enemyBullets: createGroup(bullet) as any,
    getPlayer: () => player as any,
    getNow: () => 400,
    getFacing: () => 1,
    damageBoss: () => {},
    damagePlayer: (_damage, meta) => {
      received = meta
      return { accepted: false }
    },
    damageEnemy: () => ({ accepted: true, defeated: false, recycleBullet: true }),
    recycleBullet: () => {
      recycleCalls += 1
    },
    recordCombatHit: () => {
      traceCalls += 1
    }
  })

  router.handleEnemyBulletHitsPlayer(player as any, bullet as any)

  assert.deepEqual(received, {
    sourceType: 'boss_projectile',
    sourceId: 'ground_slam',
    projectileId: 'enemy_basic_shot',
    direction: -1,
    tier: 'heavy',
    element: undefined
  })
  assert.equal(traceCalls, 0)
  assert.equal(recycleCalls, 1)
})
