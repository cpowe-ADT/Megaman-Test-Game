import Phaser from 'phaser'
import AudioService from '../../audio'
import { BOSS_ROSTER } from '../../bosses/roster'
import type { BossId } from '../../bosses/types'
import type { EnemySpawner } from '../../enemy'
import type { NewPlayerRuntime } from '../../player/NewPlayerRuntime'
import type { PlayerDamageRequest, PlayerDamageResult } from '../../player/types'
import type { ProjectileCollisionRouter, ProjectileSystem } from '../../projectiles'
import type { CombatDebugBus } from '../../tools/debug/CombatDebugBus'
import type { HUD } from '../../ui/HUD'
import type { BossBodies } from './BossBodies'
import type { BossHazards } from './BossHazards'
import { combatSourceForDamage, type CombatHitSource, type CombatHitTarget } from './combatRules'

export type { CombatHitSource, CombatHitTarget } from './combatRules'

/** Contact without a live hitbox (no controller): the roster's idle `contactDamage`. */
function rosterContactDamage(bossId: string | undefined): number {
  return BOSS_ROSTER[(bossId ?? '') as BossId]?.baseStats.contactDamage ?? 2
}

/** The members of the Game scene the hit wires, contact handlers and player damage read and write. */
export interface HitWiresHost {
  readonly physics: Phaser.Physics.Arcade.ArcadePhysics
  readonly time: Phaser.Time.Clock
  player?: Phaser.Physics.Arcade.Sprite
  playerBullets?: Phaser.Physics.Arcade.Group
  bossBullets?: Phaser.Physics.Arcade.Group
  bossTarget?: Phaser.Physics.Arcade.Sprite
  projectileSystem?: Pick<ProjectileSystem, 'recycle'>
  projectileCollisionRouter: Pick<
    ProjectileCollisionRouter,
    'handlePlayerBulletHitsBoss' | 'handleEnemyBulletHitsPlayer' | 'handleProjectileClash'
  >
  readonly combatDebugBus: Pick<CombatDebugBus, 'record'>
  enemySpawner?: Pick<EnemySpawner, 'getEntityBySprite'>
  newPlayerRuntime?: Pick<NewPlayerRuntime, 'receiveDamage'>
  hud?: Pick<HUD, 'updatePlayerHp'>
  bossEncounterActive: boolean
  activeBossId?: string
  playerHp: number
  playerMaxHp: number
  playerLives: number
  bossHitWire?: Phaser.Physics.Arcade.Collider
  playerHitWire?: Phaser.Physics.Arcade.Collider
  bossContactWire?: Phaser.Physics.Arcade.Collider
  projectileClashWire?: Phaser.Physics.Arcade.Collider
  /** The boss's hurtbox and contact hitbox, and the hazard bodies (prompt 07 phases 7.0 and 7.1). */
  bossBeats?: { bodies: Pick<BossBodies, 'ensure' | 'boxes'>; hazards: Pick<BossHazards, 'group' | 'solids'> }
  killPlayer(reason: 'pit' | 'debug' | 'damage'): void
}

type Overlapping = Phaser.Types.Physics.Arcade.GameObjectWithBody | Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody | Phaser.Tilemaps.Tile
const asObject = (value: Overlapping): Phaser.GameObjects.GameObject => value as Phaser.GameObjects.GameObject

/**
 * Hit wires (boss, player, contact and clash overlaps), contact handlers, bullet recycling and player
 * damage, moved out of `Game` in prompt 07 phase 7.0 (EVAL-P7-008). `Game` keeps one-line delegations
 * with the same names (`recycleBullet`, `recordCombatHit`, `requestPlayerDamage`) for debug hooks and smoke.
 */
export class HitWires {
  private bossHazardWire?: Phaser.Physics.Arcade.Collider
  private bossHazardSolidWire?: Phaser.Physics.Arcade.Collider

  constructor(private readonly host: HitWiresHost) {}

