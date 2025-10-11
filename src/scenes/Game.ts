import Phaser from 'phaser'
import { BossController } from '../bosses/BossController'
import { BossId } from '../bosses/types'
import { getBossById } from '../bosses/roster'
import { DEBUG_UI } from '../config/debug'
import { inputActions } from '../input/InputActions'
import { DebugOverlay } from '../ui/DebugOverlay'
import { JumpController } from './game/JumpController'

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

  private readonly handleWorldBounds = (body: Phaser.Physics.Arcade.Body) => {
    const sprite = body.gameObject as Phaser.Physics.Arcade.Sprite | null
    if (!sprite) {
      return
    }
    if (this.bullets && this.bullets.contains(sprite)) {
      this.recycleBullet(sprite)
    }
  }

  constructor() {
    super('Game')
  }

  create(data: GameData): void {
    const blueprint = getBossById(data.bossId)
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#0e1622')

    if (this.input.keyboard) {
      inputActions.initialize(this.input.keyboard)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => inputActions.release(this.input.keyboard!))
    }

    if (DEBUG_UI) {
      this.debugOverlay = new DebugOverlay(this)
      this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.debugOverlay?.destroy())
    }

    this.jumpController.reset()

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

    this.bullets = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite })
    this.bullets.defaults.set('allowGravity', false)
    this.bullets.defaults.set('collideWorldBounds', true)

    this.hazards = this.physics.add.staticGroup()
    this.hazards.create(120, height - 22, 'hazard_spikes').refreshBody()
    this.hazards.create(260, height - 22, 'hazard_spikes').refreshBody()

    this.enemies = this.physics.add.group({ classType: Phaser.Physics.Arcade.Sprite })
    const dummy = this.enemies.create(width - 60, height - 25, 'dummy_idle_0') as Phaser.Physics.Arcade.Sprite
    dummy.setData('health', 3)
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

    this.physics.add.collider(
      this.bullets,
      ground,
      (bullet) => this.recycleBullet(bullet as Phaser.Physics.Arcade.Sprite)
    )
    this.physics.add.collider(
      this.bullets,
      platform,
      (bullet) => this.recycleBullet(bullet as Phaser.Physics.Arcade.Sprite)
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

    if (this.input.keyboard) {
      inputActions.updateFrameClock(this.game.loop.now)
    }

    if (inputActions.isPressed('toggleDebug')) {
      this.debugOverlay?.toggle()
    }

    const body = this.player.body as Phaser.Physics.Arcade.Body
    const grounded = body.blocked.down || body.touching.down || body.onFloor()
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
      const wantsJump = inputActions.isDown('jump')
      if (this.jumpController.update(this.player, wantsJump, grounded)) {
        jumpTriggered = true
      } else if (grounded && this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
        this.player.setVelocityY(JUMP_VELOCITY)
        this.jumpController.reset()
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

    if (DEBUG_UI) {
      const snapshot = inputActions.getSnapshot()
      this.debugOverlay?.update({
        scene: this.scene.key,
        lastKey: snapshot.lastKey,
        transition: null,
        confirmHint: 'Enter / NumpadEnter (menus)',
        jumpHint: 'Space',
        paused: false
      })
    }
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

    bullet.enableBody(true, bulletX, bulletY, true, true)
    bullet.setActive(true)
    bullet.setVisible(true)
    bullet.setDepth(2)
    bullet.play('buster-fly')
    bullet.setScale(charged ? 1.2 : 1)
    bullet.body.reset(bulletX, bulletY)
    bullet.body.allowGravity = false
    bullet.body.setCollideWorldBounds(true)
    ;(bullet.body as Phaser.Physics.Arcade.Body).onWorldBounds = true
    bullet.setVelocityX((charged ? 360 : 260) * this.facing)
    bullet.setData('power', charged ? 2 : 1)
  }

  private recycleBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
    bullet.disableBody(true, true)
    bullet.setScale(1)
    bullet.setData('power', 1)
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
        const current = (enemy.getData('health') as number) ?? 0
        const remaining = current - 2
        enemy.setData('health', remaining)
        if (remaining <= 0) {
          this.handleEnemyDefeat(enemy)
        } else {
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
    this.recycleBullet(bullet)

    const power = (bullet.getData('power') as number) ?? 1
    const current = (enemy.getData('health') as number) ?? 0
    const remaining = current - power
    enemy.setData('health', remaining)

    if (remaining <= 0) {
      this.handleEnemyDefeat(enemy)
    } else {
      this.flashEnemy(enemy)
    }
  }

  private handleEnemyDefeat(enemy: Phaser.Physics.Arcade.Sprite): void {
    const { x, y } = enemy
    enemy.disableBody(true, true)
    const explosion = this.add.sprite(x, y - enemy.displayHeight / 2, 'explosion_0')
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
}
