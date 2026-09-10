import Phaser from 'phaser'
import { ENEMY_GLOBAL_TUNING } from './config'
import {
  resolveEnemyBehaviorProfile,
  resolveHorizontalBandIntent,
  shouldEnemyAttackNow
} from './EnemyBehaviorProfiles'
import { EnemyCombat } from './EnemyCombat'
import { EnemyMotor } from './EnemyMotor'
import { EnemyDefinition, EnemyState } from './types'
import type { EnemyEntity } from './EnemyEntity'

export class EnemyAI {
  private readonly entity: EnemyEntity
  private readonly definition: EnemyDefinition
  private readonly motor: EnemyMotor
  private readonly combat: EnemyCombat
  private readonly enabled: boolean
  private readonly profile: ReturnType<typeof resolveEnemyBehaviorProfile>

  private stateEnteredAt = 0
  private lastScanAt = 0
  private patrolDirection: 1 | -1 = 1

  constructor(
    entity: EnemyEntity,
    definition: EnemyDefinition,
    motor: EnemyMotor,
    combat: EnemyCombat,
    enabled: boolean
  ) {
    this.entity = entity
    this.definition = definition
    this.motor = motor
    this.combat = combat
    this.enabled = enabled
    this.profile = resolveEnemyBehaviorProfile(definition)
  }

  update(now: number, _deltaMs: number): void {
    if (!this.enabled || this.entity.state === 'dead') {
      return
    }

    if (this.combat.isStunned) {
      this.motor.setIntent(0, 0)
      this.transition('stunned', now)
      return
    }
    if (this.entity.state === 'stunned') {
      this.transition('alert', now)
    }

    const state = this.entity.state
    const player = this.entity.context.player
    const sprite = this.entity.sprite
    const distance = this.motor.distanceToPlayer()
    const deltaX = player.x - sprite.x
    const deltaY = player.y - sprite.y
    const seesPlayer = this.canSeePlayer(distance, deltaX, deltaY, now)

    this.updateFacing()

    switch (state) {
      case 'idle':
        this.motor.setIntent(0, 0)
        if (seesPlayer) {
          this.transition('alert', now)
          return
        }
        if (this.stateElapsed(now) > this.definition.ai.reactionTime) {
          this.transition('patrol', now)
        }
        break
      case 'patrol':
        this.applyPatrolMovement(now)
        if (seesPlayer) {
          this.transition('alert', now)
        }
        break
      case 'alert':
        this.motor.setIntent(0, 0)
        if (this.stateElapsed(now) > Math.max(80, this.definition.ai.reactionTime * 0.6)) {
          this.transition('chase', now)
        }
        break
      case 'chase':
        this.applyChaseMovement(deltaX, deltaY, now)
        if (this.combat.canAttack(now) && this.shouldStartAttack(deltaX, deltaY)) {
          this.combat.beginAttack(now)
          this.transition('attack_windup', now)
          return
        }
        if (this.distanceFromSpawn() > this.definition.ai.leashRange) {
          this.transition('retreat', now)
          return
        }
        break
      case 'attack_windup':
      case 'attack_active':
      case 'attack_recover':
        this.syncAttackPhase(now)
        break
      case 'retreat':
        this.applyRetreatMovement(now)
        if (this.distanceFromSpawn() < 18) {
          this.transition('idle', now)
        }
        break
      default:
        this.transition('idle', now)
        break
    }
  }

  private syncAttackPhase(now: number): void {
    const phase = this.combat.getAttackPhase(now)
    if (phase === 'windup') {
      this.transition('attack_windup', now)
      return
    }
    if (phase === 'active') {
      this.transition('attack_active', now)
      return
    }
    if (phase === 'recover') {
      this.transition('attack_recover', now)
      return
    }
    this.transition('chase', now)
  }

  private applyPatrolMovement(now: number): void {
    const speed = this.definition.stats.speed
    switch (this.definition.movementType) {
      case 'hopper':
        this.motor.setIntent(0, 0)
        if (this.motor.isGrounded() && this.stateElapsed(now) > this.definition.ai.reactionTime) {
          this.motor.hop(this.patrolDirection, -220)
          this.stateEnteredAt = now
        }
        break
      case 'flyer':
      case 'drone': {
        const targetY = this.entity.spawnPosition.y + Math.sin(now / 260) * 18
        const targetDeltaY = targetY - this.entity.sprite.y
        const vy =
          Math.abs(targetDeltaY) <= this.profile.hoverDeadzoneY
            ? 0
            : Phaser.Math.Clamp(targetDeltaY * 1.2, -speed * 0.8, speed * 0.8)
        this.motor.setIntent(this.patrolDirection * speed * 0.65, vy)
        break
      }
      case 'turret':
        this.motor.setIntent(0, 0)
        break
      default:
        this.motor.setIntent(this.patrolDirection * speed * 0.8, 0)
        if (this.shouldFlipPatrolDirection()) {
          this.flipPatrolDirection()
        }
        break
    }
  }

