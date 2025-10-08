import Phaser from 'phaser'

interface GameData {
  boss: string
}

type ActionKeyMap = {
  dash: Phaser.Input.Keyboard.Key
  shoot: Phaser.Input.Keyboard.Key
  saber: Phaser.Input.Keyboard.Key
  cycleForward: Phaser.Input.Keyboard.Key
  shoulderPrev: Phaser.Input.Keyboard.Key
  shoulderNext: Phaser.Input.Keyboard.Key
  jumpAlt: Phaser.Input.Keyboard.Key
  modifier: Phaser.Input.Keyboard.Key
}

export class Game extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite
  private actionKeys!: ActionKeyMap
  private bullets!: Phaser.Physics.Arcade.Group
  private weaponLabel!: Phaser.GameObjects.Text
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

  constructor() {
    super('Game')
  }

  create(data: GameData): void {
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#0e1622')

    this.add
      .text(6, 6, `Boss: ${data.boss}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ad'
      })
      .setScrollFactor(0)

    this.weaponLabel = this.add
      .text(6, 18, `Weapon: ${this.weapons[this.currentWeaponIndex]}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ad'
      })
      .setScrollFactor(0)

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
    this.actionKeys = this.input.keyboard!.addKeys({
      dash: Phaser.Input.Keyboard.KeyCodes.Z,
      shoot: Phaser.Input.Keyboard.KeyCodes.X,
      saber: Phaser.Input.Keyboard.KeyCodes.C,
      cycleForward: Phaser.Input.Keyboard.KeyCodes.S,
      shoulderPrev: Phaser.Input.Keyboard.KeyCodes.L,
      shoulderNext: Phaser.Input.Keyboard.KeyCodes.R,
      jumpAlt: Phaser.Input.Keyboard.KeyCodes.A,
      modifier: Phaser.Input.Keyboard.KeyCodes.SHIFT
    }) as ActionKeyMap

    this.bullets = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Image,
      maxSize: 12,
      allowGravity: false
    })

    this.cameras.main.startFollow(this.player, false, 0.1, 0.1)
  }

  update(_time: number, delta: number): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body

    if (this.dashCooldownTimer > 0) {
      this.dashCooldownTimer = Math.max(0, this.dashCooldownTimer - delta)
    }

    if (this.dashActive) {
      this.dashTimer = Math.max(0, this.dashTimer - delta)
      if (this.dashTimer === 0) {
        this.dashActive = false
        this.player.setDragX(800)
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

    const movingLeft = this.cursors.left?.isDown
    const movingRight = this.cursors.right?.isDown

    if (!this.dashActive) {
      if (movingLeft) {
        this.player.setAccelerationX(-600)
        this.player.setFlipX(true)
      } else if (movingRight) {
        this.player.setAccelerationX(600)
        this.player.setFlipX(false)
      } else {
        this.player.setAccelerationX(0)
      }
    } else {
      this.player.setAccelerationX(0)
      this.setPlayerAnimation('player-hurt')
      this.player.setFlipX(this.facing === -1)
      return
    }

    if (sliding) {
      this.applySlideHitbox()
      this.player.setAccelerationX(0)
      const slideSpeed = 260 * this.facing
      if (onGround) {
        this.player.setVelocityX(slideSpeed)
      }
    } else {
      const movingLeft = this.cursors.left?.isDown
      const movingRight = this.cursors.right?.isDown

      if (movingLeft && !movingRight) {
        this.player.setAccelerationX(-700)
        this.facing = -1
      } else if (movingRight && !movingLeft) {
        this.player.setAccelerationX(700)
        this.facing = 1
      } else {
        this.player.setAccelerationX(0)
      }

      if (this.usingSlideHitbox) {
        this.resetPlayerHitbox()
      }
    }

    this.player.setFlipX(this.facing === -1)

    const jumpPressed =
      (this.cursors.up && Phaser.Input.Keyboard.JustDown(this.cursors.up)) ||
      Phaser.Input.Keyboard.JustDown(this.jumpKey)

    if (jumpPressed && onGround && now >= this.slideUntil) {
      this.player.setVelocityY(-260)
    }

    if (onGround && Phaser.Input.Keyboard.JustDown(this.actionKeys.jumpAlt)) {
      this.player.setVelocityY(-230)
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.dash)) {
      this.tryDash()
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.shoot)) {
      this.startCharge()
    }

    if (Phaser.Input.Keyboard.JustUp(this.actionKeys.shoot) && this.isChargingShot) {
      this.releaseShot()
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.saber)) {
      this.startSaberCombo()
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.cycleForward)) {
      if (this.actionKeys.modifier.isDown) {
        this.cycleWeapon(-1)
      } else {
        this.cycleWeapon(1)
      }
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.shoulderNext)) {
      this.cycleWeapon(1)
    }

    if (Phaser.Input.Keyboard.JustDown(this.actionKeys.shoulderPrev)) {
      this.cycleWeapon(-1)
    }

    if (this.isChargingShot && this.actionKeys.shoot.isDown) {
      this.updatePlayerTint()
    }

    this.recycleBullets()
  }

  private tryDash(): void {
    if (this.dashCooldownTimer > 0 || this.dashActive) {
      return
    }

    const direction = this.player.flipX ? -1 : 1
    this.player.setAccelerationX(0)
    this.player.setDragX(0)
    this.player.setVelocityX(direction * 280)

    this.dashActive = true
    this.dashTimer = this.dashDuration
    this.dashCooldownTimer = this.dashDuration + this.dashCooldown
    this.updatePlayerTint()
  }

  private startCharge(): void {
    this.isChargingShot = true
    this.chargeStartedAt = this.time.now
    this.updatePlayerTint()
  }

  private releaseShot(): void {
    const chargeTime = this.time.now - this.chargeStartedAt
    const chargeLevel = chargeTime > 1200 ? 2 : chargeTime > 450 ? 1 : 0
    const speed = [260, 320, 380][chargeLevel]
    const scale = [1, 1.5, 2][chargeLevel]
    const tint = [0xffffff, 0xa0d9ff, 0xfff099][chargeLevel]
    const offsetX = this.player.flipX ? -8 : 8

    const bullet = this.bullets.get(
      this.player.x + offsetX,
      this.player.y - 2,
      'pixel'
    ) as Phaser.Physics.Arcade.Image | null

    if (bullet) {
      bullet.setActive(true)
      bullet.setVisible(true)
      bullet.setScale(scale)
      bullet.setTint(tint)
      const bulletBody = bullet.body as Phaser.Physics.Arcade.Body
      bulletBody.reset(this.player.x + offsetX, this.player.y - 2)
      bullet.setVelocityX(this.player.flipX ? -speed : speed)
    }

    this.isChargingShot = false
    this.updatePlayerTint()
  }

  private startSaberCombo(): void {
    this.saberComboStep = (this.saberComboStep % 4) + 1
    this.saberComboTimer = 240
    this.updatePlayerTint()
  }

  private cycleWeapon(direction: 1 | -1): void {
    const total = this.weapons.length
    this.currentWeaponIndex = (this.currentWeaponIndex + direction + total) % total
    this.weaponLabel.setText(`Weapon: ${this.weapons[this.currentWeaponIndex]}`)
  }

  private updatePlayerTint(): void {
    if (!this.player) {
      return
    }

    if (this.dashActive) {
      this.player.setTint(0x9adfff)
      return
    }

    if (this.saberComboStep > 0) {
      const colors = [0xfff6a0, 0xffc8a0, 0xff9a9a, 0xffffff]
      this.player.setTint(colors[this.saberComboStep - 1])
      return
    }

    if (this.isChargingShot) {
      const chargeTime = this.time.now - this.chargeStartedAt
      const tint = chargeTime > 1200 ? 0xfff099 : chargeTime > 450 ? 0xa0d9ff : 0xffffff
      this.player.setTint(tint)
      return
    }

    this.player.clearTint()
  }

  private recycleBullets(): void {
    const camera = this.cameras.main
    const { left, right, top, bottom } = camera.worldView

    this.bullets.children.each((obj) => {
      const bullet = obj as Phaser.Physics.Arcade.Image
      if (!bullet.active) {
        return
      }

      const offscreen =
        bullet.x < left - 32 ||
        bullet.x > right + 32 ||
        bullet.y < top - 32 ||
        bullet.y > bottom + 32

      if (offscreen) {
        bullet.setActive(false)
        bullet.setVisible(false)
      }
    })
  }
}
