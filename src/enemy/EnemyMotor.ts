import Phaser from 'phaser'
import { EnemyDefinition, EnemyRuntimeContext } from './types'

export class EnemyMotor {
  private readonly sprite: Phaser.Physics.Arcade.Sprite
  private readonly definition: EnemyDefinition
  private readonly context: EnemyRuntimeContext
  private knockbackUntil = 0
  private knockback = new Phaser.Math.Vector2(0, 0)
  private currentIntentX = 0
  private currentIntentY = 0

  constructor(sprite: Phaser.Physics.Arcade.Sprite, definition: EnemyDefinition, context: EnemyRuntimeContext) {
    this.sprite = sprite
    this.definition = definition
    this.context = context

    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined
    if (!body) {
      return
    }
    body.setSize(definition.collider.width, definition.collider.height)
    this.syncColliderToFrame(body)

    const usesGravity = definition.movementType !== 'flyer' && definition.movementType !== 'drone' && definition.movementType !== 'turret'
    body.allowGravity = usesGravity
    body.setGravityY(usesGravity ? 800 * definition.stats.gravityScale : 0)
    body.setCollideWorldBounds(true)
  }

  setIntent(vx: number, vy: number): void {
    this.currentIntentX = vx
    this.currentIntentY = vy
  }

  applyKnockback(vector: Phaser.Math.Vector2, durationMs: number, now: number): void {
    this.knockback.copy(vector)
    this.knockbackUntil = Math.max(this.knockbackUntil, now + durationMs)
  }

  hop(direction: 1 | -1, impulseY = -250): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined
    if (!body) {
      return
    }
    body.setVelocityX(direction * Math.max(this.definition.stats.speed, 60))
    body.setVelocityY(impulseY)
  }

  update(now: number): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined
    if (!body) {
      return
    }
    this.syncColliderToFrame(body)

    if (now < this.knockbackUntil) {
      body.setVelocity(
        Phaser.Math.Linear(body.velocity.x, this.knockback.x, 0.35),
        Phaser.Math.Linear(body.velocity.y, this.knockback.y, 0.35)
      )
      return
    }

    const movementType = this.definition.movementType
    if (movementType === 'turret') {
      body.setVelocity(0, 0)
      return
    }

    if (movementType === 'flyer' || movementType === 'drone') {
      body.setAllowGravity(false)
      body.setVelocity(
        Phaser.Math.Linear(body.velocity.x, this.currentIntentX, 0.18),
        Phaser.Math.Linear(body.velocity.y, this.currentIntentY, 0.18)
      )
      return
    }

    body.setAllowGravity(true)
    body.setVelocityX(Phaser.Math.Linear(body.velocity.x, this.currentIntentX, 0.25))
  }

  private syncColliderToFrame(body: Phaser.Physics.Arcade.Body): void {
    const collider = this.definition.collider
    const frameWidth = Math.round(this.sprite.frame?.width ?? this.sprite.width ?? collider.width)
    const frameHeight = Math.round(this.sprite.frame?.height ?? this.sprite.height ?? collider.height)
    const centeredOffsetX = Math.floor((frameWidth - collider.width) / 2)
    const targetOffsetX = Math.max(0, centeredOffsetX + collider.offsetX)
    const groundedOffsetY = frameHeight - collider.height
    const targetOffsetY = Math.max(0, groundedOffsetY + collider.offsetY)
    if (body.offset.x !== targetOffsetX || body.offset.y !== targetOffsetY) {
      body.setOffset(targetOffsetX, targetOffsetY)
    }
  }

  isGrounded(): boolean {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined
    return Boolean(body?.onFloor() || body?.blocked.down)
  }

  hitWall(): boolean {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body | undefined
    return Boolean(body?.blocked.left || body?.blocked.right)
  }

  atLedge(facing: 1 | -1): boolean {
    const worldWidth = this.context.scene.scale.width
    return facing > 0 ? this.sprite.x >= worldWidth - 10 : this.sprite.x <= 10
  }

  distanceToPlayer(): number {
    return Phaser.Math.Distance.Between(
      this.sprite.x,
      this.sprite.y,
      this.context.player.x,
      this.context.player.y
    )
  }
}
