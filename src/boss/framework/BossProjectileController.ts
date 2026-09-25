import Phaser from 'phaser'
import type { AttackPattern } from '../../bosses/types'
import type { ProjectileSystem } from '../../projectiles'

type BossProjectileOrigin = Phaser.GameObjects.GameObject & {
  x: number
  y: number
  active?: boolean
}

type BossProjectileControllerOptions = {
  projectileSystem: ProjectileSystem
  projectileGroup: Phaser.Physics.Arcade.Group
  getNow: () => number
  isEncounterActive: () => boolean
  isControllerDriven: () => boolean
  getPlayerPosition: () => { x: number; y: number } | null
  getBossOrigin: () => BossProjectileOrigin | null
  getBossMovementBody: () => Phaser.Physics.Arcade.Body | undefined
  getBossAttackFacing?: () => 1 | -1
  getTrailTint: () => number
  createTrailEmitter: (bullet: Phaser.Physics.Arcade.Sprite) => Phaser.GameObjects.Particles.ParticleEmitter | null
  registerProjectile?: (bullet: Phaser.Physics.Arcade.Sprite, kind: string) => void
  playAttackSfx?: (name: string) => void
  setActionLabel?: (text: string) => void
  playShootAnimation?: () => void
  restoreWalkAnimation?: () => void
  spawnGroundSlamHazard: (origin: BossProjectileOrigin, attackData?: unknown) => void
  log?: (level: 'debug' | 'info' | 'warn', message: string, payload?: unknown) => void
}

type BossBulletConfig = {
  projectileId?: string
  speed: number
  damage: number
  angle?: number
  tint?: number
  label?: string
  direction?: 1 | -1
  velocityY?: number
  scale?: number
}

type PendingBossAttack = {
  attack: AttackPattern
  attackData?: any
  startedAt: number
  executeAt: number
  direction: 1 | -1
}

/** An attack in its wind-up: the telegraph renderer draws it from `startedAt` until `executeAt`. */
export type PendingBossTelegraph = Readonly<PendingBossAttack>

export function buildBossSpreadAngles(count: number, spread: number): number[] {
  const clampedCount = Math.max(1, Math.min(7, Math.round(count)))
  if (clampedCount === 1) {
    return [0]
  }

  const steps = clampedCount - 1
  return Array.from({ length: clampedCount }, (_, index) => {
    const t = index / steps
    return -spread / 2 + t * spread
  })
}

/** Boss shots leave this far above the boss's feet: the hero's chest height when both stand on one floor. */
export const BOSS_MUZZLE_ABOVE_FEET_PX = 16

/**
 * Muzzle height for a boss shot. Boss containers stand on their feet (origin y = feet), so the old
 * `origin.y - 6` put a 22px shot across the floor and the bullet-vs-platform collider recycled every
 * boss bullet on its first step. With a movement body the muzzle sits BOSS_MUZZLE_ABOVE_FEET_PX above
 * its bottom (never above its top); without one, that far above the origin.
 */
export function resolveBossMuzzleY(originY: number, body?: { top: number; bottom: number } | null): number {
  if (!body || !(body.bottom > body.top)) {
    return originY - BOSS_MUZZLE_ABOVE_FEET_PX
  }
  return Math.max(body.top + 6, body.bottom - BOSS_MUZZLE_ABOVE_FEET_PX)
}

function isOriginActive(origin: BossProjectileOrigin | null): origin is BossProjectileOrigin {
  if (!origin) {
    return false
  }

  if ('active' in origin && origin.active === false) {
    return false
  }

  return true
}

export class BossProjectileController {
  private loopActive = false
  private paused = false
  private nextTimerShotAt = 0
  private lastBossBulletSpawnAt = 0
  private attackFirstLogEmitted = false
  private restoreWalkAt = 0
  private pausedTrailEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []
  private pendingAttacks: PendingBossAttack[] = []
  private lockedAttackDirection: 1 | -1 | null = null

  constructor(private readonly options: BossProjectileControllerOptions) {}

  update(now: number, _deltaMs: number): void {
    if (this.paused || !this.loopActive || !this.options.isEncounterActive()) {
      return
    }

    if (this.restoreWalkAt > 0 && now >= this.restoreWalkAt) {
      this.restoreWalkAt = 0
      this.options.restoreWalkAnimation?.()
    }


    this.executePendingAttacks(now)

    if (!this.options.isControllerDriven()) {
      this.maybeFireTimerLoop(now)
    }
  }

