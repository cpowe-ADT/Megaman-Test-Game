import Phaser from 'phaser'
import { TELEGRAPHS_ATLAS, telegraphFrame } from '../boss/telegraphArt'
import { PROJECTILES_ATLAS_KEY } from '../projectiles/definitions/coreProjectiles'
import { EnemyProjectileCatalog, spawnEnemyProjectile } from './EnemyProjectiles'
import { isWalkBlocked, type SolidRect } from './floorProbe'
import { MinibossHealthBar, readSolidRects } from './minibossAdapter'
import { RELAY_NEST_MORTAR, launchMortar, mortarBlastHits, stepMortar, type MortarShell, type MortarStage } from './mortarShell'
import {
  createRelayNestState,
  killRelayNest,
  relayNestWindupTimeScale,
  stepRelayNest,
  type RelayNestState
} from './relayTurretNest'
import type { EnemyBrain } from './types'
import type { EnemyEntity } from './EnemyEntity'

/** The barrel's tip in the 64px frame, from its centre, facing right; the mortar leaves the raised barrel. */
const MUZZLE = { x: 20, y: -8 } as const
const MORTAR_MUZZLE = { x: 14, y: -14 } as const
const BURST_SHOT = 'enemy_shot_basic'
const SHELL_FRAME = 'projectiles_core/core/003'
const SHELL_TINT = 0xffb36b
const MARKER_FRAME_MS = 90
const BAR_COLOR = 0x4ad8ff

type LiveShell = {
  shell: MortarShell
  image: Phaser.GameObjects.Image | null
  marker: Phaser.GameObjects.Image | null
  blast: Phaser.GameObjects.Graphics | null
  hit: boolean
  bornAt: number
}

export interface RelayNestDebugSnapshot {
  id: string
  phase: RelayNestState['phase']
  phaseMs: number
  facing: 1 | -1
  hp: number
  maxHp: number
  x: number
  homeX: number | null
  floorTop: number
  nextAttack: RelayNestState['nextAttack']
  shots: number
  bursts: number
  mortars: number
  turns: number
  shells: Array<{ x: number; y: number; targetX: number; stage: MortarStage; markerVisible: boolean }>
  shellHits: number
  barVisible: boolean
}

/**
 * Phaser adapter for the relay turret nest: feeds `stepRelayNest` from the sprite, drives the shuffle,
 * fires the aimed burst through the enemy projectile system, and owns its mortar shells (the shell, the
 * floor marker at the landing spot, the blast). The kill plays the four death frames before the defeat.
 */
export class RelayTurretNestBrain implements EnemyBrain {
  private readonly entity: EnemyEntity
  private readonly enabled: boolean
  private state: RelayNestState
  private solids: SolidRect[] | null = null
  private homeX: number | null = null
  private shells: LiveShell[] = []
  private shellHits = 0
  private readonly bar: MinibossHealthBar

  constructor(entity: EnemyEntity, enabled: boolean) {
    this.entity = entity
    this.enabled = enabled
    const player = entity.context.player
    this.state = createRelayNestState(player && player.x >= entity.sprite.x ? 1 : -1)
    entity.facing = this.state.facing
    this.bar = new MinibossHealthBar(entity.context.scene, BAR_COLOR)
  }

