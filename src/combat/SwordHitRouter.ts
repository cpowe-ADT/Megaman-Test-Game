import Phaser from 'phaser'
import AudioService from '../audio'
import type { ContactHitKind } from '../player/hitFeel'
import { resolveSwordHitboxOrigin, swordHitboxIntersectsTarget } from '../player/swordCollision'
import type { ResolvedHitbox } from '../player/types'
import type { ProjectileSystem } from '../projectiles'
import { PLAYER_REFLECTED_SHOT_ID } from '../projectiles/definitions/coreProjectiles'
import { HERO_HIT_FX } from './heroCombatVisuals'
import { playStripOnce } from './heroFxPlayer'
import { resolveSwordReflect } from './reflect'

/** A reflect freezes the frame this long (60Hz frames). */
export const REFLECT_HITSTOP_FRAMES = 3

type BossTarget = Phaser.GameObjects.GameObject & {
  x: number
  y: number
  active: boolean
  displayWidth?: number
  displayHeight?: number
  body?: { center?: { x: number; y: number }; width?: number; height?: number } | null
}

export type SwordHitHost = {
  scene: Phaser.Scene
  player: () => Phaser.Physics.Arcade.Sprite | undefined
  facing: () => 1 | -1
  enemies: () => Phaser.Physics.Arcade.Group | undefined
  enemyShots: () => Phaser.Physics.Arcade.Group | undefined
  /** The live boss hurt target, or null when there is none or the fight is won. */
  boss: () => BossTarget | null
  bossHp: () => number | null
  projectiles: () => ProjectileSystem | undefined
  /** Applies sword damage to an enemy (framework first, then plain hp). */
  damageEnemy: (enemy: Phaser.Physics.Arcade.Sprite, amount: number, knockback: Phaser.Math.Vector2) => void
  damageBoss: (amount: number) => void
  flashEnemy: (enemy: Phaser.Physics.Arcade.Sprite) => void
  /** Once per swing (the saber recharges the selected weapon). */
  onSwing: () => void
  onContactHit: (kind: ContactHitKind, hitstopFrames?: number) => void
}

export type SwordHitRecord = {
  swingId: number
  move: string
  target: 'enemy' | 'boss'
  damage: number
  knockbackX: number
  bossHpBefore?: number | null
  bossHpAfter?: number | null
}

export type ReflectRecord = { swingId: number; from: string; damage: number; vx: number; vy: number; shotSpawned: boolean }

const LOG_LIMIT = 24

/**
 * The sword-hit path, out of Game.ts: every active frame NewPlayerRuntime hands over the swing's box and
 * a claim function (one hit per target per combo hit). Damage, knockback and hit-stop come from the box
 * (config.ts sword.combo). Enemy shots inside the box are reflected (reflect.ts): the shot becomes a
 * player `player_reflected_shot` that damages enemies and the boss through the normal player-shot path.
 */
export class SwordHitRouter {
  private lastSwingId = -1
  /** The swing that last took boss HP: the boss is hit once per combo hit, but a frame met by its i-frames can land later in the same active window. */
  private bossLandedSwingId = -1
  private readonly hits: SwordHitRecord[] = []
  private readonly reflects: ReflectRecord[] = []

  constructor(private readonly host: SwordHitHost) {}