  /** Attacks between their event and their execution, oldest first (prompt 07 phase 7.1 telegraphs). */
  getPendingTelegraphs(): readonly PendingBossTelegraph[] {
    return this.pendingAttacks
  }

  startLoop(): void {
    const now = this.options.getNow()
    this.loopActive = true
    this.nextTimerShotAt = now + 1200
    this.restoreWalkAt = 0
  }

  stop(): void {
    this.loopActive = false
    this.paused = false
    this.nextTimerShotAt = 0
    this.lastBossBulletSpawnAt = 0
    this.restoreWalkAt = 0
    this.attackFirstLogEmitted = false
    this.pendingAttacks = []
    this.lockedAttackDirection = null
    this.resumeTrailEmitters()
  }

  onBossAttack(attack: AttackPattern, attackData?: any): void {
    this.options.playAttackSfx?.(String(attackData?.sfxName ?? attack?.name ?? 'ui_move'))
    if (!attack || !this.options.isEncounterActive()) {
      return
    }

    const now = this.options.getNow()

    if (!this.attackFirstLogEmitted) {
      this.options.log?.('info', '[Boss] first attack event received', { attack: attack.name })
      this.attackFirstLogEmitted = true
    }

    this.options.log?.('debug', '[Boss][Event] attack', { time: now, attack })
    this.options.setActionLabel?.(`ACTION • ${attack.name.toUpperCase()}`)

    const origin = this.options.getBossOrigin()
    if (!isOriginActive(origin)) {
      return
    }

    const playerPosition = this.options.getPlayerPosition()
    const direction =
      this.options.getBossAttackFacing?.() ??
      (playerPosition && playerPosition.x < origin.x ? -1 : 1)
    this.pendingAttacks.push({
      attack,
      attackData,
      startedAt: now,
      executeAt: now + Math.max(0, attack.telegraph.telegraphMs),
      direction
    })
  }

  private executePendingAttacks(now: number): void {
    if (this.pendingAttacks.length === 0) {
      return
    }
    const due = this.pendingAttacks.filter((entry) => entry.executeAt <= now)
    this.pendingAttacks = this.pendingAttacks.filter((entry) => entry.executeAt > now)
    due.forEach((entry) => this.executeBossAttack(entry))
  }

  private executeBossAttack(pending: PendingBossAttack): void {
    const { attack, attackData, direction } = pending
    const origin = this.options.getBossOrigin()
    if (!isOriginActive(origin) || !this.options.isEncounterActive()) {
      return
    }
    this.lockedAttackDirection = direction

    const isProjectileAttack =
      attack.state === 'shoot' ||
      attack.state === 'summon' ||
      attackData?.type === 'hazard' ||
      attackData?.type === 'dash' ||
      attackData?.type === 'melee'
    if (!isProjectileAttack) {
      return
    }

    const sampleAttackSpawns: Record<string, string[]> = {
      shock_punch: ['melee_punch'],
      spark_shot: ['arc_shards'],
      ground_slam: ['ground_slam_hazard'],
      dash_strike: ['dash_strike']
    }

    const attackId = String(attackData?.id ?? '')
    const spawnList =
      sampleAttackSpawns[attackId] ??
      (attack.spawns && attack.spawns.length > 0 ? attack.spawns : attack.state === 'shoot' ? ['slow_bullet'] : [])

    this.options.log?.('debug', '[Boss][Attack] execute', {
      attack: attack.name,
      origin: { x: origin.x, y: origin.y },
      spawns: spawnList
    })

    spawnList.forEach((spawn) => this.spawnBossProjectile(spawn, attack, origin, attackData))
  }

  onPauseChanged(paused: boolean): void {
    if (paused === this.paused) {
      return
    }

    this.paused = paused
    if (paused) {
      this.pauseTrailEmitters()
      return
    }

    const now = this.options.getNow()
    this.resumeTrailEmitters()
    this.lastBossBulletSpawnAt = now
    if (this.loopActive && !this.options.isControllerDriven()) {
      this.nextTimerShotAt = now + 200
    }
  }

  private maybeFireTimerLoop(now: number): void {
    if (now < this.nextTimerShotAt) {
      return
    }

    const origin = this.options.getBossOrigin()
    const playerPosition = this.options.getPlayerPosition()
    if (!isOriginActive(origin) || !playerPosition) {
      this.nextTimerShotAt = now + 200
      return
    }

    const direction = playerPosition.x < origin.x ? -1 : 1
    this.spawnBossBullet(origin, undefined, {
      speed: 260,
      damage: 1,
      label: 'timer-loop',
      direction
    })
    this.nextTimerShotAt = now + 1200
  }

