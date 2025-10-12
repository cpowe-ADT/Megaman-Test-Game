import Phaser from 'phaser'
import { BossController } from '../bosses/BossController'
import { BossId } from '../bosses/types'
import { getBossById } from '../bosses/roster'
import { DEBUG_UI } from '../config/debug'
import InputActions from '../input/InputActions'
import { DebugOverlay } from '../ui/DebugOverlay'
import { HUD } from '../ui/HUD'
import { JumpController } from './game/JumpController'
import { evaluatePauseState } from './game/pauseLogic'

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

export class Game extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite
  private actionKeys!: ActionKeyMap
  private bullets!: Phaser.Physics.Arcade.Group
  private hazards!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private boss?: BossController
  private bossLabel!: Phaser.GameObjects.Text
  private weaponLabel!: Phaser.GameObjects.Text
  private phaseLabel!: Phaser.GameObjects.Text
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
  private scaleResizeHandler?: Phaser.Types.Core.ScaleEventCallback

  private readonly handleWorldBounds = (body: Phaser.Physics.Arcade.Body) => {
    const sprite = body.gameObject as Phaser.Physics.Arcade.Sprite | null
    if (!sprite) {
      return
    }
    if (this.bullets && this.bullets.contains(sprite)) {
      this.recycleBullet(sprite, undefined)
    }
  }

  constructor() {
    super('Game')
  }

  create(data: GameData): void {
    const blueprint = getBossById(data.bossId)
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#0e1622')

    InputActions.init(this)
    this.installScrollGuards()
    this.createPauseOverlay(width, height)

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
    this.bossName = blueprint.codename
    this.bossHp = { current: blueprint.baseStats.maxHp, max: blueprint.baseStats.maxHp }
    const weaponEnergyMax = blueprint.weaponReward?.maxEnergy ?? this.weaponEnergy.max
    this.weaponEnergy = { current: weaponEnergyMax, max: weaponEnergyMax }

    this.bossLabel = this.add
      .text(6, 6, `${blueprint.codename} • ${blueprint.element}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ad'
      })
      .setScrollFactor(0)

    this.weaponLabel = this.add
      .text(6, 18, '', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ad'
      })
      .setScrollFactor(0)

    this.phaseLabel = this.add
      .text(width - 6, 6, 'Phase: --', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ad',
        align: 'right'
      })
      .setScrollFactor(0)
      .setOrigin(1, 0)

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

    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      maxSize: 50,
      runChildUpdate: true,
      allowGravity: false,
      collideWorldBounds: true
    })

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

    this.physics.add.collider(this.player, ground)
    this.physics.add.collider(this.player, platform)
    this.physics.add.collider(this.enemies, ground)
    this.physics.add.collider(this.enemies, platform)

    this.physics.add.overlap(this.player, this.hazards, this.onPlayerDamaged, undefined, this)
    this.physics.add.overlap(this.player, this.enemies, this.onPlayerDamaged, undefined, this)
    this.physics.add.overlap(this.bullets, this.enemies, this.onBulletHitsEnemy, undefined, this)

    this.physics.add.collider(this.bullets, ground, this.recycleBullet, undefined, this)
    this.physics.add.collider(this.bullets, platform, this.recycleBullet, undefined, this)
    this.physics.add.overlap(
      this.player,
      this.bullets,
      (p, b) => {
        const bullet = b as Phaser.Physics.Arcade.Sprite
        if (bullet?.data?.get('owner') === 'enemy') {
          const dmg = (bullet.data.get('damage') as number | undefined) ?? 1
          this.applyDamageToPlayer(dmg)
          this.recycleBullet(bullet, p as any)
        }
      },
      undefined,
      this
    )

    this.physics.world.on(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.handleWorldBounds)
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.physics.world.off(Phaser.Physics.Arcade.Events.WORLD_BOUNDS, this.handleWorldBounds)
    })

    this.cursors = this.input.keyboard!.createCursorKeys()
    this.initializeActionKeys()
    this.updateWeaponLabel()

    this.boss = new BossController(this, blueprint, {
      spawn: new Phaser.Math.Vector2(width - 48, height - 40),
      lockIntro: true
    })
    this.initializeHud()
    this.currentPhaseName = this.boss.currentPhase.name
    this.phaseLabel.setText(`Phase: ${this.currentPhaseName}`)

    this.time.delayedCall(1600, () => {
      this.boss?.unlockIntro()
      const phase = this.boss?.currentPhase
      if (phase) {
        this.currentPhaseName = phase.name
        this.phaseLabel.setText(`Phase: ${this.currentPhaseName}`)
      }
    })

    this.events.on('boss-phase-change', (event) => {
      const { phase } = event as { phase: { name: string } }
      this.currentPhaseName = phase.name
      this.phaseLabel.setText(`Phase: ${this.currentPhaseName}`)
    })

    this.events.on('boss-attack', (event) => {
      const { attack } = event as { attack: { name: string } }
      this.phaseLabel.setText(`Phase: ${this.currentPhaseName}\nAction: ${attack.name}`)
    })

    this.events.on('boss-defeated', (event) => {
      const { reward } = event as { reward: { displayName: string } }
      this.phaseLabel.setText(`Victory! Weapon Acquired: ${reward.displayName}`)
    })

    this.cameras.main.startFollow(this.player, false, 0.1, 0.1)
  }

  update(_time: number, delta: number): void {
    if (!this.player || !this.cursors) {
      return
    }

    const pauseState = evaluatePauseState(this.paused, InputActions.isPressedPauseOnce())
    this.setPaused(pauseState.paused)

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
      return
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    const grounded = body.onFloor() || body.blocked.down
    const now = this.time.now
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

    if (this.boss && this.boss.scene) {
      this.boss.update(this.time.now, this.game.loop.delta)
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
    this.hud.setNames('Sentinel ROOK', this.bossName ?? '??')
    this.hud.setLives(this.playerLives)
    this.hud.updatePlayerHp(this.playerHp, this.playerMaxHp)
    this.hud.updateWeapon(this.weaponEnergy.current, this.weaponEnergy.max)
    if (this.bossHp) {
      this.hud.updateBossHp(this.bossHp.current, this.bossHp.max)
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
    }

    if (this.isChargingShot && !shootKey.isDown) {
      const charged = now - this.chargeStartedAt >= 600
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

    const bullet = this.bullets.get(bulletX, bulletY, 'buster_0') as Phaser.Physics.Arcade.Sprite | undefined
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
    bullet.data.set('damage', charged ? 2 : 1)
    bullet.setPosition(bulletX, bulletY)
    bullet.setVelocityX((charged ? 360 : 260) * this.facing)
    bullet.play('buster-fly')
    bullet.setScale(charged ? 1.2 : 1)
  }

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
    const anyBullet = bullet as any
    if (typeof anyBullet.disableBody === 'function') {
      anyBullet.disableBody(true, true)
    } else {
      this.bullets.killAndHide(bullet)
      const body = bullet.body as Phaser.Physics.Arcade.Body
      body.enable = false
    }

    if (typeof (bullet as any).setVelocity === 'function') {
      ;(bullet as any).setVelocity(0, 0)
    } else if (bullet.body && typeof (bullet.body as any).setVelocity === 'function') {
      ;(bullet.body as Phaser.Physics.Arcade.Body).setVelocity(0, 0)
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
    this.weaponLabel.setText(`Weapon: ${this.weapons[this.currentWeaponIndex]}`)
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
    this.add
      .text(this.scale.width / 2, this.scale.height / 2, 'GAME OVER', { color: '#fff' })
      .setOrigin(0.5)
      .setScrollFactor(0)
  }
}