  install(): void {
    const host = this.host
    if (!host.physics) {
      return
    }
    host.bossHitWire?.destroy()
    host.playerHitWire?.destroy()
    host.bossContactWire?.destroy()
    host.projectileClashWire?.destroy()
    host.bossHitWire = undefined
    host.playerHitWire = undefined
    host.bossContactWire = undefined
    host.projectileClashWire = undefined
    this.bossHazardWire?.destroy()
    this.bossHazardSolidWire?.destroy()
    this.bossHazardWire = undefined
    this.bossHazardSolidWire = undefined

    const target = host.bossTarget
    if (target) {
      const body = target.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = true
        body.allowGravity = body.allowGravity ?? false
      }
      target.setDataEnabled?.()
      if (target.data?.get('maxHp') == null) target.data?.set('maxHp', 20)
      if (target.data?.get('hp') == null) target.data?.set('hp', target.data?.get('maxHp') ?? 20)
      // Shots and the saber meet the hurtbox, the hero meets the contact hitbox; the floor body (target) meets
      // neither (prompt 07 phase 7.0, EVAL-P7-010). Without a controller the one body still does all three.
      const boxes = host.bossBeats?.bodies.ensure() ?? null
      const hurtbox = (boxes?.hurtbox ?? target) as Phaser.Physics.Arcade.Sprite
      const hitbox = boxes?.hitbox ?? target
      if (host.playerBullets) {
        host.bossHitWire = host.physics.add.overlap(host.playerBullets, hurtbox, (a, b) =>
          host.projectileCollisionRouter.handlePlayerBulletHitsBoss(asObject(a), asObject(b), hurtbox)
        )
      }
      if (host.player) {
        host.bossContactWire = host.physics.add.overlap(host.player, hitbox, (playerObj, bossObj) =>
          this.onBossContact(asObject(playerObj), asObject(bossObj))
        )
      }
    }
    const hazards = host.bossBeats?.hazards
    if (host.player && hazards?.group) {
      this.bossHazardWire = host.physics.add.overlap(host.player, hazards.group, (playerObj, hazardObj) =>
        this.onHazardContact(asObject(playerObj), asObject(hazardObj))
      )
    }
    if (host.player && hazards?.solids) {
      this.bossHazardSolidWire = host.physics.add.collider(host.player, hazards.solids)
    }
    if (host.player && host.bossBullets) {
      host.playerHitWire = host.physics.add.overlap(host.player, host.bossBullets, (playerObj, bulletObj) =>
        host.projectileCollisionRouter.handleEnemyBulletHitsPlayer(asObject(playerObj), asObject(bulletObj))
      )
    }
    if (host.playerBullets && host.bossBullets) {
      host.projectileClashWire = host.physics.add.overlap(host.playerBullets, host.bossBullets, (playerShot, enemyShot) =>
        host.projectileCollisionRouter.handleProjectileClash(asObject(playerShot), asObject(enemyShot))
      )
    }
  }

  recordCombatHit(
    source: CombatHitSource,
    target: CombatHitTarget,
    amount: number,
    kind: string,
    accepted: boolean,
    note?: string
  ): void {
    this.host.combatDebugBus.record({ timeMs: this.host.time?.now ?? 0, source, target, amount, kind, accepted, note })
  }

  recycleBullet(a: unknown, b: unknown): void {
    const bullet = asDynSprite(a) || asDynSprite(b)
    if (!bullet) {
      return
    }
    if (this.host.projectileSystem?.recycle(bullet)) {
      return
    }
    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.onWorldBounds = false
    }
    const tagged = bullet as Phaser.Physics.Arcade.Sprite & { __trailEmitter?: { stop?: () => void; destroy?: () => void } | null }
    const emitter = tagged.__trailEmitter
    if (emitter && typeof emitter.stop === 'function') {
      emitter.stop()
      emitter.destroy?.()
      tagged.__trailEmitter = null
    }
    const owner = (bullet.data?.get?.('owner') as string | undefined) ?? 'player'
    const group = owner === 'enemy' ? this.host.bossBullets : this.host.playerBullets
    if (typeof bullet.disableBody === 'function') {
      bullet.disableBody(true, true)
    } else {
      group?.killAndHide(bullet)
      if (body) {
        body.enable = false
      }
    }
    if (typeof bullet.setVelocity === 'function') {
      bullet.setVelocity(0, 0)
    } else {
      body?.setVelocity?.(0, 0)
    }
  }

  onHazardContact(playerObj: Phaser.GameObjects.GameObject, hazardObj: Phaser.GameObjects.GameObject): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite
    const hazard = hazardObj as Phaser.Physics.Arcade.Sprite
    if (!player.active) {
      return
    }
    const rawSourceType = String(hazard.data?.get?.('damageSourceType') ?? 'hazard')
    const amount = Number(hazard.data?.get?.('damageAmount') ?? 1)
    this.requestPlayerDamage({
      amount,
      tier: amount >= 2 ? 'heavy' : 'light',
      sourceType: rawSourceType === 'boss_projectile' ? 'boss_projectile' : 'hazard',
      sourceId: String(hazard.data?.get?.('damageSourceId') ?? 'stage_hazard'),
      direction: player.x >= hazard.x ? 1 : -1
    })
  }

  onEnemyContact(playerObj: Phaser.GameObjects.GameObject, enemyObj: Phaser.GameObjects.GameObject): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
    if (!player.active || !enemy.active) {
      return
    }
    const entity = this.host.enemySpawner?.getEntityBySprite(enemy)
    const damage = Number(entity?.definition.stats.contactDamage ?? entity?.definition.stats.damage ?? 1)
    this.requestPlayerDamage({
      amount: damage,
      tier: damage >= 2 ? 'heavy' : 'light',
      sourceType: 'enemy_contact',
      sourceId: String(entity?.id ?? enemy.data?.get?.('enemyFrameworkId') ?? 'enemy_contact'),
      direction: player.x >= enemy.x ? 1 : -1
    })
  }

  onBossContact(playerObj: Phaser.GameObjects.GameObject, bossObj: Phaser.GameObjects.GameObject): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite
    const boss = bossObj as Phaser.Physics.Arcade.Sprite
    if (!player.active || !boss.active || !this.host.bossEncounterActive) {
      return
    }
    // Idle: the roster's contactDamage; an active attack's hitbox: that attack's damage.
    const boxes = this.host.bossBeats?.bodies.boxes ?? null
    const amount = boxes?.damage ?? rosterContactDamage(this.host.activeBossId)
    if (amount <= 0) {
      return
    }
    const bossId = String(this.host.activeBossId ?? 'boss_contact')
    this.requestPlayerDamage({
      amount,
      tier: amount >= 2 ? 'heavy' : 'light',
      sourceType: 'boss_contact',
      sourceId: boxes?.attack ? `${bossId}:${boxes.attack}` : bossId,
      direction: player.x >= boss.x ? 1 : -1
    })
  }

  requestPlayerDamage(request: PlayerDamageRequest): PlayerDamageResult {
    const host = this.host
    const debugSource = combatSourceForDamage(request.sourceType)
    const player = host.player
    if (!player || !player.active || host.playerLives < 0 || !host.newPlayerRuntime) {
      this.recordCombatHit(debugSource, 'player', request.amount, request.sourceType, false, `${request.sourceId}:inactive`)
      return { accepted: false, reason: 'inactive', amount: 0, request }
    }
    const result = host.newPlayerRuntime.receiveDamage(request)
    this.recordCombatHit(debugSource, 'player', result.amount, request.sourceType, result.accepted, `${request.sourceId}:${result.reason}`)
    if (result.accepted) {
      AudioService.playSfx('player_hit')
      if (player.active) {
        player.setTint(0xff6b6b)
        host.time.delayedCall(140, () => {
          if (host.player?.active) {
            host.player.clearTint()
          }
        })
      }
    }
    return result
  }

  commitPlayerDamage(dmg: number): void {
    const host = this.host
    const player = host.player
    if (!player || !player.active || host.playerLives < 0) {
      return
    }
    host.playerHp = Math.max(0, host.playerHp - dmg)
    player.setDataEnabled()
    player.data.set('hp', host.playerHp)
    player.data.set('maxHp', host.playerMaxHp)
    host.hud?.updatePlayerHp(host.playerHp, host.playerMaxHp)
    if (host.playerHp <= 0) {
      host.killPlayer('damage')
    }
  }
}

function asDynSprite(obj: unknown): Phaser.Physics.Arcade.Sprite | null {
  const candidate = obj as { body?: unknown; setVelocity?: unknown } | null | undefined
  if (!candidate || !candidate.body) {
    return null
  }
  const isDynamic = candidate.body instanceof Phaser.Physics.Arcade.Body
  return isDynamic && typeof candidate.setVelocity === 'function' ? (candidate as Phaser.Physics.Arcade.Sprite) : null
}
