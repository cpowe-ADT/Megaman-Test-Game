import Phaser from 'phaser'
import { resolveProjectileClashResult } from './projectileClash'
import {
  consumeProjectileHit,
  shouldSkipProjectileHit,
  type ProjectileTrackingSprite,
  type ProjectileTrackingTarget
} from './projectileHitTracking'

type CombatSource = 'player' | 'enemy' | 'boss' | 'hazard' | 'system'
type CombatTarget = 'player' | 'enemy' | 'boss' | 'environment'

type BulletDamageMeta = {
  weaponId?: string
  weaponElement?: string
  kind: 'bullet'
}

type EnemyHitResult = {
  accepted: boolean
  defeated: boolean
  recycleBullet: boolean
}

type ProjectileCollisionRouterOptions = {
  playerBullets: Phaser.Physics.Arcade.Group
  enemyBullets: Phaser.Physics.Arcade.Group
  getPlayer: () => Phaser.Physics.Arcade.Sprite | undefined
  getNow: () => number
  getFacing: () => 1 | -1
  damageBoss: (damage: number, meta: BulletDamageMeta) => void
  damagePlayer: (damage: number) => boolean
  damageEnemy: (enemy: Phaser.Physics.Arcade.Sprite, damage: number) => EnemyHitResult
  recycleBullet: (a: any, b: any) => void
  recordCombatHit: (
    source: CombatSource,
    target: CombatTarget,
    amount: number,
    kind: string,
    accepted: boolean,
    note?: string
  ) => void
  devLogOverlap?: (
    tag: string,
    bullet: Phaser.Physics.Arcade.Sprite,
    target: Phaser.GameObjects.GameObject,
    accepted: boolean,
    reason: string
  ) => void
  playEnemyHitSfx?: () => void
  spawnProjectileClashFx?: (x: number, y: number, strong: boolean) => void
}

function asDynSprite(obj: unknown): Phaser.Physics.Arcade.Sprite | null {
  if (!obj || typeof obj !== 'object') {
    return null
  }

  const candidate = obj as Record<string, unknown>
  const hasBody = 'body' in candidate
  const hasMotionMethod =
    typeof candidate.setVelocity === 'function' ||
    typeof candidate.setPosition === 'function' ||
    typeof candidate.setTexture === 'function'

  return hasBody && hasMotionMethod ? (obj as Phaser.Physics.Arcade.Sprite) : null
}

function resolveBulletFromOverlap(
  objA: Phaser.GameObjects.GameObject,
  objB: Phaser.GameObjects.GameObject,
  group: Phaser.Physics.Arcade.Group
): Phaser.Physics.Arcade.Sprite | null {
  const fromA = asDynSprite(objA)
  if (fromA && group.contains(fromA)) {
    return fromA
  }
  const fromB = asDynSprite(objB)
  if (fromB && group.contains(fromB)) {
    return fromB
  }
  return null
}

export class ProjectileCollisionRouter {
  constructor(private readonly options: ProjectileCollisionRouterOptions) {}

  handlePlayerBulletHitsBoss(
    objA: Phaser.GameObjects.GameObject,
    objB: Phaser.GameObjects.GameObject,
    target: Phaser.Physics.Arcade.Sprite
  ): void {
    const bullet =
      resolveBulletFromOverlap(objA, objB, this.options.playerBullets) ||
      asDynSprite(objA) ||
      asDynSprite(objB)
    if (!bullet) {
      return
    }

    const owner = bullet.data?.get?.('owner')
    if (owner !== 'player') {
      if (this.options.playerBullets.contains(bullet)) {
        bullet.setDataEnabled?.()
        bullet.data?.set?.('owner', 'player')
      } else {
        this.options.devLogOverlap?.('PB->B', bullet, target, false, `owner=${owner}`)
        this.options.recordCombatHit('player', 'boss', 0, 'bullet', false, `owner=${owner}`)
        return
      }
    }

    if (!target.body?.enable || !target.active) {
      this.options.devLogOverlap?.('PB->B', bullet, target, false, 'target inactive/body disabled')
      this.options.recordCombatHit('player', 'boss', 0, 'bullet', false, 'target inactive')
      return
    }

    const damage = (bullet.data?.get?.('damage') as number | undefined) ?? 1
    this.options.damageBoss(damage, {
      weaponId: bullet.data?.get?.('weaponId') as string | undefined,
      weaponElement: bullet.data?.get?.('weaponElement') as string | undefined,
      kind: 'bullet'
    })
    this.options.devLogOverlap?.('PB->B', bullet, target, true, 'owner is player')
    this.options.recycleBullet(bullet, target)
  }

  handleEnemyBulletHitsPlayer(
    playerObj: Phaser.GameObjects.GameObject,
    bulletObj: Phaser.GameObjects.GameObject
  ): void {
    const bullet =
      resolveBulletFromOverlap(playerObj, bulletObj, this.options.enemyBullets) ||
      asDynSprite(bulletObj) ||
      asDynSprite(playerObj)
    const player = this.options.getPlayer()
    if (!bullet || !player) {
      return
    }

    const owner = bullet.data?.get?.('owner')
    if (owner !== 'enemy') {
      if (this.options.enemyBullets.contains(bullet)) {
        bullet.setDataEnabled?.()
        bullet.data?.set?.('owner', 'enemy')
      } else {
        this.options.devLogOverlap?.('EB->P', bullet, player, false, `owner=${owner}`)
        this.options.recordCombatHit('enemy', 'player', 0, 'bullet', false, `owner=${owner}`)
        return
      }
    }

    if (!player.body?.enable || !player.active) {
      this.options.devLogOverlap?.('EB->P', bullet, player, false, 'player inactive/body disabled')
      this.options.recordCombatHit('enemy', 'player', 0, 'bullet', false, 'player inactive')
      return
    }

    const damage = (bullet.data?.get?.('damage') as number | undefined) ?? 1
    const accepted = this.options.damagePlayer(damage)
    this.options.recordCombatHit('enemy', 'player', damage, 'bullet', accepted, 'new-player-runtime')
    this.options.devLogOverlap?.('EB->P', bullet, player, true, 'owner is enemy')
    this.options.recycleBullet(bullet, player)
  }

