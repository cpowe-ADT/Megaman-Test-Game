import Phaser from 'phaser'

interface GameData {
  boss: string
}

export class Game extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite

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
    this.cameras.main.startFollow(this.player, false, 0.1, 0.1)
  }

  update(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const movingLeft = this.cursors.left?.isDown
    const movingRight = this.cursors.right?.isDown

    if (movingLeft) {
      this.player.setAccelerationX(-600)
      this.player.setFlipX(true)
    } else if (movingRight) {
      this.player.setAccelerationX(600)
      this.player.setFlipX(false)
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
  }
}
