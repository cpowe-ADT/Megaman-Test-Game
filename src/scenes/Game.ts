import Phaser from 'phaser'
import { BossController } from '../bosses/BossController'
import { BossId } from '../bosses/types'
import { getBossById } from '../bosses/roster'

interface GameData {
  bossId: BossId
}

export class Game extends Phaser.Scene {
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys
  private player!: Phaser.Physics.Arcade.Sprite
  private boss!: BossController
  private bossLabel!: Phaser.GameObjects.Text
  private phaseLabel!: Phaser.GameObjects.Text
  private currentPhaseName = 'Intro Lock'

  constructor() {
    super('Game')
  }

  create(data: GameData): void {
    const blueprint = getBossById(data.bossId)
    const { width, height } = this.scale
    this.cameras.main.setBackgroundColor('#0e1622')

    this.bossLabel = this.add
      .text(6, 6, `${blueprint.codename} • ${blueprint.element}`, {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#9ad'
      })
      .setScrollFactor(0)

    this.phaseLabel = this.add
      .text(6, 18, 'Phase: Intro Lock', {
        fontFamily: 'monospace',
        fontSize: '10px',
        color: '#7fa'
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

    this.boss = new BossController(this, blueprint, {
      spawn: new Phaser.Math.Vector2(width - 48, height - 40),
      lockIntro: true
    })

    this.time.delayedCall(1600, () => {
      this.boss.unlockIntro()
      const phase = this.boss.currentPhase
      this.currentPhaseName = phase.name
      this.phaseLabel.setText(`Phase: ${this.currentPhaseName}`)
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

  update(): void {
    const body = this.player.body as Phaser.Physics.Arcade.Body
    const movingLeft = this.cursors.left?.isDown
    const movingRight = this.cursors.right?.isDown

    this.registry.set('player_x', this.player.x)

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

    if (this.boss && this.boss.scene) {
      this.boss.update(this.time.now, this.game.loop.delta)
    }
  }
}
