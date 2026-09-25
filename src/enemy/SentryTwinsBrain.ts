import Phaser from 'phaser'
import { TELEGRAPHS_ATLAS, telegraphFrame } from '../boss/telegraphArt'
import { EnemyProjectileCatalog, spawnEnemyProjectile } from './EnemyProjectiles'
import { MinibossHealthBar, floorTopUnder, playMinibossSfx, readSolidRects } from './minibossAdapter'
import {
  createTwinsState,
  killTwins,
  stepTwins,
  swooperOf,
  twinsPoses,
  type TwinIndex,
  type TwinPose,
  type TwinPoseName,
  type TwinsState
} from './sentryTwins'
import type { EnemyBrain, EnemyState } from './types'
import type { EnemyEntity } from './EnemyEntity'

/** The lens in the 48px frame, from its centre, facing right. */
const LENS = { x: 14, y: -2 } as const
const BOLT_SHOT = 'enemy_beam_pulse'
const FLASH_FRAME_MS = 80
const BAR_COLOR = 0xffe14a
/** A hovering twin bobs this many px over this period (drawn only; the pure model holds the perch). */
const BOB = { px: 2, periodMs: 520 } as const

const POSE_STATE: Record<TwinPoseName, EnemyState> = {
  hover: 'idle',
  dash: 'chase',
  windup: 'attack_windup',
  fire: 'attack_active',
  dead: 'dead'
}

export interface SentryTwinsDebugSnapshot {
  id: string
  phase: TwinsState['phase']
  phaseMs: number
  hp: number
  maxHp: number
  shooter: TwinIndex
  swooper: TwinIndex
  lineY: number
  bolts: number
  swoops: number
  rounds: number
  flashVisible: boolean
  barsVisible: [boolean, boolean]
  twins: Array<{ x: number; y: number; facing: 1 | -1; pose: TwinPoseName; visible: boolean; anim: string | null; tinted: boolean }>
}

/**
 * Phaser adapter for the sentry twins. The entity's own sprite is twin 0; twin 1 is a second sprite in
 * the enemy group carrying the same framework id, so a pellet, a saber swing or contact on either routes
 * to the one entity and its one health pool. The brain places both from `stepTwins` every frame, fires
 * the shooter's bolt through the enemy projectile system, draws the warning flash over the swooper and a
 * bar over each twin that shows the shared pool.
 */
export class SentryTwinsBrain implements EnemyBrain {
  private readonly entity: EnemyEntity
  private readonly enabled: boolean
  private state: TwinsState
  private poses: [TwinPose, TwinPose]
  private readonly other: Phaser.Physics.Arcade.Sprite
  private readonly bars: [MinibossHealthBar, MinibossHealthBar]
  private readonly flash: Phaser.GameObjects.Image | null
  private flashBornAt = 0
  private floorTop: number | null = null

  constructor(entity: EnemyEntity, enabled: boolean) {
    this.entity = entity
    this.enabled = enabled
    const { sprite, context } = entity
    const scene = context.scene
    // Twin 0 perches at the left end of its bounds, twin 1 at the right, both at the marker's height.
    const bounds = entity.patrolBounds ?? { minX: sprite.x - 120, maxX: sprite.x + 120 }
    this.state = createTwinsState([
      { x: bounds.minX, y: sprite.y },
      { x: bounds.maxX, y: sprite.y }
    ])
    this.poses = twinsPoses(this.state, context.player?.x ?? sprite.x)
    this.other = this.createTwin(bounds.maxX, sprite.y)
    this.bars = [new MinibossHealthBar(scene, BAR_COLOR), new MinibossHealthBar(scene, BAR_COLOR)]
    this.flash = scene.textures.exists(TELEGRAPHS_ATLAS.key)
      ? scene.add.image(0, 0, TELEGRAPHS_ATLAS.key, telegraphFrame('warning_flash', 0)).setDepth(4).setVisible(false)
      : null
    entity.facing = this.poses[0].facing
  }

