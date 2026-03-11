import Phaser from 'phaser'
import { EnemyEntity } from './EnemyEntity'

export class EnemyDebugOverlay {
  private readonly scene: Phaser.Scene
  private readonly graphics: Phaser.GameObjects.Graphics
  private readonly labels = new Map<string, Phaser.GameObjects.Text>()

  constructor(scene: Phaser.Scene) {
    this.scene = scene
    this.graphics = scene.add.graphics().setDepth(11000)
  }

  update(entities: EnemyEntity[]): void {
    this.graphics.clear()

    entities.forEach((entity) => {
      const sprite = entity.sprite
      if (!sprite.active) {
        return
      }

      const body = sprite.body as Phaser.Physics.Arcade.Body | undefined
      if (body) {
        this.graphics.lineStyle(1, 0xffcc66, 1)
        this.graphics.strokeRect(body.x, body.y, body.width, body.height)
      }

      this.graphics.lineStyle(1, 0x55ccff, 0.45)
      this.graphics.strokeCircle(sprite.x, sprite.y, entity.definition.ai.sightRange)
      this.graphics.lineStyle(1, 0xff6677, 0.3)
      this.graphics.strokeCircle(sprite.x, sprite.y, entity.definition.ai.aggroRange)
      this.graphics.lineStyle(1, 0x7de48a, 0.25)
      this.graphics.strokeCircle(entity.spawnPosition.x, entity.spawnPosition.y, entity.definition.ai.leashRange)

      const activeHitbox = entity.combat.getActiveHitboxRect(entity.facing)
      if (activeHitbox) {
        this.graphics.lineStyle(1, 0xff4d4d, 1)
        this.graphics.strokeRect(activeHitbox.x, activeHitbox.y, activeHitbox.width, activeHitbox.height)
      }

      let label = this.labels.get(entity.id)
      if (!label) {
        label = this.scene.add
          .text(sprite.x, sprite.y - 20, '', {
            fontFamily: 'monospace',
            fontSize: '9px',
            color: '#e0f2ff',
            backgroundColor: '#0c1730aa',
            padding: { x: 2, y: 1 }
          })
          .setDepth(11001)
        this.labels.set(entity.id, label)
      }
      label.setPosition(sprite.x - 16, sprite.y - 22)
      label.setText(`${entity.typeKey}\n${entity.state}\nHP:${entity.combat.currentHp}`)
      label.setVisible(true)
    })

    for (const [id, label] of this.labels.entries()) {
      const stillActive = entities.some((entity) => entity.id === id && entity.sprite.active)
      if (!stillActive) {
        label.setVisible(false)
      }
    }
  }

  destroy(): void {
    this.graphics.destroy()
    this.labels.forEach((label) => label.destroy())
    this.labels.clear()
  }
}