  private spawnBossProjectile(
    id: string,
    attack: AttackPattern,
    origin: BossProjectileOrigin,
    attackData?: any
  ): void {
    switch (id) {
      case 'melee_punch':
        this.spawnBossBullet(origin, attack, {
          speed: 80,
          damage: attackData?.hit?.damageAmount ?? 2
        })
        break
      case 'slow_bullet':
        this.spawnBossBullet(origin, attack, { speed: 220, damage: 1 })
        break
      case 'fire_orb':
        this.spawnBossBullet(origin, attack, {
          projectileId: 'boss_fire_orb',
          speed: 180,
          damage: 2,
          velocityY: -170,
          scale: 1.7,
          tint: this.options.getTrailTint()
        })
        break
      case 'arc_shards':
      case 'flame_cone':
      case 'freeze_cone':
      case 'dart_spread':
      case 'boulder_radial':
        this.spawnConfigurableSpread(origin, attack, attackData)
        break
      case 'ground_slam_hazard':
      case 'short_quake':
      case 'ground_shockwave':
      case 'burn_puddle':
      case 'charge_mine':
      case 'splash_pillar':
      case 'stone_pillar':
      case 'magnet_node':
      case 'acid_trail':
      case 'vapor_pod':
      case 'tornado_pillar':
      case 'icicle_fall':
        this.options.spawnGroundSlamHazard(origin, attackData)
        break
      case 'dash_strike':
        this.spawnDashStrike(origin, attackData)
        break
      case 'wind_hitbox':
        this.spawnBossBullet(origin, attack, {
          speed: Number(attackData?.params?.dashSpeed ?? 240),
          damage: Number(attackData?.hit?.damageAmount ?? 2)
        })
        break
      case 'water_lance':
        this.spawnBossBullet(origin, attack, {
          projectileId: 'boss_water_lance',
          speed: Number(attackData?.params?.projectileSpeed ?? 285),
          damage: Number(attackData?.hit?.damageAmount ?? 1),
          scale: 1.45,
          tint: this.options.getTrailTint()
        })
        break
      case 'vertical_bolt':
      case 'static_orb':
        this.spawnBossBullet(origin, attack, {
          projectileId: 'boss_static_orb',
          speed: Number(attackData?.params?.projectileSpeed ?? 220),
          damage: Number(attackData?.hit?.damageAmount ?? 1),
          scale: 1.4,
          tint: this.options.getTrailTint()
        })
        break
      case 'mag_disc':
        this.spawnBossBullet(origin, attack, {
          projectileId: 'boss_mag_disc',
          speed: Number(attackData?.params?.projectileSpeed ?? 250),
          damage: Number(attackData?.hit?.damageAmount ?? 2),
          scale: 1.45,
          tint: this.options.getTrailTint()
        })
        break
      case 'acid_glob':
        this.spawnBossBullet(origin, attack, {
          projectileId: 'boss_acid_glob',
          speed: Number(attackData?.params?.projectileSpeed ?? 165),
          damage: Number(attackData?.hit?.damageAmount ?? 2),
          velocityY: -160,
          scale: 1.55,
          tint: this.options.getTrailTint()
        })
        break
      default:
        this.spawnBossBullet(origin, attack, {
          speed: Number(attackData?.params?.projectileSpeed ?? 240),
          damage: Number(attackData?.hit?.damageAmount ?? 1)
        })
        break
    }
  }

  private spawnConfigurableSpread(
    origin: BossProjectileOrigin,
    attack: AttackPattern,
    attackData?: any
  ): void {
    const spawnId = String(attack?.spawns?.find((id) =>
      ['arc_shards', 'flame_cone', 'freeze_cone', 'dart_spread', 'boulder_radial'].includes(id)
    ) ?? '')
    const count = spawnId === 'flame_cone' ? 5 : Number(attackData?.params?.count ?? 3)
    const speed = spawnId === 'flame_cone' ? 190 : Number(attackData?.params?.projectileSpeed ?? 240)
    const spread = spawnId === 'flame_cone' ? 0.24 : Number(attackData?.params?.spread ?? 0.32)
    const damage = Number(attackData?.hit?.damageAmount ?? 1)

    buildBossSpreadAngles(count, spread).forEach((angle) => {
      this.spawnBossBullet(origin, attack, {
        projectileId: spawnId === 'arc_shards' ? 'boss_arc_shard' : undefined,
        speed,
        damage,
        angle,
        scale: spawnId === 'flame_cone' ? 1.35 : 1.2
      })
    })
  }