  apply(hitbox: ResolvedHitbox, claim: (target: unknown) => boolean): void {
    const player = this.host.player()
    if (!player) {
      return
    }
    const swingId = hitbox.swingId ?? -1
    if (swingId !== this.lastSwingId) {
      this.lastSwingId = swingId
      this.host.onSwing()
    }
    const facing = this.host.facing()
    const origin = resolveSwordHitboxOrigin(player.x, player.y, facing, hitbox)
    const damage = hitbox.damage ?? 2
    const knockback = hitbox.knockback ?? { x: facing * 100, y: -60 }
    let landed = false

    this.host.enemies()?.children.iterate((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite | null
      if (!enemy?.active) return true
      const inside = swordHitboxIntersectsTarget(origin, hitbox, { x: enemy.x, y: enemy.y, width: enemy.displayWidth, height: enemy.displayHeight })
      if (!inside || !claim(enemy)) return true
      this.host.damageEnemy(enemy, damage, new Phaser.Math.Vector2(knockback.x, knockback.y))
      if (enemy.active) this.host.flashEnemy(enemy)
      this.spark('fx_hit_spark', enemy.x, enemy.y)
      this.record({ swingId, move: hitbox.move ?? 'combo1', target: 'enemy', damage, knockbackX: knockback.x })
      landed = true
      return true
    })

    const boss = this.host.boss()
    if (boss?.active) {
      const inside = swordHitboxIntersectsTarget(origin, hitbox, {
        // The boss is a container; its display size is not its hurt box. Use the aligned body.
        x: boss.body?.center?.x ?? boss.x,
        y: boss.body?.center?.y ?? boss.y,
        width: boss.body?.width ?? boss.displayWidth ?? 32,
        height: boss.body?.height ?? boss.displayHeight ?? 32
      })
      if (inside && this.bossLandedSwingId !== swingId) {
        const before = this.host.bossHp()
        this.host.damageBoss(damage)
        const after = this.host.bossHp()
        const took = before == null || after == null || after < before || !boss.active
        if (took) {
          this.bossLandedSwingId = swingId
          this.host.scene.tweens?.add({ targets: boss, alpha: 0.25, yoyo: true, duration: 70 })
          this.spark('fx_hit_spark', boss.x + facing * 10, boss.y - 6, 1.4)
          this.record({ swingId, move: hitbox.move ?? 'combo1', target: 'boss', damage, knockbackX: knockback.x, bossHpBefore: before, bossHpAfter: after })
          landed = true
        }
      }
    }

    if (landed) {
      AudioService.playSfx('sword_hit')
      this.host.scene.events.emit('camera.shake', { intensity: damage >= 4 ? 0.009 : 0.005, duration: damage >= 4 ? 100 : 75 })
      this.host.onContactHit(hitbox.grounded ? 'sword_ground' : 'sword_air', hitbox.hitstopFrames)
    }

    this.reflectShots(hitbox, player, facing, swingId, claim)
  }

  getDebugState(): { lastSwingId: number; hits: SwordHitRecord[]; reflects: ReflectRecord[] } {
    return { lastSwingId: this.lastSwingId, hits: this.hits.map((hit) => ({ ...hit })), reflects: this.reflects.map((entry) => ({ ...entry })) }
  }

  private reflectShots(hitbox: ResolvedHitbox, player: Phaser.Physics.Arcade.Sprite, facing: 1 | -1, swingId: number, claim: (target: unknown) => boolean): void {
    const projectiles = this.host.projectiles()
    const shots = this.host.enemyShots()
    if (!projectiles || !shots) {
      return
    }
    const sword = { phase: 'active' as const, hitbox, playerX: player.x, playerY: player.y, facing }
    const reflected: Phaser.Physics.Arcade.Sprite[] = []
    shots.children.iterate((child) => {
      const shot = child as Phaser.Physics.Arcade.Sprite | null
      const body = shot?.body as Phaser.Physics.Arcade.Body | undefined
      if (!shot?.active || !body) return true
      const id = String(shot.data?.get?.('projectileId') ?? '')
      const definition = projectiles.getDefinition(id)
      const result = resolveSwordReflect(sword, {
        x: shot.x,
        y: shot.y,
        width: body.width,
        height: body.height,
        vx: body.velocity.x,
        vy: body.velocity.y,
        damage: Number(shot.data?.get?.('damage') ?? definition?.damage ?? 1),
        reflectable: definition?.reflectable === true,
        owner: definition?.owner ?? 'enemy'
      })
      if (!result.reflected || !claim(shot)) return true
      reflected.push(shot)
      const x = shot.x
      const y = shot.y
      projectiles.recycle(shot)
      const spawned = projectiles.spawn({
        id: PLAYER_REFLECTED_SHOT_ID,
        x,
        y,
        direction: result.velocity.x < 0 ? -1 : 1,
        velocity: result.velocity,
        damage: result.damage,
        metadata: { reflectedFrom: id, weaponId: 'Buster', sourceType: 'player_reflect' }
      })
      this.spark('fx_deflect', x, y)
      this.reflects.push({ swingId, from: id, damage: result.damage, vx: Math.round(result.velocity.x), vy: Math.round(result.velocity.y), shotSpawned: Boolean(spawned) })
      if (this.reflects.length > LOG_LIMIT) this.reflects.shift()
      return true
    })
    if (reflected.length > 0) {
      AudioService.playSfx('sword_hit')
      this.host.onContactHit(hitbox.grounded ? 'sword_ground' : 'sword_air', REFLECT_HITSTOP_FRAMES)
    }
  }

  private spark(key: keyof typeof HERO_HIT_FX, x: number, y: number, scale = 1): void {
    playStripOnce(this.host.scene, key, HERO_HIT_FX[key], x, y, { depth: 8, scale, additive: true })
  }

  private record(hit: SwordHitRecord): void {
    this.hits.push(hit)
    if (this.hits.length > LOG_LIMIT) this.hits.shift()
  }
}