  update(now: number, deltaMs: number): void {
    const { context, combat, motor } = this.entity
    const dtMs = Math.min(Math.max(deltaMs, 0), 50)
    const dying = this.state.phase === 'dying' || this.state.phase === 'gone'
    motor.setIntent(0, 0)
    if (this.enabled || dying) {
      const perch = this.state.perches[0]
      this.floorTop ??= floorTopUnder(
        readSolidRects(context.worldPlatforms),
        (this.state.perches[0].x + this.state.perches[1].x) / 2,
        perch.y,
        perch.y + 100
      )
      const step = stepTwins(this.state, { dtMs, heroX: context.player.x, heroY: context.player.y, floorTop: this.floorTop })
      this.state = step.state
      this.poses = step.poses
      for (const event of step.events) {
        if (event === 'bolt_windup') {
          playMinibossSfx('tell')
        } else if (event === 'swoop') {
          playMinibossSfx('dash')
        } else if (event === 'bolt') {
          playMinibossSfx('bolt')
          this.fireBolt()
        } else if (event === 'flash') {
          this.flashBornAt = now
        } else if (event === 'defeated') {
          this.other.setActive(false).setVisible(false)
          combat.finishDefeat()
        }
      }
    }
    this.render(now)
  }

  onHurt(_now: number): void {
    // One pool: the entity flashes twin 0, the brain flashes twin 1.
    if (!this.other.active) {
      return
    }
    this.other.setTintFill(0xffffff)
    this.entity.context.scene.time.delayedCall(80, () => {
      if (this.other.active) {
        this.other.clearTint()
      }
    })
  }

