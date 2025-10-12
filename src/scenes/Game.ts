import Phaser from 'phaser'
import { BossController } from '../bosses/BossController'
import { AttackPattern, BossId } from '../bosses/types'
import { getBossById } from '../bosses/roster'
import { DEBUG_UI } from '../config/debug'
import InputActions from '../input/InputActions'
import { DebugOverlay } from '../ui/DebugOverlay'
import { HUD } from '../ui/HUD'
import { JumpController } from './game/JumpController'
import { evaluatePauseState } from './game/pauseLogic'
import PauseScene from './PauseScene'
import WinScene from './WinScene'
import GameOverScene from './GameOverScene'

const JUMP_VELOCITY = -420

interface GameData {
  bossId: BossId
}

type ActionKeyMap = {
  dash: Phaser.Input.Keyboard.Key
  shoot: Phaser.Input.Keyboard.Key
  saber: Phaser.Input.Keyboard.Key
  cycleForward: Phaser.Input.Keyboard.Key
  shoulderPrev: Phaser.Input.Keyboard.Key
  shoulderNext: Phaser.Input.Keyboard.Key
  modifier: Phaser.Input.Keyboard.Key
}

type StageConfig = {
  id: string
  allowFallOff: boolean
  leftWall: boolean
  rightWall: boolean
  midPlatforms: { x: number; y: number; w: number }[]
}

