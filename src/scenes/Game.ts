import Phaser from 'phaser'

interface GameData {
  boss: string
}

type PlayerAnimationKey =
  | 'player-idle'
  | 'player-run'
  | 'player-jump'
  | 'player-fall'
  | 'player-shoot'
  | 'player-shoot-air'
  | 'player-slide'
  | 'player-hurt'

export class Game extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite
  private bullets!: Phaser.Physics.Arcade.Group
  private hazards!: Phaser.Physics.Arcade.StaticGroup
  private enemies!: Phaser.Physics.Arcade.Group
  private jumpKey!: Phaser.Input.Keyboard.Key
  private shootKey!: Phaser.Input.Keyboard.Key
  private altShootKey!: Phaser.Input.Keyboard.Key
  private slideKey!: Phaser.Input.Keyboard.Key
  private facing: 1 | -1 = 1
  private nextShotTime = 0
  private shootingUntil = 0
  private slideUntil = 0
  private hurtUntil = 0
  private invulnerableUntil = 0
  private usingSlideHitbox = false
  private currentAnimation: PlayerAnimationKey = 'player-idle'
  private readonly handleWorldBounds = (body: Phaser.Physics.Arcade.Body) => {
    const sprite = body.gameObject as Phaser.GameObjects.Sprite | null
    if (!sprite || sprite.getData('type') !== 'bullet') {
      return
    }
    this.recycleBullet(sprite as Phaser.Physics.Arcade.Sprite)
  }

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

    const instructions = [
      'Arrows move • Up/Z jump',
      'X or Space shoot • C slide',
      'Avoid spikes & training bot!'
    ].join('\n')

    this.add
      .text(width - 8, 8, instructions, {
        fontFamily: 'monospace',
        fontSize: '8px',
        color: '#9ad',
        align: 'right'
      })
      .setOrigin(1, 0)
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
    this.jumpKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.Z)
    this.shootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.X)
    this.altShootKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE)
    this.slideKey = this.input.keyboard!.addKey(Phaser.Input.Keyboard.KeyCodes.C)

    this.cameras.main.startFollow(this.player, false, 0.1, 0.1)
  }

  update(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const now = this.time.now
    const onGround = body.blocked.down
    const hurt = now < this.hurtUntil
    const sliding = now < this.slideUntil

    if (hurt) {
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

    const shootPressed =
      Phaser.Input.Keyboard.JustDown(this.shootKey) || Phaser.Input.Keyboard.JustDown(this.altShootKey)

    if (shootPressed) {
      this.fireBuster()
    }

    if (Phaser.Input.Keyboard.JustDown(this.slideKey) && onGround && now >= this.slideUntil) {
      this.startSlide()
    }

    const shooting = now < this.shootingUntil
    let animation: PlayerAnimationKey = 'player-idle'

    if (sliding) {
      animation = 'player-slide'
    } else if (!onGround) {
      animation = shooting ? 'player-shoot-air' : body.velocity.y < 0 ? 'player-jump' : 'player-fall'
    } else if (shooting) {
      animation = 'player-shoot'
    } else if (Math.abs(body.velocity.x) > 45) {
      animation = 'player-run'
    }

    this.setPlayerAnimation(animation)
  }

  private fireBuster(): void {
    const now = this.time.now
    if (now < this.nextShotTime || now < this.hurtUntil) {
      return
    }

    const spawnX = this.player.x + this.facing * 10
    const spawnY = this.player.y - 4
    const bullet = this.bullets.get(spawnX, spawnY, 'buster_0') as Phaser.Physics.Arcade.Sprite | null

    if (!bullet) {
      return
    }

    bullet.setActive(true)
    bullet.setVisible(true)
    bullet.body.enable = true
    bullet.body.allowGravity = false
    bullet.body.onWorldBounds = true
    bullet.setVelocity(this.facing * 320, 0)
    bullet.setData('type', 'bullet')
    bullet.setSize(6, 6)
    bullet.setOffset(0, 0)
    bullet.play('buster-fly')
    this.shootingUntil = now + 200
    this.nextShotTime = now + 180
  }

  private recycleBullet(bullet: Phaser.Physics.Arcade.Sprite): void {
    bullet.body.stop()
    bullet.body.enable = false
    bullet.setActive(false)
    bullet.setVisible(false)
    this.bullets.killAndHide(bullet)
  }

  private onBulletHitsEnemy(
    bulletObj: Phaser.GameObjects.GameObject,
    enemyObj: Phaser.GameObjects.GameObject
  ): void {
    const bullet = bulletObj as Phaser.Physics.Arcade.Sprite
    const enemy = enemyObj as Phaser.Physics.Arcade.Sprite
    this.recycleBullet(bullet)

    const health = (enemy.getData('health') as number | undefined) ?? 1
    const nextHealth = health - 1
    enemy.setData('health', nextHealth)
    enemy.setTintFill(0xffffff)
    this.time.delayedCall(80, () => {
      if (enemy.active) {
        enemy.clearTint()
      }
    })

    if (nextHealth <= 0) {
      enemy.body.enable = false
      enemy.play('dummy-explode')
      this.time.delayedCall(260, () => enemy.destroy())
    }
  }

  private onPlayerDamaged(
    playerObj: Phaser.GameObjects.GameObject,
    sourceObj: Phaser.GameObjects.GameObject
  ): void {
    const now = this.time.now
    if (now < this.invulnerableUntil) {
      return
    }

    this.invulnerableUntil = now + 1000
    this.hurtUntil = now + 400
    this.slideUntil = 0
    this.resetPlayerHitbox(true)

    const source = sourceObj as Phaser.GameObjects.Sprite | undefined
    const direction = source ? Math.sign(this.player.x - source.x) || 1 : -this.facing
    this.facing = direction >= 0 ? 1 : -1
    this.player.setVelocity(direction * 160, -220)

    this.player.setTintFill(0xffffff)
    this.time.delayedCall(100, () => this.player.clearTint())

    this.tweens.add({
      targets: this.player,
      alpha: 0.3,
      duration: 90,
      yoyo: true,
      repeat: 6,
      onComplete: () => this.player.setAlpha(1)
    })
  }

  private startSlide(): void {
    const now = this.time.now
    if (now < this.hurtUntil) {
      return
    }

    this.slideUntil = now + 320
    this.shootingUntil = this.slideUntil
    this.applySlideHitbox()
    this.player.setVelocity(this.facing * 260, 0)
  }

  private setPlayerAnimation(key: PlayerAnimationKey): void {
    if (this.currentAnimation === key) {
      return
    }
    this.currentAnimation = key
    this.player.play(key, true)
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

  private resetPlayerHitbox(force = false): void {
    if (!force && !this.usingSlideHitbox) {
      return
    }
    const body = this.player.body as Phaser.Physics.Arcade.Body
    body.setSize(10, 16)
    body.setOffset(3, 2)
    this.usingSlideHitbox = false
  }
}