  onDefeated(_now: number): void {
    this.state = killTwins(this.state)
    this.poses = twinsPoses(this.state, this.entity.context.player.x)
    const body = this.other.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.stop()
      body.enable = false
    }
    this.flash?.setVisible(false)
    this.bars.forEach((bar) => bar.hide())
  }

  destroy(): void {
    this.other.destroy()
    this.bars.forEach((bar) => bar.destroy())
    this.flash?.destroy()
  }

  snapshot(): SentryTwinsDebugSnapshot {
    const sprites = [this.entity.sprite, this.other] as const
    return {
      id: this.entity.id,
      phase: this.state.phase,
      phaseMs: Math.round(this.state.phaseMs),
      hp: this.entity.combat.currentHp,
      maxHp: this.entity.definition.stats.hp,
      shooter: this.state.shooter,
      swooper: swooperOf(this.state),
      lineY: Math.round(this.state.lineY),
      bolts: this.state.bolts,
      swoops: this.state.swoops,
      rounds: this.state.rounds,
      flashVisible: Boolean(this.flash?.visible),
      barsVisible: [this.bars[0].visible, this.bars[1].visible],
      twins: this.poses.map((pose, index) => {
        const sprite = sprites[index]
        return {
          x: Math.round(sprite.x),
          y: Math.round(sprite.y),
          facing: pose.facing,
          pose: pose.pose,
          visible: sprite.active && sprite.visible,
          anim: sprite.anims?.currentAnim?.key ?? null,
          tinted: sprite.isTinted
        }
      })
    }
  }

  private createTwin(x: number, y: number): Phaser.Physics.Arcade.Sprite {
    const { sprite, context, definition, typeKey } = this.entity
    const twin = context.enemyGroup.create(x, y, sprite.texture.key, sprite.frame.name) as Phaser.Physics.Arcade.Sprite
    twin.setActive(true).setVisible(true).setDepth(sprite.depth)
    twin.setDataEnabled()
    twin.data?.set('enemyFrameworkId', this.entity.id)
    twin.data?.set('enemyTypeKey', typeKey)
    twin.data?.set('enemyState', 'idle')
    twin.data?.set('enemyAtlasKey', sprite.texture.key)
    twin.data?.set('enemyUsingPlaceholder', false)
    twin.data?.set('enemyTwinIndex', 1)
    const body = twin.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      const collider = definition.collider
      body.setAllowGravity(false)
      body.setSize(collider.width, collider.height)
      // Placed like EnemyMotor places twin 0's: centred, its bottom `offsetY` above the frame's bottom.
      body.setOffset(
        Math.max(0, Math.floor((twin.frame.width - collider.width) / 2) + collider.offsetX),
        Math.max(0, twin.frame.height - collider.height + collider.offsetY)
      )
      body.setCollideWorldBounds(true)
    }
    return twin
  }

  private render(now: number): void {
    const dead = this.state.phase === 'dying' || this.state.phase === 'gone'
    this.poses.forEach((pose, index) => {
      const hovering = !dead && (pose.pose === 'hover' || pose.pose === 'windup' || pose.pose === 'fire')
      const bob = hovering ? Math.round(BOB.px * Math.sin(((now + index * 260) / BOB.periodMs) * Math.PI * 2)) : 0
      this.place(index as TwinIndex, pose, bob)
    })

    const flashOn = this.state.phase === 'flash'
    if (this.flash) {
      this.flash.setVisible(flashOn)
      if (flashOn) {
        const swooper = this.poses[swooperOf(this.state)]
        this.flash.setPosition(swooper.x, swooper.y - 22)
        const frame = telegraphFrame('warning_flash', Math.floor((now - this.flashBornAt) / FLASH_FRAME_MS) % 4)
        if (this.flash.frame.name !== frame) {
          this.flash.setFrame(frame)
        }
      }
    }

    const awake = this.state.phase !== 'dormant' && !dead
    const hp = this.entity.combat.currentHp
    const maxHp = Math.max(1, this.entity.definition.stats.hp)
    this.poses.forEach((pose, index) => this.bars[index].draw(pose.x, pose.y - 12, hp, maxHp, awake))
  }

  private place(index: TwinIndex, pose: TwinPose, bob: number): void {
    const target = index === 0 ? this.entity.sprite : this.other
    if (!target.active) {
      return
    }
    const y = pose.y + bob
    const body = target.body as Phaser.Physics.Arcade.Body | undefined
    if (body?.enable) {
      body.reset(pose.x, y)
    } else {
      target.setPosition(pose.x, y)
    }
    const animState = POSE_STATE[pose.pose]
    if (index === 0) {
      this.entity.facing = pose.facing
      if (this.entity.state !== animState) {
        this.entity.state = animState
        target.data?.set('enemyState', animState)
      }
      return
    }
    target.setFlipX(pose.facing < 0)
    target.data?.set('enemyState', animState)
    const key = this.animationFor(pose.pose)
    if (target.anims?.currentAnim?.key !== key && this.entity.context.scene.anims.exists(key)) {
      target.play(key)
    }
  }

  private animationFor(pose: TwinPoseName): string {
    const animations = this.entity.definition.animations
    switch (pose) {
      case 'dash':
        return animations.move
      case 'windup':
        return animations.attackWindup
      case 'fire':
        return animations.attackActive
      case 'dead':
        return animations.death
      default:
        return animations.idle
    }
  }

  /** The shooter's electric bolt, from its lens toward the hero. */
  private fireBolt(): void {
    const { context } = this.entity
    const projectile = EnemyProjectileCatalog[BOLT_SHOT]
    if (!projectile) {
      return
    }
    const shooter = this.poses[this.state.shooter]
    const origin = new Phaser.Math.Vector2(shooter.x + shooter.facing * LENS.x, shooter.y + LENS.y)
    spawnEnemyProjectile(
      context.scene,
      context.projectileGroup,
      context.projectileSystem,
      projectile,
      origin,
      shooter.facing,
      new Phaser.Math.Vector2(context.player.x, context.player.y),
      { sourceType: 'enemy_projectile', sourceId: this.entity.id, attackId: 'sentry_twin_bolt' }
    )
  }
}