export class Game extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite
  private actionKeys!: ActionKeyMap
  private playerBullets!: Phaser.Physics.Arcade.Group
  private bossBullets!: Phaser.Physics.Arcade.Group
  private hazards!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private stagePlatforms?: Phaser.Physics.Arcade.StaticGroup
  private bossController?: BossController
  private bossLabel!: Phaser.GameObjects.Text
  private weaponLabel!: Phaser.GameObjects.Text
  private phaseLabel!: Phaser.GameObjects.Text
  // ======================= [BOSS-HITBOX-BEGIN]
  private bossBody?: Phaser.Physics.Arcade.Sprite
  private bossArt?: Phaser.GameObjects.Sprite
  private bossTarget?: Phaser.Physics.Arcade.Sprite
  private _bossSpawned = false
  private victoryTriggered = false
  private gameOverTriggered = false

  // [REGION: BOSS-FIRE - BEGIN]
  private bossFireTimer?: Phaser.Time.TimerEvent
  private bossFireTimerMissingLogged = false
  private bossBulletHud?: Phaser.GameObjects.Text
  private devHudEnabled = false
  private lastBossBulletSpawnAt = 0
  private lastBossAttackAt = 0
  private bossAttackActiveUntil = 0
  private bossWatchdogCooldownUntil = 0
  private bossAttackFirstLogEmitted = false
  private bossBulletFirstLogEmitted = false

  private startBossFireLoop(): void {
    this.bossFireTimer?.remove(false)
    this.bossFireTimer = undefined
    this.bossFireTimerMissingLogged = false

    if (this.bossController) {
      return
    }

    const shooter = this.bossBody ?? this.bossTarget
    if (!shooter || !this.bossBullets) {
      return
    }

    this.bossFireTimer = this.time.addEvent({
      delay: 1200,
      loop: true,
      callbackScope: this,
      callback: () => {
        if (!shooter.active || !this.player?.active) {
          return
        }
        this.spawnBossBullet(shooter, undefined, {
          speed: 260,
          damage: 1,
          label: 'legacy-timer'
        })
      }
    })
  }

  private executeBossAttack(attack: AttackPattern): void {
    const origin = this.bossTarget ?? this.bossBody
    if (!origin || !this.bossBullets) {
      return
    }

    const isProjectileAttack = attack.state === 'shoot' || attack.state === 'summon'
    if (!isProjectileAttack) {
      return
    }

    const spawnList =
      attack.spawns && attack.spawns.length > 0 ? attack.spawns : attack.state === 'shoot' ? ['slow_bullet'] : []

    spawnList.forEach((spawn) => this.spawnBossProjectile(spawn, attack, origin))
  }

  private spawnBossProjectile(
    id: string,
    attack: AttackPattern,
    origin: Phaser.GameObjects.GameObject
  ): void {
    switch (id) {
      case 'slow_bullet':
        this.spawnBossBullet(origin, attack, { speed: 220, damage: 1 })
        break
      case 'fire_orb':
        this.spawnBossBullet(origin, attack, {
          speed: 180,
          damage: 2,
          tint: this.bossController?.blueprint.theme.accent
        })
        break
      case 'arc_shards':
        this.spawnBossBulletSpread(origin, attack, [
          { speed: 240, damage: 1, angle: -0.22 },
          { speed: 240, damage: 1, angle: 0 },
          { speed: 240, damage: 1, angle: 0.22 }
        ])
        break
      default:
        this.spawnBossBullet(origin, attack, { speed: 240, damage: 1 })
        break
    }
  }

  private spawnBossBulletSpread(
    origin: Phaser.GameObjects.GameObject,
    attack: AttackPattern,
    configs: { speed: number; damage: number; angle?: number; tint?: number }[]
  ): void {
    configs.forEach((cfg) => this.spawnBossBullet(origin, attack, cfg))
  }

  private spawnBossBullet(
    origin: Phaser.GameObjects.GameObject,
    attack: AttackPattern | undefined,
    config: {
      speed: number
      damage: number
      angle?: number
      tint?: number
      label?: string
      direction?: number
    }
  ): void {
    if (!this.bossBullets) {
      return
    }

    const direction =
      config.direction ?? (this.player && this.player.x < origin.x ? -1 : 1) ?? 1
    const spawnX = origin.x + 12 * direction
    const spawnY = origin.y - 6

    const bullet = this.bossBullets.get(spawnX, spawnY, 'bossBullet') as
      | Phaser.Physics.Arcade.Sprite
      | null
    if (!bullet) {
      const attackName = attack?.name ?? config.label ?? 'unknown'
      console.warn('[Boss] boss bullet pool exhausted', { attack: attackName })
      return
    }

    bullet.setActive(true).setVisible(true)
    bullet.setDepth(1000)
    bullet.setAlpha(1)
    bullet.setPosition(spawnX, spawnY)
    bullet.setDataEnabled()
    bullet.data?.set('owner', 'enemy')
    bullet.data?.set('damage', config.damage)
    bullet.data?.set('attack', attack?.name ?? config.label ?? 'unknown')
    bullet.data?.set('spawnedAt', this.time.now)
    bullet.data?.set('ignoreBossUntil', this.time.now + 120)

    this.styleBulletForOwner(bullet, 'enemy')

    const baseAngle = direction === -1 ? Math.PI : 0
    const travel = new Phaser.Math.Vector2(1, 0).setAngle(baseAngle + (config.angle ?? 0))
    travel.scale(config.speed)

    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.enable = true
      body.allowGravity = false
      body.setCollideWorldBounds(true)
      body.onWorldBounds = true
      body.reset(spawnX, spawnY)
      body.setVelocity(travel.x, travel.y)
    } else {
      bullet.setVelocity(travel.x, travel.y)
    }

    const tint = config.tint ?? this.bossController?.blueprint.theme.trail ?? 0x55ccff
    const anyBullet = bullet as any
    anyBullet.setTint?.(tint)

    const bossArt = this.bossArt
    if (bossArt) {
      bossArt.play('boss_shoot', true)
      this.time.delayedCall(260, () => {
        if (bossArt.anims) {
          bossArt.play('boss_walk', true)
        }
      })
    }

    const existingEmitter = (bullet as any).__trailEmitter
    if (existingEmitter && typeof existingEmitter.stop === 'function') {
      existingEmitter.stop()
      ;(bullet as any).__trailEmitter = null
    }

    const trail = (this as any)
      ._enemyTrail as Phaser.GameObjects.Particles.ParticleEmitterManager | undefined
    if (trail) {
      const emitter = trail.createEmitter({
        lifespan: 180,
        speed: 0,
        quantity: 1,
        scale: { start: 0.8, end: 0 },
        alpha: { start: 0.7, end: 0 },
        follow: bullet
      })
      ;(bullet as any).__trailEmitter = emitter
    }

    this.noteBossBulletSpawn(attack?.name ?? config.label ?? 'unknown', attack ? 'controller' : 'legacy')
    this.devRegister(bullet, 'bullet.enemy')
  }
  
  private noteBossBulletSpawn(attackName: string, source: 'controller' | 'legacy'): void {
    const now = this.time.now
    this.lastBossBulletSpawnAt = now
    if (!this.bossBulletFirstLogEmitted) {
      console.info('[Boss] first bullet spawned', { attack: attackName, source })
      this.bossBulletFirstLogEmitted = true
    }
    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      console.info('[Boss][Bullet] spawn', { attack: attackName, source, time: now })
    }
  }

  private handleBossAttackEvent(event: { attack: AttackPattern }): void {
    const { attack } = event
    if (!attack) {
      return
    }

    const now = this.time.now
    this.lastBossAttackAt = now
    const attackWindow = Math.max(attack.executeMs, attack.telegraph.telegraphMs, 600)
    this.bossAttackActiveUntil = now + attackWindow + 200
    this.bossWatchdogCooldownUntil = now + 300

    if (!this.bossAttackFirstLogEmitted) {
      console.info('[Boss] first attack event received', { attack: attack.name })
      this.bossAttackFirstLogEmitted = true
    }

    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      console.info('[Boss][Event] attack', { time: now, attack })
    }

    if (this.phaseLabel) {
      this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}\nACTION • ${attack.name.toUpperCase()}`)
    }

    this.executeBossAttack(attack)
  }

  private executeBossAttack(attack: AttackPattern): void {
    const origin = this.bossTarget ?? this.bossBody
    if (!origin || !this.bullets) {
      return
    }

    const isProjectileAttack = attack.state === 'shoot' || attack.state === 'summon'
    if (!isProjectileAttack) {
      return
    }

    const spawnList =
      attack.spawns && attack.spawns.length > 0 ? attack.spawns : attack.state === 'shoot' ? ['slow_bullet'] : []

    spawnList.forEach((spawn) => this.spawnBossProjectile(spawn, attack, origin))
  }

  private spawnBossProjectile(
    id: string,
    attack: AttackPattern,
    origin: Phaser.GameObjects.GameObject
  ): void {
    switch (id) {
      case 'slow_bullet':
        this.spawnBossBullet(origin, attack, { speed: 220, damage: 1 })
        break
      case 'fire_orb':
        this.spawnBossBullet(origin, attack, {
          speed: 180,
          damage: 2,
          tint: this.bossController?.blueprint.theme.accent
        })
        break
      case 'arc_shards':
        this.spawnBossBulletSpread(origin, attack, [
          { speed: 240, damage: 1, angle: -0.22 },
          { speed: 240, damage: 1, angle: 0 },
          { speed: 240, damage: 1, angle: 0.22 }
        ])
        break
      default:
        this.spawnBossBullet(origin, attack, { speed: 240, damage: 1 })
        break
    }
  }

  private spawnBossBulletSpread(
    origin: Phaser.GameObjects.GameObject,
    attack: AttackPattern,
    configs: { speed: number; damage: number; angle?: number; tint?: number }[]
  ): void {
    configs.forEach((cfg) => this.spawnBossBullet(origin, attack, cfg))
  }

  private spawnBossBullet(
    origin: Phaser.GameObjects.GameObject,
    attack: AttackPattern,
    config: { speed: number; damage: number; angle?: number; tint?: number }
  ): void {
    if (!this.bullets) {
      return
    }

    const direction = this.player && this.player.x < origin.x ? -1 : 1
    const spawnX = origin.x + 12 * direction
    const spawnY = origin.y - 6

    const bullet = this.bullets.get(spawnX, spawnY, 'bullet_enemy') as
      | Phaser.Physics.Arcade.Sprite
      | null
    if (!bullet) {
      console.warn('[Boss] enemy bullet pool exhausted', { attack: attack.name })
      return
    }

    bullet.setActive(true).setVisible(true)
    bullet.setDepth(2)
    bullet.setPosition(spawnX, spawnY)
    bullet.setDataEnabled()
    bullet.data?.set('owner', 'enemy')
    bullet.data?.set('damage', config.damage)
    bullet.data?.set('attack', attack.name)

    const tint = config.tint ?? this.bossController?.blueprint.theme.trail ?? 0x55ccff
    const anyBullet = bullet as any
    anyBullet.setTint?.(tint)
    anyBullet.setBlendMode?.(Phaser.BlendModes.ADD)

    const baseAngle = direction === -1 ? Math.PI : 0
    const travel = new Phaser.Math.Vector2(1, 0).setAngle(baseAngle + (config.angle ?? 0))
    travel.scale(config.speed)

    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.enable = true
      body.allowGravity = false
      body.setCollideWorldBounds(true)
      body.reset(spawnX, spawnY)
      body.setVelocity(travel.x, travel.y)
      body.onWorldBounds = true
    } else {
      bullet.setVelocity(travel.x, travel.y)
    }

    this.devRegister(bullet, 'bullet.enemy')
  }
  // [REGION: BOSS-FIRE - END]

  private rearmBossFireTimer(reason: string): void {
    if (this.bossController) {
      return
    }

    const shooter = this.bossBody ?? this.bossTarget
    if (!shooter?.active || !this.bossBullets) {
      return
    }

    const prevTimer = this.bossFireTimer
    this.startBossFireLoop()
    if (this.bossFireTimer) {
      console.info(`[Boss] fire timer re-armed (${reason})`)
    } else if (!prevTimer) {
      this.bossFireTimerMissingLogged = false
    }
  }

  private onSceneWake(): void {
    this.rearmBossFireTimer('scene wake')
  }

  private spawnBossOnce(cb: () => void): void {
    if (this._bossSpawned) {
      return
    }

    this._bossSpawned = true
    cb()
    this.syncBossArt()
  }

  private syncBossArt(): void {
    if (!this.bossArt) {
      return
    }

    const source = (this.bossController ? this.bossTarget : this.bossBody) ?? this.bossBody
    if (!source) {
      return
    }

    this.bossArt.setPosition(source.x, source.y)

    const body = source.body as Phaser.Physics.Arcade.Body | undefined
    if (body && body.velocity.x !== 0) {
      this.bossArt.setFlipX(body.velocity.x < 0)
    }
  }
  // ======================= [BOSS-HITBOX-END]
  private hud?: HUD
  private isChargingShot = false
  private chargeStartedAt = 0
  private currentWeaponIndex = 0
  private readonly weapons = ['Buster', 'Fire', 'Aqua', 'Elec']
  private dashActive = false
  private dashTimer = 0
  private dashCooldownTimer = 0
  private readonly dashDuration = 140
  private readonly dashCooldown = 420
  private saberComboStep = 0
  private saberComboTimer = 0
  private readonly saberComboWindow = 320
  private facing: 1 | -1 = 1
  private usingSlideHitbox = false
  private slideUntil = 0
  private readonly slideDuration = 260
  private currentPhaseName = ''
  private animationLockUntil = 0
  // [REGION: CHARGE-AURA - BEGIN]
  private chargePM!: Phaser.GameObjects.Particles.ParticleEmitterManager
  private chargeEmitter?: Phaser.GameObjects.Particles.ParticleEmitter
  private charging = false
  private fullyCharged = false
  // [REGION: CHARGE-AURA - END]
  private debugOverlay?: DebugOverlay
  private readonly jumpController = new JumpController(JUMP_VELOCITY)
  private debugToggleHandler?: () => void
  private preventScrollHandler?: (event: KeyboardEvent) => void
  private pauseOverlay?: Phaser.GameObjects.Container
  private paused = false
  private playerMaxHp = 0
  private playerHp = 0
  private weaponEnergy = { current: 28, max: 28 }
  private playerLives = 0
  private respawnPoint?: Phaser.Math.Vector2
  private bossHp?: { current: number; max: number }
  private bossName?: string
  private nextBossShot = 0
  private scaleResizeHandler?: Phaser.Types.Core.ScaleEventCallback
  private _hitsInstalled = false
  private _devOn = true
  private _devInitOnce = false
  private _devPanel!: Phaser.GameObjects.Text
  private _devGfx!: Phaser.GameObjects.Graphics
  private _devTick = 0
  private _registry = new Map<number, { kind: string; ref: any; label: Phaser.GameObjects.Text }>()
  private _eid = 1
  // ======================= [DEV-UX-BEGIN]
  private readonly _dev = {
    on: true,
    initOnce: false,
    tick: 0,
    panel: undefined as Phaser.GameObjects.Text | undefined,
    gfx: undefined as Phaser.GameObjects.Graphics | undefined,
    entries: new Map<
      number,
      {
        kind: string
        ref: (Phaser.GameObjects.GameObject & { body?: Phaser.Physics.Arcade.Body }) | undefined
        label: Phaser.GameObjects.Text
      }
    >(),
    nextId: 1
  }
  // ======================= [DEV-UX-END]

  // [REGION: STAGE-BUILDER - BEGIN]
  private readonly stageConfigs: Record<string, StageConfig> = {
    metal: {
      id: 'metal',
      allowFallOff: false,
      leftWall: true,
      rightWall: true,
      midPlatforms: [
        { x: 160, y: 170, w: 60 },
        { x: 220, y: 130, w: 60 }
      ]
    },
    water: {
      id: 'water',
      allowFallOff: true,
      leftWall: false,
      rightWall: false,
      midPlatforms: [
        { x: 160, y: 170, w: 60 },
        { x: 160, y: 130, w: 60 },
        { x: 230, y: 150, w: 40 }
      ]
    },
    fire: {
      id: 'fire',
      allowFallOff: false,
      leftWall: true,
      rightWall: false,
      midPlatforms: [{ x: 200, y: 160, w: 50 }]
    }
  }

  private buildStage(stageId: string): void {
    const cfg = this.stageConfigs[stageId] ?? this.stageConfigs.metal
    const { width, height } = this.scale

    this.physics.world.setBounds(0, 0, width, height, true, cfg.leftWall, cfg.rightWall, true)
    this.physics.world.setBoundsCollision(cfg.leftWall, cfg.rightWall, true, !cfg.allowFallOff)

    this.stagePlatforms?.clear(true, true)
    this.stagePlatforms?.destroy()
    this.stagePlatforms = this.physics.add.staticGroup()

    cfg.midPlatforms.forEach((p) => {
      const rect = this.add.rectangle(p.x, p.y, p.w, 8, 0x33404f)
      this.physics.add.existing(rect, true)
      const body = rect.body as Phaser.Physics.Arcade.StaticBody | undefined
      body?.updateFromGameObject()
      this.stagePlatforms?.add(rect)
    })

    if (this.player) {
      this.physics.add.collider(this.player, this.stagePlatforms)
    }
    if (this.enemies) {
      this.physics.add.collider(this.enemies, this.stagePlatforms)
    }
    if (this.bossBody) {
      this.physics.add.collider(this.bossBody, this.stagePlatforms)
    }
    if (this.bossTarget && this.bossTarget !== this.bossBody) {
      this.physics.add.collider(this.bossTarget, this.stagePlatforms)
    }
  }
  // [REGION: STAGE-BUILDER - END]

  private readonly handleWorldBounds = (body: Phaser.Physics.Arcade.Body) => {
    const sprite = body.gameObject as Phaser.Physics.Arcade.Sprite | null
    if (!sprite) {
      return
    }
    if (this.playerBullets?.contains(sprite) || this.bossBullets?.contains(sprite)) {
      this.recycleBullet(sprite, undefined)
    }
  }

  constructor() {
    super('Game')
  }

  // ======================= [OVERLAPS-BEGIN]
  private bossHitWire?: Phaser.Physics.Arcade.Collider
  private playerHitWire?: Phaser.Physics.Arcade.Collider

  private installHitWires(): void {
    if (!this.physics) {
      return
    }

    this.bossHitWire?.destroy()
    this.playerHitWire?.destroy()
    this.bossHitWire = undefined
    this.playerHitWire = undefined

    const target = this.bossTarget
    if (target) {
      const body = target.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = true
        body.allowGravity = body.allowGravity ?? false
      }
      target.setDataEnabled?.()
      if (target.data?.get('maxHp') == null) target.data?.set('maxHp', 20)
      if (target.data?.get('hp') == null) target.data?.set('hp', target.data?.get('maxHp') ?? 20)

      if (this.playerBullets) {
        this.bossHitWire = this.physics.add.overlap(
          this.playerBullets,
          target,
          (a, b) => this.handlePlayerBulletHitsBoss(a, b, target),
          undefined,
          this
        )
      }
    }

    if (this.player && this.bossBullets) {
      this.playerHitWire = this.physics.add.overlap(
        this.player,
        this.bossBullets,
        (playerObj, bulletObj) => this.handleEnemyBulletHitsPlayer(playerObj, bulletObj),
        undefined,
        this
      )
    }

    this._hitsInstalled = true
  }

  private handlePlayerBulletHitsBoss(
    objA: Phaser.GameObjects.GameObject,
    objB: Phaser.GameObjects.GameObject,
    target: Phaser.Physics.Arcade.Sprite
  ): void {
    const bullet = this.asDynSprite?.(objA) || this.asDynSprite?.(objB)
    if (!bullet) {
      return
    }

    const owner = bullet.data?.get?.('owner')
    if (owner !== 'player') {
      this.devLogOverlap?.('PB->B', bullet, target, false, `owner=${owner}`)
      return
    }

    if (!target.body?.enable || !target.active) {
      this.devLogOverlap?.('PB->B', bullet, target, false, 'target inactive/body disabled')
      return
    }

    target.setDataEnabled?.()
    const dmg = (bullet.data?.get?.('damage') as number | undefined) ?? 1
    const cur = (target.data?.get?.('hp') ?? target.data?.get?.('maxHp') ?? 20) as number
    const max = (target.data?.get?.('maxHp') ?? Math.max(20, cur)) as number
    const next = Math.max(0, cur - dmg)
    target.data?.set?.('hp', next)
    target.data?.set?.('maxHp', max)
    this.bossHp = { current: next, max }
    this.hud?.updateBossHp(next, max)
    this.events?.emit('updateBossHP')
    this.tweens?.add({ targets: target, alpha: 0.25, yoyo: true, duration: 60 })

    if (next <= 0) {
      ;(target as any).disableBody?.(true, true) ?? target.setActive(false).setVisible(false)
      if (!this.bossController) {
        this.events.emit('boss-defeated', {
          reward: { displayName: 'FROST SLASH' }
        })
      }
      this.onBossDefeated()
    }

    if (this.bossController) {
      this.bossController.hurt(dmg)
    }

    this.devLogOverlap?.('PB->B', bullet, target, true, 'owner is player')
    this.recycleBullet?.(bullet, target)
  }

  private handleEnemyBulletHitsPlayer(
    playerObj: Phaser.GameObjects.GameObject,
    bulletObj: Phaser.GameObjects.GameObject
  ): void {
    const bullet = this.asDynSprite?.(bulletObj) || this.asDynSprite?.(playerObj)
    const player = this.player
    if (!bullet || !player) {
      return
    }

    const owner = bullet.data?.get?.('owner')
    if (owner !== 'enemy') {
      this.devLogOverlap?.('EB->P', bullet, player, false, `owner=${owner}`)
      return
    }

    if (!player.body?.enable || !player.active) {
      this.devLogOverlap?.('EB->P', bullet, player, false, 'player inactive/body disabled')
      return
    }

    const dmg = (bullet.data?.get?.('damage') as number | undefined) ?? 1
    this.applyDamageToPlayer?.(dmg)
    this.devLogOverlap?.('EB->P', bullet, player, true, 'owner is enemy')
    this.recycleBullet?.(bullet, player)
  }
  // ======================= [OVERLAPS-END]

  private devInit() {
    if (this._dev.initOnce) return
    this._dev.initOnce = true

    this._dev.panel = this.add
      .text(8, 40, '', {
        fontFamily: 'monospace',
        fontSize: '9px',
        color: '#b0e0ff',
        lineSpacing: 2
      })
      .setScrollFactor(0)
      .setDepth(10001)
    this._dev.gfx = this.add.graphics().setDepth(10000)

    const world = this.physics.world as any
    world.drawDebug = false
    world.createDebugGraphic?.()
    world.debugGraphic?.clear?.()

    const dump = () => {
      const rows = Array.from(this._dev.entries.values()).map(({ kind, ref }) => ({
        eid: ref?.data?.get?.('eid'),
        kind,
        owner: ref?.data?.get?.('owner'),
        hp: ref?.data?.get?.('hp'),
        maxHp: ref?.data?.get?.('maxHp'),
        active: !!ref?.active,
        visible: !!ref?.visible,
        bodyEnabled: !!ref?.body?.enable,
        immovable: !!ref?.body?.immovable,
        x: Math.round((ref as any)?.x ?? 0),
        y: Math.round((ref as any)?.y ?? 0),
        vx: Math.round(ref?.body?.velocity?.x ?? 0),
        vy: Math.round(ref?.body?.velocity?.y ?? 0),
        w: Math.round(ref?.body?.width ?? (ref as any)?.width ?? 0),
        h: Math.round(ref?.body?.height ?? (ref as any)?.height ?? 0),
        checkColl: ref?.body?.checkCollision ? { ...ref.body.checkCollision } : null
      }))
      console.table(rows)
      return rows
    }

    ;(window as any).dump = dump

    const toggleOverlay = () => {
      this._dev.on = !this._dev.on
      if (!this._dev.on) {
        this._dev.panel?.setText('')
        this._dev.gfx?.clear()
      }
    }
    const handleDump = () => dump()
    const handlePhysics = () => {
      const arcadeWorld = this.physics.world as any
      arcadeWorld.drawDebug = !arcadeWorld.drawDebug
      arcadeWorld.debugGraphic?.clear?.()
    }

    const keyboard = this.input.keyboard
    if (keyboard) {
      keyboard.on('keydown-BACKTICK', toggleOverlay)
      keyboard.on('keydown-D', handleDump)
      keyboard.on('keydown-BACKSLASH', handlePhysics)

      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        keyboard.off('keydown-BACKTICK', toggleOverlay)
        keyboard.off('keydown-D', handleDump)
        keyboard.off('keydown-BACKSLASH', handlePhysics)
        if ((window as any).dump === dump) {
          delete (window as any).dump
        }
      })
    }
  }

  private devRegister<T extends Phaser.GameObjects.GameObject & { data?: Phaser.Data.DataManager }>(
    ref: T | undefined,
    kind: string
  ): T | undefined {
    if (!ref) return ref

    const anyRef = ref as any
    anyRef.setDataEnabled?.()
    const data = anyRef.data as Phaser.Data.DataManager | undefined
    let id = data?.get?.('eid') as number | undefined
    if (id == null) {
      id = this._dev.nextId++
      data?.set?.('eid', id)
    }
    data?.set?.('kind', kind)

    let entry = this._dev.entries.get(id)
    if (!entry) {
      const label = this.add
        .text(anyRef.x ?? 0, (anyRef.y ?? 0) - 12, '', {
          fontFamily: 'monospace',
          fontSize: '8px',
          color: '#7fffd4'
        })
        .setDepth(10000)
      entry = { kind, ref, label }
      this._dev.entries.set(id, entry)
    } else {
      entry.kind = kind
      entry.ref = ref
    }

    return ref
  }

  private devUpdate() {
    if (!this._dev.on) {
      this._dev.panel?.setText('')
      this._dev.gfx?.clear()
      return
    }
    if (this.time.now < this._dev.tick) return
    this._dev.tick = this.time.now + 180

    this._dev.gfx?.clear()

    const camera = this.cameras.main
    const pad = 128
    const view = camera.worldView
    const left = view.left - pad
    const right = view.right + pad
    const top = view.top - pad
    const bottom = view.bottom + pad

    const lines: string[] = ['` overlay  D dump  \\ physics', '─ entities near camera ─']

    for (const { kind, ref, label } of this._dev.entries.values()) {
      if (!ref?.active) {
        label.setVisible(false)
        continue
      }

      const anyRef = ref as any
      const posx = Math.round(anyRef?.x ?? 0)
      const posy = Math.round(anyRef?.y ?? 0)
      const withinView = posx >= left && posx <= right && posy >= top && posy <= bottom
      label.setVisible(withinView)

      if (withinView) {
        const id = ref?.data?.get?.('eid')
        const hp = ref?.data?.get?.('hp')
        const mxhp = ref?.data?.get?.('maxHp')
        const own = ref?.data?.get?.('owner')
        const vx = Math.round(ref?.body?.velocity?.x ?? 0)
        const vy = Math.round(ref?.body?.velocity?.y ?? 0)

        label
          .setText(`#${id} ${kind}`)
          .setPosition((anyRef?.x ?? 0) - 18, (anyRef?.y ?? 0) - 16)

        const body = ref?.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          this._dev.gfx?.lineStyle(1, 0x2afe6f, 1)
          this._dev.gfx?.strokeRect(body.x, body.y, body.width, body.height)
        }

        const detailParts = [`#${id}`, kind]
        if (own) detailParts.push(`owner:${own}`)
        detailParts.push(`hp:${hp ?? '-'}/${mxhp ?? '-'}`, `xy:${posx},${posy}`, `v:${vx},${vy}`)
        lines.push(detailParts.join(' '))
      }
    }

    this._dev.panel?.setText(lines.join('\n'))
  }

  private devLogOverlap(tag: string, bullet: any, target: any, accepted: boolean, reason: string) {
    const bId = bullet?.data?.get?.('eid')
    const tId = target?.data?.get?.('eid')
    const status = accepted ? 'ACCEPT' : 'BLOCK '
    const msg = `[COLLIDE] ${tag} ${status} b#${bId ?? '-'} -> t#${tId ?? '-'} :: ${reason}`
    console.log(msg, {
      bulletOwner: bullet?.data?.get?.('owner'),
      bulletBody: !!bullet?.body?.enable,
      targetKind: target?.data?.get?.('kind'),
      targetBody: !!target?.body?.enable
    })
  }

  // ======================= [AI-UPDATE-BEGIN]
  private bossUpdate(now: number): void {
    this.syncBossArt()

    if (!this.bossBody || !this.bossBody.active || this.bossController) {
      return
    }

    const body = this.bossBody.body as Phaser.Physics.Arcade.Body | undefined
    if (!body) {
      return
    }

    if (body.blocked.left) {
      this.bossBody.setVelocityX(60)
    } else if (body.blocked.right) {
      this.bossBody.setVelocityX(-60)
    } else if (body.velocity.x === 0) {
      const direction = this.player && this.player.x < this.bossBody.x ? -1 : 1
      this.bossBody.setVelocityX(60 * direction)
    }

    if (!this.bossFireTimer && (!this.nextBossShot || now > this.nextBossShot)) {
      const origin = this.bossArt ?? this.bossBody
      const originX = origin?.x ?? this.bossBody.x
      const originY = origin?.y ?? this.bossBody.y
      this.nextBossShot = now + 1400
      const shotVelocity = this.player && this.player.x < originX ? -200 : 200
      this.fireEnemyBullet(originX, originY, shotVelocity)
    }
  }
  // ======================= [AI-UPDATE-END]

  private updateBossAttackWatchdog(now: number): void {
    if (!this.bossController || !this.bossBullets) {
      return
    }

    if (now > this.bossAttackActiveUntil) {
      return
    }

    if (now - this.lastBossBulletSpawnAt <= 1500) {
      return
    }

    if (now < this.bossWatchdogCooldownUntil) {
      return
    }

    const origin = this.bossTarget ?? this.bossBody
    if (!origin) {
      return
    }

    this.spawnBossBullet(origin, undefined, {
      speed: 220,
      damage: 1,
      label: 'watchdog',
      direction: this.player && this.player.x < origin.x ? -1 : 1
    })
    this.bossWatchdogCooldownUntil = now + 1500

    if (typeof window !== 'undefined' && (window as any).__DEV__) {
      console.warn('[Boss][Watchdog] forced projectile', { time: now })
    }
  }

  create(data: GameData): void {
    this.bossAttackFirstLogEmitted = false
    this.bossBulletFirstLogEmitted = false
    this.lastBossBulletSpawnAt = 0
    this.lastBossAttackAt = 0
    this.bossAttackActiveUntil = 0
    this.bossWatchdogCooldownUntil = 0

    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      this.devHudEnabled = params.get('dev') === '1'
    } else {
      this.devHudEnabled = false
    }

    this.ensureBulletTextures()
    this.ensureSlashTexture()

    console.info('[Boss] bullet textures ready', {
      boss: this.textures.exists('bossBullet'),
      player: this.textures.exists('bullet_player')
    })

    const saberPM = this.add.particles(0, 0, 'slash')
    saberPM.setDepth(9)
    ;(this as any)._saberPM = saberPM

    if (!this.textures.exists('px')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 2, 2)
      g.generateTexture('px', 2, 2)
      g.destroy()
    }

    const enemyTrail = this.add.particles(0, 0, 'px', {
      lifespan: 180,
      speed: 0,
      quantity: 1,
      scale: { start: 0.8, end: 0 },
      alpha: { start: 0.7, end: 0 },
      frequency: 30
    })
    enemyTrail.setDepth(1)
    ;(this as any)._enemyTrail = enemyTrail

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      saberPM.destroy()
      enemyTrail.destroy()
      this.bossFireTimer?.remove(false)
      this.bossFireTimer = undefined
      this.bossFireTimerMissingLogged = false
      this.physics.world.off('worldbounds', this.handleBulletWorldBounds, this)
      this.events.off('boss-attack', this.handleBossAttackEvent, this)
      this.chargeEmitter?.stop()
      this.stagePlatforms?.clear(true, true)
      this.stagePlatforms?.destroy()
      this.stagePlatforms = undefined
      this.bossBulletHud?.destroy()
      this.bossBulletHud = undefined
    })

    const manager = this.scene.manager
    if (!manager.keys['Pause']) {
      this.scene.add('Pause', PauseScene, false)
    }
    if (!manager.keys['WinScene']) {
      this.scene.add('WinScene', WinScene, false)
    }
    if (!manager.keys['GameOver']) {
      this.scene.add('GameOver', GameOverScene, false)
    }

    this.devInit()
    const blueprint = getBossById(data.bossId)
    const bossMaxHp = blueprint.baseStats?.maxHp ?? 20
    const bossCodename = blueprint.codename ?? blueprint.id
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#0e1622')

    const stageId = (data as any)?.stageId ?? data.bossId ?? 'metal'
    ;(this as any).stageId = stageId
    ;(this as any).rewardWeapon = blueprint.weaponReward?.id ?? blueprint.id
    this.victoryTriggered = false
    this.gameOverTriggered = false

    InputActions.init(this)
    this.installScrollGuards()
    this.createPauseOverlay(width, height)

    const escHandler = () => {
      if (this.scene.isPaused(this.scene.key)) {
        return
      }
      this.setPaused(true)
      this.scene.launch('Pause')
      this.scene.pause()
    }
    this.input.keyboard?.on('keydown-ESC', escHandler)
    const resumeHandler = () => {
      this.setPaused(false)
      this.rearmBossFireTimer('scene resume')
    }
    this.events.on(Phaser.Scenes.Events.RESUME, resumeHandler)
    this.events.on(Phaser.Scenes.Events.WAKE, this.onSceneWake, this)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.input.keyboard?.off('keydown-ESC', escHandler)
      this.events.off(Phaser.Scenes.Events.RESUME, resumeHandler)
      this.events.off(Phaser.Scenes.Events.WAKE, this.onSceneWake, this)
    })

    if (this.input.keyboard) {
      this.debugToggleHandler = () => this.debugOverlay?.toggle()
      this.input.keyboard.on('keydown-BACKTICK', this.debugToggleHandler)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
        if (this.debugToggleHandler) {
          this.input.keyboard?.off('keydown-BACKTICK', this.debugToggleHandler)
          this.debugToggleHandler = undefined
        }
      })
    }

    if (DEBUG_UI) {
      this.debugOverlay = new DebugOverlay(this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugOverlay?.destroy())
    }

    this.jumpController.reset()
    this.bossName = bossCodename
    this.bossHp = { current: bossMaxHp, max: bossMaxHp }
    const weaponEnergyMax = blueprint.weaponReward?.maxEnergy ?? this.weaponEnergy.max
    this.weaponEnergy = { current: weaponEnergyMax, max: weaponEnergyMax }

    const makeOverlayLabel = (
      x: number,
      y: number,
      text: string,
      originX = 0
    ): Phaser.GameObjects.Text => {
      const label = this.add
        .text(x, y, text, {
          fontFamily: 'monospace',
          fontSize: '9px',
          color: '#b7e3ff',
          align: originX === 1 ? 'right' : 'left'
        })
        .setScrollFactor(0)
        .setOrigin(originX, 0)
        .setDepth(1000)

      label.setLetterSpacing(1)
      label.setShadow(0, 1, '#041224', 0, false, true)
      label.setStroke('#0a2137', 2)
      return label
    }

    this.bossLabel = makeOverlayLabel(
      10,
      8,
      `${(this.bossName ?? '').toUpperCase()} • ${blueprint.element.toUpperCase()}`
    )

    this.weaponLabel = makeOverlayLabel(10, 18, '')

    this.phaseLabel = makeOverlayLabel(width - 10, 8, 'PHASE • --', 1)

    const ground = this.add.rectangle(width / 2, height - 8, width, 16, 0x1a2230)
    this.physics.add.existing(ground, true)

    const platform = this.add.rectangle(200, 120, 50, 8, 0x253348)
    this.physics.add.existing(platform, true)
    const platformBody = platform.body as Phaser.Physics.Arcade.StaticBody
    this.tweens.add({
      targets: platform,
      x: 260,
      duration: 1500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut',
      onUpdate: () => platformBody.updateFromGameObject()
    })

    this.player = this.physics.add.sprite(40, 40, 'player_idle_0')
    this.player.setCollideWorldBounds(true)
    this.player.setDragX(900)
    this.player.setMaxVelocity(220, 550)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setSize(10, 16)
    playerBody.setOffset(3, 2)
    this.player.play('player-idle')
    this.playerMaxHp = 8
    this.playerHp = this.playerMaxHp
    this.playerLives = 3
    this.respawnPoint = new Phaser.Math.Vector2(this.player.x, this.player.y)
    this.player.setDataEnabled()
    this.player.data.set('hp', this.playerHp)
    this.player.data.set('maxHp', this.playerMaxHp)
    this.devRegister(this.player, 'player')

    this.buildStage(stageId)

    this.playerBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 50,
      runChildUpdate: true,
      allowGravity: false,
      collideWorldBounds: true
    })
    this.bossBullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 80,
      runChildUpdate: false,
      allowGravity: false,
      collideWorldBounds: true,
      defaultKey: 'bossBullet'
    })
    this.physics.world.on('worldbounds', this.handleBulletWorldBounds, this)

    if (this.devHudEnabled) {
      this.bossBulletHud?.destroy()
      this.bossBulletHud = this.add
        .text(8, 24, 'Boss bullets: active=0 / total=0', {
          fontFamily: 'monospace',
          fontSize: '10px',
          color: '#ffcccc'
        })
        .setScrollFactor(0)
        .setDepth(2000)
    } else {
      this.bossBulletHud?.destroy()
      this.bossBulletHud = undefined
    }

    this.hazards = this.physics.add.staticGroup()
    this.hazards.create(120, height - 22, 'hazard_spikes').refreshBody()
    this.hazards.create(260, height - 22, 'hazard_spikes').refreshBody()

    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite })
    const dummy = this.enemies.create(width - 60, height - 25, 'dummy_idle_0') as Phaser.Physics.Arcade.Sprite
    dummy.setDataEnabled()
    dummy.setData('hp', 3)
    dummy.setData('maxHp', 3)
    dummy.setBounceX(1)
    dummy.setCollideWorldBounds(true)
    dummy.setVelocityX(40)
    dummy.play('dummy-idle')
    this.devRegister(dummy, 'enemy')

    if (this.stagePlatforms) {
      this.physics.add.collider(this.enemies, this.stagePlatforms)
    }

    this.makeBossFrames()
    // ======================= [BOSS-SPAWN-BEGIN]
    this.spawnBossOnce(() => {
      this.bossBody = this.physics.add.sprite(560, 120, 'boss_tex', 0)
      this.bossBody.setVisible(false)
      this.bossBody.setCollideWorldBounds(true)
      this.bossBody.setDataEnabled()
      this.bossBody.data.set('name', bossCodename)
      this.bossBody.data.set('maxHp', bossMaxHp)
      this.bossBody.data.set('hp', bossMaxHp)
      const bossBody = this.bossBody.body as Phaser.Physics.Arcade.Body
      if (this.bossBody.width > 0 && this.bossBody.height > 0) {
        bossBody.setSize(this.bossBody.width, this.bossBody.height)
        bossBody.setOffset(0, 0)
      }
      this.bossBody.setVelocityX(-60)
      this.bossHp = { current: bossMaxHp, max: bossMaxHp }
      this.bossName = this.bossBody.data.get('name')
      this.nextBossShot = this.time.now + 800
      this.devRegister(this.bossBody, 'boss.body')
      this.bossTarget = this.bossBody

      if (this.stagePlatforms) {
        this.physics.add.collider(this.bossBody, this.stagePlatforms)
      }

      if (!this.bossArt) {
        this.bossArt = this.add.sprite(this.bossBody.x, this.bossBody.y, 'boss_tex', 0)
      } else {
        this.bossArt.setTexture('boss_tex', 0)
        this.bossArt.setVisible(true)
        this.bossArt.setPosition(this.bossBody.x, this.bossBody.y)
      }
      this.bossArt.setDepth(2)
      this.bossArt.setDataEnabled?.()
      this.bossArt.play('boss_walk')
      this.devRegister(this.bossArt, 'boss.art')
      this.devRegister(this.bossTarget, 'boss.hitbox')
      this.startBossFireLoop()
    })
    // ======================= [BOSS-SPAWN-END]

    this.physics.add.collider(this.player, ground)
    this.physics.add.collider(this.player, platform)
    this.physics.add.collider(this.enemies, ground)
    this.physics.add.collider(this.enemies, platform)
    if (this.bossTarget) {
      this.physics.add.collider(this.bossTarget, ground)
      this.physics.add.collider(this.bossTarget, platform)
    }
    this.installHitWires()

    this.physics.add.overlap(this.player, this.hazards, this.onPlayerDamaged, undefined, this)
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerDamaged, undefined, this)
    this.physics.add.overlap(this.playerBullets, this.enemies, this.onBulletHitsEnemy, undefined, this)

    this.physics.add.collider(this.playerBullets, ground, this.recycleBullet, undefined, this)
    this.physics.add.collider(this.playerBullets, platform, this.recycleBullet, undefined, this)
    this.physics.add.collider(this.bossBullets, ground, this.recycleBullet, undefined, this)
    this.physics.add.collider(this.bossBullets, platform, this.recycleBullet, undefined, this)

    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.handleWorldBounds)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.physics.world.off(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.handleWorldBounds)
    })

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.initializeActionKeys()
    this.updateWeaponLabel()

    this.bossController = new BossController(this, blueprint, {
      spawn: new Phaser.Math.Vector2(width - 48, height - 40),
      lockIntro: true
    })
    if (this.bossController) {
      const bossActor = this.bossController as Phaser.Types.Physics.Arcade.GameObjectWithBody
      this.bossTarget = bossActor as Phaser.Physics.Arcade.Sprite
      this.bossTarget?.setDataEnabled?.()
      if (this.bossTarget?.data?.get?.('maxHp') == null) {
        this.bossTarget?.data?.set?.('maxHp', bossMaxHp)
      }
      if (this.bossTarget?.data?.get?.('hp') == null) {
        this.bossTarget?.data?.set?.('hp', bossMaxHp)
      }
      if (this.bossTarget) {
        this.devRegister(this.bossTarget, 'boss.hitbox')
        this.physics.add.collider(this.bossTarget, ground)
        this.physics.add.collider(this.bossTarget, platform)
        if (this.stagePlatforms) {
          this.physics.add.collider(this.bossTarget, this.stagePlatforms)
        }
      }
      this.installHitWires()
      this.startBossFireLoop()
    }
    this.initializeHud()
    this.currentPhaseName = this.bossController.currentPhase.name.toUpperCase()
    this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}`)

    this.time.delayedCall(1600, () => {
      this.bossController?.unlockIntro()
      const phase = this.bossController?.currentPhase
      if (phase) {
        this.currentPhaseName = phase.name.toUpperCase()
        this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}`)
      }
    })

    this.events.on('boss-phase-change', (event) => {
      const { phase } = event as { phase: { name: string } }
      this.currentPhaseName = phase.name.toUpperCase()
      this.phaseLabel.setText(`PHASE • ${this.currentPhaseName}`)
    })

    this.events.on('boss-attack', this.handleBossAttackEvent, this)

    this.events.on('boss-defeated', (event) => {
      const { reward } = event as { reward: { displayName: string } }
      this.phaseLabel.setText(`VICTORY • WEAPON ACQUIRED\n${reward.displayName.toUpperCase()}`)
      if (this.bossHp) {
        this.bossHp = { current: 0, max: this.bossHp.max }
        this.hud?.updateBossHp(this.bossHp.current, this.bossHp.max)
      }
      if (this.bossTarget) {
        const body = this.bossTarget.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          body.enable = false
        }
        this.bossTarget.setActive(false).setVisible(false)
      }
      this.bossArt?.setVisible(false)
      this.onBossDefeated()
    })

    this.cameras.main.startFollow(this.player, false, 0.1, 0.1)
  }

  update(_time: number, delta: number): void {
    if (!this.player || !this.cursors) {
      this.bossUpdate(this.time.now)
      this.devUpdate()
      return
    }

    const pauseState = evaluatePauseState(this.paused, InputActions.isPressedPauseOnce())
    this.setPaused(pauseState.paused)
    const now = this.time.now

    if (this.devHudEnabled && this.bossBulletHud && this.bossBullets) {
      const active = this.bossBullets.countActive(true)
      const total = this.bossBullets.getLength()
      this.bossBulletHud.setText(`Boss bullets: active=${active} / total=${total}`)
    }

    if (!this.bossController) {
      const shooter = this.bossBody ?? this.bossTarget
      if (shooter?.active) {
        if (!this.bossFireTimer) {
          if (!this.bossFireTimerMissingLogged) {
            console.warn('[Boss] fire timer missing while boss is active; restarting')
            this.bossFireTimerMissingLogged = true
          }
          this.startBossFireLoop()
        } else {
          this.bossFireTimerMissingLogged = false
        }
      }
    }

    if (DEBUG_UI) {
      this.debugOverlay?.update({
        sceneName: this.scene.key,
        managerName: this.scene.key,
        confirmHint: 'Enter / NumpadEnter (menus)',
        jumpHint: 'Space',
        pauseHint: 'Esc (toggle)'
      })
    }

    if (pauseState.skipUpdate) {
      this.bossUpdate(now)
      this.devUpdate()
      return
    }

    this.updateBossAttackWatchdog(now)

    const body = this.player.body as Phaser.Physics.Arcade.Body
    const grounded = body.onFloor() || body.blocked.down
    const sliding = now < this.slideUntil

    this.registry.set('player_x', this.player.x)

    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - delta)
    }

    if (this.dashActive) {
      this.dashTimer = Math.max(0, this.dashTimer - delta)
      if (this.dashTimer === 0) {
        this.dashActive = false
        this.player.setDragX(900)
        this.updatePlayerTint()
      }
    }

    if (this.saberComboStep > 0) {
      this.saberComboTimer = Math.max(0, this.saberComboTimer - delta)
      if (this.saberComboTimer === 0) {
        this.saberComboStep = 0
        this.updatePlayerTint()
      }
    }

    this.handleWeaponCycling()
    this.handleShooting(now, grounded)
    this.handleSaberInput(now, grounded)

    const movingLeft = this.cursors.left?.isDown ?? false
    const movingRight = this.cursors.right?.isDown ?? false

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.dash) && this.dashCooldownTimer === 0) {
      if (grounded && this.cursors.down?.isDown) {
        this.startSlide(now, movingLeft, movingRight)
      } else {
        this.startDash(now, movingLeft, movingRight)
      }
    }

    if (sliding) {
      this.applySlideHitbox()
      this.player.setAccelerationX(0)
      if (grounded) {
        this.player.setVelocityX(260 * this.facing)
      }
    } else {
      if (this.usingSlideHitbox) {
        this.resetPlayerHitbox()
      }

      if (movingLeft && !movingRight) {
        this.player.setAccelerationX(-700)
        this.facing = -1
      } else if (movingRight && !movingLeft) {
        this.player.setAccelerationX(700)
        this.facing = 1
      } else {
        this.player.setAccelerationX(0)
      }
    }

    let jumpTriggered = false
    if (!sliding) {
      const wantsJump = InputActions.isDownJump()
      if (this.jumpController.update(this.player, wantsJump, grounded)) {
        jumpTriggered = true
      }

      if (jumpTriggered) {
        this.animationLockUntil = Math.max(this.animationLockUntil, now + 120)
        this.setPlayerAnimation('player-jump')
      }
    }

    if (this.dashActive) {
      const dashSpeed = 320 * this.facing
      this.player.setAccelerationX(0)
      this.player.setVelocityX(dashSpeed)
    }

    if (now >= this.animationLockUntil) {
      let animationKey = 'player-idle'
      if (sliding) {
        animationKey = 'player-slide'
      } else if (!grounded) {
        animationKey = body.velocity.y < 0 ? 'player-jump' : 'player-fall'
      } else if (Math.abs(body.velocity.x) > 30) {
        animationKey = 'player-run'
      }
      this.setPlayerAnimation(animationKey)
    }

    this.player.setFlipX(this.facing === -1)

    this.bossUpdate(now)
    this.devUpdate()

    if (this.bossController && this.bossController.scene) {
      this.bossController.update(this.time.now, this.game.loop.delta)
    }
  }

  private createPauseOverlay(width: number, height: number): void {
    const overlay = this.add.container(0, 0)
    overlay.setScrollFactor(0)
    overlay.setDepth(900)

    const dim = this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.55)
    dim.setScrollFactor(0)

    const label = this.add.text(width / 2, height / 2, 'Paused', {
      fontFamily: 'monospace',
      fontSize: '22px',
      color: '#ffffff',
      backgroundColor: 'rgba(8, 12, 20, 0.75)',
      padding: { x: 12, y: 8 },
      align: 'center'
    })
    label.setOrigin(0.5)
    label.setScrollFactor(0)
    label.setShadow(2, 2, '#000000', 4, true, true)

    overlay.add([dim, label])
    overlay.setVisible(false)
    this.pauseOverlay = overlay

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      overlay.destroy(true)
      if (this.pauseOverlay === overlay) {
        this.pauseOverlay = undefined
      }
    })
  }

  private setPaused(paused: boolean): void {
    if (this.paused === paused) {
      return
    }

    this.paused = paused
    if (paused) {
      this.physics.world.pause()
    } else {
      this.physics.world.resume()
    }

    this.pauseOverlay?.setVisible(paused)
  }

  private installScrollGuards(): void {
    const keyboard = this.input.keyboard
    if (!keyboard || this.preventScrollHandler) {
      return
    }

    const blockedCodes = new Set(['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'])
    const handler = (event: KeyboardEvent) => {
      if (blockedCodes.has(event.code)) {
        event.preventDefault()
      }
    }

    this.preventScrollHandler = handler
    keyboard.on('keydown', handler)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', handler)
      if (this.preventScrollHandler === handler) {
        this.preventScrollHandler = undefined
      }
    })
  }

  private initializeActionKeys(): void {
    const keyboard = this.input.keyboard
    if (!keyboard) {
      throw new Error('Keyboard input not available')
    }

    this.actionKeys = {
      dash: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Z),
      shoot: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X),
      saber: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.C),
      cycleForward: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      shoulderPrev: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.Q),
      shoulderNext: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.E),
      modifier: keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT)
    }
  }

  private initializeHud(): void {
    this.hud = new HUD(this)
    const bossLabelRaw =
      this.bossController?.blueprint.codename ??
      this.bossBody?.data?.get?.('name') ??
      this.bossName ??
      '??'
    const bossLabelName = typeof bossLabelRaw === 'string' ? bossLabelRaw : String(bossLabelRaw)
    this.hud.setNames('Sentinel ROOK', bossLabelName)
    this.hud.setLives(this.playerLives)
    this.hud.updatePlayerHp(this.playerHp, this.playerMaxHp)
    this.hud.updateWeapon(this.weaponEnergy.current, this.weaponEnergy.max)
    if (this.bossHp) {
      this.hud.updateBossHp(this.bossHp.current, this.bossHp.max)
    } else if (this.bossTarget) {
      const cur =
        (this.bossTarget.data?.get?.('hp') ?? this.bossTarget.data?.get?.('maxHp') ?? 0) as number
      const max = (this.bossTarget.data?.get?.('maxHp') ?? Math.max(cur, 1)) as number
      this.hud.updateBossHp(cur, max)
    }
    this.scaleResizeHandler = () => this.hud?.resize()
    this.scale.on('resize', this.scaleResizeHandler)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      if (this.scaleResizeHandler) {
        this.scale.off('resize', this.scaleResizeHandler)
        this.scaleResizeHandler = undefined
      }
    })
  }

  private handleWeaponCycling(): void {
    if (
      Phaser.Input.Keyboard.JustDown(this.actionKeys.cycleForward) ||
      Phaser.Input.Keyboard.JustDown(this.actionKeys.shoulderNext)
    ) {
      this.changeWeapon(1)
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.shoulderPrev)) {
      this.changeWeapon(-1)
    }
  }

  private handleShooting(now: number, grounded: boolean): void {
    const shootKey = this.actionKeys.shoot
    if (Phaser.Input.Keyboard.JustDown(shootKey)) {
      this.isChargingShot = true
      this.chargeStartedAt = now
      this.startCharging()
    }

    if (this.isChargingShot && !shootKey.isDown) {
      const charged = now - this.chargeStartedAt >= 600
      this.stopCharging()
      this.fireBullet(charged)
      this.isChargingShot = false
      this.animationLockUntil = Math.max(this.animationLockUntil, now + 180)
      this.setPlayerAnimation(grounded ? 'player-shoot' : 'player-shoot-air')
    }
  }

  private handleSaberInput(now: number, grounded: boolean): void {
    if (!Phaser.Input.Keyboard.JustDown(this.actionKeys.saber)) {
      return
    }

    this.saberComboStep = ((this.saberComboStep % 3) + 1) as number
    this.saberComboTimer = this.saberComboWindow
    this.animationLockUntil = Math.max(this.animationLockUntil, now + 180)
    this.updatePlayerTint()
    this.setPlayerAnimation(grounded ? 'player-shoot' : 'player-shoot-air')
    this.applySaberDamage()
    if (this.player) {
      this.playSaberFx(this.player, this.facing)
    }
  }

  private startDash(now: number, movingLeft: boolean, movingRight: boolean): void {
    if (this.dashActive) {
      return
    }

    const direction = movingLeft && !movingRight ? -1 : movingRight && !movingLeft ? 1 : this.facing
    this.facing = direction === 0 ? this.facing : (direction as 1 | -1)

    this.dashActive = true
    this.dashTimer = this.dashDuration
    this.dashCooldownTimer = this.dashCooldown
    this.player.setAccelerationX(0)
    this.player.setDragX(0)
    this.player.setVelocityX(320 * this.facing)
    this.animationLockUntil = Math.max(this.animationLockUntil, now + this.dashDuration)
    this.updatePlayerTint()
  }

  private startSlide(now: number, movingLeft: boolean, movingRight: boolean): void {
    const direction = movingLeft && !movingRight ? -1 : movingRight && !movingLeft ? 1 : this.facing
    this.facing = direction === 0 ? this.facing : (direction as 1 | -1)
    this.slideUntil = now + this.slideDuration
    this.applySlideHitbox()
    this.player.setVelocityX(260 * this.facing)
    this.animationLockUntil = Math.max(this.animationLockUntil, this.slideUntil)
    this.updatePlayerTint()
    this.setPlayerAnimation('player-slide')
  }

  private applySlideHitbox(): void {
    if (this.usingSlideHitbox) {
      return
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(14, 12)
    body.setOffset(2, 6)
    this.usingSlideHitbox = true
  }

  private resetPlayerHitbox(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(10, 16)
    body.setOffset(3, 2)
    this.usingSlideHitbox = false
  }

  private fireBullet(charged: boolean): void {
    const offsetX = this.facing === -1 ? -8 : 8
    const bulletX = this.player.x + offsetX
    const bulletY = this.player.y - 6

    const bullet = this.playerBullets.get(
      bulletX,
      bulletY,
      'bullet_player'
    ) as Phaser.Physics.Arcade.Sprite | undefined
    if (!bullet) {
      return
    }

    bullet.setActive(true).setVisible(true)
    const body = bullet.body as Phaser.Physics.Arcade.Body
    body.enable = true
    body.reset(bulletX, bulletY)
    body.allowGravity = false
    body.setCollideWorldBounds(true)
    body.onWorldBounds = true
    bullet.setDepth(2)
    bullet.setDataEnabled()
    bullet.data.set('owner', 'player')
    bullet.data.set('damage', bullet.data.get('damage') ?? 1)
    this.devRegister(bullet, 'bullet')

    this.styleBulletForOwner(bullet, 'player')
    bullet.setPosition(bulletX, bulletY)
    bullet.setVelocityX((charged ? 360 : 260) * this.facing)
    if (charged) {
      bullet.data.set('damage', 2)
      bullet.setScale(1.2)
    }
  }

  private fireEnemyBullet(x: number, y: number, vx: number): void {
    const fauxOrigin = { x, y } as unknown as Phaser.GameObjects.GameObject
    this.spawnBossBullet(fauxOrigin, undefined, {
      speed: Math.abs(vx),
      damage: 1,
      direction: vx < 0 ? -1 : 1,
      label: 'legacy-direct'
    })
  }

  private styleBulletForOwner(
    bullet: Phaser.Physics.Arcade.Sprite,
    owner: 'player' | 'enemy'
  ): void {
    if (owner === 'player') {
      bullet.setTexture('bullet_player')
      bullet.clearTint()
      bullet.setScale(1)
      ;(bullet as any).setBlendMode?.(Phaser.BlendModes.NORMAL)
    } else {
      bullet.setTexture('bossBullet')
      bullet.setTint(0xff3b30)
      bullet.setScale(1.1)
      bullet.setDepth(1000)
      bullet.setAlpha(1)
      ;(bullet as any).setBlendMode?.(Phaser.BlendModes.ADD)
    }
  }

  // [REGION: SABER-FX - BEGIN]
  private ensureSlashTexture(): void {
    if (this.textures.exists('slash')) {
      return
    }
    const g = this.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(0xffffff, 1)
    for (let i = 0; i < 10; i += 1) {
      g.fillRect(i, 10 - i, 1, 2)
    }
    g.generateTexture('slash', 12, 12)
    g.destroy()
  }

  private playSaberFx(origin: Phaser.GameObjects.Sprite, direction: number): void {
    const pm = (this as any)._saberPM as
      | Phaser.GameObjects.Particles.ParticleEmitterManager
      | undefined
    if (!pm) {
      return
    }

    const emitter = pm.createEmitter({
      x: origin.x + 8 * direction,
      y: origin.y,
      angle: { min: -20 + (direction < 0 ? 180 : 0), max: 20 + (direction < 0 ? 180 : 0) },
      speed: 80,
      lifespan: 160,
      scale: { start: 1.2, end: 0 },
      quantity: 6,
      blendMode: 'ADD'
    })
    this.time.delayedCall(180, () => emitter.stop())
  }
  // [REGION: SABER-FX - END]

  // [REGION: CHARGE-AURA - BEGIN]
  private initChargeFx(): void {
    if (this.chargePM) {
      return
    }

    if (!this.textures.exists('px')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillRect(0, 0, 2, 2)
      g.generateTexture('px', 2, 2)
      g.destroy()
    }

    this.chargePM = this.add.particles(0, 0, 'px').setDepth(10)
  }

  private startCharging(): void {
    if (!this.player?.active) {
      return
    }
    this.initChargeFx()
    if (this.charging) {
      return
    }
    this.charging = true
    this.fullyCharged = false

    this.chargeEmitter?.stop()
    this.chargeEmitter = this.chargePM.createEmitter({
      follow: this.player,
      lifespan: 220,
      speed: { min: 10, max: 40 },
      scale: { start: 1.0, end: 0 },
      quantity: 6,
      alpha: { start: 0.9, end: 0 },
      tint: 0x88ddff,
      angle: { min: 0, max: 360 }
    })

    this.time.delayedCall(600, () => {
      if (!this.charging) {
        return
      }
      this.fullyCharged = true
      this.chargeEmitter?.setQuantity(2)
      this.chargeEmitter?.setLifespan(400)
      this.chargeEmitter?.setSpeed({ min: 5, max: 20 })
      this.chargeEmitter?.setTint(0x55ffcc)
      this.tweens.add({ targets: this.player, scale: 1.05, duration: 80, yoyo: true })
    })
  }

  private stopCharging(): void {
    this.charging = false
    if (!this.chargeEmitter) {
      return
    }

    if (!this.fullyCharged) {
      this.chargeEmitter.stop()
      this.chargeEmitter = undefined
      return
    }

    this.chargeEmitter.setQuantity(1)
    this.chargeEmitter.setLifespan(500)
    this.chargeEmitter.setSpeed(10)
    this.chargeEmitter.setAlpha({ start: 0.5, end: 0 })
    this.chargeEmitter.setTint(0x99ffee)
  }
  // [REGION: CHARGE-AURA - END]

  private ensureBulletTextures(): void {
    const tex = this.textures
    if (!tex.exists('bullet_player')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xffffff, 1)
      g.fillCircle(6, 6, 5) // 12×12 circle
      g.generateTexture('bullet_player', 12, 12)
      g.destroy()
    }
    if (!tex.exists('bossBullet')) {
      const g = this.make.graphics({ x: 0, y: 0, add: false })
      g.fillStyle(0xff3b30, 1)
      g.fillCircle(2, 2, 2)
      g.generateTexture('bossBullet', 4, 4)
      g.destroy()
    }
  }

  // [REGION: BOSS-ART-PLACEHOLDER - BEGIN]
  private makeBossFrames(): void {
    if (this.textures.exists('boss_tex')) {
      return
    }

    const rt = this.make.renderTexture({ x: -1000, y: -1000, width: 48, height: 48, add: false })
    const drawFrame = (color: number, diag: boolean) => {
      const g = this.add.graphics({ x: 0, y: 0 })
      g.fillStyle(color, 1)
      g.fillRect(0, 0, 32, 32)
      if (diag) {
        g.lineStyle(2, 0x113311)
        g.beginPath()
        g.moveTo(0, 32)
        g.lineTo(32, 0)
        g.strokePath()
      }
      rt.draw(g, 8, 8)
      g.destroy()
    }

    drawFrame(0x4bc06b, true)
    this.textures.addSpriteSheet('boss_tex', rt.texture.getSourceImage(), {
      frameWidth: 48,
      frameHeight: 48
    })
    rt.clear()
    drawFrame(0x5bd07b, false)
    this.textures.get('boss_tex').add(1, 0, 0, 48, 48)
    drawFrame(0x6be08b, true)
    this.textures.get('boss_tex').add(2, 0, 0, 48, 48)
    rt.destroy()

    if (!this.anims.exists('boss_idle')) {
      this.anims.create({ key: 'boss_idle', frames: [{ key: 'boss_tex', frame: 0 }], frameRate: 4, repeat: -1 })
    }
    if (!this.anims.exists('boss_walk')) {
      this.anims.create({
        key: 'boss_walk',
        frames: [
          { key: 'boss_tex', frame: 0 },
          { key: 'boss_tex', frame: 1 }
        ],
        frameRate: 6,
        repeat: -1
      })
    }
    if (!this.anims.exists('boss_shoot')) {
      this.anims.create({
        key: 'boss_shoot',
        frames: [
          { key: 'boss_tex', frame: 2 },
          { key: 'boss_tex', frame: 0 }
        ],
        frameRate: 10,
        repeat: 0
      })
    }
  }
  // [REGION: BOSS-ART-PLACEHOLDER - END]

  private asDynSprite(obj: any): Phaser.Physics.Arcade.Sprite | null {
    if (!obj || !obj.body) {
      return null
    }
    const body = obj.body
    const isDynamic = body instanceof Phaser.Physics.Arcade.Body
    const hasSetVelocity = typeof (obj as any).setVelocity === 'function'
    return isDynamic && hasSetVelocity ? (obj as Phaser.Physics.Arcade.Sprite) : null
  }

  private recycleBullet(a: any, b: any): void {
    const bullet = this.asDynSprite(a) || this.asDynSprite(b)
    if (!bullet) {
      return
    }
    const body = bullet.body as Phaser.Physics.Arcade.Body | undefined
    if (body) {
      body.onWorldBounds = false
    }
    const em = (bullet as any).__trailEmitter
    if (em && typeof em.stop === 'function') {
      em.stop()
      ;(bullet as any).__trailEmitter = null
    }
    const anyBullet = bullet as any
    const owner = (bullet.data?.get?.('owner') as string | undefined) ?? 'player'
    const group = owner === 'enemy' ? this.bossBullets : this.playerBullets
    if (typeof anyBullet.disableBody === 'function') {
      anyBullet.disableBody(true, true)
    } else {
      group?.killAndHide(bullet)
      if (body) {
        body.enable = false
      }
    }

    if (typeof (bullet as any).setVelocity === 'function') {
      ;(bullet as any).setVelocity(0, 0)
    } else if (bullet.body && typeof (bullet.body as any).setVelocity === 'function') {
      ;(bullet.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0)
    }
  }

  private handleBulletWorldBounds(body: Phaser.Physics.Arcade.Body): void {
    if (!this.playerBullets && !this.bossBullets) {
      return
    }

    const go = body.gameObject
    if (!go) {
      return
    }

    if (this.playerBullets?.contains(go) || this.bossBullets?.contains(go)) {
      this.recycleBullet(go, undefined)
    }
  }

  private applySaberDamage(): void {
    this.enemies.children.iterate((child) => {
      const enemy = child as Phaser.Physics.Arcade.Sprite | null
      if (!enemy || !enemy.active) {
        return false
      }
      const distanceX = Math.abs(enemy.x - this.player.x)
      const distanceY = Math.abs(enemy.y - this.player.y)
      if (distanceX <= 36 && distanceY <= 32) {
        const remaining = this.applyDamageToTarget(enemy, 2)
        if (remaining > 0) {
          this.flashEnemy(enemy)
        }
      }
      return false
    })
  }

  private onBulletHitsEnemy(
    bulletObj: Phaser.GameObjects.GameObject,
    enemyObj: Phaser.GameObjects.GameObject
  ): void {
    const bullet = bulletObj as Phaser.Physics.Arcade.Sprite
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
    if (!bullet?.data || bullet.data.get('owner') !== 'player') {
      return
    }
    const dmg = (bullet.data.get('damage') as number | undefined) ?? 1
    const remaining = this.applyDamageToTarget(enemy, dmg)
    if (remaining > 0) {
      this.flashEnemy(enemy)
    }
    this.recycleBullet(bullet, enemy)
  }

  private applyDamageToTarget(target: Phaser.Physics.Arcade.Sprite, dmg: number): number {
    target.setDataEnabled()
    const current = (target.getData('hp') ?? target.getData('maxHp') ?? 3) as number
    const max = (target.getData('maxHp') ?? Math.max(3, current)) as number
    const next = Math.max(0, current - dmg)
    target.data.set('hp', next)
    target.data.set('maxHp', max)
    if (next <= 0) {
      this.onTargetDefeated(target)
    }
    return next
  }

  // [REGION: FLOW-HOOKS - BEGIN]
  private onBossDefeated(): void {
    if (this.victoryTriggered) {
      return
    }
    this.victoryTriggered = true
    this.bossAttackActiveUntil = 0
    this.bossWatchdogCooldownUntil = 0
    this.bossFireTimer?.remove(false)
    this.bossFireTimer = undefined
    this.bossFireTimerMissingLogged = false
    this.stopCharging()
    const stageId = ((this as any).stageId as string | undefined) ?? 'unknown'
    const weaponId = ((this as any).rewardWeapon as string | undefined) ?? 'buster+'
    if (this.scene.manager.keys['Pause']) {
      this.scene.stop('Pause')
    }
    if (this.scene.manager.keys['WinScene']) {
      this.scene.start('WinScene', { stageId, weaponId })
    }
  }

  private onPlayerGameOver(): void {
    if (this.gameOverTriggered) {
      return
    }
    this.gameOverTriggered = true
    this.bossAttackActiveUntil = 0
    this.bossWatchdogCooldownUntil = 0
    this.bossFireTimer?.remove(false)
    this.bossFireTimer = undefined
    this.bossFireTimerMissingLogged = false
    this.stopCharging()
    const stageId = ((this as any).stageId as string | undefined) ?? 'unknown'
    if (this.scene.manager.keys['Pause']) {
      this.scene.stop('Pause')
    }
    if (this.scene.manager.keys['GameOver']) {
      this.scene.start('GameOver', { stageId })
    }
  }
  // [REGION: FLOW-HOOKS - END]

  private applyDamageToBoss(dmg: number): void {
    if (this.bossController) {
      const max = this.bossHp?.max ?? this.bossController.blueprint.baseStats.maxHp
      const current = Math.max(0, (this.bossHp?.current ?? max) - dmg)
      this.bossHp = { current, max }
      this.hud?.updateBossHp(current, max)
      if (this.bossTarget) {
        this.bossTarget.setDataEnabled?.()
        const cur = (this.bossTarget.data?.get?.('hp') ?? max) as number
        const nextHp = Math.max(0, cur - dmg)
        this.bossTarget.data?.set?.('hp', nextHp)
        this.bossTarget.data?.set?.('maxHp', max)
      }
      this.bossController.hurt(dmg)
      if (current <= 0) {
        this.onBossDefeated()
      }
      return
    }

    const target = this.bossTarget ?? this.bossBody
    if (!target || !target.active) {
      return
    }

    target.setDataEnabled?.()
    const current = (target.data?.get?.('hp') ?? target.data?.get?.('maxHp') ?? 0) as number
    const max = (target.data?.get?.('maxHp') ?? Math.max(1, current)) as number
    const next = Math.max(0, current - dmg)
    target.data?.set?.('hp', next)
    target.data?.set?.('maxHp', max)
    this.bossHp = { current: next, max }
    this.hud?.updateBossHp(next, max)

    if (next <= 0) {
      const anyTarget = target as any
      if (typeof anyTarget.disableBody === 'function') {
        anyTarget.disableBody(true, true)
      } else {
        target.setActive(false).setVisible(false)
        const body = target.body as Phaser.Physics.Arcade.Body | undefined
        if (body) {
          body.enable = false
        }
      }

      this.events.emit('boss-defeated', {
        reward: { displayName: 'FROST SLASH' }
      })
      this.onBossDefeated()
    }
  }

  private onTargetDefeated(target: Phaser.Physics.Arcade.Sprite): void {
    const anyTarget = target as any
    const { x, y, displayHeight } = target
    if (typeof anyTarget.disableBody === 'function') {
      anyTarget.disableBody(true, true)
    } else {
      target.setActive(false).setVisible(false)
    }
    this.handleEnemyDefeat(x, y, displayHeight)
  }

  private handleEnemyDefeat(x: number, y: number, targetHeight: number): void {
    const explosion = this.add.sprite(x, y - targetHeight / 2, 'explosion_0')
    explosion.play('dummy-explode')
    explosion.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      explosion.destroy()
    })
  }

  private flashEnemy(enemy: Phaser.Physics.Arcade.Sprite): void {
    enemy.setTint(0xfff3a3)
    this.time.delayedCall(120, () => {
      if (enemy.active) {
        enemy.clearTint()
      }
    })
  }

  private onPlayerDamaged(playerObj: Phaser.GameObjects.GameObject): void {
    const player = playerObj as Phaser.Physics.Arcade.Sprite
    if (!player.active) {
      return
    }

    this.applyDamageToPlayer(1)
    player.setTint(0xff6b6b)
    player.setVelocityY(-160)
    this.animationLockUntil = Math.max(this.animationLockUntil, this.time.now + 220)
    this.setPlayerAnimation('player-hurt')
    this.time.delayedCall(220, () => {
      if (!player.active) {
        return
      }
      player.clearTint()
      this.updatePlayerTint()
    })
  }

  private updatePlayerTint(): void {
    if (!this.player) {
      return
    }
    if (this.dashActive) {
      this.player.setTint(0x8bd2ff)
    } else if (this.saberComboStep > 0) {
      this.player.setTint(0xfff5a3)
    } else {
      this.player.clearTint()
    }
  }

  private setPlayerAnimation(key: string): void {
    if (!this.player.anims || this.player.anims.currentAnim?.key === key) {
      return
    }
    this.player.play(key)
  }

  private changeWeapon(delta: number): void {
    const total = this.weapons.length
    this.currentWeaponIndex = Phaser.Math.Wrap(this.currentWeaponIndex + delta, 0, total)
    this.updateWeaponLabel()
  }

  private updateWeaponLabel(): void {
    const weapon = this.weapons[this.currentWeaponIndex]
    this.weaponLabel.setText(`WEAPON • ${weapon.toUpperCase()}`)
  }

  private applyDamageToPlayer(dmg: number): void {
    if (!this.player || !this.player.active || this.playerLives < 0) {
      return
    }

    this.playerHp = Math.max(0, this.playerHp - dmg)
    this.player.setDataEnabled()
    this.player.data.set('hp', this.playerHp)
    this.player.data.set('maxHp', this.playerMaxHp)
    this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)

    if (this.playerHp <= 0) {
      this.playerDeathAndRespawn()
    }
  }

  private playerDeathAndRespawn(): void {
    if (!this.player) {
      return
    }

    this.stopCharging()
    this.playerLives--
    this.hud?.setLives(this.playerLives)

    const anyPlayer = this.player as any
    if (typeof anyPlayer.disableBody === 'function') {
      anyPlayer.disableBody(true, true)
    } else {
      this.player.setActive(false).setVisible(false)
      const body = this.player.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.enable = false
      }
    }

    if (this.playerLives > 0) {
      this.time.delayedCall(600, () => {
        if (!this.player || !this.respawnPoint) {
          return
        }

        const playerAny = this.player as any
        if (typeof playerAny.enableBody === 'function') {
          playerAny.enableBody(true, this.respawnPoint.x, this.respawnPoint.y, true, true)
        } else {
          this.player.setPosition(this.respawnPoint.x, this.respawnPoint.y)
          const body = this.player.body as Phaser.Physics.Arcade.Body | undefined
          if (body) {
            body.enable = true
            body.reset(this.respawnPoint.x, this.respawnPoint.y)
          }
        }
        this.playerHp = this.playerMaxHp
        this.player.setDataEnabled()
        this.player.data.set('hp', this.playerHp)
        this.player.data.set('maxHp', this.playerMaxHp)
        this.hud?.updatePlayerHp(this.playerHp, this.playerMaxHp)
        this.player.setVelocity(0, 0)
        this.player.setActive(true).setVisible(true)
      })
    } else {
      this.gameOver()
    }
  }

  private gameOver(): void {
    this.onPlayerGameOver()
  }
}