  private applyChaseMovement(deltaX: number, deltaY: number, now: number): void {
    const player = this.entity.context.player
    const sprite = this.entity.sprite
    const towardPlayer: 1 | -1 = player.x >= sprite.x ? 1 : -1
    const speed = this.definition.stats.speed
    const horizontalIntent = resolveHorizontalBandIntent(this.profile, deltaX)

    switch (this.definition.movementType) {
      case 'hopper':
        this.motor.setIntent(0, 0)
        if (
          this.motor.isGrounded() &&
          this.stateElapsed(now) > this.definition.ai.reactionTime * 0.9 &&
          Math.abs(deltaY) <= this.profile.verticalAggroTolerance
        ) {
          const hopDirection = horizontalIntent === 0 ? towardPlayer : (Math.sign(horizontalIntent) as 1 | -1)
          this.motor.hop(hopDirection, -250)
          this.stateEnteredAt = now
        }
        break
      case 'flyer':
      case 'drone': {
        const vx = horizontalIntent * speed
        const targetY = player.y + this.profile.hoverAnchorOffsetY
        const targetDeltaY = targetY - sprite.y
        const vy =
          Math.abs(targetDeltaY) <= this.profile.hoverDeadzoneY
            ? 0
            : Phaser.Math.Clamp(targetDeltaY * 1.35, -speed * 0.9, speed * 0.9)
        this.motor.setIntent(vx, vy)
        break
      }
      case 'turret':
        this.motor.setIntent(0, 0)
        break
      default:
        this.motor.setIntent(horizontalIntent * speed, 0)
        if (horizontalIntent === 0 && this.definition.attack.type === 'melee' && Math.abs(deltaX) < 24) {
          this.motor.setIntent(0, 0)
        }
        break
    }
  }

  private applyRetreatMovement(_now: number): void {
    const spawn = this.entity.spawnPosition
    const sprite = this.entity.sprite
    const towardSpawn: 1 | -1 = spawn.x >= sprite.x ? 1 : -1
    const speed = this.definition.stats.speed

    if (this.definition.movementType === 'flyer' || this.definition.movementType === 'drone') {
      const vx = towardSpawn * speed * 0.7
      const vy = Phaser.Math.Clamp((spawn.y - sprite.y) * 1.8, -speed, speed)
      this.motor.setIntent(vx, vy)
      return
    }

    if (this.definition.movementType === 'turret') {
      this.motor.setIntent(0, 0)
      return
    }

    this.motor.setIntent(towardSpawn * speed * 0.7, 0)
  }

  private canSeePlayer(distance: number, deltaX: number, deltaY: number, now: number): boolean {
    if (Math.abs(deltaY) > this.profile.verticalAggroTolerance) {
      return false
    }
    const scanInterval = 1000 / ENEMY_GLOBAL_TUNING.aggroScanHz
    if (now - this.lastScanAt < scanInterval) {
      return distance <= this.definition.ai.aggroRange && this.entity.state !== 'idle'
    }
    this.lastScanAt = now
    return distance <= this.definition.ai.sightRange
  }

  private updateFacing(): void {
    const sprite = this.entity.sprite
    const playerX = this.entity.context.player.x
    this.entity.facing = playerX >= sprite.x ? 1 : -1
  }

  private shouldFlipPatrolDirection(): boolean {
    if (this.entity.patrolBounds) {
      const nextX = this.entity.sprite.x + this.patrolDirection * 8
      if (nextX <= this.entity.patrolBounds.minX || nextX >= this.entity.patrolBounds.maxX) {
        return true
      }
    }
    return this.motor.hitWall() || this.motor.atLedge(this.patrolDirection)
  }

  private shouldStartAttack(deltaX: number, deltaY: number): boolean {
    const camera = this.entity.context.scene.cameras.main.worldView
    const margin = this.profile.offscreenAttackMargin
    const sprite = this.entity.sprite
    const isOnscreen =
      sprite.x >= camera.left - margin &&
      sprite.x <= camera.right + margin &&
      sprite.y >= camera.top - margin &&
      sprite.y <= camera.bottom + margin

    return shouldEnemyAttackNow(this.profile, deltaX, deltaY, isOnscreen)
  }

  private flipPatrolDirection(): void {
    this.patrolDirection = this.patrolDirection === 1 ? -1 : 1
  }

  private distanceFromSpawn(): number {
    return Phaser.Math.Distance.Between(
      this.entity.sprite.x,
      this.entity.sprite.y,
      this.entity.spawnPosition.x,
      this.entity.spawnPosition.y
    )
  }

  private transition(next: EnemyState, now: number): void {
    if (this.entity.state === next) {
      return
    }
    this.entity.state = next
    this.stateEnteredAt = now
    this.entity.sprite.data?.set('enemyState', next)
  }

  private stateElapsed(now: number): number {
    return now - this.stateEnteredAt
  }
}
