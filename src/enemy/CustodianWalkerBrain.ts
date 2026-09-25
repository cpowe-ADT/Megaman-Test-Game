import Phaser from 'phaser'
import {
  CUSTODIAN_TUNING,
  createCustodianState,
  killCustodian,
  stepCustodian,
  type CustodianState
} from './custodianWalker'
import { isWalkBlocked, type SolidRect } from './floorProbe'
import {
  CUSTODIAN_SHOCKWAVE,
  groundWaveHits,
  launchShockwaves,
  resolveShockwaveSpan,
  stepGroundWave,
  type GroundWave
} from './groundShockwave'
import type { EnemyBrain } from './types'
import type { EnemyEntity } from './EnemyEntity'

/** Two frames cut from the stomp art's flat fire (the right tip of attack_active/001 and /002). */
const WAVE_FRAMES = [
  { name: 'custodian_walker/wave/000', from: 'custodian_walker/attack_active/001', x: 47, y: 48, w: 16, h: 16 },
  { name: 'custodian_walker/wave/001', from: 'custodian_walker/attack_active/002', x: 47, y: 48, w: 16, h: 16 }
] as const
const WAVE_FRAME_MS = 80
const BAR_WIDTH = 36
const BAR_HEIGHT = 3

type LiveWave = { wave: GroundWave; image: Phaser.GameObjects.Image; hit: boolean; bornAt: number }

export interface CustodianDebugSnapshot {
  id: string
  phase: CustodianState['phase']
  phaseMs: number
  facing: 1 | -1
  hp: number
  maxHp: number
  windupMs: number
  stomps: number
  x: number
  floorTop: number
  waves: Array<{ x: number; dir: 1 | -1; limitX: number; alive: boolean; hit: boolean }>
  waveHits: number
  barVisible: boolean
}

/**
 * Phaser adapter for the custodian walker: feeds `stepCustodian` from the sprite, drives the motor,
 * launches and hit-tests the ground shockwaves, and draws a small health bar over the walker (the
 * HUD's boss bar belongs to the stage boss, so the mini-boss carries its own). The kill plays the
 * four death frames before the defeat (explosion, drop) lands.
 */
export class CustodianWalkerBrain implements EnemyBrain {
  private readonly entity: EnemyEntity
  private readonly enabled: boolean
  private state: CustodianState
  private solids: SolidRect[] | null = null
  private waves: LiveWave[] = []
  private readonly bar: Phaser.GameObjects.Graphics
  private barHp = -1
  private waveHits = 0

  constructor(entity: EnemyEntity, enabled: boolean) {
    this.entity = entity
    this.enabled = enabled
    const player = entity.context.player
    this.state = createCustodianState(player && player.x >= entity.sprite.x ? 1 : -1)
    entity.facing = this.state.facing
    ensureWaveFrames(entity.context.scene)
    this.bar = entity.context.scene.add.graphics().setDepth(4).setVisible(false)
  }

  update(now: number, deltaMs: number): void {
    const { sprite, context, motor, combat } = this.entity
    const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
    const dtMs = Math.min(Math.max(deltaMs, 0), 50)
    const dying = this.state.phase === 'dying' || this.state.phase === 'gone'
    if (!body || (!this.enabled && !dying)) {
      motor.setIntent(0, 0)
      this.updateWaves(dtMs, now)
      return
    }
    const grounded = Boolean(body.blocked.down || body.onFloor())
    if (!grounded && !dying) {
      motor.setIntent(0, 0)
      this.updateWaves(dtMs, now)
      return
    }

    const maxHp = Math.max(1, this.entity.definition.stats.hp)
    const floorTop = body.bottom
    const blockedAhead = !dying && isWalkBlocked(this.readSolids(), {
      x: body.center.x,
      halfWidth: body.halfWidth,
      floorTop,
      bodyHeight: body.height,
      facing: this.state.facing,
      bounds: this.entity.patrolBounds
    })
    const step = stepCustodian(this.state, {
      dtMs,
      dx: context.player.x - sprite.x,
      dy: context.player.y - sprite.y,
      hpFraction: combat.currentHp / maxHp,
      blockedAhead
    })
    this.state = step.state
    this.entity.facing = step.state.facing
    if (this.entity.state !== step.animState) {
      this.entity.state = step.animState
      sprite.data?.set('enemyState', step.animState)
    }
    motor.setIntent(step.velocityX, 0)
    // The wind-up art is three frames at 6 fps (500 ms); a shorter enraged wind-up plays them faster.
    const timeScale = step.state.phase === 'windup' ? CUSTODIAN_TUNING.windupMs / step.state.windupMs : 1
    if (sprite.anims && sprite.anims.timeScale !== timeScale) {
      sprite.anims.timeScale = timeScale
    }

    for (const event of step.events) {
      if (event === 'stomp') {
        this.launch(body.center.x, floorTop, body.halfWidth, now)
      } else if (event === 'defeated') {
        this.clearWaves()
        this.bar.setVisible(false)
        combat.finishDefeat()
      }
    }
    this.updateWaves(dtMs, now)
    this.drawBar(combat.currentHp, maxHp, body)
  }

  onHurt(_now: number): void {
    // Super armour: the entity's white flash is the whole reaction; the bar redraws on the next update.
  }

  onDefeated(_now: number): void {
    this.state = killCustodian(this.state)
    this.clearWaves()
    this.bar.setVisible(false)
    this.entity.motor.setIntent(0, 0)
  }

