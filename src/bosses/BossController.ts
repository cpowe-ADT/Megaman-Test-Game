import Phaser from 'phaser'
import { BossBlueprint, AttackPattern } from './types'
import { ArenaController } from '../boss/framework/ArenaController'
import { BossBase } from '../boss/framework/BossBase'
import { BossDefinition, DamageEvent, HitResult } from '../boss/framework/types'
import { clampBossXToBounds, type MovementBounds } from '../content/stageArenaLayout'
import { toAttackPatternFromDefinition, toBossDefinition } from '../boss/framework/bossDefinitionMapper'

export interface BossControllerConfig {
  spawn: Phaser.Math.Vector2
  lockIntro?: boolean
  runtimeDefinition?: BossDefinition
  movementBounds?: MovementBounds
}

interface BossPhaseView {
  name: string
  threshold: number
}

function makePhaseName(index: number): string {
  return index <= 0 ? 'Phase 1' : `Phase ${index + 1}`
}

export class BossController extends Phaser.GameObjects.Container {
  readonly blueprint: BossBlueprint

  private readonly sprite: Phaser.GameObjects.Sprite
  private readonly atlasKey: string
  private readonly atlasFrames: string[]
  private readonly groupedAtlasFrames: Record<string, string[]>
  private readonly runtimeDefinition: BossDefinition
  private readonly bossBrain: BossBase
  private readonly arenaController: ArenaController
  private readonly movementBounds: MovementBounds

  private introLocked: boolean
  private moveDirection: -1 | 0 | 1 = 0
  private phaseView: BossPhaseView = { name: 'Phase 1', threshold: 1 }

  declare body: Phaser.Physics.Arcade.Body

  constructor(scene: Phaser.Scene, blueprint: BossBlueprint, config: BossControllerConfig) {
    super(scene, config.spawn.x, config.spawn.y)
    this.blueprint = blueprint
    this.runtimeDefinition = config.runtimeDefinition ?? toBossDefinition(blueprint)
    this.introLocked = !!config.lockIntro
    this.movementBounds = config.movementBounds ?? {
      minX: 16,
      maxX: scene.scale.width - 16
    }

    this.atlasKey = `atlas_${blueprint.id}`
    if (!scene.textures.exists(this.atlasKey)) {
      throw new Error(`[BossController] Missing required boss atlas '${this.atlasKey}'`)
    }
    this.atlasFrames = scene.textures
      .get(this.atlasKey)
      .getFrameNames()
      .filter((name) => name !== '__BASE')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    if (this.atlasFrames.length === 0) {
      throw new Error(`[BossController] Boss atlas '${this.atlasKey}' has no frames`)
    }
    this.groupedAtlasFrames = this.buildGroupedAtlasFrames()

    this.sprite = scene.add.sprite(0, 0, this.atlasKey, this.atlasFrames[0])
    this.sprite.setOrigin(blueprint.spritePlan.origin.x, blueprint.spritePlan.origin.y)
    this.add(this.sprite)
    scene.add.existing(this)

    scene.physics.add.existing(this)
    this.setSize(this.width || 32, this.height || 32)
    this.body.setAllowGravity(false)
    this.body.setCollideWorldBounds(true)

    const body = this.body
    body.setSize(blueprint.spritePlan.frame.x, blueprint.spritePlan.frame.y)
    body.setOffset(
      -blueprint.spritePlan.frame.x * this.sprite.originX,
      -blueprint.spritePlan.frame.y * (1 - this.sprite.originY)
    )

    this.arenaController = new ArenaController({
      lockDoors: () => this.scene.events.emit('arena-lock', { id: this.runtimeDefinition.boss_id }),
      unlockDoors: () => this.scene.events.emit('arena-unlock', { id: this.runtimeDefinition.boss_id }),
      startBossMusic: () => this.scene.events.emit('boss-music-start', { id: this.runtimeDefinition.boss_id }),
      stopBossMusic: () => this.scene.events.emit('boss-music-stop', { id: this.runtimeDefinition.boss_id }),
      dropReward: () =>
        this.scene.events.emit('boss-reward-drop', {
          id: this.runtimeDefinition.boss_id,
          reward: this.blueprint.weaponReward
        })
    })

    this.bossBrain = new BossBase(this.runtimeDefinition, {
      onAttackStarted: (attack) => {
        const attackPattern = this.toSceneAttackPattern(attack)
        this.scene.events.emit('boss-attack', {
          id: this.runtimeDefinition.boss_id,
          attack: attackPattern,
          attackData: attack
        })
      },
      onPhaseChanged: (phaseIndex, phase) => {
        this.phaseView = { name: makePhaseName(phaseIndex), threshold: phase.threshold }
        this.scene.events.emit('boss-phase-change', {
          id: this.runtimeDefinition.boss_id,
          phase: this.phaseView,
          phaseIndex,
          phaseData: phase
        })
      },
      onDamageApplied: (event, result) => {
        this.scene.events.emit('boss-damage', {
          id: this.runtimeDefinition.boss_id,
          event,
          result,
          hp: this.bossBrain.hpSnapshot
        })
      },
      onDied: () => {
        this.arenaController.onBossDeath()
        this.scene.events.emit('boss-defeated', {
          id: this.runtimeDefinition.boss_id,
          reward: this.blueprint.weaponReward
        })
        this.destroy()
      }
    })

    this.bossBrain.OnFightStart()
    this.phaseView = { name: makePhaseName(0), threshold: 1 }
    if (!this.introLocked) {
      this.arenaController.onIntroStart()
      this.bossBrain.unlockIntro()
    }
  }

  get currentPhase(): BossPhaseView {
    return this.phaseView
  }

