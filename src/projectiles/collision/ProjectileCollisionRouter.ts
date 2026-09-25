import Phaser from 'phaser'
import { resolveProjectileClashResult } from './projectileClash'
import {
  consumeProjectileHit,
  shouldSkipProjectileHit,
  type ProjectileTrackingSprite,
  type ProjectileTrackingTarget
} from './projectileHitTracking'
import { WEAPON_TUNING } from '../../content/weapons'
import { corrodeTickDelays, resolveChainTargets } from '../weaponEffects'
import { weaponOnHitEffects } from './weaponOnHitEffects'

type CombatSource = 'player' | 'enemy' | 'boss' | 'hazard' | 'system'
type CombatTarget = 'player' | 'enemy' | 'boss' | 'environment'

type BulletDamageMeta = {
  weaponId?: string
  weaponElement?: string
  projectileId?: string
  chargeLevel: 0 | 1 | 2 | 3 | 4
  kind: 'bullet'
}

type EnemyHitResult = {
  accepted: boolean
  defeated: boolean
  recycleBullet: boolean
}

/** Extra fields an on-hit tag adds to an enemy hit (FrostShatter: a 1.5s hitstun and no knockback). */
export type EnemyHitExtras = { hitstunMs?: number; knockback?: undefined }

/** The last on-hit tag the router applied (smoke 12 and the combat debug read it). */
export type OnHitRecord = {
  tag: string
  target: 'enemy' | 'boss'
  weaponId: string | null
  /** What the tag did: `chain:2` (enemies it jumped to), `corrode:3` (ticks scheduled), `freeze:1500`, `burn`, ... */
  applied: string
  atMs: number
}

type EnemyBulletDamageMeta = {
  sourceType: 'enemy_projectile' | 'boss_projectile' | 'system'
  sourceId: string
  projectileId: string
  direction: -1 | 1
  tier: 'light' | 'heavy'
  element?: string
}