  destroy(): void {
    this.clearWaves()
    this.bar.destroy()
  }

  snapshot(): CustodianDebugSnapshot {
    const body = this.entity.sprite.body as Phaser.Physics.Arcade.Body | undefined
    return {
      id: this.entity.id,
      phase: this.state.phase,
      phaseMs: Math.round(this.state.phaseMs),
      facing: this.state.facing,
      hp: this.entity.combat.currentHp,
      maxHp: this.entity.definition.stats.hp,
      windupMs: this.state.windupMs,
      stomps: this.state.stomps,
      x: Math.round(this.entity.sprite.x),
      floorTop: Math.round(body?.bottom ?? 0),
      waves: this.waves.map(({ wave, hit }) => ({ x: Math.round(wave.x), dir: wave.dir, limitX: Math.round(wave.limitX), alive: wave.alive, hit })),
      waveHits: this.waveHits,
      barVisible: this.bar.visible
    }
  }

  private readSolids(): SolidRect[] {
    if (!this.solids) {
      const group = this.entity.context.worldPlatforms
      const rects: SolidRect[] = []
      group?.getChildren().forEach((child) => {
        const body = (child as Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.StaticBody }).body
        if (body) {
          rects.push({ left: body.x, right: body.x + body.width, top: body.y, bottom: body.y + body.height })
        }
      })
      this.solids = rects
    }
    return this.solids
  }

  private launch(originX: number, floorTop: number, halfWidth: number, now: number): void {
    // The patrol bounds are its arena: a wave runs to the walker's farthest reach and no further.
    const bounds = this.entity.patrolBounds
    const arena = bounds ? { minX: bounds.minX - halfWidth, maxX: bounds.maxX + halfWidth } : undefined
    const span = resolveShockwaveSpan(this.readSolids(), originX, floorTop, CUSTODIAN_SHOCKWAVE, { arena })
    const scene = this.entity.context.scene
    for (const wave of launchShockwaves(originX, floorTop, span)) {
      if (!wave.alive) {
        continue
      }
      const image = scene.add
        .image(wave.x, floorTop, this.atlasKey(), WAVE_FRAMES[0].name)
        .setOrigin(0.5, 1)
        .setDepth(3)
        .setFlipX(wave.dir < 0)
      this.waves.push({ wave, image, hit: false, bornAt: now })
    }
  }

  private updateWaves(dtMs: number, now: number): void {
    if (this.waves.length === 0) {
      return
    }
    const player = this.entity.context.player
    const heroBody = player.body as Phaser.Physics.Arcade.Body | undefined
    const hero = heroBody
      ? { left: heroBody.left, right: heroBody.right, top: heroBody.top, bottom: heroBody.bottom }
      : null
    this.waves = this.waves.filter((live) => {
      live.wave = stepGroundWave(live.wave, dtMs)
      if (!live.wave.alive) {
        live.image.destroy()
        return false
      }
      live.image.setX(live.wave.x)
      const frame = WAVE_FRAMES[Math.floor((now - live.bornAt) / WAVE_FRAME_MS) % WAVE_FRAMES.length].name
      if (live.image.frame.name !== frame) {
        live.image.setFrame(frame)
      }
      if (!live.hit && hero && player.active && groundWaveHits(live.wave, hero)) {
        const result = this.entity.context.applyDamageToPlayer({
          amount: CUSTODIAN_SHOCKWAVE.damage,
          tier: 'heavy',
          sourceType: 'enemy_projectile',
          sourceId: `${this.entity.id}:${CUSTODIAN_SHOCKWAVE.key}`,
          direction: live.wave.dir
        })
        if (result.accepted) {
          live.hit = true
          this.waveHits += 1
        }
      }
      return true
    })
  }

  private clearWaves(): void {
    this.waves.forEach((live) => live.image.destroy())
    this.waves = []
  }

  private drawBar(hp: number, maxHp: number, body: Phaser.Physics.Arcade.Body): void {
    const awake = this.state.phase !== 'dormant' && this.state.phase !== 'dying' && this.state.phase !== 'gone'
    this.bar.setVisible(awake)
    if (!awake) {
      return
    }
    this.bar.setPosition(Math.round(body.center.x - BAR_WIDTH / 2), Math.round(body.top - 8))
    if (hp === this.barHp) {
      return
    }
    this.barHp = hp
    const fill = Math.round((BAR_WIDTH - 2) * Phaser.Math.Clamp(hp / maxHp, 0, 1))
    this.bar.clear()
    this.bar.fillStyle(0x140806, 1).fillRect(0, 0, BAR_WIDTH, BAR_HEIGHT + 2)
    this.bar.fillStyle(0xff7a2a, 1).fillRect(1, 1, fill, BAR_HEIGHT)
  }

  private atlasKey(): string {
    return `atlas_${this.entity.typeKey}`
  }
}

function ensureWaveFrames(scene: Phaser.Scene): void {
  const key = 'atlas_custodian_walker'
  if (!scene.textures.exists(key)) {
    return
  }
  const texture = scene.textures.get(key)
  for (const spec of WAVE_FRAMES) {
    if (texture.has(spec.name)) {
      continue
    }
    const source = texture.get(spec.from)
    texture.add(spec.name, source.sourceIndex, source.cutX + spec.x, source.cutY + spec.y, spec.w, spec.h)
  }
}