  handleProjectileClash(
    playerBulletObj: Phaser.GameObjects.GameObject,
    enemyBulletObj: Phaser.GameObjects.GameObject
  ): void {
    const playerBullet =
      resolveBulletFromOverlap(playerBulletObj, enemyBulletObj, this.options.playerBullets) ||
      asDynSprite(playerBulletObj) ||
      asDynSprite(enemyBulletObj)
    const enemyBullet =
      resolveBulletFromOverlap(playerBulletObj, enemyBulletObj, this.options.enemyBullets) ||
      asDynSprite(enemyBulletObj) ||
      asDynSprite(playerBulletObj)
    if (!playerBullet || !enemyBullet || playerBullet === enemyBullet) {
      return
    }

    if (playerBullet.data?.get?.('owner') !== 'player' || enemyBullet.data?.get?.('owner') !== 'enemy') {
      return
    }

    if (!playerBullet.active || !enemyBullet.active) {
      return
    }

    const playerSurvives = this.resolveProjectileClash(playerBullet, enemyBullet)
    this.options.spawnProjectileClashFx?.(
      (playerBullet.x + enemyBullet.x) * 0.5,
      (playerBullet.y + enemyBullet.y) * 0.5,
      playerSurvives
    )
    this.options.recordCombatHit(
      'player',
      'environment',
      Number(playerBullet.data?.get?.('damage') ?? 1),
      'bullet',
      true,
      playerSurvives ? 'projectile-clash-survive' : 'projectile-clash'
    )
    this.options.playEnemyHitSfx?.()
    this.options.recycleBullet(enemyBullet, playerBullet)
    if (!playerSurvives) {
      this.options.recycleBullet(playerBullet, enemyBullet)
    }
  }

  handlePlayerBulletHitsEnemy(
    bulletObj: Phaser.GameObjects.GameObject,
    enemyObj: Phaser.GameObjects.GameObject
  ): void {
    const bullet =
      resolveBulletFromOverlap(bulletObj, enemyObj, this.options.playerBullets) ||
      asDynSprite(bulletObj) ||
      asDynSprite(enemyObj)
    const enemy =
      (bullet === bulletObj ? asDynSprite(enemyObj) : asDynSprite(bulletObj)) ||
      asDynSprite(enemyObj) ||
      asDynSprite(bulletObj)
    if (!bullet?.data || !enemy || bullet.data.get('owner') !== 'player') {
      return
    }

    const damage = (bullet.data.get('damage') as number | undefined) ?? 1
    if (
      shouldSkipProjectileHit(
        bullet as unknown as ProjectileTrackingSprite,
        enemy as unknown as ProjectileTrackingTarget,
        this.options.getNow()
      )
    ) {
      return
    }

    const result = this.options.damageEnemy(enemy, damage)
    this.options.recordCombatHit(
      'player',
      'enemy',
      damage,
      'bullet',
      result.accepted,
      result.defeated ? 'defeat' : result.accepted ? 'hit' : 'rejected'
    )

    if (
      result.recycleBullet &&
      !consumeProjectileHit(
        bullet as unknown as ProjectileTrackingSprite,
        enemy as unknown as ProjectileTrackingTarget,
        this.options.getNow(),
        this.options.getFacing()
      )
    ) {
      this.options.recycleBullet(bullet, enemy)
    }
  }

  private resolveProjectileClash(
    playerBullet: Phaser.Physics.Arcade.Sprite,
    enemyBullet: Phaser.Physics.Arcade.Sprite
  ): boolean {
    const pierceRemaining = Number(playerBullet.data?.get?.('pierceRemaining') ?? 0)
    const result = resolveProjectileClashResult({
      playerDamage: Number(playerBullet.data?.get?.('damage') ?? 1),
      enemyDamage: Number(enemyBullet.data?.get?.('damage') ?? 1),
      chargeLevel: Number(playerBullet.data?.get?.('chargeLevel') ?? 0),
      pierceRemaining
    })
    if (!result.playerSurvives) {
      return false
    }

    if (pierceRemaining > 0) {
      playerBullet.data?.set?.('pierceRemaining', result.nextPierceRemaining)
    }

    const body = playerBullet.body as Phaser.Physics.Arcade.Body | undefined
    const velocityX = body?.velocity.x ?? 0
    const velocityY = body?.velocity.y ?? 0
    const nextX = playerBullet.x + Math.sign(body?.velocity.x || 1) * 12
    const nextY = playerBullet.y
    playerBullet.setPosition(nextX, nextY)
    body?.reset?.(nextX, nextY)
    if (body) {
      body.setVelocity(velocityX, velocityY)
    }
    return true
  }
}