  update(now: number, deltaMs: number): void {
    const { sprite, context, motor, combat } = this.entity
    const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
    const dtMs = Math.min(Math.max(deltaMs, 0), 50)
    const dying = this.state.phase === 'dying' || this.state.phase === 'gone'
    this.updateShells(dtMs, now)
    if (!body || (!this.enabled && !dying)) {
      motor.setIntent(0, 0)
      return
    }
    if (!dying && !(body.blocked.down || body.onFloor())) {
      motor.setIntent(0, 0)
      return
    }
    if (this.homeX === null) {
      this.homeX = body.center.x
    }

    const maxHp = Math.max(1, this.entity.definition.stats.hp)
    const floorTop = body.bottom
    const blockedShuffle = !dying && isWalkBlocked(this.readSolids(), {
      x: body.center.x,
      halfWidth: body.halfWidth,
      floorTop,
      bodyHeight: body.height,
      facing: this.state.shuffleDir,
      bounds: this.entity.patrolBounds
    })
    const step = stepRelayNest(this.state, {
      dtMs,
      dx: context.player.x - sprite.x,
      dy: context.player.y - sprite.y,
      offsetX: body.center.x - this.homeX,
      blockedShuffle
    })
    this.state = step.state
    this.entity.facing = step.state.facing
    if (this.entity.state !== step.animState) {
      this.entity.state = step.animState
      sprite.data?.set('enemyState', step.animState)
    }
    motor.setIntent(step.velocityX, 0)
    const timeScale = relayNestWindupTimeScale(step.state)
    if (sprite.anims && sprite.anims.timeScale !== timeScale) {
      sprite.anims.timeScale = timeScale
    }

    for (const event of step.events) {
      if (event === 'shot') {
        this.fireShot()
      } else if (event === 'mortar') {
        this.fireMortar(floorTop, now)
      } else if (event === 'defeated') {
        this.clearShells()
        this.bar.hide()
        combat.finishDefeat()
      }
    }
    const awake = this.state.phase !== 'dormant' && this.state.phase !== 'dying' && this.state.phase !== 'gone'
    this.bar.draw(body.center.x, body.top, combat.currentHp, maxHp, awake)
  }

  onHurt(_now: number): void {
    // Super armour: the entity's white flash is the whole reaction; the bar redraws on the next update.
  }

  onDefeated(_now: number): void {
    this.state = killRelayNest(this.state)
    this.clearShells()
    this.bar.hide()
    this.entity.motor.setIntent(0, 0)
  }

  destroy(): void {
    this.clearShells()
    this.bar.destroy()
  }

  snapshot(): RelayNestDebugSnapshot {
    const body = this.entity.sprite.body as Phaser.Physics.Arcade.Body | undefined
    return {
      id: this.entity.id,
      phase: this.state.phase,
      phaseMs: Math.round(this.state.phaseMs),
      facing: this.state.facing,
      hp: this.entity.combat.currentHp,
      maxHp: this.entity.definition.stats.hp,
      x: Math.round(this.entity.sprite.x),
      homeX: this.homeX === null ? null : Math.round(this.homeX),
      floorTop: Math.round(body?.bottom ?? 0),
      nextAttack: this.state.nextAttack,
      shots: this.state.shots,
      bursts: this.state.bursts,
      mortars: this.state.mortars,
      turns: this.state.turns,
      shells: this.shells.map(({ shell, marker }) => ({
        x: Math.round(shell.x),
        y: Math.round(shell.y),
        targetX: Math.round(shell.targetX),
        stage: shell.stage,
        markerVisible: Boolean(marker?.visible)
      })),
      shellHits: this.shellHits,
      barVisible: this.bar.visible
    }
  }

  private readSolids(): SolidRect[] {
    this.solids ??= readSolidRects(this.entity.context.worldPlatforms)
    return this.solids
  }

  /** One shot of the burst, aimed at the hero when the hero is in front, straight ahead otherwise. */
  private fireShot(): void {
    const { sprite, context, definition } = this.entity
    const projectile = EnemyProjectileCatalog[BURST_SHOT]
    if (!projectile) {
      return
    }
    const facing = this.state.facing
    const origin = new Phaser.Math.Vector2(sprite.x + facing * MUZZLE.x, sprite.y + MUZZLE.y)
    const player = context.player
    const inFront = Math.sign(player.x - origin.x) === facing
    const aim = inFront ? new Phaser.Math.Vector2(player.x, player.y) : new Phaser.Math.Vector2(origin.x + facing * 100, origin.y)
    spawnEnemyProjectile(context.scene, context.projectileGroup, context.projectileSystem, projectile, origin, facing, aim, {
      sourceType: 'enemy_projectile',
      sourceId: this.entity.id,
      attackId: 'relay_nest_burst'
    })
    if (sprite.anims?.currentAnim?.key === definition.animations.attackActive) {
      sprite.anims.restart()
    }
  }

