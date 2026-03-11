import Phaser from 'phaser'
import { ENEMY_GLOBAL_TUNING } from './config'
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
    const distance = this.motor.distanceToPlayer()
    const seesPlayer = this.canSeePlayer(distance, now)

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
        this.applyChaseMovement(distance, now)
        if (distance <= (this.definition.attack.range ?? 46) && this.combat.canAttack(now)) {
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
        const yWave = Math.sin(now / 260) * 30
        this.motor.setIntent(this.patrolDirection * speed * 0.65, yWave)
        break
      }
      case 'turret':
        this.motor.setIntent(0, 0)
        break
      default:
        this.motor.setIntent(this.patrolDirection * speed * 0.8, 0)
        if (this.motor.hitWall() || this.motor.atLedge(this.patrolDirection)) {
          this.flipPatrolDirection()
        }
        break
    }
  }

  private applyChaseMovement(distanceToPlayer: number, now: number): void {
    const player = this.entity.context.player
    const sprite = this.entity.sprite
    const towardPlayer: 1 | -1 = player.x >= sprite.x ? 1 : -1
    const speed = this.definition.stats.speed

    switch (this.definition.movementType) {
      case 'hopper':
        this.motor.setIntent(0, 0)
        if (this.motor.isGrounded() && this.stateElapsed(now) > this.definition.ai.reactionTime * 0.9) {
          this.motor.hop(towardPlayer, -250)
          this.stateEnteredAt = now
        }
        break
      case 'flyer':
      case 'drone': {
        const minBand = 80
        const maxBand = 130
        const dx = player.x - sprite.x
        const dy = player.y - sprite.y
        let vx = 0
        if (Math.abs(dx) > maxBand) {
          vx = Math.sign(dx) * speed
        } else if (Math.abs(dx) < minBand) {
          vx = -Math.sign(dx) * speed * 0.8
        }
        const vy = Phaser.Math.Clamp(dy * 1.5, -speed * 0.9, speed * 0.9)
        this.motor.setIntent(vx, vy)
        break
      }
      case 'turret':
        this.motor.setIntent(0, 0)
        break
      default:
        this.motor.setIntent(towardPlayer * speed, 0)
        if (distanceToPlayer < 34) {
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

  private canSeePlayer(distance: number, now: number): boolean {
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
