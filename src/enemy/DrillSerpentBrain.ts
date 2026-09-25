import Phaser from 'phaser'
import { isWalkBlocked, type SolidRect } from './floorProbe'
import { MinibossHealthBar, ensureAtlasAnimation, playMinibossSfx, readSolidRects, type MinibossSound } from './minibossAdapter'
import {
  SERPENT_ANIMATIONS,
  createSerpentState,
  isSerpentUnderground,
  killSerpent,
  serpentAnimationSuffix,
  stepSerpent,
  type SerpentState
} from './drillSerpent'
import type { EnemyBrain } from './types'
import type { EnemyEntity } from './EnemyEntity'

const BAR_COLOR = 0x8ae04a
const EVENT_SFX: Partial<Record<string, MinibossSound>> = { burrow: 'dash', burst: 'burst', coil: 'tell', lunge: 'dash' }
/** The mound shakes a pixel either way at this rate. */
const SHAKE_FRAME_MS = 50

export interface DrillSerpentDebugSnapshot {
  id: string
  phase: SerpentState['phase']
  phaseMs: number
  facing: 1 | -1
  hp: number
  maxHp: number
  x: number
  groundY: number | null
  moundX: number | null
  burrows: number
  bursts: number
  lunges: number
  underground: boolean
  bodyEnabled: boolean
  visible: boolean
  anim: string | null
  barVisible: boolean
}

/**
 * Phaser adapter for the drill serpent. On the surface it moves by the motor like any walker; from the
 * first burrow frame until it bursts up, its body is off (no pellet, swing or contact reaches it, and the
 * entity asks `isInvulnerable` before any damage), the brain carries its x under the floor, hides it
 * while it tunnels and shows the shaking mound where it will come up.
 */
export class DrillSerpentBrain implements EnemyBrain {
  private readonly entity: EnemyEntity
  private readonly enabled: boolean
  private state: SerpentState
  private solids: SolidRect[] | null = null
  private groundY: number | null = null
  private floorTop = 0
  private x: number
  private readonly bar: MinibossHealthBar

  constructor(entity: EnemyEntity, enabled: boolean) {
    this.entity = entity
    this.enabled = enabled
    const { sprite, context, typeKey } = entity
    const player = context.player
    this.state = createSerpentState(player && player.x >= sprite.x ? 1 : -1)
    entity.facing = this.state.facing
    this.x = sprite.x
    for (const [suffix, spec] of Object.entries(SERPENT_ANIMATIONS)) {
      ensureAtlasAnimation(context.scene, typeKey, `${typeKey}_${suffix}`, spec.frames, spec.frameRate, spec.repeat)
    }
    this.bar = new MinibossHealthBar(context.scene, BAR_COLOR)
  }

  update(now: number, deltaMs: number): void {
    const { sprite, context, motor, combat } = this.entity
    const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
    const dtMs = Math.min(Math.max(deltaMs, 0), 50)
    const dying = this.state.phase === 'dying' || this.state.phase === 'gone'
    const wasUnderground = isSerpentUnderground(this.state.phase)
    if (!body || (!this.enabled && !dying)) {
      motor.setIntent(0, 0)
      return
    }
    if (!wasUnderground && !dying) {
      if (!(body.blocked.down || body.onFloor())) {
        motor.setIntent(0, 0)
        return
      }
      if (this.groundY === null) {
        this.groundY = sprite.y
        this.floorTop = body.bottom
      }
      this.x = sprite.x
    }
    const groundY = this.groundY ?? sprite.y

    const blockedAhead = !wasUnderground && !dying && isWalkBlocked(this.readSolids(), {
      x: body.center.x,
      halfWidth: body.halfWidth,
      floorTop: this.floorTop,
      bodyHeight: body.height,
      facing: this.state.facing,
      bounds: this.entity.patrolBounds
    })
    const step = stepSerpent(this.state, {
      dtMs,
      dx: context.player.x - this.x,
      dy: context.player.y - groundY,
      x: this.x,
      bounds: this.entity.patrolBounds,
      blockedAhead
    })
    this.state = step.state
    this.entity.facing = step.state.facing
    if (this.entity.state !== step.animState) {
      this.entity.state = step.animState
      sprite.data?.set('enemyState', step.animState)
    }

    if (isSerpentUnderground(this.state.phase)) {
      if (!wasUnderground) {
        body.stop()
        body.enable = false
      }
      this.x += (step.velocityX * dtMs) / 1000
      const shake = this.state.phase === 'mound' ? (Math.floor(now / SHAKE_FRAME_MS) % 2 === 0 ? -1 : 1) : 0
      sprite.setPosition(this.x + shake, groundY)
      sprite.setVisible(this.state.phase !== 'tunnel')
      motor.setIntent(0, 0)
    } else {
      if (wasUnderground) {
        sprite.setVisible(true)
        body.enable = true
        body.reset(this.x, groundY)
      }
      motor.setIntent(step.velocityX, 0)
    }

    for (const event of step.events) {
      const sound = EVENT_SFX[event]
      if (sound) {
        playMinibossSfx(sound)
      }
      if (event === 'defeated') {
        this.bar.hide()
        combat.finishDefeat()
      }
    }
    const shown = this.state.phase !== 'dormant' && this.state.phase !== 'tunnel' && this.state.phase !== 'dying' && this.state.phase !== 'gone'
    this.bar.draw(this.x, groundY - 14, combat.currentHp, Math.max(1, this.entity.definition.stats.hp), shown)
  }

  /** Burrowing, tunnelling or under its mound, nothing hurts it. */
  isInvulnerable(): boolean {
    return isSerpentUnderground(this.state.phase)
  }

  animationKey(): string | undefined {
    const suffix = serpentAnimationSuffix(this.state.phase)
    return suffix ? `${this.entity.typeKey}_${suffix}` : undefined
  }

  onHurt(_now: number): void {
    // Super armour: the entity's white flash is the whole reaction.
  }

  onDefeated(_now: number): void {
    this.state = killSerpent(this.state)
    this.bar.hide()
    this.entity.motor.setIntent(0, 0)
  }

  destroy(): void {
    this.bar.destroy()
  }

  snapshot(): DrillSerpentDebugSnapshot {
    const sprite = this.entity.sprite
    const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
    return {
      id: this.entity.id,
      phase: this.state.phase,
      phaseMs: Math.round(this.state.phaseMs),
      facing: this.state.facing,
      hp: this.entity.combat.currentHp,
      maxHp: this.entity.definition.stats.hp,
      x: Math.round(this.x),
      groundY: this.groundY === null ? null : Math.round(this.groundY),
      moundX: this.state.moundX === null ? null : Math.round(this.state.moundX),
      burrows: this.state.burrows,
      bursts: this.state.bursts,
      lunges: this.state.lunges,
      underground: isSerpentUnderground(this.state.phase),
      bodyEnabled: Boolean(body?.enable),
      visible: sprite.visible,
      anim: sprite.anims?.currentAnim?.key ?? null,
      barVisible: this.bar.visible
    }
  }

  private readSolids(): SolidRect[] {
    this.solids ??= readSolidRects(this.entity.context.worldPlatforms)
    return this.solids
  }
}
