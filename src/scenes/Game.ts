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

    this.player = this.physics.add.sprite(40, 40, 'player_idle')
    this.player.setCollideWorldBounds(true)
    this.player.setDragX(800)
    this.player.setMaxVelocity(200, 500)
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body
    playerBody.setSize(10, 14)
    playerBody.setOffset(1, 0)

    this.physics.add.collider(this.player, ground)
    this.physics.add.collider(this.player, platform)

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
    }

    const isMoving = Math.abs(body.velocity.x) > 20
    this.player.setTexture(isMoving ? 'player_run' : 'player_idle')

    const jumpKey = this.cursors.up
    const onGround = body.blocked.down
    if (onGround && jumpKey && Phaser.Input.Keyboard.JustDown(jumpKey)) {
      this.player.setVelocityY(-230)
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