  /** The shell lands where the hero stands now; the floor marker shows the spot for the whole flight. */
  private fireMortar(floorTop: number, now: number): void {
    const { sprite, context } = this.entity
    const scene = context.scene
    const facing = this.state.facing
    const originX = sprite.x + facing * MORTAR_MUZZLE.x
    const originY = sprite.y + MORTAR_MUZZLE.y
    const shell = launchMortar(originX, originY, context.player.x, floorTop)
    const image = scene.textures.exists(PROJECTILES_ATLAS_KEY)
      ? scene.add.image(originX, originY, PROJECTILES_ATLAS_KEY, SHELL_FRAME).setDepth(5).setTint(SHELL_TINT).setScale(1.2)
      : null
    const marker = scene.textures.exists(TELEGRAPHS_ATLAS.key)
      ? scene.add.image(shell.targetX, floorTop, TELEGRAPHS_ATLAS.key, telegraphFrame('floor_marker', 0)).setOrigin(0.5, 1).setDepth(3)
      : null
    this.shells.push({ shell, image, marker, blast: null, hit: false, bornAt: now })
  }

  private updateShells(dtMs: number, now: number): void {
    if (this.shells.length === 0) {
      return
    }
    const player = this.entity.context.player
    const heroBody = player.body as Phaser.Physics.Arcade.Body | undefined
    const hero = heroBody ? { left: heroBody.left, right: heroBody.right, top: heroBody.top, bottom: heroBody.bottom } : null
    this.shells = this.shells.filter((live) => {
      live.shell = stepMortar(live.shell, dtMs)
      if (live.shell.stage === 'spent') {
        this.destroyShell(live)
        return false
      }
      if (live.shell.stage === 'flight') {
        live.image?.setPosition(live.shell.x, live.shell.y)
        const frame = telegraphFrame('floor_marker', Math.floor((now - live.bornAt) / MARKER_FRAME_MS) % 4)
        if (live.marker && live.marker.frame.name !== frame) {
          live.marker.setFrame(frame)
        }
        return true
      }
      // Landed: the shell and its marker give way to the blast.
      live.image?.destroy()
      live.image = null
      live.marker?.destroy()
      live.marker = null
      live.blast ??= this.drawBlast(live.shell)
      live.blast.setAlpha(Math.max(0, 1 - (live.shell.elapsedMs - RELAY_NEST_MORTAR.flightMs) / RELAY_NEST_MORTAR.blastMs))
      if (!live.hit && hero && player.active && mortarBlastHits(live.shell, hero)) {
        const result = this.entity.context.applyDamageToPlayer({
          amount: RELAY_NEST_MORTAR.damage,
          tier: 'heavy',
          sourceType: 'enemy_projectile',
          sourceId: `${this.entity.id}:${RELAY_NEST_MORTAR.key}`,
          direction: player.x >= live.shell.targetX ? 1 : -1
        })
        if (result.accepted) {
          live.hit = true
          this.shellHits += 1
        }
      }
      return true
    })
  }

  private drawBlast(shell: MortarShell): Phaser.GameObjects.Graphics {
    const blast = this.entity.context.scene.add.graphics().setDepth(5)
    blast.fillStyle(0xffe0a0, 0.9).fillCircle(shell.targetX, shell.floorTop - 10, 14)
    blast.fillStyle(0xff7a2a, 0.95).fillCircle(shell.targetX, shell.floorTop - 8, 9)
    return blast
  }

  private destroyShell(live: LiveShell): void {
    live.image?.destroy()
    live.marker?.destroy()
    live.blast?.destroy()
  }

  private clearShells(): void {
    this.shells.forEach((live) => this.destroyShell(live))
    this.shells = []
  }
}