type ProjectileCollisionRouterOptions = {
  playerBullets: Phaser.Physics.Arcade.Group
  enemyBullets: Phaser.Physics.Arcade.Group
  getPlayer: () => Phaser.Physics.Arcade.Sprite | undefined
  getNow: () => number
  getFacing: () => 1 | -1
  damageBoss: (damage: number, meta: BulletDamageMeta) => void
  damagePlayer: (damage: number, meta: EnemyBulletDamageMeta) => { accepted: boolean }
  damageEnemy: (enemy: Phaser.Physics.Arcade.Sprite, damage: number, extras?: EnemyHitExtras) => EnemyHitResult
  /** Live enemies, for ThunderSpike's chain (optional: without it a charged spike does not chain). */
  getEnemies?: () => Phaser.Physics.Arcade.Sprite[] | undefined
  /** Runs `fn` after `delayMs` of scene time (AcidGlob's ticks); defaults to the target's scene clock. */
  schedule?: (delayMs: number, fn: () => void) => void
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
  /** The last on-hit tag applied, and how many times each tag has fired this scene. */
  lastOnHit: OnHitRecord | null = null
  readonly onHitCounts: Record<string, number> = {}

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
      projectileId: bullet.data?.get?.('projectileId') as string | undefined,
      chargeLevel: Math.max(0, Math.min(4, Number(bullet.data?.get?.('chargeLevel') ?? 0))) as 0 | 1 | 2 | 3 | 4,
      kind: 'bullet'
    })
    this.options.devLogOverlap?.('PB->B', bullet, target, true, 'owner is player')
    // Bosses take the weakness table, not status tags; a flame still leaves its puddle where it hit.
    const tag = String(bullet.data?.get?.('onHitTag') ?? 'none')
    if (tag !== 'none') this.record(tag, 'boss', bullet, tag === 'burn' ? 'burn' : 'none')
    bullet.data?.set?.('hitTarget', 'boss')
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
    const rawSourceType = String(bullet.data?.get?.('sourceType') ?? 'enemy_projectile')
    const sourceType: EnemyBulletDamageMeta['sourceType'] =
      rawSourceType === 'boss_projectile' || rawSourceType === 'system'
        ? rawSourceType
        : 'enemy_projectile'
    const velocityX = Number((bullet.body as Phaser.Physics.Arcade.Body | undefined)?.velocity.x ?? 0)
    this.options.damagePlayer(damage, {
      sourceType,
      sourceId: String(
        bullet.data?.get?.('sourceId') ??
        bullet.data?.get?.('attack') ??
        bullet.data?.get?.('enemyProjectileKey') ??
        bullet.data?.get?.('projectileId') ??
        'unknown_projectile'
      ),
      projectileId: String(bullet.data?.get?.('projectileId') ?? 'unknown_projectile'),
      direction: velocityX < 0 ? -1 : 1,
      tier: damage >= 2 ? 'heavy' : 'light',
      element: bullet.data?.get?.('element') as string | undefined
    })
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

    const tag = String(bullet.data.get('onHitTag') ?? 'none')
    const result =
      tag === 'freeze'
        ? this.options.damageEnemy(enemy, damage, { hitstunMs: WEAPON_TUNING.freeze.durationMs, knockback: undefined })
        : this.options.damageEnemy(enemy, damage)
    this.options.recordCombatHit(
      'player',
      'enemy',
      damage,
      'bullet',
      result.accepted,
      result.defeated ? 'defeat' : result.accepted ? 'hit' : 'rejected'
    )

    if (result.accepted && tag !== 'none') this.applyEnemyOnHit(tag, bullet, enemy, damage, result.defeated)

    if (
      result.recycleBullet &&
      !consumeProjectileHit(
        bullet as unknown as ProjectileTrackingSprite,
        enemy as unknown as ProjectileTrackingTarget,
        this.options.getNow(),
        this.options.getFacing()
      )
    ) {
      bullet.data.set('hitTarget', 'enemy')
      const enemyBody = enemy.body as Phaser.Physics.Arcade.Body | undefined
      if (enemyBody && typeof enemyBody.bottom === 'number') bullet.data.set('hitFloorY', enemyBody.bottom)
      this.options.recycleBullet(bullet, enemy)
    }
  }

  /**
   * On-hit tags on an enemy (prompt 07 phase 7.3): `chain` jumps to the nearest enemies (one per charge level),
   * `corrode` sticks and ticks, `freeze` cased the enemy in ice (its hitstun was set on the hit itself). `burn`,
   * `quake` and `bounce` act where the shot ends (ProjectileSystem); `pierce` and `magnet` act in flight.
   */
  private applyEnemyOnHit(tag: string, bullet: Phaser.Physics.Arcade.Sprite, enemy: Phaser.Physics.Arcade.Sprite, damage: number, defeated: boolean): void {
    if (tag === 'chain') {
      const jumps = Number(bullet.data?.get?.('chainJumps') ?? 0)
      const candidates = (this.options.getEnemies?.() ?? []).filter((other) => other !== enemy && other.active && (other.body as Phaser.Physics.Arcade.Body | undefined)?.enable !== false)
      const targets = jumps > 0 ? resolveChainTargets(enemy, candidates, jumps) : []
      let from: Phaser.Physics.Arcade.Sprite = enemy
      for (const next of targets) {
        const hit = this.options.damageEnemy(next, damage)
        this.options.recordCombatHit('player', 'enemy', damage, 'chain', hit.accepted, hit.defeated ? 'defeat' : 'chain')
        weaponOnHitEffects.chainArc(from, next, WEAPON_TUNING.chain.arcMs)
        from = next
      }
      this.record(tag, 'enemy', bullet, `chain:${targets.length}`)
      return
    }
    if (tag === 'corrode' && !defeated) {
      const delays = corrodeTickDelays()
      const schedule = this.options.schedule ?? ((delayMs: number, fn: () => void) => (enemy.scene as Phaser.Scene | undefined)?.time?.delayedCall(delayMs, fn))
      for (const delay of delays) {
        schedule(delay, () => {
          if (!enemy.active) return
          const tick = this.options.damageEnemy(enemy, WEAPON_TUNING.corrode.damage)
          this.options.recordCombatHit('player', 'enemy', WEAPON_TUNING.corrode.damage, 'corrode', tick.accepted, tick.defeated ? 'defeat' : 'corrode-tick')
        })
      }
      weaponOnHitEffects.stickGlob(enemy, delays[delays.length - 1] ?? 0)
      this.record(tag, 'enemy', bullet, `corrode:${delays.length}`)
      return
    }
    if (tag === 'freeze' && !defeated) {
      weaponOnHitEffects.freeze(enemy, this.options.getPlayer(), WEAPON_TUNING.freeze.durationMs)
      this.record(tag, 'enemy', bullet, `freeze:${WEAPON_TUNING.freeze.durationMs}`)
      return
    }
    this.record(tag, 'enemy', bullet, defeated && (tag === 'corrode' || tag === 'freeze') ? 'defeated' : tag)
  }

  private record(tag: string, target: OnHitRecord['target'], bullet: Phaser.Physics.Arcade.Sprite, applied: string): void {
    this.onHitCounts[tag] = (this.onHitCounts[tag] ?? 0) + 1
    this.lastOnHit = { tag, target, weaponId: (bullet.data?.get?.('weaponId') as string | undefined) ?? null, applied, atMs: this.options.getNow() }
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
