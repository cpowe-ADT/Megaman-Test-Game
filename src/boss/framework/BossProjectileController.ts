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
  speed: number
  damage: number
  angle?: number
  tint?: number
  label?: string
  direction?: 1 | -1
}

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
  private bossAttackActiveUntil = 0
  private bossWatchdogCooldownUntil = 0
  private attackFirstLogEmitted = false
  private restoreWalkAt = 0
  private pausedTrailEmitters: Phaser.GameObjects.Particles.ParticleEmitter[] = []

  constructor(private readonly options: BossProjectileControllerOptions) {}

  update(now: number, _deltaMs: number): void {
    if (this.paused || !this.loopActive || !this.options.isEncounterActive()) {
      return
    }

    if (this.restoreWalkAt > 0 && now >= this.restoreWalkAt) {
      this.restoreWalkAt = 0
      this.options.restoreWalkAnimation?.()
    }

    if (!this.options.isControllerDriven()) {
      this.maybeFireTimerLoop(now)
      return
    }

    this.maybeFireWatchdog(now)
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
    this.bossAttackActiveUntil = 0
    this.bossWatchdogCooldownUntil = 0
    this.restoreWalkAt = 0
    this.attackFirstLogEmitted = false
    this.resumeTrailEmitters()
  }

  onBossAttack(attack: AttackPattern, attackData?: any): void {
    this.options.playAttackSfx?.(String(attackData?.sfxName ?? attack?.name ?? 'ui_move'))
    if (!attack || !this.options.isEncounterActive()) {
      return
    }

    const now = this.options.getNow()
    const attackWindow = Math.max(attack.executeMs, attack.telegraph.telegraphMs, 600)
    this.bossAttackActiveUntil = now + attackWindow + 200
    this.bossWatchdogCooldownUntil = now + 300

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
    this.bossWatchdogCooldownUntil = now
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

  private maybeFireWatchdog(now: number): void {
    if (now > this.bossAttackActiveUntil) {
      return
    }

    if (now - this.lastBossBulletSpawnAt <= 1500) {
      return
    }

    if (now < this.bossWatchdogCooldownUntil) {
      return
    }

    const origin = this.options.getBossOrigin()
    const playerPosition = this.options.getPlayerPosition()
    if (!isOriginActive(origin) || !playerPosition) {
      return
    }

    const direction = playerPosition.x < origin.x ? -1 : 1
    this.spawnBossBullet(origin, undefined, {
      speed: 220,
      damage: 1,
      label: 'watchdog',
      direction
    })
    this.bossWatchdogCooldownUntil = now + 1500
    this.options.log?.('warn', '[Boss][Watchdog] forced projectile', { time: now })
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
          speed: 180,
          damage: 2,
          tint: this.options.getTrailTint()
        })
        break
      case 'arc_shards':
        this.spawnConfigurableSpread(origin, attack, attackData)
        break
      case 'ground_slam_hazard':
        this.options.spawnGroundSlamHazard(origin, attackData)
        break
      case 'dash_strike':
        this.spawnDashStrike(origin, attackData)
        break
      default:
        this.spawnBossBullet(origin, attack, { speed: 240, damage: 1 })
        break
    }
  }

  private spawnConfigurableSpread(
    origin: BossProjectileOrigin,
    attack: AttackPattern,
    attackData?: any
  ): void {
    const count = Number(attackData?.params?.count ?? 3)
    const speed = Number(attackData?.params?.projectileSpeed ?? 240)
    const spread = Number(attackData?.params?.spread ?? 0.32)
    const damage = Number(attackData?.hit?.damageAmount ?? 1)

    buildBossSpreadAngles(count, spread).forEach((angle) => {
      this.spawnBossBullet(origin, attack, { speed, damage, angle })
    })
  }

  private spawnDashStrike(origin: BossProjectileOrigin, attackData?: any): void {
    const body = this.options.getBossMovementBody()
    const playerPosition = this.options.getPlayerPosition()
    if (body && playerPosition) {
      const direction = playerPosition.x < origin.x ? -1 : 1
      body.setVelocityX(direction * Number(attackData?.params?.dashSpeed ?? 260))
    }

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

    const direction = config.direction ?? (playerPosition.x < origin.x ? -1 : 1)
    const spawnX = origin.x + 12 * direction
    const spawnY = origin.y - 6
    const attackName = attack?.name ?? config.label ?? 'unknown'
    const baseAngle = direction === -1 ? Math.PI : 0
    const travelAngle = baseAngle + (config.angle ?? 0)
    const velocityX = Math.cos(travelAngle) * config.speed
    const velocityY = Math.sin(travelAngle) * config.speed

    const bullet = this.options.projectileSystem.spawn({
      id: 'enemy_basic_shot',
      x: spawnX,
      y: spawnY,
      direction,
      speed: config.speed,
      damage: config.damage,
      tint: config.tint ?? this.options.getTrailTint(),
      velocity: { x: velocityX, y: velocityY },
      metadata: {
        attack: attackName,
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