  private spawnDashStrike(origin: BossProjectileOrigin, attackData?: any): void {
    this.spawnBossBullet(origin, undefined, {
      speed: Number(attackData?.params?.dashSpeed ?? 240),
      damage: Number(attackData?.hit?.damageAmount ?? 2)
    })
  }

  private spawnBossBullet(
    origin: BossProjectileOrigin,
    attack: AttackPattern | undefined,
    config: BossBulletConfig
  ): Phaser.Physics.Arcade.Sprite | null {
    const playerPosition = this.options.getPlayerPosition()
    if (!playerPosition) {
      return null
    }

    const direction = config.direction ?? this.lockedAttackDirection ?? (playerPosition.x < origin.x ? -1 : 1)
    const spawnX = origin.x + 12 * direction
    const bossBody = this.options.getBossMovementBody()
    const spawnY = resolveBossMuzzleY(origin.y, bossBody)
    const attackName = attack?.name ?? config.label ?? 'unknown'
    const baseAngle = direction === -1 ? Math.PI : 0
    const travelAngle = baseAngle + (config.angle ?? 0)
    const velocityX = Math.cos(travelAngle) * config.speed
    const velocityY = config.velocityY ?? Math.sin(travelAngle) * config.speed

    const bullet = this.options.projectileSystem.spawn({
      id: config.projectileId ?? 'enemy_basic_shot',
      x: spawnX,
      y: spawnY,
      direction,
      speed: config.speed,
      damage: config.damage,
      scale: config.scale,
      tint: config.tint ?? this.options.getTrailTint(),
      velocity: { x: velocityX, y: velocityY },
      clearFloorY: bossBody && bossBody.bottom > bossBody.top ? bossBody.bottom : origin.y,
      metadata: {
        attack: attackName,
        sourceType: 'boss_projectile',
        sourceId: attackName,
        ignoreBossUntil: this.options.getNow() + 120
      }
    })

    if (!bullet) {
      this.options.log?.('warn', '[Boss][Bullet] pool exhausted', {
        attack: attackName,
        active: this.options.projectileGroup.getTotalUsed(),
        size: this.options.projectileGroup.getLength()
      })
      return null
    }

    this.options.playShootAnimation?.()
    this.restoreWalkAt = this.options.getNow() + 260

    const existingEmitter = (bullet as any).__trailEmitter as Phaser.GameObjects.Particles.ParticleEmitter | undefined
    if (existingEmitter) {
      existingEmitter.stop?.()
      existingEmitter.destroy?.()
      ;(bullet as any).__trailEmitter = null
    }

    const emitter = this.options.createTrailEmitter(bullet)
    if (emitter) {
      ;(bullet as any).__trailEmitter = emitter
    }

    this.lastBossBulletSpawnAt = this.options.getNow()
    this.options.log?.('info', '[Boss][Bullet] spawn', {
      attack: attackName,
      source: attack ? 'controller' : config.label ?? 'timer',
      time: this.lastBossBulletSpawnAt
    })
    this.options.registerProjectile?.(bullet, 'bullet.enemy')
    return bullet
  }

  private pauseTrailEmitters(): void {
    this.pausedTrailEmitters = []
    this.options.projectileGroup.children.iterate((child) => {
      const emitter = (child as any)?.__trailEmitter as Phaser.GameObjects.Particles.ParticleEmitter | undefined
      if (!emitter) {
        return false
      }

      const emitterAny = emitter as any
      if (typeof emitterAny.pause === 'function' && (emitterAny.on ?? true)) {
        emitterAny.pause()
        this.pausedTrailEmitters.push(emitter)
      }
      return false
    })
  }

  private resumeTrailEmitters(): void {
    if (this.pausedTrailEmitters.length === 0) {
      return
    }

    this.pausedTrailEmitters.forEach((emitter) => {
      const emitterAny = emitter as any
      if (typeof emitterAny.resume === 'function') {
        emitterAny.resume()
      } else if (typeof emitterAny.start === 'function') {
        emitterAny.start()
      }
    })
    this.pausedTrailEmitters = []
  }
}
