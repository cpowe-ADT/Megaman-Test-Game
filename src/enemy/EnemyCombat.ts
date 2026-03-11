import Phaser from 'phaser'
import { EnemyAttackConfig, EnemyDefinition, EnemyRuntimeContext, DamageEvent } from './types'
import { EnemyProjectileCatalog, spawnEnemyProjectile } from './EnemyProjectiles'
import { EnemyMotor } from './EnemyMotor'

export type EnemyAttackPhase = 'none' | 'windup' | 'active' | 'recover'

export class EnemyCombat {
  private readonly sprite: Phaser.Physics.Arcade.Sprite
  private readonly definition: EnemyDefinition
  private readonly context: EnemyRuntimeContext
  private readonly motor: EnemyMotor
  private hp: number
  private maxHp: number
  private invulnerableUntil = 0
  private stunnedUntil = 0
  private attackStartedAt = -1
  private attackWindowEndsAt = -1
  private attackHitApplied = false
  private projectileBurstsFired = 0
  private readonly touchedPlayers = new Set<string>()
  private readonly enableProjectiles: boolean

  constructor(
    sprite: Phaser.Physics.Arcade.Sprite,
    definition: EnemyDefinition,
    context: EnemyRuntimeContext,
    motor: EnemyMotor,
    enableProjectiles: boolean
  ) {
    this.sprite = sprite
    this.definition = definition
    this.context = context
    this.motor = motor
    this.enableProjectiles = enableProjectiles
    this.hp = definition.stats.hp
    this.maxHp = definition.stats.hp
    this.sprite.setDataEnabled()
    this.sprite.data?.set('hp', this.hp)
    this.sprite.data?.set('maxHp', this.maxHp)
  }

  get currentHp(): number {
    return this.hp
  }

  get isDead(): boolean {
    return this.hp <= 0
  }

  get isStunned(): boolean {
    return this.context.scene.time.now < this.stunnedUntil
  }

  canAttack(now: number): boolean {
    return !this.isDead && now >= this.attackWindowEndsAt
  }

  beginAttack(now: number): void {
    this.attackStartedAt = now
    const cfg = this.definition.attack
    this.attackWindowEndsAt =
      now + cfg.windupMs + cfg.activeMs + cfg.recoveryMs + Math.max(0, cfg.cooldownMs - cfg.recoveryMs)
    this.attackHitApplied = false
    this.projectileBurstsFired = 0
    this.touchedPlayers.clear()
  }

  getAttackPhase(now: number): EnemyAttackPhase {
    if (this.attackStartedAt < 0) {
      return 'none'
    }
    const cfg = this.definition.attack
    const elapsed = now - this.attackStartedAt
    if (elapsed < cfg.windupMs) {
      return 'windup'
    }
    if (elapsed < cfg.windupMs + cfg.activeMs) {
      return 'active'
    }
    if (elapsed < cfg.windupMs + cfg.activeMs + cfg.recoveryMs) {
      return 'recover'
    }
    return 'none'
  }

  update(now: number, facing: 1 | -1): void {
    if (this.isDead || this.attackStartedAt < 0) {
      return
    }

    const phase = this.getAttackPhase(now)
    const attack = this.definition.attack

    if (phase === 'active') {
      if (attack.type === 'projectile' || attack.type === 'lobbed' || attack.type === 'burst') {
        if (!this.enableProjectiles) {
          this.attackHitApplied = true
          return
        }
        this.fireProjectilePattern(now, facing, attack)
      } else {
        this.applyMeleeHitIfNeeded(attack, facing)
      }
    }

    if (phase === 'none') {
      this.attackStartedAt = -1
    }
  }

  receiveDamage(event: DamageEvent, now: number): number {
    if (this.isDead || now < this.invulnerableUntil) {
      return this.hp
    }

    const nextHp = Math.max(0, this.hp - Math.max(0, event.amount))
    const didHeavy = event.amount >= 2
    const hitstun = event.hitstunMs ?? (didHeavy ? this.definition.stats.hitstunHeavyMs : this.definition.stats.hitstunLightMs)
    this.stunnedUntil = Math.max(this.stunnedUntil, now + hitstun)

    if (event.knockback) {
      const scale = 1 - Phaser.Math.Clamp(this.definition.stats.knockbackResist, 0, 1)
      this.motor.applyKnockback(event.knockback.clone().scale(scale), hitstun, now)
    }

    this.hp = nextHp
    this.sprite.data?.set('hp', this.hp)
    if (this.definition.stats.invulnerabilityMs) {
      this.invulnerableUntil = now + this.definition.stats.invulnerabilityMs
    }

    if (this.hp <= 0) {
      const anySprite = this.sprite as any
      if (typeof anySprite.disableBody === 'function') {
        anySprite.disableBody(true, true)
      } else {
        this.sprite.setActive(false).setVisible(false)
      }
      this.context.onEnemyDefeated(this.sprite)
    }

    return this.hp
  }

  getActiveHitboxRect(facing: 1 | -1): Phaser.Geom.Rectangle | null {
    const phase = this.getAttackPhase(this.context.scene.time.now)
    if (phase !== 'active') {
      return null
    }
    const hitbox = this.definition.hitboxes.melee
    const originX = this.sprite.x + (facing < 0 ? -hitbox.offsetX - hitbox.width : hitbox.offsetX)
    const originY = this.sprite.y + hitbox.offsetY - hitbox.height * 0.5
    return new Phaser.Geom.Rectangle(originX, originY, hitbox.width, hitbox.height)
  }

  private applyMeleeHitIfNeeded(_attack: EnemyAttackConfig, facing: 1 | -1): void {
    const hitRect = this.getActiveHitboxRect(facing)
    if (!hitRect) {
      return
    }

    const playerBounds = this.context.player.getBounds()
    if (!Phaser.Geom.Rectangle.Overlaps(hitRect, playerBounds)) {
      return
    }

    if (this.attackHitApplied) {
      return
    }

    this.attackHitApplied = true
    this.context.applyDamageToPlayer(this.definition.stats.damage)
  }

  private fireProjectilePattern(now: number, facing: 1 | -1, attack: EnemyAttackConfig): void {
    if (!attack.projectileKey) {
      return
    }
    const projectile = EnemyProjectileCatalog[attack.projectileKey]
    if (!projectile) {
      return
    }

    if (attack.type === 'burst') {
      const burstCount = Math.max(1, attack.burstCount ?? 1)
      const spacing = Math.max(40, attack.burstSpacingMs ?? 90)
      const elapsedActive = now - (this.attackStartedAt + attack.windupMs)
      const expectedBursts = Math.min(burstCount, Math.floor(elapsedActive / spacing) + 1)
      while (this.projectileBurstsFired < expectedBursts) {
        this.spawnProjectile(facing, projectile)
        this.projectileBurstsFired += 1
      }
      return
    }

    if (this.attackHitApplied) {
      return
    }
    this.attackHitApplied = true
    this.spawnProjectile(facing, projectile)
  }

  private spawnProjectile(facing: 1 | -1, projectile: (typeof EnemyProjectileCatalog)[string]): void {
    const origin = new Phaser.Math.Vector2(this.sprite.x + facing * 10, this.sprite.y - 4)
    const aim = new Phaser.Math.Vector2(this.context.player.x, this.context.player.y)
    spawnEnemyProjectile(
      this.context.scene,
      this.context.projectileGroup,
      this.context.projectileSystem,
      projectile,
      origin,
      facing,
      aim
    )
  }
}
