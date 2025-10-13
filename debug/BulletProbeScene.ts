import Phaser from 'phaser'
import {
  ENEMY_BULLET_TEXTURE_KEY,
  ensureBulletPlaceholder,
  onEnemyBulletSpawn,
  wrapEnemyProjectileFactory,
  BulletSpawnEvent
} from '../src/projectiles/diagnostics/EnemyBulletTap'

export class BulletProbeScene extends Phaser.Scene {
  private group!: Phaser.Physics.Arcade.Group

  constructor() {
    super({ key: 'BulletProbeScene' })
  }

  create(): void {
    this.cameras.main.setBackgroundColor(0x05070a)
    this.scale.setGameSize(320, 240)

    this.group = this.physics.add.group({
      classType: Phaser.Physics.Arcade.Sprite,
      allowGravity: false,
      maxSize: 16,
      runChildUpdate: false,
      defaultKey: ENEMY_BULLET_TEXTURE_KEY
    })

    ensureBulletPlaceholder(this)

    const suspects = new Set<string>()
    let shots = 0
    let sawBody = false

    const handleSpawn = (event: BulletSpawnEvent) => {
      shots += 1
      sawBody = sawBody || event.hadBody
      if (!event.hadBody) {
        suspects.add('no_body')
      }
      if (!event.active || !event.visible) {
        suspects.add('inactive_sprite')
      }
    }

    onEnemyBulletSpawn.on('spawn', handleSpawn)

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      onEnemyBulletSpawn.off('spawn', handleSpawn)
    })

    const factory = (x: number, y: number) => {
      const sprite = this.group.get(x, y, ENEMY_BULLET_TEXTURE_KEY) as Phaser.Physics.Arcade.Sprite | null
      if (!sprite) {
        suspects.add('group_full')
        return null
      }
      this.group.add(sprite, true)
      this.physics.world.enable(sprite)
      sprite.setActive(true).setVisible(true)
      const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        body.setAllowGravity(false)
      }
      sprite.setVelocityX(120)
      return sprite
    }

    const wrappedFactory = wrapEnemyProjectileFactory(factory, this, this.group)
    wrappedFactory(100, 100)

    this.time.delayedCall(750, () => {
      const active = this.group.countActive(true)
      const passed = shots > 0 && active >= 1 && sawBody

      if (shots === 0) {
        suspects.add('factory_not_called')
      }
      if (!this.textures.exists(ENEMY_BULLET_TEXTURE_KEY)) {
        suspects.add('missing_texture')
      }
      const result = {
        passed,
        shots,
        suspects: Array.from(suspects)
      }
      console.log(`[BULLET_PROBE] passed=${passed} shots=${shots} active=${active} hasBody=${sawBody}`)
      console.log(`BULLET_PROBE_RESULT=${JSON.stringify(result)}`)

      this.time.delayedCall(60, () => this.scene.stop())
    })
  }
}

function boot(): void {
  const config: Phaser.Types.Core.GameConfig = {
    type: Phaser.AUTO,
    width: 320,
    height: 240,
    parent: 'app',
    physics: {
      default: 'arcade',
      arcade: {
        gravity: { x: 0, y: 0 },
        debug: false
      }
    },
    scene: [BulletProbeScene]
  }

  // eslint-disable-next-line no-new
  new Phaser.Game(config)
}

if (typeof window !== 'undefined') {
  window.addEventListener('load', () => boot())
}