  get hp(): { current: number; max: number } {
    return this.bossBrain.hpSnapshot
  }

  get isInvulnerable(): boolean {
    return this.bossBrain.state === 'HURT_INVULN' || this.bossBrain.state === 'PHASE_TRANSITION'
  }

  update(_time: number, delta: number): void {
    const playerX = (this.scene.registry.get('player_x') as number | undefined) ?? this.x
    const distance = Math.abs(playerX - this.x)

    const tick = this.bossBrain.TickAI({
      nowMs: this.scene.time.now,
      dtMs: delta,
      bossPosition: { x: this.x, y: this.y },
      playerPosition: { x: playerX, y: this.y },
      distanceToPlayer: distance,
      lineOfSight: true,
      rng: Math.random,
      phaseIndex: this.bossBrain.currentPhaseIndex,
      speedMultiplier: 1,
      thinkTimeMultiplier: 1
    })

    this.moveDirection = tick.movementDirection
    const speed = (this.runtimeDefinition.moveSpeed ?? this.blueprint.baseStats.moveSpeed) * 0.9
    this.body.setVelocityX(this.moveDirection * speed)

    // Keep movement collision-safe in the arena.
    this.x = clampBossXToBounds(this.x, this.movementBounds)

    if (this.body.velocity.x < 0) {
      this.sprite.setFlipX(true)
    } else if (this.body.velocity.x > 0) {
      this.sprite.setFlipX(false)
    }

    this.playAnimationForState()
  }

  hurt(amount: number): HitResult {
    const event: DamageEvent = {
      amount,
      type: 'normal',
      source: 'player',
      hitstopFrames: 2
    }
    return this.applyDamage(event)
  }

  applyDamage(event: DamageEvent): HitResult {
    return this.bossBrain.ApplyDamage(event)
  }

  unlockIntro(): void {
    if (!this.introLocked) {
      return
    }
    this.introLocked = false
    this.arenaController.onIntroStart()
    this.bossBrain.unlockIntro()
  }

  private toSceneAttackPattern(attack: BossDefinition['attacks'][number]): AttackPattern {
    const pattern = toAttackPatternFromDefinition(attack)

    if (attack.type === 'projectile') {
      if (attack.id.includes('spark') || attack.id.includes('shot')) {
        pattern.spawns = ['arc_shards']
      } else {
        pattern.spawns = ['slow_bullet']
      }
    }

    if (attack.type === 'hazard' || attack.type === 'slam') {
      pattern.spawns = ['short_quake']
    }

    if (attack.type === 'dash') {
      pattern.spawns = ['slow_bullet']
    }

    return pattern
  }

  private playAnimationForState(): void {
    const runtimeState = this.bossBrain.state
    const stateKey =
      runtimeState === 'ATTACKING'
        ? 'shoot'
        : runtimeState === 'MOVE_TO_RANGE'
          ? 'move'
          : runtimeState === 'HURT_INVULN'
            ? 'idle'
            : runtimeState === 'PHASE_TRANSITION'
              ? 'special'
              : 'idle'

    const animKey = `${this.blueprint.id}_${stateKey}`
    const frameRate = this.resolveFrameRate(stateKey)
    const repeat = runtimeState === 'ATTACKING' ? 0 : -1
    if (!this.scene.anims.exists(animKey)) {
      const frames = this.resolveGroupedFrames(stateKey)
      this.scene.anims.create({
        key: animKey,
        frames,
        frameRate,
        repeat
      })
    }

    this.sprite.play(animKey, true)
  }

  private buildGroupedAtlasFrames(): Record<string, string[]> {
    const grouped: Record<string, string[]> = {}
    const prefix = `${this.blueprint.id}/`
    for (const frame of this.atlasFrames) {
      if (!frame.startsWith(prefix)) {
        continue
      }
      const rest = frame.slice(prefix.length)
      const group = rest.split('/')[0]
      if (!group) {
        continue
      }
      if (!grouped[group]) {
        grouped[group] = []
      }
      grouped[group].push(frame)
    }
    Object.values(grouped).forEach((frames) => {
      frames.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
    })
    return grouped
  }

  private resolveFrameRate(stateKey: string): number {
    const animations = this.blueprint.spritePlan.animations
    const preferred = animations.find((entry) => entry.key.includes(stateKey))
    return Math.max(4, preferred?.fps ?? 8)
  }

  private resolveGroupedFrames(stateKey: string): Phaser.Types.Animations.AnimationFrame[] {
    const groupMap: Record<string, string[]> = {
      idle: this.groupedAtlasFrames.idle ?? [],
      move: this.groupedAtlasFrames.move ?? this.groupedAtlasFrames.run ?? [],
      shoot: this.groupedAtlasFrames.shoot ?? this.groupedAtlasFrames.attack ?? [],
      special: this.groupedAtlasFrames.special ?? this.groupedAtlasFrames.shoot ?? [],
    }
    const grouped = groupMap[stateKey] ?? []
    if (grouped.length > 0) {
      return grouped.map((frame) => ({ key: this.atlasKey, frame }))
    }
    return this.resolveAnimationFrames(stateKey, Math.min(4, this.atlasFrames.length))
  }

  private resolveAnimationFrames(animationKey: string, desiredCount: number): Phaser.Types.Animations.AnimationFrame[] {
    const count = Math.max(1, Math.min(desiredCount, this.atlasFrames.length))
    const slice = this.atlasFrames.slice(0, count)
    if (slice.length === 0) {
      throw new Error(
        `[BossController] Unable to resolve frames for '${animationKey}' in atlas '${this.atlasKey}'`
      )
    }

    return slice.map((frame) => ({ key: this.atlasKey, frame }))
  }
}
